/**
 * AI 调试路由
 *
 * /api/ai/debug - 自动调试
 * /api/ai/log-summary - 日志分析
 */

import { Router, type Response, type Router as RouterType } from 'express'
import { ObjectId } from 'mongodb'
import type { AuthRequest } from '../../middleware/auth.js'
import * as debugService from '../../services/ai/debug.js'
import { getDB } from '../../db.js'
import { getLogSummary, formatLogSummaryForAI } from '../../services/logAnalysis.js'

const router: RouterType = Router()

// AI 自动调试 (SSE 流式)
router.post('/debug', async (req: AuthRequest, res: Response) => {
  try {
    const { functionId, modelId } = req.body

    if (!functionId) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'functionId 不能为空' }
      })
      return
    }

    const db = getDB()
    const userId = new ObjectId(req.user!.userId)

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    try {
      for await (const message of debugService.debugStream(
        db,
        userId,
        new ObjectId(functionId),
        modelId ? new ObjectId(modelId) : undefined
      )) {
        res.write(`data: ${JSON.stringify(message)}\n\n`)
      }
    } catch (streamError) {
      const errorMessage = streamError instanceof Error ? streamError.message : '调试失败'
      res.write(`data: ${JSON.stringify({ status: 'error', error: errorMessage })}\n\n`)
    }

    res.end()
  } catch (err) {
    const message = err instanceof Error ? err.message : '调试失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 应用调试修复
router.post('/debug/apply', async (req: AuthRequest, res) => {
  try {
    const { functionId, fixedCode } = req.body

    if (!functionId || !fixedCode) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'functionId 和 fixedCode 不能为空' }
      })
      return
    }

    const db = getDB()
    const userId = new ObjectId(req.user!.userId)

    const result = await debugService.applyDebugFix(
      db,
      userId,
      new ObjectId(functionId),
      fixedCode
    )

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: { code: 'APPLY_FAILED', message: result.error || '应用修复失败' }
      })
      return
    }

    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '应用修复失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// ============ 日志分析 ============

// 获取日志摘要
router.get('/log-summary', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 7
    const functionId = req.query.functionId as string | undefined

    const summary = await getLogSummary(userId, {
      days: Math.min(30, Math.max(1, days)),
      functionId
    })

    res.json({
      success: true,
      data: summary
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取日志摘要失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取格式化的日志摘要 (供 AI 使用)
router.get('/log-summary/formatted', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 7
    const functionId = req.query.functionId as string | undefined

    const summary = await getLogSummary(userId, {
      days: Math.min(30, Math.max(1, days)),
      functionId
    })
    const formatted = formatLogSummaryForAI(summary, days)

    res.json({
      success: true,
      data: {
        summary,
        formatted
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取日志摘要失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

export default router
