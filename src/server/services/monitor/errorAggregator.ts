import type { Collection } from 'mongodb'
import { getDB } from '../../db.js'
import type { ExecutionLog } from '../executionLog.js'

export interface ErrorGroup {
  errorType: string
  count: number
  firstOccurrence: Date
  lastOccurrence: Date
  affectedFunctions: string[]
  sampleError: string
}

export interface ErrorTrend {
  time: string
  count: number
}

export interface ErrorSummary {
  totalErrors: number
  errorRate: number
  topErrors: ErrorGroup[]
  trend: ErrorTrend[]
}

type Period = '24h' | '7d'

/**
 * 获取时间范围
 */
function getPeriodRange(period: Period): Date {
  const now = new Date()
  switch (period) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000)
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000)
  }
}

/**
 * 从错误信息中提取错误类型
 */
function extractErrorType(error: string): string {
  // 提取常见的错误类型
  const patterns = [
    /^(\w+Error):/,           // TypeError:, ReferenceError:
    /^(\w+Exception):/,       // NullPointerException:
    /^(ENOENT|EACCES|ECONNREFUSED|ETIMEDOUT)/, // 系统错误
    /^(SyntaxError):/,        // 语法错误
    /^(ValidationError):/,    // 验证错误
    /^(TimeoutError):/,       // 超时错误
    /^(\d{3})\s/,             // HTTP 状态码 (404, 500, etc.)
  ]

  for (const pattern of patterns) {
    const match = error.match(pattern)
    if (match) {
      return match[1]
    }
  }

  // 取前50个字符作为错误类型
  return error.substring(0, 50).replace(/\s+/g, ' ').trim() || 'Unknown Error'
}

/**
 * 获取错误摘要
 */
export async function getErrorSummary(
  userId: string,
  period: Period = '24h',
  functionId?: string
): Promise<ErrorSummary> {
  const db = getDB()
  const collection = db.collection<ExecutionLog>('execution_logs')
  const startTime = getPeriodRange(period)

  // 构建查询条件
  const match: Record<string, unknown> = {
    userId,
    createdAt: { $gte: startTime },
    success: false,
  }
  if (functionId) {
    match.functionId = functionId
  }

  // 获取所有失败的执行日志
  const [errors, totalCount, errorCount] = await Promise.all([
    collection
      .find(match)
      .sort({ createdAt: -1 })
      .limit(1000)
      .toArray(),
    collection.countDocuments({
      userId,
      createdAt: { $gte: startTime },
      ...(functionId ? { functionId } : {}),
    }),
    collection.countDocuments(match),
  ])

  // 按错误类型分组
  const errorGroups = new Map<string, {
    count: number
    firstOccurrence: Date
    lastOccurrence: Date
    affectedFunctions: Set<string>
    sampleError: string
  }>()

  for (const log of errors) {
    const errorType = extractErrorType(log.error || 'Unknown Error')
    const existing = errorGroups.get(errorType)

    if (existing) {
      existing.count++
      existing.affectedFunctions.add(log.functionName)
      if (log.createdAt < existing.firstOccurrence) {
        existing.firstOccurrence = log.createdAt
      }
      if (log.createdAt > existing.lastOccurrence) {
        existing.lastOccurrence = log.createdAt
      }
    } else {
      errorGroups.set(errorType, {
        count: 1,
        firstOccurrence: log.createdAt,
        lastOccurrence: log.createdAt,
        affectedFunctions: new Set([log.functionName]),
        sampleError: log.error || 'Unknown Error',
      })
    }
  }

  // 转换为数组并排序
  const topErrors: ErrorGroup[] = Array.from(errorGroups.entries())
    .map(([errorType, data]) => ({
      errorType,
      count: data.count,
      firstOccurrence: data.firstOccurrence,
      lastOccurrence: data.lastOccurrence,
      affectedFunctions: Array.from(data.affectedFunctions),
      sampleError: data.sampleError,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // 获取错误趋势
  const trend = await getErrorTrend(collection, match, period)

  const errorRate = totalCount > 0 ? Math.round((errorCount / totalCount) * 100) : 0

  return {
    totalErrors: errorCount,
    errorRate,
    topErrors,
    trend,
  }
}

/**
 * 获取错误趋势
 */
async function getErrorTrend(
  collection: Collection<ExecutionLog>,
  match: Record<string, unknown>,
  period: Period
): Promise<ErrorTrend[]> {
  let groupBy: Record<string, unknown>
  let formatFn: (d: Record<string, number>) => string

  if (period === '24h') {
    // 按小时聚合
    groupBy = {
      year: { $year: '$createdAt' },
      month: { $month: '$createdAt' },
      day: { $dayOfMonth: '$createdAt' },
      hour: { $hour: '$createdAt' },
    }
    formatFn = (d) => `${d.hour}:00`
  } else {
    // 按天聚合
    groupBy = {
      year: { $year: '$createdAt' },
      month: { $month: '$createdAt' },
      day: { $dayOfMonth: '$createdAt' },
    }
    formatFn = (d) => `${d.month}/${d.day}`
  }

  const result = await collection.aggregate([
    { $match: match },
    {
      $group: {
        _id: groupBy,
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } },
  ]).toArray()

  return result.map((r) => ({
    time: formatFn(r._id as Record<string, number>),
    count: r.count,
  }))
}

/**
 * 获取特定函数的错误详情
 */
export async function getFunctionErrors(
  userId: string,
  functionId: string,
  period: Period = '24h',
  limit: number = 50
): Promise<{
  errors: Array<{
    error: string
    createdAt: Date
    duration: number
    trigger: string
  }>
  total: number
}> {
  const db = getDB()
  const collection = db.collection<ExecutionLog>('execution_logs')
  const startTime = getPeriodRange(period)

  const match = {
    userId,
    functionId,
    createdAt: { $gte: startTime },
    success: false,
  }

  const [errors, total] = await Promise.all([
    collection
      .find(match)
      .sort({ createdAt: -1 })
      .limit(limit)
      .project({ error: 1, createdAt: 1, duration: 1, trigger: 1 })
      .toArray(),
    collection.countDocuments(match),
  ])

  return {
    errors: errors.map((e) => ({
      error: e.error || 'Unknown Error',
      createdAt: e.createdAt,
      duration: e.duration,
      trigger: e.trigger,
    })),
    total,
  }
}

/**
 * AI 工具接口：获取错误摘要
 */
export async function getErrorSummaryForAI(
  userId: string,
  period: Period = '24h',
  functionId?: string
): Promise<string> {
  const summary = await getErrorSummary(userId, period, functionId)

  if (summary.totalErrors === 0) {
    return `在${period === '24h' ? '过去24小时' : '过去7天'}内没有发现错误。`
  }

  let result = `错误摘要 (${period === '24h' ? '过去24小时' : '过去7天'}):\n`
  result += `- 总错误数: ${summary.totalErrors}\n`
  result += `- 错误率: ${summary.errorRate}%\n\n`

  if (summary.topErrors.length > 0) {
    result += `主要错误类型:\n`
    for (const error of summary.topErrors.slice(0, 5)) {
      result += `- ${error.errorType}: ${error.count}次, 影响函数: ${error.affectedFunctions.join(', ')}\n`
    }
  }

  return result
}
