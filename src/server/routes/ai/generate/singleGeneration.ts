/**
 * 单函数生成路由
 */

import { Router, type Response, type Router as RouterType } from 'express'
import { ObjectId } from 'mongodb'
import type { AuthRequest } from '../../../middleware/auth.js'
import * as aiService from '../../../services/ai/index.js'
import { buildGenerateSystemPrompt } from './prompts.js'

const router: RouterType = Router()

// 生成单个函数 (流式)
router.post('/generate', async (req: AuthRequest, res: Response) => {
  try {
    const { prompt, context } = req.body

    if (!prompt) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'prompt 不能为空' }
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

    const systemPrompt = buildGenerateSystemPrompt(context)
    const messages: aiService.ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
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
        action: 'generate',
        prompt,
        response: fullContent,
        model: config.model
      })
    } catch (streamError) {
      const errorMessage = streamError instanceof Error ? streamError.message : '生成失败'
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`)
    }

    res.end()
  } catch (err) {
    const message = err instanceof Error ? err.message : '生成失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

export default router
