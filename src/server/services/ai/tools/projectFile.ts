/**
 * 项目文件操作工具
 *
 * 提供项目文件读取、写入和文件树获取功能
 * Sprint 14: 项目代码操作
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { glob } from 'glob'

// ==================== 安全限制配置 ====================

/**
 * 允许访问的路径前缀（白名单）
 */
const ALLOWED_PATHS = [
  'src/',
  'public/',
  'package.json',
  'tsconfig.json',
  '.env.example',
  'README.md',
  'docs/',
]

/**
 * 禁止访问的路径模式（黑名单）
 */
const BLOCKED_PATTERNS = [
  '.env',
  '.env.*',
  'node_modules/',
  '.git/',
  '*.key',
  '*.pem',
  '*.p12',
  '*.pfx',
  '.npmrc',
  '.yarnrc',
  'credentials*',
  'secrets*',
  '*password*',
  '*secret*',
]

/**
 * 项目根目录（运行时设置）
 */
let projectRoot: string = process.cwd()

/**
 * 设置项目根目录
 */
export function setProjectRoot(root: string): void {
  projectRoot = root
}

/**
 * 获取项目根目录
 */
export function getProjectRoot(): string {
  return projectRoot
}

// ==================== 路径安全校验 ====================

/**
 * 路径安全错误
 */
export class PathSecurityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PathSecurityError'
  }
}

/**
 * 规范化路径，去除 .. 等危险字符
 */
function normalizePath(inputPath: string): string {
  // 移除开头的斜杠
  let normalized = inputPath.replace(/^\/+/, '')

  // 解析路径，去除 .. 和 .
  const parts = normalized.split('/').filter(Boolean)
  const result: string[] = []

  for (const part of parts) {
    if (part === '..') {
      // 不允许向上遍历
      throw new PathSecurityError('路径不允许包含 ".."')
    } else if (part !== '.') {
      result.push(part)
    }
  }

  return result.join('/')
}

/**
 * 检查路径是否匹配模式
 */
function matchesPattern(filePath: string, pattern: string): boolean {
  // 简单的通配符匹配
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')

  return new RegExp(`^${regexPattern}$`, 'i').test(filePath)
}

/**
 * 验证路径是否安全
 */
export function validatePath(inputPath: string): string {
  const normalized = normalizePath(inputPath)

  // 检查是否在黑名单中
  for (const pattern of BLOCKED_PATTERNS) {
    if (matchesPattern(normalized, pattern) || normalized.includes(pattern.replace('*', ''))) {
      throw new PathSecurityError(`禁止访问路径: ${inputPath}`)
    }
  }

  // 检查是否在白名单中
  const isAllowed = ALLOWED_PATHS.some((allowed) => {
    if (allowed.endsWith('/')) {
      return normalized.startsWith(allowed)
    }
    return normalized === allowed
  })

  if (!isAllowed) {
    throw new PathSecurityError(`路径不在允许范围内: ${inputPath}`)
  }

  return normalized
}

/**
 * 解析完整路径
 */
export function resolvePath(inputPath: string): string {
  const normalized = validatePath(inputPath)
  return path.join(projectRoot, normalized)
}

// ==================== 文件读取 ====================

/**
 * 文件读取参数
 */
export interface ReadFileParams {
  path: string
  lineStart?: number
  lineEnd?: number
}

/**
 * 文件读取结果
 */
export interface ReadFileResult {
  content: string
  totalLines: number
  lineStart?: number
  lineEnd?: number
}

/**
 * 读取项目文件
 */
export async function readProjectFile(params: ReadFileParams): Promise<ReadFileResult> {
  // 1. 路径安全检查
  const fullPath = resolvePath(params.path)

  // 2. 检查文件是否存在
  try {
    const stat = await fs.stat(fullPath)
    if (!stat.isFile()) {
      throw new Error(`路径不是文件: ${params.path}`)
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`文件不存在: ${params.path}`)
    }
    throw err
  }

  // 3. 读取文件内容
  const content = await fs.readFile(fullPath, 'utf-8')
  const lines = content.split('\n')
  const totalLines = lines.length

  // 4. 行范围处理
  if (params.lineStart !== undefined || params.lineEnd !== undefined) {
    const start = Math.max(1, params.lineStart || 1) - 1 // 转为0索引
    const end = Math.min(totalLines, params.lineEnd || totalLines)

    // 添加行号标注
    const selectedLines = lines.slice(start, end).map((line, index) => {
      const lineNum = start + index + 1
      return `${lineNum.toString().padStart(4, ' ')}| ${line}`
    })

    return {
      content: selectedLines.join('\n'),
      totalLines,
      lineStart: start + 1,
      lineEnd: end,
    }
  }

  // 返回完整内容（带行号）
  const numberedLines = lines.map((line, index) => {
    const lineNum = index + 1
    return `${lineNum.toString().padStart(4, ' ')}| ${line}`
  })

  return {
    content: numberedLines.join('\n'),
    totalLines,
  }
}

// ==================== 文件写入 ====================

