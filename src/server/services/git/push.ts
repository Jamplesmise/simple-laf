import { ObjectId } from 'mongodb'
import { simpleGit, type SimpleGit } from 'simple-git'
import * as fs from 'fs/promises'
import * as path from 'path'
import { getDB } from '../../db.js'
import { getGitConfig } from './config.js'
import { decrypt } from './crypto.js'
import { convertFromLaf, convertToLaf } from './converter.js'
import { buildAuthUrl, createGit, sanitizeError, readTsFilesRecursively } from './utils.js'
import type { SyncPreview, SyncChange } from './types.js'
import logger from '../../utils/logger.js'

// 推送到 Git
export async function pushToGit(
  userId: ObjectId,
  commitMessage: string
): Promise<void> {
  logger.info('[Git Push] 开始推送', { userId: userId.toString() })
  const db = getDB()
  const gitConfig = await getGitConfig(userId)

  if (!gitConfig) {
    logger.error('[Git Push] 未配置 Git 仓库')
    throw new Error('未配置 Git 仓库')
  }

  logger.info('[Git Push] Git 配置', {
    repoUrl: gitConfig.repoUrl,
    branch: gitConfig.branch,
    functionsPath: gitConfig.functionsPath,
    hasToken: !!gitConfig.token
  })

  const tempDir = `/tmp/git-sync-${userId.toString()}-${Date.now()}`

  try {
    // 构建认证 URL
    let cloneUrl = gitConfig.repoUrl
    if (gitConfig.token) {
      const token = decrypt(gitConfig.token)
      cloneUrl = buildAuthUrl(gitConfig.repoUrl, token)
      logger.info('[Git Push] 使用 Token 认证', {
        authUrl: cloneUrl.replace(token, '***TOKEN***')
      })
    } else {
      logger.warn('[Git Push] 无 Token，可能无法推送到私有仓库')
    }

    // 克隆仓库
    logger.info('[Git Push] 开始克隆仓库', { tempDir, branch: gitConfig.branch })
    const git: SimpleGit = createGit(gitConfig.repoUrl)
    try {
      await git.clone(cloneUrl, tempDir, [
        '--config', 'http.version=HTTP/1.1',
        '--branch', gitConfig.branch,
        '--single-branch'
      ])
      logger.info('[Git Push] 克隆成功')
    } catch (cloneErr) {
      const sanitized = sanitizeError(cloneErr)
      logger.error('[Git Push] 克隆失败', sanitized)
      throw new Error(sanitized.message)
    }

    // 获取所有函数
    const functions = await db.collection('functions')
      .find({ userId })
      .toArray()

    // 写入函数文件（保持目录结构）
    const functionsDir = path.join(tempDir, gitConfig.functionsPath)
    await fs.mkdir(functionsDir, { recursive: true })

    for (const func of functions) {
      const code = convertToLaf(func.code as string)
      // 使用完整路径，保持文件夹结构
      const funcPath = (func.path as string) || (func.name as string)
      const filePath = path.join(functionsDir, `${funcPath}.ts`)
      // 确保父目录存在
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, code)
    }

    // 配置 Git（使用相同的 SSL 设置）
    const repoGit = createGit(gitConfig.repoUrl, tempDir)
    await repoGit.addConfig('user.name', 'Simple IDE')
    await repoGit.addConfig('user.email', 'simple-ide@local')

    // 提交并推送
    logger.info('[Git Push] 添加文件到暂存区')
    await repoGit.add('.')

    // 检查是否有变更
    const status = await repoGit.status()
    logger.info('[Git Push] Git 状态', {
      filesCount: status.files.length,
      files: status.files.map(f => ({ path: f.path, index: f.index, working_dir: f.working_dir }))
    })

    if (status.files.length === 0) {
      logger.warn('[Git Push] 没有变更需要推送')
      throw new Error('没有变更需要推送')
    }

    logger.info('[Git Push] 创建提交', { message: commitMessage })
    await repoGit.commit(commitMessage || 'Update functions from Simple IDE')

    logger.info('[Git Push] 推送到远程仓库')
    try {
      // 使用带认证的 URL 推送，因为 Git 会从 remote 中移除 credentials
      await repoGit.push(cloneUrl, gitConfig.branch)
      logger.info('[Git Push] 推送成功')
    } catch (pushErr) {
      const sanitized = sanitizeError(pushErr)
      logger.error('[Git Push] 推送失败', sanitized)
      throw new Error(sanitized.message)
    }

    // 更新同步时间
    await db.collection('git_config').updateOne(
      { userId },
      { $set: { lastSyncAt: new Date() } }
    )

    logger.info('[Git Push] 推送完成')
  } finally {
    // 清理临时目录
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // 忽略清理错误
    }
  }
}

