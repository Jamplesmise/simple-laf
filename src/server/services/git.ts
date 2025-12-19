import { ObjectId } from 'mongodb'
import { simpleGit, type SimpleGit } from 'simple-git'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'
import { getDB } from '../db.js'
import { config } from '../config.js'

export interface GitConfig {
  _id: ObjectId
  repoUrl: string
  branch: string
  token?: string
  functionsPath: string
  lastSyncAt?: Date
  userId: ObjectId
  createdAt: Date
  updatedAt: Date
}

export interface PullResult {
  added: string[]
  updated: string[]
  deleted: string[]
}

// 同步变更项
export interface SyncChange {
  name: string
  status: 'added' | 'modified' | 'deleted' | 'conflict'
  localCode?: string
  remoteCode?: string
  localUpdatedAt?: Date
  remoteUpdatedAt?: Date
}

// 预览结果
export interface SyncPreview {
  changes: SyncChange[]
  hasConflicts: boolean
}

// 加密
function encrypt(text: string): string {
  const algorithm = 'aes-256-cbc'
  const key = crypto.scryptSync(config.jwtSecret, 'salt', 32)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

// 解密
function decrypt(ciphertext: string): string {
  const algorithm = 'aes-256-cbc'
  const key = crypto.scryptSync(config.jwtSecret, 'salt', 32)
  const [ivHex, encrypted] = ciphertext.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = crypto.createDecipheriv(algorithm, key, iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// 获取配置
export async function getGitConfig(userId: ObjectId): Promise<GitConfig | null> {
  const db = getDB()
  return db.collection('git_config').findOne({ userId }) as Promise<GitConfig | null>
}

// 保存配置
export async function saveGitConfig(
  userId: ObjectId,
  repoUrl: string,
  branch: string,
  token: string | undefined,
  functionsPath: string
): Promise<void> {
  const db = getDB()

  const updateData: Record<string, unknown> = {
    repoUrl,
    branch,
    functionsPath: functionsPath.replace(/\/$/, ''), // 移除尾部斜杠
    updatedAt: new Date()
  }

  // 只有提供了新 token 才更新
  if (token) {
    updateData.token = encrypt(token)
  }

  await db.collection('git_config').updateOne(
    { userId },
    {
      $set: updateData,
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    { upsert: true }
  )
}

// 转换 laf 函数格式 → 本地格式
function convertFromLaf(code: string): string {
  // 移除 laf 特有的 import
  return code.replace(/import\s+cloud\s+from\s+['"]@lafjs\/cloud['"]\s*;?\n?/g, '')
}

// 转换本地格式 → laf 函数格式
function convertToLaf(code: string): string {
  // 添加 laf 的 import
  if (!code.includes('@lafjs/cloud')) {
    return `import cloud from '@lafjs/cloud'\n\n${code}`
  }
  return code
}

// 构建带认证的 URL
function buildAuthUrl(repoUrl: string, token?: string): string {
  if (!token) return repoUrl

  try {
    const url = new URL(repoUrl)
    return `https://${token}@${url.host}${url.pathname}`
  } catch {
    return repoUrl
  }
}

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

// 获取同步状态
export async function getGitStatus(userId: ObjectId): Promise<{
  configured: boolean
  lastSyncAt?: Date
}> {
  const gitConfig = await getGitConfig(userId)

  return {
    configured: !!gitConfig,
    lastSyncAt: gitConfig?.lastSyncAt
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
    for (const [name, code] of remoteFiles) {
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