/**
 * 文件写入参数
 */
export interface WriteFileParams {
  path: string
  content: string
  createBackup?: boolean
}

/**
 * 文件写入结果
 */
export interface WriteFileResult {
  success: boolean
  backupPath?: string
  isNew: boolean
}

/**
 * 创建文件备份
 */
async function createBackup(filePath: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const ext = path.extname(filePath)
  const base = filePath.slice(0, -ext.length)
  const backupPath = `${base}.backup.${timestamp}${ext}`

  await fs.copyFile(filePath, backupPath)
  return backupPath
}

/**
 * 写入项目文件
 *
 * 注意：此操作需要用户确认（Level 2 权限）
 */
export async function writeProjectFile(params: WriteFileParams): Promise<WriteFileResult> {
  // 1. 路径安全检查
  const fullPath = resolvePath(params.path)

  // 2. 检查文件是否已存在
  let isNew = false
  let backupPath: string | undefined

  try {
    await fs.access(fullPath)

    // 文件存在，创建备份（如果需要）
    if (params.createBackup) {
      backupPath = await createBackup(fullPath)
    }
  } catch {
    // 文件不存在
    isNew = true

    // 确保目录存在
    const dir = path.dirname(fullPath)
    await fs.mkdir(dir, { recursive: true })
  }

  // 3. 写入文件
  await fs.writeFile(fullPath, params.content, 'utf-8')

  return {
    success: true,
    backupPath,
    isNew,
  }
}

// ==================== 文件树 ====================

/**
 * 文件节点
 */
export interface FileNode {
  name: string
  type: 'file' | 'directory'
  path: string
  size?: number
  children?: FileNode[]
}

/**
 * 文件树参数
 */
export interface FileTreeParams {
  path?: string
  depth?: number
  exclude?: string[]
}

/**
 * 默认排除的目录
 */
const DEFAULT_EXCLUDES = ['node_modules', '.git', 'dist', 'build', '.cache', 'coverage']

/**
 * 递归构建文件树
 */
async function buildTree(
  dirPath: string,
  relativePath: string,
  currentDepth: number,
  maxDepth: number,
  excludePatterns: string[]
): Promise<FileNode | null> {
  const name = path.basename(dirPath) || '.'
  const stats = await fs.stat(dirPath)

  if (!stats.isDirectory()) {
    return {
      name,
      type: 'file',
      path: relativePath,
      size: stats.size,
    }
  }

  // 检查是否在排除列表中
  if (excludePatterns.some((pattern) => matchesPattern(name, pattern))) {
    return null
  }

  const node: FileNode = {
    name,
    type: 'directory',
    path: relativePath,
  }

  // 检查深度限制
  if (currentDepth >= maxDepth) {
    return node
  }

  // 读取目录内容
  const entries = await fs.readdir(dirPath)
  const children: FileNode[] = []

  for (const entry of entries) {
    // 跳过隐藏文件（除了某些白名单）
    if (entry.startsWith('.') && !['README.md', '.env.example'].includes(entry)) {
      continue
    }

    // 检查是否在排除列表中
    if (excludePatterns.some((pattern) => matchesPattern(entry, pattern))) {
      continue
    }

    const entryPath = path.join(dirPath, entry)
    const entryRelativePath = relativePath ? `${relativePath}/${entry}` : entry

    try {
      const child = await buildTree(
        entryPath,
        entryRelativePath,
        currentDepth + 1,
        maxDepth,
        excludePatterns
      )
      if (child) {
        children.push(child)
      }
    } catch {
      // 跳过无法访问的文件
    }
  }

  // 排序：目录在前，文件在后；同类型按名称排序
  children.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })

  node.children = children
  return node
}

/**
 * 获取项目文件树
 */
export async function getFileTree(params: FileTreeParams = {}): Promise<FileNode> {
  const rootPath = params.path ? path.join(projectRoot, normalizePath(params.path)) : projectRoot
  const maxDepth = params.depth || 3
  const excludePatterns = [...DEFAULT_EXCLUDES, ...(params.exclude || [])]

  // 验证路径安全（如果指定了路径）
  if (params.path) {
    validatePath(params.path)
  }

  const relativePath = params.path ? normalizePath(params.path) : ''
  const tree = await buildTree(rootPath, relativePath, 0, maxDepth, excludePatterns)

  if (!tree) {
    throw new Error(`无法读取目录: ${params.path || '.'}`)
  }

  return tree
}

/**
 * 格式化文件树为字符串（用于 AI 上下文）
 */
export function formatFileTree(node: FileNode, indent = ''): string {
  const lines: string[] = []

  const icon = node.type === 'directory' ? '📁' : '📄'
  const sizeInfo = node.type === 'file' && node.size ? ` (${formatSize(node.size)})` : ''
  lines.push(`${indent}${icon} ${node.name}${sizeInfo}`)

  if (node.children) {
    for (const child of node.children) {
      lines.push(formatFileTree(child, indent + '  '))
    }
  }

  return lines.join('\n')
}

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}
