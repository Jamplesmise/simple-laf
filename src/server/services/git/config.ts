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
