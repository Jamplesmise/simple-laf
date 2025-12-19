import crypto from 'crypto'
import { ObjectId } from 'mongodb'
import { getDB } from '../db.js'

// Token 认证设置
export interface TokenAuthSettings {
  _id?: ObjectId
  userId: ObjectId
  enabled: boolean  // 是否启用 Token 认证
  updatedAt: Date
}

export interface ApiToken {
  _id: ObjectId
  userId: ObjectId
  name: string
  token: string        // 哈希后的 token
  tokenPrefix: string  // 用于显示的前缀 (sk-xxx...xxx)
  expiresAt: Date
  createdAt: Date
  lastUsedAt?: Date
}

/**
 * 生成 API Token
 * @returns token 原始值、哈希值、前缀
 */
export function generateToken(): { token: string; hash: string; prefix: string } {
  // 生成 32 字节随机数，转为 base64
  const randomBytes = crypto.randomBytes(32)
  const token = 'sk-' + randomBytes.toString('base64url')

  // SHA256 哈希存储
  const hash = crypto.createHash('sha256').update(token).digest('hex')

  // 前缀用于显示: sk-xxx...xxx (前8后4)
  const prefix = token.slice(0, 11) + '...' + token.slice(-4)

  return { token, hash, prefix }
}

/**
 * 列出用户的所有 Token
 */
export async function listTokens(userId: ObjectId): Promise<Omit<ApiToken, 'token'>[]> {
  const db = getDB()
  const tokens = await db.collection<ApiToken>('api_tokens')
    .find({ userId })
    .project({ token: 0 }) // 不返回哈希后的 token
    .sort({ createdAt: -1 })
    .toArray()

  return tokens as Omit<ApiToken, 'token'>[]
}

/**
 * 创建 Token
 * @returns 原始 token (只返回一次)
 */
export async function createToken(
  userId: ObjectId,
  name: string,
  expireDays: number
): Promise<{ token: string; id: string }> {
  const db = getDB()

  const { token, hash, prefix } = generateToken()

  const now = new Date()
  const expiresAt = new Date(now.getTime() + expireDays * 24 * 60 * 60 * 1000)

  const doc: Omit<ApiToken, '_id'> = {
    userId,
    name,
    token: hash,
    tokenPrefix: prefix,
    expiresAt,
    createdAt: now
  }

  const result = await db.collection('api_tokens').insertOne(doc)

  return { token, id: result.insertedId.toString() }
}

/**
 * 删除 Token
 */
export async function deleteToken(userId: ObjectId, tokenId: ObjectId): Promise<boolean> {
  const db = getDB()

  const result = await db.collection('api_tokens').deleteOne({
    _id: tokenId,
    userId
  })

  return result.deletedCount > 0
}

/**
 * 验证 Token
 * @returns userId if valid
 */
export async function validateToken(token: string): Promise<{ valid: boolean; userId?: ObjectId }> {
  const db = getDB()

  // 计算哈希
  const hash = crypto.createHash('sha256').update(token).digest('hex')

  const doc = await db.collection<ApiToken>('api_tokens').findOne({
    token: hash,
    expiresAt: { $gt: new Date() }
  })

  if (!doc) {
    return { valid: false }
  }

  // 更新最后使用时间
  await db.collection('api_tokens').updateOne(
    { _id: doc._id },
    { $set: { lastUsedAt: new Date() } }
  )

  return { valid: true, userId: doc.userId }
}

/**
 * 获取 Token 认证设置
 */
export async function getTokenAuthSettings(userId: ObjectId): Promise<TokenAuthSettings> {
  const db = getDB()

  const settings = await db.collection<TokenAuthSettings>('token_auth_settings').findOne({ userId })

  if (!settings) {
    // 默认不启用
    return {
      userId,
      enabled: false,
      updatedAt: new Date()
    }
  }

  return settings
}

/**
 * 更新 Token 认证设置
 */
export async function updateTokenAuthSettings(userId: ObjectId, enabled: boolean): Promise<TokenAuthSettings> {
  const db = getDB()

  const settings: TokenAuthSettings = {
    userId,
    enabled,
    updatedAt: new Date()
  }

  await db.collection('token_auth_settings').updateOne(
    { userId },
    { $set: settings },
    { upsert: true }
  )

  return settings
}

/**
 * 检查是否启用了 Token 认证
 */
export async function isTokenAuthEnabled(userId: ObjectId): Promise<boolean> {
  const settings = await getTokenAuthSettings(userId)
  return settings.enabled
}