// 预览推送 - 显示哪些函数会被推送
export async function previewPush(userId: ObjectId): Promise<SyncPreview> {
  logger.info('[Git PreviewPush] 开始预览推送', { userId: userId.toString() })
  const db = getDB()
  const gitConfig = await getGitConfig(userId)

  if (!gitConfig) {
    logger.error('[Git PreviewPush] 未配置 Git 仓库')
    throw new Error('未配置 Git 仓库')
  }

  logger.info('[Git PreviewPush] Git 配置', {
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
      logger.info('[Git PreviewPush] 使用 Token 认证', {
        authUrl: cloneUrl.replace(token, '***TOKEN***')
      })
    }

    // 克隆仓库
    logger.info('[Git PreviewPush] 开始克隆', { tempDir, branch: gitConfig.branch })
    try {
      await git.clone(cloneUrl, tempDir, [
        '--config', 'http.version=HTTP/1.1',
        '--branch', gitConfig.branch,
        '--depth', '1',
        '--single-branch'
      ])
      logger.info('[Git PreviewPush] 克隆成功')
    } catch (cloneErr) {
      const sanitized = sanitizeError(cloneErr)
      logger.error('[Git PreviewPush] 克隆失败', sanitized)
      throw new Error(sanitized.message)
    }

    // 读取远程函数（递归读取子目录）
    const functionsDir = path.join(tempDir, gitConfig.functionsPath)
    const remoteFilesList = await readTsFilesRecursively(functionsDir)
    const remoteFiles = new Map<string, string>()

    // 读取每个远程文件的内容，使用完整路径作为 key
    for (const file of remoteFilesList) {
      const funcPath = file.replace('.ts', '')  // 完整路径
      const filePath = path.join(functionsDir, file)
      const code = await fs.readFile(filePath, 'utf-8')
      remoteFiles.set(funcPath, convertFromLaf(code))
    }

    // 获取本地函数
    const localFunctions = await db.collection('functions')
      .find({ userId })
      .toArray()

    const changes: SyncChange[] = []

    // 检查本地函数
    for (const local of localFunctions) {
      const funcPath = (local.path as string) || (local.name as string)
      const funcName = local.name as string
      // 使用完整路径匹配远程文件
      const remoteCode = remoteFiles.get(funcPath)

      if (!remoteCode) {
        // 新增到远程
        changes.push({
          name: funcName,
          path: funcPath,
          status: 'added',
          localCode: local.code as string,
        })
      } else if (local.code !== remoteCode) {
        // 修改
        changes.push({
          name: funcName,
          path: funcPath,
          status: 'modified',
          localCode: local.code as string,
          remoteCode: remoteCode,
        })
      }
    }

    // 检查远程有但本地没有的 (将被删除)
    for (const [remotePath, code] of Array.from(remoteFiles.entries())) {
      // 使用完整路径匹配本地函数
      const localFunc = localFunctions.find(f => {
        const localPath = (f.path as string) || (f.name as string)
        return localPath === remotePath
      })
      if (!localFunc) {
        const funcName = remotePath.includes('/') ? remotePath.split('/').pop()! : remotePath
        changes.push({
          name: funcName,
          path: remotePath,
          status: 'deleted',
          remoteCode: code,
        })
      }
    }

    return { changes, hasConflicts: false }
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // 忽略清理错误
    }
  }
}

