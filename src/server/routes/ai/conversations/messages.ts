/**
 * 消息管理操作
 * PATCH/POST /api/ai/messages
 */

import { Router, type Router as RouterType } from 'express'
import { ObjectId } from 'mongodb'
import type { AuthRequest } from '../../../middleware/auth.js'
import * as conversationService from '../../../services/ai/conversation.js'

const router: RouterType = Router()

// 编辑消息
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = new ObjectId(req.user!.userId)
    const messageId = new ObjectId(req.params.id)
    const { content } = req.body

    if (!content?.trim()) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: '消息内容不能为空' }
      })
      return
    }

    const result = await conversationService.updateMessage(messageId, userId, content.trim())

    if (!result) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '消息不存在或无权限' }
      })
      return
    }

    res.json({
      success: true,
      data: {
        messageId: result.message._id.toString(),
        version: result.message.version,
        regenerating: result.deletedCount > 0,
        deletedCount: result.deletedCount
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '编辑消息失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 从消息创建分支对话
router.post('/:id/branch', async (req: AuthRequest, res) => {
  try {
    const userId = new ObjectId(req.user!.userId)
    const messageId = new ObjectId(req.params.id)
    const { newContent } = req.body

    const result = await conversationService.createBranch(messageId, userId, newContent)

    if (!result) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '消息不存在或无权限' }
      })
      return
    }

    res.json({
      success: true,
      data: {
        branchConversationId: result.conversation._id.toString(),
        parentMessageId: messageId.toString(),
        conversation: {
          ...result.conversation,
          _id: result.conversation._id.toString(),
          userId: result.conversation.userId.toString(),
          systemPromptId: result.conversation.systemPromptId?.toString(),
        },
        messageCount: result.messages.length
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建分支失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 消息反馈 (点赞/踩)
router.post('/:id/feedback', async (req: AuthRequest, res) => {
  try {
    const userId = new ObjectId(req.user!.userId)
    const messageId = new ObjectId(req.params.id)
    const { feedback, note } = req.body

    if (feedback !== null && feedback !== 'like' && feedback !== 'dislike') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'feedback 必须是 like、dislike 或 null' }
      })
      return
    }

    const result = await conversationService.updateMessageFeedback(messageId, userId, feedback, note)

    if (!result) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '消息不存在或无权限' }
      })
      return
    }

    res.json({
      success: true,
      data: {
        messageId: result._id.toString(),
        feedback: result.feedback,
        feedbackNote: result.feedbackNote
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '反馈失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

export default router
