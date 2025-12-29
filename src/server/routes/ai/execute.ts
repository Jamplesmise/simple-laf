/**
 * AI 执行路由
 *
 * /api/ai/execute - 执行 AI 操作
 * /api/ai/preview - 预览 AI 操作计划
 */

import { Router, type Response, type Router as RouterType } from 'express'
import { ObjectId } from 'mongodb'
import type { AuthRequest } from '../../middleware/auth.js'
import * as aiService from '../../services/ai/index.js'
import { AIExecutor, getActionSystemPrompt } from '../../services/ai/executor.js'
import { getDB } from '../../db.js'

const router: RouterType = Router()

// 执行 AI 操作 (直接创建/修改函数)
router.post('/execute', async (req: AuthRequest, res: Response) => {
  try {
    const { prompt, context, modelId, enableThinking } = req.body

    if (!prompt) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'prompt 不能为空' }
      })
      return
    }

    const userId = new ObjectId(req.user!.userId)

    if (!modelId) {
      const config = await aiService.getAIConfig(userId)
      if (!config) {
        res.status(400).json({
          success: false,
          error: { code: 'CONFIG_ERROR', message: '请先选择 AI 模型或配置 AI 设置' }
        })
        return
      }
    }

    const db = getDB()

    const existingFunctions = await db.collection<{ _id: ObjectId; name: string; code: string }>('functions')
      .find({ userId })
      .project<{ _id: ObjectId; name: string; code: string }>({ _id: 1, name: 1, code: 1 })
      .toArray()

    const folders = await db.collection<{ _id: ObjectId; name: string; path: string }>('folders')
      .find({ userId })
      .project<{ _id: ObjectId; name: string; path: string }>({ _id: 1, name: 1, path: 1 })
      .toArray()

    const systemPrompt = getActionSystemPrompt({
      existingFunctions: existingFunctions.map((f) => ({
        id: f._id.toString(),
        name: f.name,
        code: f.code
      })),
      folders: folders.map((f) => ({
        id: f._id.toString(),
        name: f.name,
        path: f.path
      }))
    })

    let userPrompt = prompt
    if (context?.selectedCode) {
      userPrompt = `${prompt}\n\n当前代码:\n\`\`\`typescript\n${context.selectedCode}\n\`\`\``
    }
    if (context?.selectedFunctionId) {
      userPrompt = `${prompt}\n\n(目标函数 ID: ${context.selectedFunctionId})`
    }

    const messages: aiService.ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    let fullContent = ''

    try {
      res.write(`data: ${JSON.stringify({ status: 'thinking', message: 'AI 正在分析...' })}\n\n`)

      const effectiveModelId = modelId ? new ObjectId(modelId) : undefined
      for await (const chunk of aiService.chatStream(userId, messages, { enableThinking }, effectiveModelId)) {
        fullContent += chunk
        res.write(`data: ${JSON.stringify({ status: 'generating', content: chunk })}\n\n`)
      }

      let modelName: string | undefined
      if (modelId) {
        const model = await db.collection('ai_models').findOne({ _id: new ObjectId(modelId) })
        modelName = model?.name as string || model?.alias as string
      }

      // 从请求中获取基础URL
      const protocol = req.protocol
      const host = req.get('host')
      const baseUrl = `${protocol}://${host}`

      const executor = new AIExecutor(db, userId, {
        username: req.user!.username,
        modelName,
        baseUrl,
      })
      const plan = executor.parsePlan(fullContent)

      if (!plan) {
        res.write(`data: ${JSON.stringify({
          status: 'error',
          error: 'AI 返回的格式无法解析，请重试'
        })}\n\n`)
        res.end()
        return
      }

      res.write(`data: ${JSON.stringify({
        status: 'plan',
        plan: {
          thinking: plan.thinking,
          operations: plan.operations.map((op: { type: string; description?: string }) => ({
            type: op.type,
            description: op.description || `${op.type} 操作`
          })),
          summary: plan.summary
        }
      })}\n\n`)

      res.write(`data: ${JSON.stringify({ status: 'executing', message: '正在执行操作...' })}\n\n`)

      const result = await executor.execute(plan)

      res.write(`data: ${JSON.stringify({
        status: 'done',
        result: {
          success: result.success,
          message: result.message,
          results: result.results.map((r: { operation: { type: string }; success: boolean; error?: string; result?: unknown }) => ({
            type: r.operation.type,
            success: r.success,
            error: r.error,
            result: r.result
          }))
        }
      })}\n\n`)

      await aiService.saveAIHistory(userId, {
        action: 'generate',
        prompt,
        response: fullContent,
        model: modelId || 'custom'
      })

    } catch (streamError) {
      const errorMessage = streamError instanceof Error ? streamError.message : '执行失败'
      res.write(`data: ${JSON.stringify({ status: 'error', error: errorMessage })}\n\n`)
    }

    res.end()
  } catch (err) {
    const message = err instanceof Error ? err.message : '执行失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 预览 AI 操作计划 (不执行)
router.post('/preview', async (req: AuthRequest, res: Response) => {
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

    const db = getDB()

    const existingFunctions = await db.collection<{ _id: ObjectId; name: string; code: string }>('functions')
      .find({ userId })
      .project<{ _id: ObjectId; name: string; code: string }>({ _id: 1, name: 1, code: 1 })
      .toArray()

    const folders = await db.collection<{ _id: ObjectId; name: string; path: string }>('folders')
      .find({ userId })
      .project<{ _id: ObjectId; name: string; path: string }>({ _id: 1, name: 1, path: 1 })
      .toArray()

    const systemPrompt = getActionSystemPrompt({
      existingFunctions: existingFunctions.map((f) => ({
        id: f._id.toString(),
        name: f.name,
        code: f.code
      })),
      folders: folders.map((f) => ({
        id: f._id.toString(),
        name: f.name,
        path: f.path
      }))
    })

    let userPrompt = prompt
    if (context?.selectedCode) {
      userPrompt = `${prompt}\n\n当前代码:\n\`\`\`typescript\n${context.selectedCode}\n\`\`\``
    }

    const messages: aiService.ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    const response = await aiService.chat(userId, messages)

    // 从请求中获取基础URL
    const protocol = req.protocol
    const host = req.get('host')
    const baseUrl = `${protocol}://${host}`

    const executor = new AIExecutor(db, userId, {
      username: req.user!.username,
      baseUrl,
    })
    const plan = executor.parsePlan(response.content)

    if (!plan) {
      res.status(400).json({
        success: false,
        error: { code: 'PARSE_ERROR', message: 'AI 返回的格式无法解析' }
      })
      return
    }

    res.json({
      success: true,
      data: {
        plan,
        rawResponse: response.content
      }
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : '预览失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

export default router