// 选择性推送
export async function selectivePush(
  userId: ObjectId,
  functionPaths: string[],  // 现在传入的是路径而非名称
  commitMessage: string
): Promise<void> {
  logger.info('[Git SelectivePush] 开始', { userId: userId.toString(), functionPaths, commitMessage })
  const db = getDB()
  const gitConfig = await getGitConfig(userId)

  if (!gitConfig) {
    logger.error('[Git SelectivePush] 未配置 Git 仓库')
    throw new Error('未配置 Git 仓库')
  }

  logger.info('[Git SelectivePush] Git 配置', {
    repoUrl: gitConfig.repoUrl,
    branch: gitConfig.branch,
    functionsPath: gitConfig.functionsPath,
    hasToken: !!gitConfig.token
  })

  const tempDir = `/tmp/git-sync-${userId.toString()}-${Date.now()}`

  try {
    let cloneUrl = gitConfig.repoUrl
    if (gitConfig.token) {
      const token = decrypt(gitConfig.token)
      cloneUrl = buildAuthUrl(gitConfig.repoUrl, token)
      logger.info('[Git SelectivePush] 使用 Token 认证')
    }

    logger.info('[Git SelectivePush] 开始克隆', { tempDir, branch: gitConfig.branch })
    const git: SimpleGit = createGit(gitConfig.repoUrl)
    await git.clone(cloneUrl, tempDir, [
      '--config', 'http.version=HTTP/1.1',
      '--branch', gitConfig.branch,
      '--single-branch'
    ])
    logger.info('[Git SelectivePush] 克隆成功')

    // 获取选中的函数 (按 path 查询，兼容旧数据按 name 查询)
    logger.info('[Git SelectivePush] 查询函数', { functionPaths })
    const functions = await db.collection('functions')
      .find({
        userId,
        $or: [
          { path: { $in: functionPaths } },
          { name: { $in: functionPaths } }  // 兼容没有 path 的旧数据
        ]
      })
      .toArray()
    logger.info('[Git SelectivePush] 找到函数', { count: functions.length, names: functions.map(f => f.name) })

    if (functions.length === 0) {
      logger.warn('[Git SelectivePush] 没有找到匹配的函数')
      throw new Error('没有找到匹配的函数')
    }

    const functionsDir = path.join(tempDir, gitConfig.functionsPath)
    await fs.mkdir(functionsDir, { recursive: true })

    // 只写入选中的函数（保持目录结构）
    for (const func of functions) {
      const code = convertToLaf(func.code as string)
      // 使用完整路径，保持文件夹结构
      const funcPath = (func.path as string) || (func.name as string)
      const filePath = path.join(functionsDir, `${funcPath}.ts`)
      // 确保父目录存在
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      logger.info('[Git SelectivePush] 写入文件', { path: funcPath, filePath })
      await fs.writeFile(filePath, code)
    }

    const repoGit = createGit(gitConfig.repoUrl, tempDir)
    await repoGit.addConfig('user.name', 'Simple IDE')
    await repoGit.addConfig('user.email', 'simple-ide@local')

    logger.info('[Git SelectivePush] 添加到暂存区')
    await repoGit.add('.')

    const status = await repoGit.status()
    logger.info('[Git SelectivePush] Git 状态', {
      filesCount: status.files.length,
      files: status.files.map(f => ({ path: f.path, index: f.index, working_dir: f.working_dir }))
    })

    if (status.files.length === 0) {
      logger.warn('[Git SelectivePush] 没有变更需要推送')
      throw new Error('没有变更需要推送')
    }

    logger.info('[Git SelectivePush] 创建提交', { message: commitMessage })
    await repoGit.commit(commitMessage || 'Update functions from Simple IDE')

    logger.info('[Git SelectivePush] 开始推送')
    // 使用带认证的 URL 推送，因为 Git 会从 remote 中移除 credentials
    await repoGit.push(cloneUrl, gitConfig.branch)
    logger.info('[Git SelectivePush] 推送成功')

    await db.collection('git_config').updateOne(
      { userId },
      { $set: { lastSyncAt: new Date() } }
    )
    logger.info('[Git SelectivePush] 完成')
  } catch (err) {
    const sanitized = sanitizeError(err)
    logger.error('[Git SelectivePush] 失败', sanitized)
    throw new Error(sanitized.message)
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // 忽略
    }
  }
}
