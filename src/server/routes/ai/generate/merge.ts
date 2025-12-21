/**
 * 函数合并分析路由
 */

import { Router, type Response, type Router as RouterType } from 'express'
import { ObjectId } from 'mongodb'
import type { AuthRequest } from '../../../middleware/auth.js'
import * as aiService from '../../../services/ai/index.js'
import { getDB } from '../../../db.js'
import { logAIAction } from '../../../services/functionAudit.js'
import { buildMergeAnalyzePrompt } from './prompts.js'

const router: RouterType = Router()

// 多函数合并分析
router.post('/merge-analyze', async (req: AuthRequest, res: Response) => {
  try {
    const { functions, modelId } = req.body

    if (!functions || !Array.isArray(functions) || functions.length < 2) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请至少选择 2 个函数进行合并分析' }
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

    const systemPrompt = buildMergeAnalyzePrompt()
    const functionCodes = functions.map((fn: { name: string; code: string }) =>
      `// 函数: ${fn.name}\n${fn.code}`
    ).join('\n\n---\n\n')
    const userPrompt = `请分析以下 ${functions.length} 个函数是否适合合并:\n\n${functionCodes}`

    const messages: aiService.ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    let fullContent = ''

    try {
      res.write(`data: ${JSON.stringify({ status: 'analyzing', message: 'AI 正在分析函数...' })}\n\n`)

      const effectiveModelId = modelId ? new ObjectId(modelId) : undefined
      for await (const chunk of aiService.chatStream(userId, messages, {}, effectiveModelId)) {
        fullContent += chunk
        res.write(`data: ${JSON.stringify({ status: 'generating', content: chunk })}\n\n`)
      }

      let mergePlan = null
      try {
        const jsonMatch = fullContent.match(/```json\s*([\s\S]*?)\s*```/)
        if (jsonMatch) {
          mergePlan = JSON.parse(jsonMatch[1])
        } else {
          mergePlan = JSON.parse(fullContent)
        }
      } catch {
        // 解析失败
      }

      res.write(`data: ${JSON.stringify({
        status: 'done',
        plan: mergePlan,
        message: mergePlan?.shouldMerge === false ? '这些函数不建议合并' : undefined
      })}\n\n`)

      await aiService.saveAIHistory(userId, {
        action: 'refactor',
        prompt: userPrompt,
        response: fullContent,
        model: modelId || 'custom'
      })
    } catch (streamError) {
      const errorMessage = streamError instanceof Error ? streamError.message : '分析失败'
      res.write(`data: ${JSON.stringify({ status: 'error', error: errorMessage })}\n\n`)
    }

    res.end()
  } catch (err) {
    const message = err instanceof Error ? err.message : '分析失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 确认执行合并计划
router.post('/merge/confirm', async (req: AuthRequest, res: Response) => {
  try {
    const { folderId, plan, originalFunctionIds } = req.body

    if (!plan || !plan.mergedFunction) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '无效的合并计划' }
      })
      return
    }

    const userId = new ObjectId(req.user!.userId)
    const db = getDB()

    const results: Array<{ type: string; name: string; success: boolean; error?: string }> = []

    try {
      const insertResult = await db.collection('functions').insertOne({
        userId,
        folderId: folderId ? new ObjectId(folderId) : null,
        name: plan.mergedFunction.name,
        code: plan.mergedFunction.code,
        description: plan.mergedFunction.description || '',
        published: false,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      results.push({ type: 'create', name: plan.mergedFunction.name, success: true })

      await logAIAction({
        functionId: insertResult.insertedId,
        functionName: plan.mergedFunction.name,
        userId,
        username: req.user!.username,
        action: 'create',
        changes: {
          after: plan.mergedFunction.code,
          description: `AI 合并创建: ${plan.mergedFunction.description || '合并函数'}`,
        },
        metadata: {
          originalFunctionIds,
        },
      }, db)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '创建失败'
      results.push({ type: 'create', name: plan.mergedFunction.name, success: false, error: errMsg })
    }

    const allSuccess = results.every(r => r.success)
    res.json({
      success: true,
      data: {
        success: allSuccess,
        message: allSuccess ? '合并完成，新函数已创建（未发布）。原函数保留供参考。' : '部分操作失败',
        results
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '执行失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

export default router
