import { ObjectId } from 'mongodb'
import { getDB } from '../../db.js'
import { encrypt } from './crypto.js'
import type { GitConfig } from './types.js'

// 获取配置
export async function getGitConfig(userId: ObjectId): Promise<GitConfig | null> {
  const db = getDB()
  return db.collection('git_config').findOne({ userId }) as Promise<GitConfig | null>
}

// 保存配置
// clearToken: 明确要求清除 Token（用于切换到公开仓库）
export async function saveGitConfig(
  userId: ObjectId,
  repoUrl: string,
  branch: string,
  token: string | undefined,
  functionsPath: string,
  clearToken: boolean = false
): Promise<void> {
  const db = getDB()

  const updateData: Record<string, unknown> = {
    repoUrl,
    branch,
    functionsPath: functionsPath.replace(/\/$/, ''), // 移除尾部斜杠
    updatedAt: new Date()
  }

  // 如果提供了新 token 则加密保存
  if (token) {
    updateData.token = encrypt(token)
  }

  // 构建更新操作
  const updateOps: Record<string, unknown> = {
    $set: updateData,
    $setOnInsert: {
      createdAt: new Date()
    }
  }

  // 只有明确要求清除 Token 时才删除（切换到公开仓库）
  // 如果只是没有填写 Token，则保留原有 Token
  if (clearToken && !token) {
    updateOps.$unset = { token: '' }
  }

  await db.collection('git_config').updateOne(
    { userId },
    updateOps,
    { upsert: true }
  )
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
