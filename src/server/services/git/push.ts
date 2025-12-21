import { ObjectId } from 'mongodb'
import { simpleGit, type SimpleGit } from 'simple-git'
import * as fs from 'fs/promises'
import * as path from 'path'
import { getDB } from '../../db.js'
import { getGitConfig } from './config.js'
import { decrypt } from './crypto.js'
import { convertFromLaf, convertToLaf } from './converter.js'
import { buildAuthUrl } from './utils.js'
import type { SyncPreview, SyncChange } from './types.js'

// 推送到 Git
export async function pushToGit(
  userId: ObjectId,
  commitMessage: string
): Promise<void> {
  const db = getDB()
  const gitConfig = await getGitConfig(userId)

  if (!gitConfig) throw new Error('未配置 Git 仓库')

  const tempDir = `/tmp/git-sync-${userId.toString()}-${Date.now()}`

  try {
    // 构建认证 URL
    let cloneUrl = gitConfig.repoUrl
    if (gitConfig.token) {
      const token = decrypt(gitConfig.token)
      cloneUrl = buildAuthUrl(gitConfig.repoUrl, token)
    }

    // 克隆仓库
    const git: SimpleGit = simpleGit()
    await git.clone(cloneUrl, tempDir, [
      '--branch', gitConfig.branch,
      '--single-branch'
    ])

    // 获取所有函数
    const functions = await db.collection('functions')
      .find({ userId })
      .toArray()

    // 写入函数文件
    const functionsDir = path.join(tempDir, gitConfig.functionsPath)
    await fs.mkdir(functionsDir, { recursive: true })

    for (const func of functions) {
      const code = convertToLaf(func.code as string)
      await fs.writeFile(
        path.join(functionsDir, `${func.name}.ts`),
        code
      )
    }

    // 配置 Git
    const repoGit = simpleGit(tempDir)
    await repoGit.addConfig('user.name', 'Simple IDE')
    await repoGit.addConfig('user.email', 'simple-ide@local')

    // 提交并推送
    await repoGit.add('.')

    // 检查是否有变更
    const status = await repoGit.status()
    if (status.files.length === 0) {
      throw new Error('没有变更需要推送')
    }

    await repoGit.commit(commitMessage || 'Update functions from Simple IDE')
    await repoGit.push()

    // 更新同步时间
    await db.collection('git_config').updateOne(
      { userId },
      { $set: { lastSyncAt: new Date() } }
    )
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
  const db = getDB()
  const gitConfig = await getGitConfig(userId)

  if (!gitConfig) throw new Error('未配置 Git 仓库')

  const tempDir = `/tmp/git-sync-${userId.toString()}-${Date.now()}`
  const git: SimpleGit = simpleGit()

  try {
    // 构建认证 URL
    let cloneUrl = gitConfig.repoUrl
    if (gitConfig.token) {
      const token = decrypt(gitConfig.token)
      cloneUrl = buildAuthUrl(gitConfig.repoUrl, token)
    }

    // 克隆仓库
    await git.clone(cloneUrl, tempDir, [
      '--branch', gitConfig.branch,
      '--depth', '1',
      '--single-branch'
    ])

    // 读取远程函数
    const functionsDir = path.join(tempDir, gitConfig.functionsPath)
    const remoteFiles = new Map<string, string>()

    try {
      const entries = await fs.readdir(functionsDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.ts')) {
          const code = await fs.readFile(path.join(functionsDir, entry.name), 'utf-8')
          remoteFiles.set(entry.name.replace('.ts', ''), convertFromLaf(code))
        }
      }
    } catch {
      // 目录不存在，所有本地函数都是新增
    }

    // 获取本地函数
    const localFunctions = await db.collection('functions')
      .find({ userId })
      .toArray()

    const changes: SyncChange[] = []

    // 检查本地函数
    for (const local of localFunctions) {
      const remoteCode = remoteFiles.get(local.name as string)

      if (!remoteCode) {
        // 新增到远程
        changes.push({
          name: local.name as string,
          status: 'added',
          localCode: local.code as string,
        })
      } else if (local.code !== remoteCode) {
        // 修改
        changes.push({
          name: local.name as string,
          status: 'modified',
          localCode: local.code as string,
          remoteCode: remoteCode,
        })
      }
    }

    // 检查远程有但本地没有的 (将被删除)
    for (const [name, code] of Array.from(remoteFiles.entries())) {
      if (!localFunctions.find(f => f.name === name)) {
        changes.push({
          name,
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
  functionNames: string[],
  commitMessage: string
): Promise<void> {
  const db = getDB()
  const gitConfig = await getGitConfig(userId)

  if (!gitConfig) throw new Error('未配置 Git 仓库')

  const tempDir = `/tmp/git-sync-${userId.toString()}-${Date.now()}`

  try {
    let cloneUrl = gitConfig.repoUrl
    if (gitConfig.token) {
      const token = decrypt(gitConfig.token)
      cloneUrl = buildAuthUrl(gitConfig.repoUrl, token)
    }

    const git: SimpleGit = simpleGit()
    await git.clone(cloneUrl, tempDir, [
      '--branch', gitConfig.branch,
      '--single-branch'
    ])

    // 获取选中的函数
    const functions = await db.collection('functions')
      .find({ userId, name: { $in: functionNames } })
      .toArray()

    const functionsDir = path.join(tempDir, gitConfig.functionsPath)
    await fs.mkdir(functionsDir, { recursive: true })

    // 只写入选中的函数
    for (const func of functions) {
      const code = convertToLaf(func.code as string)
      await fs.writeFile(
        path.join(functionsDir, `${func.name}.ts`),
        code
      )
    }

    const repoGit = simpleGit(tempDir)
    await repoGit.addConfig('user.name', 'Simple IDE')
    await repoGit.addConfig('user.email', 'simple-ide@local')

    await repoGit.add('.')

    const status = await repoGit.status()
    if (status.files.length === 0) {
      throw new Error('没有变更需要推送')
    }

    await repoGit.commit(commitMessage || 'Update functions from Simple IDE')
    await repoGit.push()

    await db.collection('git_config').updateOne(
      { userId },
      { $set: { lastSyncAt: new Date() } }
    )
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // 忽略
    }
  }
}
