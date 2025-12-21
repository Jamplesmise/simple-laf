/**
 * 文件上传管理
 * POST/GET/DELETE /api/ai/conversations/:id/files
 */

import { Router, type Response, type Router as RouterType } from 'express'
import { ObjectId } from 'mongodb'
import type { AuthRequest } from '../../../middleware/auth.js'
import * as conversationService from '../../../services/ai/conversation.js'
import { getDB } from '../../../db.js'
import { upload, estimateTokens, type MulterAuthRequest } from './shared.js'

const router: RouterType = Router()

// 上传文件
router.post(
  '/:id/files',
  upload.single('file'),
  async (req: MulterAuthRequest, res: Response) => {
    try {
      const userId = new ObjectId(req.user!.userId)
      const conversationId = new ObjectId(req.params.id)

      // 验证对话存在
      const conversation = await conversationService.getConversation(userId, conversationId)
      if (!conversation) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '对话不存在' }
        })
        return
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: '未提供文件' }
        })
        return
      }

      const { originalname, mimetype, size, buffer } = req.file
      const content = buffer.toString('utf-8')
      const tokens = estimateTokens(content)

      const db = getDB()
      const fileDoc = {
        _id: new ObjectId(),
        conversationId,
        userId,
        name: originalname,
        type: mimetype,
        size,
        content,
        tokens,
        createdAt: new Date(),
      }

      await db.collection('ai_conversation_files').insertOne(fileDoc)

      res.json({
        success: true,
        data: {
          id: fileDoc._id.toString(),
          name: originalname,
          type: mimetype,
          size,
          content,
          tokens,
        }
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '上传文件失败'
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message }
      })
    }
  }
)

// 获取文件列表
router.get('/:id/files', async (req: AuthRequest, res) => {
  try {
    const userId = new ObjectId(req.user!.userId)
    const conversationId = new ObjectId(req.params.id)

    // 验证对话存在
    const conversation = await conversationService.getConversation(userId, conversationId)
    if (!conversation) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '对话不存在' }
      })
      return
    }

    const db = getDB()
    const files = await db.collection('ai_conversation_files')
      .find({ conversationId, userId })
      .project({ content: 0 }) // 不返回完整内容
      .sort({ createdAt: -1 })
      .toArray()

    res.json({
      success: true,
      data: files.map(f => ({
        id: f._id.toString(),
        name: f.name,
        type: f.type,
        size: f.size,
        tokens: f.tokens,
        createdAt: f.createdAt,
      }))
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取文件列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 删除文件
router.delete('/:id/files/:fileId', async (req: AuthRequest, res) => {
  try {
    const userId = new ObjectId(req.user!.userId)
    const conversationId = new ObjectId(req.params.id)
    const fileId = new ObjectId(req.params.fileId)

    const db = getDB()
    const result = await db.collection('ai_conversation_files').deleteOne({
      _id: fileId,
      conversationId,
      userId,
    })

    if (result.deletedCount === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '文件不存在' }
      })
      return
    }

    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除文件失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

export default router
