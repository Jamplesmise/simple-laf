import { ObjectId } from 'mongodb'
import type { SimpleGit } from 'simple-git'
import * as fs from 'fs/promises'
import * as path from 'path'
import { getDB } from '../../db.js'
import { getGitConfig } from './config.js'
import { decrypt } from './crypto.js'
import { convertFromLaf } from './converter.js'
import { buildAuthUrl, createGit, sanitizeError, readTsFilesRecursively } from './utils.js'
import type { PullResult, SyncPreview, SyncChange } from './types.js'
import logger from '../../utils/logger.js'

// 从 Git 拉取
export async function pullFromGit(userId: ObjectId): Promise<PullResult> {
  logger.info('[Git Pull] 开始拉取', { userId: userId.toString() })
  const db = getDB()
  const gitConfig = await getGitConfig(userId)

  if (!gitConfig) {
    logger.error('[Git Pull] 未配置 Git 仓库')
    throw new Error('未配置 Git 仓库')
  }

  logger.info('[Git Pull] Git 配置', {
    repoUrl: gitConfig.repoUrl,
    branch: gitConfig.branch,
    functionsPath: gitConfig.functionsPath,
    hasToken: !!gitConfig.token
  })

  const tempDir = `/tmp/git-sync-${userId.toString()}-${Date.now()}`
  const git: SimpleGit = createGit(gitConfig.repoUrl)

  try {
    // 构建认证 URL
    let cloneUrl = gitConfig.repoUrl
    if (gitConfig.token) {
      const token = decrypt(gitConfig.token)
      cloneUrl = buildAuthUrl(gitConfig.repoUrl, token)
      logger.info('[Git Pull] 使用 Token 认证', {
        authUrl: cloneUrl.replace(token, '***TOKEN***')
      })
    } else {
      logger.info('[Git Pull] 无 Token，使用公开访问')
    }

    // 克隆仓库
    logger.info('[Git Pull] 开始克隆仓库', { tempDir, branch: gitConfig.branch })
    try {
      await git.clone(cloneUrl, tempDir, [
        '--config', 'http.version=HTTP/1.1',
        '--branch', gitConfig.branch,
        '--depth', '1',
        '--single-branch'
      ])
      logger.info('[Git Pull] 克隆成功')
    } catch (cloneErr) {
      const sanitized = sanitizeError(cloneErr)
      logger.error('[Git Pull] 克隆失败', sanitized)
      throw new Error(sanitized.message)
    }

    // 读取函数文件（递归读取子目录）
    const functionsDir = path.join(tempDir, gitConfig.functionsPath)
    logger.info('[Git Pull] 读取函数目录', { functionsDir })

    const files = await readTsFilesRecursively(functionsDir)
    if (files.length === 0) {
      logger.warn('[Git Pull] 函数目录为空或不存在')
      throw new Error(`函数目录不存在或为空: ${gitConfig.functionsPath}`)
    }
    logger.info('[Git Pull] 找到函数文件', { count: files.length, files })

    const added: string[] = []
    const updated: string[] = []

    // 获取现有函数，使用 path 作为主键
    const existingFunctions = await db.collection('functions')
      .find({ userId })
      .toArray()
    // 建立 path -> function 映射
    const pathMap = new Map(existingFunctions.map(f => [(f.path as string) || (f.name as string), f]))

    // 处理每个函数文件
    for (const file of files) {
      // file 是相对路径，如 "api/test.ts" 或 "test.ts"
      const funcPath = file.replace('.ts', '')  // 去掉 .ts 后缀，得到完整路径
      const funcName = path.basename(funcPath)  // 提取文件名作为函数名
      const filePath = path.join(functionsDir, file)
      const code = await fs.readFile(filePath, 'utf-8')
      const convertedCode = convertFromLaf(code)

      // 按 path 查找现有函数
      const existing = pathMap.get(funcPath)

      if (existing) {
        // 更新
        await db.collection('functions').updateOne(
          { _id: existing._id },
          {
            $set: {
              code: convertedCode,
              compiled: '', // 需要重新编译
              updatedAt: new Date()
            }
          }
        )
        updated.push(funcPath)
      } else {
        // 新增（使用完整路径）
        await db.collection('functions').insertOne({
          name: funcName,
          code: convertedCode,
          compiled: '',
          path: funcPath,  // 保存完整路径
          userId,
          published: false,
          order: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        added.push(funcPath)
      }
    }

    // 更新同步时间
    await db.collection('git_config').updateOne(
      { userId },
      { $set: { lastSyncAt: new Date() } }
    )

    logger.info('[Git Pull] 拉取完成', { added, updated })
    return { added, updated, deleted: [] }
  } finally {
    // 清理临时目录
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // 忽略清理错误
    }
  }
}

// 预览拉取 - 显示哪些函数会被添加/修改/冲突
export async function previewPull(userId: ObjectId): Promise<SyncPreview> {
  logger.info('[Git PreviewPull] 开始预览拉取', { userId: userId.toString() })
  const db = getDB()
  const gitConfig = await getGitConfig(userId)

  if (!gitConfig) {
    logger.error('[Git PreviewPull] 未配置 Git 仓库')
    throw new Error('未配置 Git 仓库')
  }

  logger.info('[Git PreviewPull] Git 配置', {
    repoUrl: gitConfig.repoUrl,
    branch: gitConfig.branch,
    functionsPath: gitConfig.functionsPath,
    hasToken: !!gitConfig.token
  })

  const tempDir = `/tmp/git-sync-${userId.toString()}-${Date.now()}`
  const git: SimpleGit = createGit(gitConfig.repoUrl)

  try {
    // 构建认证 URL
    let cloneUrl = gitConfig.repoUrl
    if (gitConfig.token) {
      const token = decrypt(gitConfig.token)
      cloneUrl = buildAuthUrl(gitConfig.repoUrl, token)
      logger.info('[Git PreviewPull] 使用 Token 认证', {
        authUrl: cloneUrl.replace(token, '***TOKEN***')
      })
    }

    // 克隆仓库
    logger.info('[Git PreviewPull] 开始克隆', { tempDir, branch: gitConfig.branch })
    try {
      await git.clone(cloneUrl, tempDir, [
        '--config', 'http.version=HTTP/1.1',
        '--branch', gitConfig.branch,
        '--depth', '1',
        '--single-branch'
      ])
      logger.info('[Git PreviewPull] 克隆成功')
    } catch (cloneErr) {
      const sanitized = sanitizeError(cloneErr)
      logger.error('[Git PreviewPull] 克隆失败', sanitized)
      throw new Error(sanitized.message)
    }

    // 读取远程函数文件（递归读取子目录）
    const functionsDir = path.join(tempDir, gitConfig.functionsPath)
    const files = await readTsFilesRecursively(functionsDir)

    if (files.length === 0) {
      throw new Error(`函数目录不存在或为空: ${gitConfig.functionsPath}`)
    }

    // 获取本地函数，使用 path 作为主键
    const localFunctions = await db.collection('functions')
      .find({ userId })
      .toArray()
    const pathMap = new Map(localFunctions.map(f => [(f.path as string) || (f.name as string), f]))

    const changes: SyncChange[] = []
    let hasConflicts = false

    // 检查远程文件
    for (const file of files) {
      // file 是相对路径，如 "api/test.ts" 或 "test.ts"
      const funcPath = file.replace('.ts', '')  // 完整路径
      const funcName = path.basename(funcPath)  // 函数名
      const filePath = path.join(functionsDir, file)
      const remoteCode = await fs.readFile(filePath, 'utf-8')
      const convertedRemoteCode = convertFromLaf(remoteCode)

      // 按 path 查找本地函数
      const local = pathMap.get(funcPath)

      if (!local) {
        // 新增
        changes.push({
          name: funcName,
          path: funcPath,
          status: 'added',
          remoteCode: convertedRemoteCode,
        })
      } else if (local.code !== convertedRemoteCode) {
        // 检查是否有冲突 (本地在上次同步后有修改)
        const lastSync = gitConfig.lastSyncAt
        const localModified = lastSync && new Date(local.updatedAt as Date) > lastSync

        if (localModified) {
          changes.push({
            name: funcName,
            path: funcPath,
            status: 'conflict',
            localCode: local.code as string,
            remoteCode: convertedRemoteCode,
            localUpdatedAt: local.updatedAt as Date,
          })
          hasConflicts = true
        } else {
          changes.push({
            name: funcName,
            path: funcPath,
            status: 'modified',
            localCode: local.code as string,
            remoteCode: convertedRemoteCode,
          })
        }
      }
      // 相同则不显示
    }

    return { changes, hasConflicts }
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // 忽略清理错误
    }
  }
}

