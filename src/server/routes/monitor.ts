import { Router, type IRouter, type Response } from 'express'
import type { Collection } from 'mongodb'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { getDB } from '../db.js'
import type { ExecutionLog } from '../services/executionLog.js'
import { getConnectionStats, getErrorSummary, getFunctionErrors } from '../services/monitor/index.js'

const router: IRouter = Router()

type Period = '1h' | '24h' | '7d'

/**
 * 获取时间范围
 */
function getPeriodRange(period: Period): Date {
  const now = new Date()
  switch (period) {
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000)
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000)
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000)
  }
}

/**
 * GET /api/monitor/stats - 获取函数调用统计
 */
router.get('/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } })
    return
  }

  const period = (req.query.period as Period) || '24h'
  const functionId = req.query.functionId as string | undefined

  const db = getDB()
  const collection = db.collection<ExecutionLog>('execution_logs')
  const startTime = getPeriodRange(period)

  // 构建查询条件
  const match: Record<string, unknown> = {
    userId,
    createdAt: { $gte: startTime },
  }
  if (functionId) {
    match.functionId = functionId
  }

  try {
    // 统计聚合
    const [stats, timeline] = await Promise.all([
      // 总体统计
      collection.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            callCount: { $sum: 1 },
            successCount: { $sum: { $cond: ['$success', 1, 0] } },
            totalDuration: { $sum: '$duration' },
          },
        },
      ]).toArray(),
      // 时间线数据
      getTimeline(collection, match, period),
    ])

    const stat = stats[0] || { callCount: 0, successCount: 0, totalDuration: 0 }
    const successRate = stat.callCount > 0 ? Math.round((stat.successCount / stat.callCount) * 100) : 0
    const avgLatency = stat.callCount > 0 ? Math.round(stat.totalDuration / stat.callCount) : 0

    res.json({
      success: true,
      data: {
        callCount: stat.callCount,
        successRate,
        avgLatency,
        timeline,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询失败'
    res.status(500).json({
      success: false,
      error: { code: 'QUERY_ERROR', message },
    })
  }
})

/**
 * GET /api/monitor/top-functions - 获取热门函数排行
 */
router.get('/top-functions', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } })
    return
  }

  const period = (req.query.period as Period) || '24h'
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50)

  const db = getDB()
  const collection = db.collection<ExecutionLog>('execution_logs')
  const startTime = getPeriodRange(period)

  try {
    const topFunctions = await collection.aggregate([
      { $match: { userId, createdAt: { $gte: startTime } } },
      {
        $group: {
          _id: { functionId: '$functionId', functionName: '$functionName' },
          count: { $sum: 1 },
          successCount: { $sum: { $cond: ['$success', 1, 0] } },
          avgDuration: { $avg: '$duration' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]).toArray()

    res.json({
      success: true,
      data: topFunctions.map((f) => ({
        functionId: f._id.functionId,
        functionName: f._id.functionName,
        count: f.count,
        successRate: f.count > 0 ? Math.round((f.successCount / f.count) * 100) : 0,
        avgDuration: Math.round(f.avgDuration || 0),
      })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询失败'
    res.status(500).json({
      success: false,
      error: { code: 'QUERY_ERROR', message },
    })
  }
})

/**
 * GET /api/monitor/connections - 获取 WebSocket 连接统计
 */
router.get('/connections', authMiddleware, async (req: AuthRequest, res: Response) => {
  const stats = getConnectionStats()
  res.json({ success: true, data: stats })
})

type ErrorPeriod = '24h' | '7d'

/**
 * GET /api/monitor/errors - 获取错误摘要
 */
router.get('/errors', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } })
    return
  }

  const period = (req.query.period as ErrorPeriod) || '24h'
  const functionId = req.query.functionId as string | undefined

  try {
    const summary = await getErrorSummary(userId, period, functionId)
    res.json({ success: true, data: summary })
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询失败'
    res.status(500).json({
      success: false,
      error: { code: 'QUERY_ERROR', message },
    })
  }
})

/**
 * GET /api/monitor/errors/:functionId - 获取函数错误详情
 */
router.get('/errors/:functionId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } })
    return
  }

  const { functionId } = req.params
  const period = (req.query.period as ErrorPeriod) || '24h'
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100)

  try {
    const result = await getFunctionErrors(userId, functionId, period, limit)
    res.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询失败'
    res.status(500).json({
      success: false,
      error: { code: 'QUERY_ERROR', message },
    })
  }
})

/**
 * 获取时间线数据
 */
async function getTimeline(
  collection: Collection<ExecutionLog>,
  match: Record<string, unknown>,
  period: Period
): Promise<{ time: string; count: number; successCount: number }[]> {
  // 根据时间段选择聚合粒度
  let groupBy: Record<string, unknown>
  let formatFn: (d: Record<string, number>) => string

  if (period === '1h') {
    // 按5分钟聚合
    groupBy = {
      year: { $year: '$createdAt' },
      month: { $month: '$createdAt' },
      day: { $dayOfMonth: '$createdAt' },
      hour: { $hour: '$createdAt' },
      minute: { $subtract: [{ $minute: '$createdAt' }, { $mod: [{ $minute: '$createdAt' }, 5] }] },
    }
    formatFn = (d) => `${d.hour}:${String(d.minute).padStart(2, '0')}`
  } else if (period === '24h') {
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
        successCount: { $sum: { $cond: ['$success', 1, 0] } },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1, '_id.minute': 1 } },
  ]).toArray()

  return result.map((r) => ({
    time: formatFn(r._id as Record<string, number>),
    count: r.count,
    successCount: r.successCount,
  }))
}

export default router
