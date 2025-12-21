/**
 * 对话导出功能
 * GET /api/ai/conversations/:id/export
 */

import { Router, type Router as RouterType } from 'express'
import { ObjectId } from 'mongodb'
import type { AuthRequest } from '../../../middleware/auth.js'
import * as conversationService from '../../../services/ai/conversation.js'

const router: RouterType = Router()

// 导出对话
router.get('/:id/export', async (req: AuthRequest, res) => {
  try {
    const userId = new ObjectId(req.user!.userId)
    const conversationId = new ObjectId(req.params.id)
    const format = (req.query.format as string) || 'markdown'

    if (format !== 'markdown' && format !== 'json') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_FORMAT', message: 'format 必须是 markdown 或 json' }
      })
      return
    }

    const result = await conversationService.getConversation(userId, conversationId)

    if (!result) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '对话不存在' }
      })
      return
    }

    const { conversation, messages } = result

    if (format === 'json') {
      // JSON 格式导出
      const exportData = {
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        messageCount: messages.length,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          createdAt: m.createdAt
        }))
      }

      res.json({
        success: true,
        data: exportData
      })
    } else {
      // Markdown 格式导出
      const lines: string[] = []
      lines.push(`# ${conversation.title}`)
      lines.push('')
      lines.push(`> 创建时间: ${new Date(conversation.createdAt).toLocaleString('zh-CN')}`)
      lines.push(`> 消息数量: ${messages.length}`)
      lines.push('')
      lines.push('---')
      lines.push('')

      for (const msg of messages) {
        const roleLabel = msg.role === 'user' ? '## 👤 用户' : '## 🤖 AI'
        lines.push(roleLabel)
        lines.push('')
        lines.push(msg.content)
        lines.push('')
      }

      const markdown = lines.join('\n')
      const filename = encodeURIComponent(`${conversation.title}.md`)

      res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.send(markdown)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '导出对话失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

export default router