// 选择性拉取
export async function selectivePull(
  userId: ObjectId,
  functionPaths: string[]  // 现在传入的是路径而非名称
): Promise<PullResult> {
  const db = getDB()
  const gitConfig = await getGitConfig(userId)

  if (!gitConfig) throw new Error('未配置 Git 仓库')

  const tempDir = `/tmp/git-sync-${userId.toString()}-${Date.now()}`
  const git: SimpleGit = createGit(gitConfig.repoUrl)

  try {
    let cloneUrl = gitConfig.repoUrl
    if (gitConfig.token) {
      const token = decrypt(gitConfig.token)
      cloneUrl = buildAuthUrl(gitConfig.repoUrl, token)
    }

    await git.clone(cloneUrl, tempDir, [
      '--config', 'http.version=HTTP/1.1',
      '--branch', gitConfig.branch,
      '--depth', '1',
      '--single-branch'
    ])

    const functionsDir = path.join(tempDir, gitConfig.functionsPath)
    const added: string[] = []
    const updated: string[] = []

    const existingFunctions = await db.collection('functions')
      .find({ userId })
      .toArray()
    // 建立 path -> function 和 name -> function 两个映射
    const pathMap = new Map(existingFunctions.map(f => [(f.path as string) || (f.name as string), f]))
    const nameMap = new Map(existingFunctions.map(f => [f.name as string, f]))

    // 只处理选中的函数
    for (const funcPath of functionPaths) {
      // 从路径中提取函数名 (路径最后一段)
      const funcName = funcPath.includes('/') ? funcPath.split('/').pop()! : funcPath
      // 使用完整路径读取文件（支持目录结构）
      const filePath = path.join(functionsDir, `${funcPath}.ts`)

      try {
        const code = await fs.readFile(filePath, 'utf-8')
        const convertedCode = convertFromLaf(code)
        // 优先按 path 查找，其次按 name 查找
        const existing = pathMap.get(funcPath) || nameMap.get(funcName)

        if (existing) {
          await db.collection('functions').updateOne(
            { _id: existing._id },
            {
              $set: {
                code: convertedCode,
                compiled: '',
                updatedAt: new Date()
              }
            }
          )
          updated.push(funcPath)
        } else {
          await db.collection('functions').insertOne({
            name: funcName,
            code: convertedCode,
            compiled: '',
            path: funcPath,
            userId,
            published: false,
            order: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          added.push(funcPath)
        }
      } catch {
        // 文件不存在，跳过
      }
    }

    await db.collection('git_config').updateOne(
      { userId },
      { $set: { lastSyncAt: new Date() } }
    )

    return { added, updated, deleted: [] }
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // 忽略
    }
  }
}
