import { ObjectId } from 'mongodb'
import { getDB } from '../db.js'

export interface ExecutionLog {
  _id?: ObjectId
  userId: string
  functionId: string
  functionName: string
  // 触发来源
  trigger: 'manual' | 'scheduler' | 'webhook' | 'public'
  // 请求信息
  request: {
    method: string
    body?: unknown
    query?: Record<string, string>
    headers?: Record<string, string>
  }
  // 执行结果
  success: boolean
  data?: unknown
  error?: string
  // 控制台日志
  logs: Array<{
    level: 'log' | 'info' | 'warn' | 'error'
    args: unknown[]
    timestamp: number
  }>
  // 执行耗时 (毫秒)
  duration: number
  // 时间戳
  createdAt: Date
}

/**
 * 记录执行日志
 */
export async function create(log: Omit<ExecutionLog, '_id' | 'createdAt'>): Promise<ExecutionLog> {
  const db = getDB()
  const doc: ExecutionLog = {
    ...log,
    createdAt: new Date(),
  }
  const result = await db.collection<ExecutionLog>('execution_logs').insertOne(doc)
  doc._id = result.insertedId
  return doc
}

/**
 * 获取函数的执行历史
 */
export async function listByFunction(
  functionId: string,
  userId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ logs: ExecutionLog[]; total: number }> {
  const db = getDB()
  const { limit = 50, offset = 0 } = options

  const filter = { functionId, userId }
  const [logs, total] = await Promise.all([
    db.collection<ExecutionLog>('execution_logs')
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray(),
    db.collection<ExecutionLog>('execution_logs').countDocuments(filter),
  ])

  return { logs, total }
}

/**
 * 获取用户的所有执行历史
 */
export async function listByUser(
  userId: string,
  options: { limit?: number; offset?: number; functionId?: string } = {}
): Promise<{ logs: ExecutionLog[]; total: number }> {
  const db = getDB()
  const { limit = 50, offset = 0, functionId } = options

  const filter: Record<string, unknown> = { userId }
  if (functionId) {
    filter.functionId = functionId
  }

  const [logs, total] = await Promise.all([
    db.collection<ExecutionLog>('execution_logs')
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray(),
    db.collection<ExecutionLog>('execution_logs').countDocuments(filter),
  ])

  return { logs, total }
}

/**
 * 获取单条执行日志详情
 */
export async function findById(logId: string, userId: string): Promise<ExecutionLog | null> {
  const db = getDB()
  return db.collection<ExecutionLog>('execution_logs').findOne({
    _id: new ObjectId(logId),
    userId,
  })
}

/**
 * 删除函数的所有执行历史
 */
export async function deleteByFunction(functionId: string, userId: string): Promise<number> {
  const db = getDB()
  const result = await db.collection<ExecutionLog>('execution_logs').deleteMany({
    functionId,
    userId,
  })
  return result.deletedCount
}

/**
 * 清理过期日志 (保留最近 N 天)
 */
export async function cleanupOldLogs(userId: string, retentionDays: number = 7): Promise<number> {
  const db = getDB()
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

  const result = await db.collection<ExecutionLog>('execution_logs').deleteMany({
    userId,
    createdAt: { $lt: cutoffDate },
  })
  return result.deletedCount
}

/**
 * 获取函数执行统计
 */
export async function getStats(functionId: string, userId: string): Promise<{
  totalCount: number
  successCount: number
  failCount: number
  avgDuration: number
  last24hCount: number
}> {
  const db = getDB()
  const collection = db.collection<ExecutionLog>('execution_logs')

  const now = new Date()
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [stats, last24hCount] = await Promise.all([
    collection.aggregate([
      { $match: { functionId, userId } },
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
          successCount: { $sum: { $cond: ['$success', 1, 0] } },
          failCount: { $sum: { $cond: ['$success', 0, 1] } },
          avgDuration: { $avg: '$duration' },
        },
      },
    ]).toArray(),
    collection.countDocuments({
      functionId,
      userId,
      createdAt: { $gte: last24h },
    }),
  ])

  const stat = stats[0] || { totalCount: 0, successCount: 0, failCount: 0, avgDuration: 0 }

  return {
    totalCount: stat.totalCount,
    successCount: stat.successCount,
    failCount: stat.failCount,
    avgDuration: Math.round(stat.avgDuration || 0),
    last24hCount,
  }
}

/**
 * 获取用户整体统计
 */
