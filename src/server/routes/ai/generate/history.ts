/**
 * AI 历史记录路由
 */

import { Router, type Router as RouterType } from 'express'
import { ObjectId } from 'mongodb'
import type { AuthRequest } from '../../../middleware/auth.js'
import * as aiService from '../../../services/ai/index.js'

const router: RouterType = Router()

// 获取 AI 历史记录
router.get('/history', async (req: AuthRequest, res) => {
  try {
    const { limit, offset, functionId } = req.query
    const history = await aiService.getAIHistory(new ObjectId(req.user!.userId), {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      functionId: functionId ? new ObjectId(functionId as string) : undefined
    })
    res.json({ success: true, data: history })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取历史失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 删除 AI 历史记录
router.delete('/history/:id', async (req: AuthRequest, res) => {
  try {
    const deleted = await aiService.deleteAIHistory(
      new ObjectId(req.user!.userId),
      new ObjectId(req.params.id)
    )

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '记录不存在' }
      })
      return
    }

    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

export default router
