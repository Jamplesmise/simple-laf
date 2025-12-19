/**
 * 函数操作审计日志服务
 *
 * 记录所有函数的增删改操作，区分用户操作和 AI 操作
 */

import { ObjectId, type Db } from 'mongodb'
import { getDB } from '../db.js'

/**
 * 审计日志操作类型
 */
export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'rename'
  | 'move'
  | 'publish'
  | 'unpublish'
  | 'rollback'

/**
 * 操作者类型
 */
export type OperatorType = 'user' | 'ai' | 'git' | 'system'

/**
 * 审计日志记录
 */
export interface FunctionAuditLog {
  _id: ObjectId
  functionId: ObjectId
  functionName: string
  userId: ObjectId
  username: string              // 操作账号用户名
  action: AuditAction
  operator: OperatorType
  operatorDetail?: string       // 如 "AI: deepseek-v3" 或 "Git: pull from main"
  changes?: {
    before?: string             // 修改前代码
    after?: string              // 修改后代码
    description?: string        // 变更描述
  }
  metadata?: Record<string, unknown>  // 额外元数据
  createdAt: Date
}

/**
 * 创建审计日志的参数
 */
export interface CreateAuditLogParams {
  functionId: string | ObjectId
  functionName: string
  userId: string | ObjectId
  username: string              // 操作账号用户名
  action: AuditAction
  operator: OperatorType
  operatorDetail?: string
  changes?: {
    before?: string
    after?: string
    description?: string
  }
  metadata?: Record<string, unknown>
}

/**
 * 查询审计日志的过滤条件
 */
export interface AuditLogFilter {
  functionId?: string
  userId?: string
  action?: AuditAction
  operator?: OperatorType
  startDate?: Date
  endDate?: Date
}

/**
 * 创建审计日志
 */
export async function createAuditLog(
  params: CreateAuditLogParams,
  db?: Db
): Promise<FunctionAuditLog> {
  const database = db || getDB()

  const log: Omit<FunctionAuditLog, '_id'> = {
    functionId: typeof params.functionId === 'string'
      ? new ObjectId(params.functionId)
      : params.functionId,
    functionName: params.functionName,
    userId: typeof params.userId === 'string'
      ? new ObjectId(params.userId)
      : params.userId,
    username: params.username,
    action: params.action,
    operator: params.operator,
    operatorDetail: params.operatorDetail,
    changes: params.changes,
    metadata: params.metadata,
    createdAt: new Date(),
  }

  const result = await database.collection('function_audit_logs').insertOne(log)

  return {
    _id: result.insertedId,
    ...log,
  }
}

/**
 * 查询审计日志
 */
export async function listAuditLogs(
  filter: AuditLogFilter = {},
  options: { limit?: number; offset?: number } = {},
  db?: Db
): Promise<FunctionAuditLog[]> {
  const database = db || getDB()
  const { limit = 50, offset = 0 } = options

  const query: Record<string, unknown> = {}

  if (filter.functionId) {
    query.functionId = new ObjectId(filter.functionId)
  }
  if (filter.userId) {
    query.userId = new ObjectId(filter.userId)
  }
  if (filter.action) {
    query.action = filter.action
  }
  if (filter.operator) {
    query.operator = filter.operator
  }
  if (filter.startDate || filter.endDate) {
    query.createdAt = {}
    if (filter.startDate) {
      (query.createdAt as Record<string, Date>).$gte = filter.startDate
    }
    if (filter.endDate) {
      (query.createdAt as Record<string, Date>).$lte = filter.endDate
    }
  }

  return database
    .collection<FunctionAuditLog>('function_audit_logs')
    .find(query)
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .toArray()
}

/**
 * 获取函数的审计日志
 */
export async function getFunctionAuditLogs(
  functionId: string,
  options: { limit?: number; offset?: number } = {},
  db?: Db
): Promise<FunctionAuditLog[]> {
  return listAuditLogs({ functionId }, options, db)
}

/**
 * 获取用户的审计日志
 */
export async function getUserAuditLogs(
  userId: string,
  filter: Omit<AuditLogFilter, 'userId'> = {},
  options: { limit?: number; offset?: number } = {},
  db?: Db
): Promise<FunctionAuditLog[]> {
  return listAuditLogs({ ...filter, userId }, options, db)
}

/**
 * 获取审计日志统计
 */
export async function getAuditStats(
  userId: string,
  days: number = 7,
  db?: Db
): Promise<{
  total: number
  byAction: Record<AuditAction, number>
  byOperator: Record<OperatorType, number>
}> {
  const database = db || getDB()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const logs = await database
    .collection<FunctionAuditLog>('function_audit_logs')
    .find({
      userId: new ObjectId(userId),
      createdAt: { $gte: startDate },
    })
    .toArray()

  const byAction: Record<string, number> = {}
  const byOperator: Record<string, number> = {}

  for (const log of logs) {
    byAction[log.action] = (byAction[log.action] || 0) + 1
    byOperator[log.operator] = (byOperator[log.operator] || 0) + 1
  }

  return {
    total: logs.length,
    byAction: byAction as Record<AuditAction, number>,
    byOperator: byOperator as Record<OperatorType, number>,
  }
}

/**
 * 便捷方法：记录用户操作
 */
export async function logUserAction(
  params: Omit<CreateAuditLogParams, 'operator' | 'operatorDetail'>,
  db?: Db
): Promise<FunctionAuditLog> {
  return createAuditLog({
    ...params,
    operator: 'user',
    operatorDetail: `用户: ${params.username}`,
  }, db)
}

/**
 * 便捷方法：记录 AI 操作
 */
export async function logAIAction(
  params: Omit<CreateAuditLogParams, 'operator' | 'operatorDetail'> & { modelName?: string },
  db?: Db
): Promise<FunctionAuditLog> {
  const detail = params.modelName
    ? `AI: ${params.modelName} (账号: ${params.username})`
    : `AI 操作 (账号: ${params.username})`
  return createAuditLog({
    ...params,
    operator: 'ai',
    operatorDetail: detail,
  }, db)
}

/**
 * 便捷方法：记录 Git 操作
 */
export async function logGitAction(
  params: Omit<CreateAuditLogParams, 'operator' | 'operatorDetail'> & { gitAction?: string },
  db?: Db
): Promise<FunctionAuditLog> {
  const detail = params.gitAction
    ? `Git: ${params.gitAction} (账号: ${params.username})`
    : `Git 同步 (账号: ${params.username})`
  return createAuditLog({
    ...params,
    operator: 'git',
    operatorDetail: detail,
  }, db)
}
