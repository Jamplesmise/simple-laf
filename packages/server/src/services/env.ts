import { ObjectId } from 'mongodb'
import crypto from 'node:crypto'
import { getDB } from '../db.js'
import { config } from '../config.js'

// 加密密钥 (使用 JWT secret 派生)
const ENCRYPTION_KEY = crypto.scryptSync(config.jwtSecret, 'salt', 32)
const IV_LENGTH = 16

/**
 * 加密
 */
function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

/**
 * 解密
 */
function decrypt(ciphertext: string): string {
  const [ivHex, encrypted] = ciphertext.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export interface EnvVariable {
  _id: ObjectId
  key: string
  value: string
  description?: string
  userId: ObjectId
  createdAt: Date
  updatedAt: Date
}

/**
 * 获取环境变量列表 (不返回值)
 */
export async function listEnvVariables(userId: ObjectId): Promise<Array<{
  key: string
  description?: string
  hasValue: boolean
}>> {
  const db = getDB()
  const envs = await db.collection<EnvVariable>('env_variables')
    .find({ userId })
    .toArray()

  return envs.map(env => ({
    key: env.key,
    description: env.description,
    hasValue: !!env.value
  }))
}

/**
 * 获取环境变量列表 (带解密值)
 */
export async function listEnvVariablesWithValues(userId: ObjectId): Promise<Array<{
  key: string
  value: string
  description?: string
}>> {
  const db = getDB()
  const envs = await db.collection<EnvVariable>('env_variables')
    .find({ userId })
    .toArray()

  return envs.map(env => {
    let value = ''
    try {
      value = decrypt(env.value)
    } catch {
      // 解密失败
    }
    return {
      key: env.key,
      value,
      description: env.description
    }
  })
}

/**
 * 获取所有环境变量 (解密后的值)
 */
export async function getEnvVariables(userId: ObjectId): Promise<Record<string, string>> {
  const db = getDB()
  const envs = await db.collection<EnvVariable>('env_variables')
    .find({ userId })
    .toArray()

  const result: Record<string, string> = {}
  for (const env of envs) {
    try {
      result[env.key] = decrypt(env.value)
    } catch {
      // 解密失败，跳过
    }
  }
  return result
}

/**
 * 设置环境变量
 */
export async function setEnvVariable(
  userId: ObjectId,
  key: string,
  value: string,
  description?: string
): Promise<void> {
  const db = getDB()

  await db.collection('env_variables').updateOne(
    { userId, key },
    {
      $set: {
        value: encrypt(value),
        description,
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    { upsert: true }
  )
}

/**
 * 删除环境变量
 */
export async function deleteEnvVariable(
  userId: ObjectId,
  key: string
): Promise<boolean> {
  const db = getDB()
  const result = await db.collection('env_variables').deleteOne({ userId, key })
  return result.deletedCount > 0
}

/**
 * 批量更新环境变量 (删除所有旧的，插入新的)
 */
export async function bulkUpdateEnvVariables(
  userId: ObjectId,
  variables: Array<{ key: string; value: string }>
): Promise<void> {
  const db = getDB()
  const collection = db.collection('env_variables')

  // 删除该用户的所有环境变量
  await collection.deleteMany({ userId })

  // 插入新的环境变量
  if (variables.length > 0) {
    const now = new Date()
    const docs = variables.map(v => ({
      userId,
      key: v.key,
      value: encrypt(v.value),
      createdAt: now,
      updatedAt: now
    }))
    await collection.insertMany(docs)
  }
}
