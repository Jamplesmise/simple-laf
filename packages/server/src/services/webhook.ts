import { ObjectId } from 'mongodb'
import crypto from 'crypto'
import { getDB } from '../db.js'
import { executeFunction, type ExecuteResult } from '../engine/executor.js'
import { createCloudWithEnv } from '../cloud/index.js'
import * as functionService from './function.js'
import * as executionLogService from './executionLog.js'

export interface Webhook {
  _id?: ObjectId
  userId: string
  functionId: string
  functionName: string
  // Webhook 唯一标识 (用于 URL)
  token: string
  // 可选的签名密钥 (用于验证请求)
  secret?: string
  // 是否启用
  enabled: boolean
  // 允许的请求方法
  methods: string[]
  // 调用次数
  callCount: number
  // 上次调用时间
  lastCalledAt?: Date
  createdAt: Date
  updatedAt: Date
}

/**
 * 生成随机 token
 */
function generateToken(): string {
  return crypto.randomBytes(16).toString('hex')
}

/**
 * 生成签名密钥
 */
function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * 获取用户的 webhook 列表
 */
export async function list(userId: string): Promise<Webhook[]> {
  const db = getDB()
  return db.collection<Webhook>('webhooks')
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray()
}

/**
 * 获取函数的 webhook
 */
export async function findByFunction(functionId: string, userId: string): Promise<Webhook | null> {
  const db = getDB()
  return db.collection<Webhook>('webhooks').findOne({ functionId, userId })
}

/**
 * 根据 token 查找 webhook
 */
export async function findByToken(token: string): Promise<Webhook | null> {
  const db = getDB()
  return db.collection<Webhook>('webhooks').findOne({ token })
}

/**
 * 创建 webhook
 */
export async function create(
  userId: string,
  functionId: string,
  options: { methods?: string[]; generateSecret?: boolean } = {}
): Promise<Webhook> {
  const db = getDB()

  // 验证函数存在
  const func = await functionService.findById(functionId, userId)
  if (!func) {
    throw new Error('函数不存在')
  }

  // 检查是否已存在
  const existing = await db.collection<Webhook>('webhooks').findOne({ functionId, userId })
  if (existing) {
    throw new Error('该函数已有 Webhook')
  }

  const now = new Date()
  const webhook: Webhook = {
    userId,
    functionId,
    functionName: func.name,
    token: generateToken(),
    secret: options.generateSecret ? generateSecret() : undefined,
    enabled: true,
    methods: options.methods || ['POST'],
    callCount: 0,
    createdAt: now,
    updatedAt: now,
  }

  const result = await db.collection<Webhook>('webhooks').insertOne(webhook)
  webhook._id = result.insertedId

  return webhook
}

/**
 * 更新 webhook
 */
export async function update(
  webhookId: string,
  userId: string,
  updates: { enabled?: boolean; methods?: string[]; regenerateToken?: boolean; regenerateSecret?: boolean }
): Promise<Webhook | null> {
  const db = getDB()

  const updateData: Partial<Webhook> & { $unset?: Record<string, 1> } = {
    updatedAt: new Date(),
  }

  if (updates.enabled !== undefined) {
    updateData.enabled = updates.enabled
  }

  if (updates.methods) {
    updateData.methods = updates.methods
  }

  if (updates.regenerateToken) {
    updateData.token = generateToken()
  }

  if (updates.regenerateSecret) {
    updateData.secret = generateSecret()
  }

  await db.collection<Webhook>('webhooks').updateOne(
    { _id: new ObjectId(webhookId), userId },
    { $set: updateData }
  )

  return db.collection<Webhook>('webhooks').findOne({ _id: new ObjectId(webhookId) })
}

/**
 * 删除 webhook
 */
export async function remove(webhookId: string, userId: string): Promise<boolean> {
  const db = getDB()
  const result = await db.collection<Webhook>('webhooks').deleteOne({
    _id: new ObjectId(webhookId),
    userId,
  })
  return result.deletedCount > 0
}

/**
 * 验证签名
 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

/**
 * 执行 webhook 调用
 */
export async function execute(
  webhook: Webhook,
  request: {
    method: string
    body?: unknown
    query?: Record<string, string>
    headers?: Record<string, string>
  }
): Promise<ExecuteResult> {
  const db = getDB()
  const startTime = Date.now()

  try {
    // 检查是否启用
    if (!webhook.enabled) {
      throw new Error('Webhook 已禁用')
    }

    // 检查请求方法
    if (!webhook.methods.includes(request.method)) {
      throw new Error(`不支持的请求方法: ${request.method}`)
    }

    // 获取函数
    const func = await functionService.findById(webhook.functionId, webhook.userId)
    if (!func) {
      throw new Error('函数不存在')
    }

    if (!func.compiled) {
      throw new Error('函数未编译')
    }

    // 创建 Cloud SDK
    const cloud = await createCloudWithEnv(webhook.userId)

    // 执行函数
    const result = await executeFunction(
      func.name,
      func.compiled,
      '',
      {
        body: request.body || {},
        query: request.query || {},
        headers: request.headers || {},
        cloud,
        userId: webhook.userId,
      }
    )

    const duration = Date.now() - startTime

    // 记录执行日志
    executionLogService.create({
      userId: webhook.userId,
      functionId: webhook.functionId,
      functionName: webhook.functionName,
      trigger: 'webhook',
      request: {
        method: request.method,
        body: request.body,
        query: request.query,
      },
      success: !result.error,
      data: result.data,
      error: result.error,
      logs: result.logs.map(log => ({
        level: 'log',
        args: [log],
        timestamp: Date.now(),
      })),
      duration,
    }).catch(err => console.error('记录执行日志失败:', err))

    // 更新 webhook 统计
    await db.collection<Webhook>('webhooks').updateOne(
      { _id: webhook._id },
      {
        $set: { lastCalledAt: new Date(), updatedAt: new Date() },
        $inc: { callCount: 1 },
      }
    )

    return result
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : '执行失败'

    // 记录执行日志（失败）
    executionLogService.create({
      userId: webhook.userId,
      functionId: webhook.functionId,
      functionName: webhook.functionName,
      trigger: 'webhook',
      request: {
        method: request.method,
        body: request.body,
        query: request.query,
      },
      success: false,
      error: errorMessage,
      logs: [],
      duration,
    }).catch(err => console.error('记录执行日志失败:', err))

    return {
      data: null,
      error: errorMessage,
      logs: [],
      time: duration,
    }
  }
}
