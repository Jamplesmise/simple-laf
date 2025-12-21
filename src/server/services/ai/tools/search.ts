/**
 * 代码搜索工具
 *
 * 提供项目代码全文搜索功能
 * Sprint 14: 项目代码操作
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { glob } from 'glob'
import { getProjectRoot, validatePath, PathSecurityError } from './projectFile.js'

// ==================== 搜索配置 ====================

/**
 * 最大结果数量
 */
const MAX_RESULTS = 50

/**
 * 上下文行数
 */
const CONTEXT_LINES = 2

/**
 * 默认搜索的文件类型
 */
const DEFAULT_FILE_PATTERNS = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.json', '**/*.md']

/**
 * 排除的目录
 */
const EXCLUDE_PATTERNS = ['node_modules/**', '.git/**', 'dist/**', 'build/**', 'coverage/**']

// ==================== 搜索类型定义 ====================

/**
 * 搜索参数
 */
export interface SearchParams {
  query: string
  filePattern?: string
  caseSensitive?: boolean
  maxResults?: number
  contextLines?: number
}

/**
 * 搜索结果项
 */
export interface SearchResult {
  file: string
  line: number
  column: number
  content: string
  context: {
    before: string[]
    after: string[]
  }
  matchLength: number
}

/**
 * 搜索响应
 */
export interface SearchResponse {
  results: SearchResult[]
  totalMatches: number
  truncated: boolean
  searchTime: number
}

// ==================== 搜索实现 ====================

/**
 * 验证文件路径是否可搜索
 */
function isSearchablePath(filePath: string): boolean {
  try {
    // 检查是否在允许的路径范围内
    validatePath(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * 获取匹配的文件列表
 */
async function getMatchingFiles(filePattern?: string): Promise<string[]> {
  const projectRoot = getProjectRoot()

  // 构建搜索模式
  const patterns = filePattern ? [filePattern] : DEFAULT_FILE_PATTERNS

  // 获取所有匹配的文件
  const files: string[] = []

  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      cwd: projectRoot,
      ignore: EXCLUDE_PATTERNS,
      nodir: true,
      absolute: false,
    })
    files.push(...matches)
  }

  // 去重并过滤不可访问的路径
  const uniqueFiles = [...new Set(files)]
  return uniqueFiles.filter(isSearchablePath)
}

/**
 * 在单个文件中搜索
 */
async function searchInFile(
  filePath: string,
  pattern: RegExp,
  contextLines: number
): Promise<SearchResult[]> {
  const projectRoot = getProjectRoot()
  const fullPath = path.join(projectRoot, filePath)

  try {
    const content = await fs.readFile(fullPath, 'utf-8')
    const lines = content.split('\n')
    const results: SearchResult[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      let match: RegExpExecArray | null

      // 重置正则的lastIndex（全局匹配时需要）
      pattern.lastIndex = 0

      while ((match = pattern.exec(line)) !== null) {
        // 获取上下文行
        const beforeStart = Math.max(0, i - contextLines)
        const afterEnd = Math.min(lines.length, i + contextLines + 1)

        results.push({
          file: filePath,
          line: i + 1,
          column: match.index + 1,
          content: line,
          context: {
            before: lines.slice(beforeStart, i),
            after: lines.slice(i + 1, afterEnd),
          },
          matchLength: match[0].length,
        })

        // 如果不是全局匹配，跳出循环避免无限循环
        if (!pattern.global) break
      }
    }

    return results
  } catch {
    // 文件读取失败，跳过
    return []
  }
}

/**
 * 在项目中搜索代码
 */
export async function searchCode(params: SearchParams): Promise<SearchResponse> {
  const startTime = Date.now()

  // 构建正则表达式
  const flags = params.caseSensitive ? 'g' : 'gi'
  let pattern: RegExp

  try {
    pattern = new RegExp(params.query, flags)
  } catch {
    throw new Error(`无效的正则表达式: ${params.query}`)
  }

  // 获取要搜索的文件
  const files = await getMatchingFiles(params.filePattern)

  // 配置参数
  const maxResults = params.maxResults || MAX_RESULTS
  const contextLines = params.contextLines ?? CONTEXT_LINES

  // 在所有文件中搜索
  const allResults: SearchResult[] = []
  let totalMatches = 0

  for (const file of files) {
    const fileResults = await searchInFile(file, pattern, contextLines)
    totalMatches += fileResults.length
    allResults.push(...fileResults)

    // 达到最大结果数时提前停止
    if (allResults.length >= maxResults) {
      break
    }
  }

  // 限制结果数量
  const truncated = allResults.length > maxResults || totalMatches > allResults.length
  const results = allResults.slice(0, maxResults)

  const searchTime = Date.now() - startTime

  return {
    results,
    totalMatches,
    truncated,
    searchTime,
  }
}

/**
 * 格式化搜索结果为字符串（用于 AI 上下文）
 */
export function formatSearchResults(response: SearchResponse): string {
  const lines: string[] = []

  lines.push(`找到 ${response.totalMatches} 个匹配${response.truncated ? `（显示前 ${response.results.length} 个）` : ''}`)
  lines.push(`搜索用时: ${response.searchTime}ms`)
  lines.push('')

  for (const result of response.results) {
    lines.push(`📄 ${result.file}:${result.line}:${result.column}`)

    // 显示上下文（如果有）
    if (result.context.before.length > 0) {
      for (let i = 0; i < result.context.before.length; i++) {
        const lineNum = result.line - result.context.before.length + i
        lines.push(`   ${lineNum.toString().padStart(4)}│ ${result.context.before[i]}`)
      }
    }

    // 显示匹配行（高亮）
    lines.push(`>> ${result.line.toString().padStart(4)}│ ${result.content}`)

    // 显示下文（如果有）
    if (result.context.after.length > 0) {
      for (let i = 0; i < result.context.after.length; i++) {
        const lineNum = result.line + 1 + i
        lines.push(`   ${lineNum.toString().padStart(4)}│ ${result.context.after[i]}`)
      }
    }

    lines.push('')
  }

  return lines.join('\n')
}

// ==================== 快捷搜索函数 ====================

/**
 * 搜索函数定义
 */
export async function searchFunctionDef(name: string): Promise<SearchResponse> {
  return searchCode({
    query: `(function\\s+${name}|const\\s+${name}\\s*=|export\\s+(default\\s+)?function\\s+${name})`,
    filePattern: '**/*.{ts,tsx,js,jsx}',
  })
}

/**
 * 搜索接口/类型定义
 */
export async function searchTypeDef(name: string): Promise<SearchResponse> {
  return searchCode({
    query: `(interface\\s+${name}|type\\s+${name}\\s*=|class\\s+${name})`,
    filePattern: '**/*.{ts,tsx}',
  })
}

/**
 * 搜索导入语句
 */
export async function searchImports(moduleName: string): Promise<SearchResponse> {
  return searchCode({
    query: `import.*from\\s+['"\`].*${moduleName}.*['"\`]`,
    filePattern: '**/*.{ts,tsx,js,jsx}',
  })
}
