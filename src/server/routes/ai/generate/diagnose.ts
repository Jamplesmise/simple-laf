/**
 * 错误诊断路由
 */

import { Router, type Response, type Router as RouterType } from 'express'
import { ObjectId } from 'mongodb'
import type { AuthRequest } from '../../../middleware/auth.js'
import * as aiService from '../../../services/ai/index.js'
import { buildDiagnoseSystemPrompt } from './prompts.js'

const router: RouterType = Router()

// 错误诊断
router.post('/diagnose', async (req: AuthRequest, res: Response) => {
  try {
    const { code, error: errorMsg, errorStack } = req.body

    if (!code || !errorMsg) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'code 和 error 不能为空' }
      })
      return
    }

    const userId = new ObjectId(req.user!.userId)
    const config = await aiService.getAIConfig(userId)

    if (!config) {
      res.status(400).json({
        success: false,
        error: { code: 'CONFIG_ERROR', message: '请先配置 AI 设置' }
      })
      return
    }

    const systemPrompt = buildDiagnoseSystemPrompt()
    const userPrompt = `请诊断以下代码的错误:\n\n代码:\n\`\`\`typescript\n${code}\n\`\`\`\n\n错误信息:\n${errorMsg}\n\n${errorStack ? `错误堆栈:\n${errorStack}` : ''}`

    const messages: aiService.ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    let fullContent = ''

    try {
      for await (const chunk of aiService.chatStream(userId, messages)) {
        fullContent += chunk
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`)

      await aiService.saveAIHistory(userId, {
        action: 'diagnose',
        prompt: userPrompt,
        response: fullContent,
        model: config.model
      })
    } catch (streamError) {
      const errorMessage = streamError instanceof Error ? streamError.message : '诊断失败'
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`)
    }

    res.end()
  } catch (err) {
    const message = err instanceof Error ? err.message : '诊断失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

export default router
