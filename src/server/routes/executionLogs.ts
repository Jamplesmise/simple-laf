import { Router, type IRouter } from 'express'
import * as executionLogService from '../services/executionLog.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router: IRouter = Router()

// 所有路由都需要认证
router.use(authMiddleware)

// 获取执行历史列表
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { functionId, limit = '50', offset = '0' } = req.query
    const result = await executionLogService.listByUser(req.user!.userId, {
      functionId: functionId as string | undefined,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    })
    res.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取执行历史失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 高级搜索执行日志
router.post('/search', async (req: AuthRequest, res) => {
  try {
    const { functionIds, keyword, startDate, endDate, limit = 50, offset = 0 } = req.body
    const result = await executionLogService.searchLogs(req.user!.userId, {
      functionIds,
      keyword,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
      offset,
    })
    res.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : '搜索日志失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取单个函数的执行历史
router.get('/function/:functionId', async (req: AuthRequest, res) => {
  try {
    const { functionId } = req.params
    const { limit = '50', offset = '0' } = req.query
    const result = await executionLogService.listByFunction(
      functionId,
      req.user!.userId,
      {
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      }
    )
    res.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取执行历史失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取执行日志详情
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const log = await executionLogService.findById(req.params.id, req.user!.userId)
    if (!log) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '日志不存在' }
      })
      return
    }
    res.json({ success: true, data: log })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取日志详情失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取整体统计
router.get('/stats/overall', async (req: AuthRequest, res) => {
  try {
    const stats = await executionLogService.getOverallStats(req.user!.userId)
    res.json({ success: true, data: stats })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取统计失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取执行趋势
router.get('/stats/trend', async (req: AuthRequest, res) => {
  try {
    const { days = '7' } = req.query
    const trend = await executionLogService.getExecutionTrend(
      req.user!.userId,
      parseInt(days as string, 10)
    )
    res.json({ success: true, data: trend })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取趋势失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取函数执行统计
router.get('/stats/:functionId', async (req: AuthRequest, res) => {
  try {
    const stats = await executionLogService.getStats(
      req.params.functionId,
      req.user!.userId
    )
    res.json({ success: true, data: stats })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取统计失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 删除函数的所有执行历史
router.delete('/function/:functionId', async (req: AuthRequest, res) => {
  try {
    const count = await executionLogService.deleteByFunction(
      req.params.functionId,
      req.user!.userId
    )
    res.json({ success: true, data: { deletedCount: count } })
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除失败'
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_FAILED', message }
    })
  }
})

// 清理过期日志
router.post('/cleanup', async (req: AuthRequest, res) => {
  try {
    const { retentionDays = 7 } = req.body
    const count = await executionLogService.cleanupOldLogs(
      req.user!.userId,
      retentionDays
    )
    res.json({ success: true, data: { deletedCount: count } })
  } catch (err) {
    const message = err instanceof Error ? err.message : '清理失败'
    res.status(500).json({
      success: false,
      error: { code: 'CLEANUP_FAILED', message }
    })
  }
})

export default router
