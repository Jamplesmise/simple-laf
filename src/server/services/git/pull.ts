import { ObjectId } from 'mongodb'
import { simpleGit, type SimpleGit } from 'simple-git'
import * as fs from 'fs/promises'
import * as path from 'path'
import { getDB } from '../../db.js'
import { getGitConfig } from './config.js'
import { decrypt } from './crypto.js'
import { convertFromLaf } from './converter.js'
import { buildAuthUrl } from './utils.js'
import type { PullResult, SyncPreview, SyncChange } from './types.js'

// 从 Git 拉取
export async function pullFromGit(userId: ObjectId): Promise<PullResult> {
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

    // 读取函数文件
    const functionsDir = path.join(tempDir, gitConfig.functionsPath)
    let files: string[] = []

    try {
      const entries = await fs.readdir(functionsDir, { withFileTypes: true })
      files = entries
        .filter(e => e.isFile() && e.name.endsWith('.ts'))
        .map(e => e.name)
    } catch {
      throw new Error(`函数目录不存在: ${gitConfig.functionsPath}`)
    }

    const added: string[] = []
    const updated: string[] = []

    // 获取现有函数
    const existingFunctions = await db.collection('functions')
      .find({ userId })
      .toArray()
    const existingMap = new Map(existingFunctions.map(f => [f.name as string, f]))

    // 处理每个函数文件
    for (const file of files) {
      const funcName = file.replace('.ts', '')
      const filePath = path.join(functionsDir, file)
      const code = await fs.readFile(filePath, 'utf-8')
      const convertedCode = convertFromLaf(code)

      const existing = existingMap.get(funcName)

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
        updated.push(funcName)
      } else {
        // 新增
        await db.collection('functions').insertOne({
          name: funcName,
          code: convertedCode,
          compiled: '',
          path: funcName,
          userId,
          published: false,
          order: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        added.push(funcName)
      }
    }

    // 更新同步时间
    await db.collection('git_config').updateOne(
      { userId },
      { $set: { lastSyncAt: new Date() } }
    )

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

    // 读取远程函数文件
    const functionsDir = path.join(tempDir, gitConfig.functionsPath)
    let files: string[] = []

    try {
      const entries = await fs.readdir(functionsDir, { withFileTypes: true })
      files = entries
        .filter(e => e.isFile() && e.name.endsWith('.ts'))
        .map(e => e.name)
    } catch {
      throw new Error(`函数目录不存在: ${gitConfig.functionsPath}`)
    }

    // 获取本地函数
    const localFunctions = await db.collection('functions')
      .find({ userId })
      .toArray()
    const localMap = new Map(localFunctions.map(f => [f.name as string, f]))

    const changes: SyncChange[] = []
    let hasConflicts = false

    // 检查远程文件
    for (const file of files) {
      const funcName = file.replace('.ts', '')
      const filePath = path.join(functionsDir, file)
      const remoteCode = await fs.readFile(filePath, 'utf-8')
      const convertedRemoteCode = convertFromLaf(remoteCode)

      const local = localMap.get(funcName)

      if (!local) {
        // 新增
        changes.push({
          name: funcName,
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
            status: 'conflict',
            localCode: local.code as string,
            remoteCode: convertedRemoteCode,
            localUpdatedAt: local.updatedAt as Date,
          })
          hasConflicts = true
        } else {
          changes.push({
            name: funcName,
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
  functionNames: string[]
): Promise<PullResult> {
  const db = getDB()
  const gitConfig = await getGitConfig(userId)

  if (!gitConfig) throw new Error('未配置 Git 仓库')

  const tempDir = `/tmp/git-sync-${userId.toString()}-${Date.now()}`
  const git: SimpleGit = simpleGit()

  try {
    let cloneUrl = gitConfig.repoUrl
    if (gitConfig.token) {
      const token = decrypt(gitConfig.token)
      cloneUrl = buildAuthUrl(gitConfig.repoUrl, token)
    }

    await git.clone(cloneUrl, tempDir, [
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
    const existingMap = new Map(existingFunctions.map(f => [f.name as string, f]))

    // 只处理选中的函数
    for (const funcName of functionNames) {
      const filePath = path.join(functionsDir, `${funcName}.ts`)

      try {
        const code = await fs.readFile(filePath, 'utf-8')
        const convertedCode = convertFromLaf(code)
        const existing = existingMap.get(funcName)

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
          updated.push(funcName)
        } else {
          await db.collection('functions').insertOne({
            name: funcName,
            code: convertedCode,
            compiled: '',
            path: funcName,
            userId,
            published: false,
            order: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          added.push(funcName)
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