export async function getOverallStats(userId: string): Promise<{
  totalExecutions: number
  successCount: number
  failCount: number
  successRate: number
  avgDuration: number
  last24hCount: number
  last7dCount: number
  triggerBreakdown: { trigger: string; count: number }[]
  topFunctions: { functionId: string; functionName: string; count: number; avgDuration: number }[]
}> {
  const db = getDB()
  const collection = db.collection<ExecutionLog>('execution_logs')

  const now = new Date()
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [overallStats, last24hCount, last7dCount, triggerBreakdown, topFunctions] = await Promise.all([
    // 总体统计
    collection.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalExecutions: { $sum: 1 },
          successCount: { $sum: { $cond: ['$success', 1, 0] } },
          failCount: { $sum: { $cond: ['$success', 0, 1] } },
          avgDuration: { $avg: '$duration' },
        },
      },
    ]).toArray(),
    // 24小时执行数
    collection.countDocuments({ userId, createdAt: { $gte: last24h } }),
    // 7天执行数
    collection.countDocuments({ userId, createdAt: { $gte: last7d } }),
    // 触发来源分布
    collection.aggregate([
      { $match: { userId } },
      { $group: { _id: '$trigger', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray(),
    // Top 函数
    collection.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: { functionId: '$functionId', functionName: '$functionName' },
          count: { $sum: 1 },
          avgDuration: { $avg: '$duration' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]).toArray(),
  ])

  const stat = overallStats[0] || { totalExecutions: 0, successCount: 0, failCount: 0, avgDuration: 0 }
  const successRate = stat.totalExecutions > 0 ? Math.round((stat.successCount / stat.totalExecutions) * 100) : 0

  return {
    totalExecutions: stat.totalExecutions,
    successCount: stat.successCount,
    failCount: stat.failCount,
    successRate,
    avgDuration: Math.round(stat.avgDuration || 0),
    last24hCount,
    last7dCount,
    triggerBreakdown: triggerBreakdown.map((t) => ({ trigger: t._id as string, count: t.count })),
    topFunctions: topFunctions.map((f) => ({
      functionId: f._id.functionId,
      functionName: f._id.functionName,
      count: f.count,
      avgDuration: Math.round(f.avgDuration || 0),
    })),
  }
}

/**
 * 高级搜索执行日志
 */
export async function searchLogs(
  userId: string,
  options: {
    functionIds?: string[]
    keyword?: string
    startDate?: Date
    endDate?: Date
    limit?: number
    offset?: number
  } = {}
): Promise<{ logs: ExecutionLog[]; total: number }> {
  const db = getDB()
  const { functionIds, keyword, startDate, endDate, limit = 50, offset = 0 } = options

  // 构建查询条件
  const filter: Record<string, unknown> = { userId }

  // 函数 ID 过滤
  if (functionIds && functionIds.length > 0) {
    filter.functionId = { $in: functionIds }
  }

  // 日期范围过滤
  if (startDate || endDate) {
    filter.createdAt = {}
    if (startDate) {
      (filter.createdAt as Record<string, Date>).$gte = startDate
    }
    if (endDate) {
      (filter.createdAt as Record<string, Date>).$lte = endDate
    }
  }

  // 关键字搜索 (搜索日志内容、错误信息、函数名)
  if (keyword) {
    const keywordRegex = { $regex: keyword, $options: 'i' }
    filter.$or = [
      { functionName: keywordRegex },
      { error: keywordRegex },
      { 'logs.args': keywordRegex },
    ]
  }

  const [logs, total] = await Promise.all([
    db.collection<ExecutionLog>('execution_logs')
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray(),
    db.collection<ExecutionLog>('execution_logs').countDocuments(filter),
  ])

  return { logs, total }
}

/**
 * 获取执行趋势数据 (最近7天每小时)
 */
export async function getExecutionTrend(userId: string, days: number = 7): Promise<{
  hourly: { hour: string; count: number; successCount: number }[]
  daily: { date: string; count: number; successCount: number }[]
}> {
  const db = getDB()
  const collection = db.collection<ExecutionLog>('execution_logs')

  const now = new Date()
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

  // 每日统计
  const dailyStats = await collection.aggregate([
    { $match: { userId, createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        },
        count: { $sum: 1 },
        successCount: { $sum: { $cond: ['$success', 1, 0] } },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
  ]).toArray()

  // 最近24小时每小时统计
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const hourlyStats = await collection.aggregate([
    { $match: { userId, createdAt: { $gte: last24h } } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
          hour: { $hour: '$createdAt' },
        },
        count: { $sum: 1 },
        successCount: { $sum: { $cond: ['$success', 1, 0] } },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } },
  ]).toArray()

  return {
    daily: dailyStats.map((d) => ({
      date: `${d._id.month}/${d._id.day}`,
      count: d.count,
      successCount: d.successCount,
    })),
    hourly: hourlyStats.map((h) => ({
      hour: `${h._id.hour}:00`,
      count: h.count,
      successCount: h.successCount,
    })),
  }
}
