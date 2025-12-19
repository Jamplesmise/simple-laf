/**
 * 审计日志 API
 *
 * 提供函数操作审计日志的查询接口
 */

import { Router, type IRouter } from 'express'
import { ObjectId } from 'mongodb'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import {
  listAuditLogs,
  getFunctionAuditLogs,
  getAuditStats,
  type AuditLogFilter,
  type AuditAction,
  type OperatorType,
} from '../services/functionAudit.js'

const router: IRouter = Router()

// 所有路由都需要认证
router.use(authMiddleware)

// 获取审计日志列表
router.get('/', async (req: AuthRequest, res) => {
  try {
    const {
      functionId,
      action,
      operator,
      startDate,
      endDate,
      limit = '50',
      offset = '0',
    } = req.query

    const filter: AuditLogFilter = {
      userId: req.user!.userId,
    }

    if (functionId && typeof functionId === 'string') {
      filter.functionId = functionId
    }
    if (action && typeof action === 'string') {
      filter.action = action as AuditAction
    }
    if (operator && typeof operator === 'string') {
      filter.operator = operator as OperatorType
    }
    if (startDate && typeof startDate === 'string') {
      filter.startDate = new Date(startDate)
    }
    if (endDate && typeof endDate === 'string') {
      filter.endDate = new Date(endDate)
    }

    const logs = await listAuditLogs(filter, {
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    })

    res.json({
      success: true,
      data: logs.map((log) => ({
        _id: log._id.toString(),
        functionId: log.functionId.toString(),
        functionName: log.functionName,
        username: log.username,
        action: log.action,
        operator: log.operator,
        operatorDetail: log.operatorDetail,
        changes: log.changes,
        metadata: log.metadata,
        createdAt: log.createdAt,
      })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取审计日志失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message },
    })
  }
})

// 获取指定函数的审计日志
router.get('/function/:id', async (req: AuthRequest, res) => {
  try {
    const { limit = '50', offset = '0' } = req.query

    const logs = await getFunctionAuditLogs(req.params.id, {
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    })

    // 过滤只属于当前用户的日志
    const userId = new ObjectId(req.user!.userId)
    const userLogs = logs.filter((log) => log.userId.equals(userId))

    res.json({
      success: true,
      data: userLogs.map((log) => ({
        _id: log._id.toString(),
        functionId: log.functionId.toString(),
        functionName: log.functionName,
        username: log.username,
        action: log.action,
        operator: log.operator,
        operatorDetail: log.operatorDetail,
        changes: log.changes,
        metadata: log.metadata,
        createdAt: log.createdAt,
      })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取审计日志失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message },
    })
  }
})

// 获取审计统计
router.get('/stats', async (req: AuthRequest, res) => {
  try {
    const { days = '7' } = req.query

    const stats = await getAuditStats(
      req.user!.userId,
      parseInt(days as string, 10)
    )

    res.json({
      success: true,
      data: stats,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取统计失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message },
    })
  }
})

export default router
