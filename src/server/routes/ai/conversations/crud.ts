/**
 * 对话 CRUD 操作
 * GET/POST/PATCH/DELETE /api/ai/conversations
 */

import { Router, type Router as RouterType } from 'express'
import { ObjectId } from 'mongodb'
import type { AuthRequest } from '../../../middleware/auth.js'
import * as conversationService from '../../../services/ai/conversation.js'

const router: RouterType = Router()

// 获取对话列表
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = new ObjectId(req.user!.userId)
    const { archived, starred } = req.query

    const filter: conversationService.ConversationFilter = {}
    if (archived !== undefined) {
      filter.archived = archived === 'true'
    }
    if (starred !== undefined) {
      filter.starred = starred === 'true'
    }

    const conversations = await conversationService.listConversations(userId, filter)

    res.json({
      success: true,
      data: conversations.map(c => ({
        ...c,
        _id: c._id.toString(),
        userId: c.userId.toString(),
        systemPromptId: c.systemPromptId?.toString(),
      }))
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取对话列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 创建对话
router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = new ObjectId(req.user!.userId)
    const { title, systemPromptId } = req.body

    const conversation = await conversationService.createConversation(userId, {
      title,
      systemPromptId
    })

    res.json({
      success: true,
      data: {
        ...conversation,
        _id: conversation._id.toString(),
        userId: conversation.userId.toString(),
        systemPromptId: conversation.systemPromptId?.toString(),
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建对话失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取对话详情 (含消息)
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = new ObjectId(req.user!.userId)
    const conversationId = new ObjectId(req.params.id)

    const result = await conversationService.getConversation(userId, conversationId)

    if (!result) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '对话不存在' }
      })
      return
    }

    res.json({
      success: true,
      data: {
        conversation: {
          ...result.conversation,
          _id: result.conversation._id.toString(),
          userId: result.conversation.userId.toString(),
          systemPromptId: result.conversation.systemPromptId?.toString(),
        },
        messages: result.messages.map(m => ({
          ...m,
          _id: m._id.toString(),
          conversationId: m.conversationId.toString(),
        }))
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取对话详情失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 更新对话
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = new ObjectId(req.user!.userId)
    const conversationId = new ObjectId(req.params.id)
    const { title, archived, starred } = req.body

    const conversation = await conversationService.updateConversation(
      userId,
      conversationId,
      { title, archived, starred }
    )

    if (!conversation) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '对话不存在' }
      })
      return
    }

    res.json({
      success: true,
      data: {
        ...conversation,
        _id: conversation._id.toString(),
        userId: conversation.userId.toString(),
        systemPromptId: conversation.systemPromptId?.toString(),
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新对话失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 删除对话
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = new ObjectId(req.user!.userId)
    const conversationId = new ObjectId(req.params.id)

    const deleted = await conversationService.deleteConversation(userId, conversationId)

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '对话不存在' }
      })
      return
    }

    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除对话失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

export default router
