/**
 * 函数重构路由
 */

import { Router, type Response, type Router as RouterType } from 'express'
import { ObjectId } from 'mongodb'
import type { AuthRequest } from '../../../middleware/auth.js'
import * as aiService from '../../../services/ai/index.js'
import { getDB } from '../../../db.js'
import { logAIAction } from '../../../services/functionAudit.js'
import { buildRefactorSystemPrompt } from './prompts.js'

const router: RouterType = Router()

// 函数解耦/重构
router.post('/refactor', async (req: AuthRequest, res: Response) => {
  try {
    const { code, functionName, functionId, folderId, modelId, autoExecute } = req.body

    if (!code) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'code 不能为空' }
      })
      return
    }

    const userId = new ObjectId(req.user!.userId)
    const db = getDB()

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

    const systemPrompt = buildRefactorSystemPrompt()
    const userPrompt = `请分析以下函数并评估是否需要解耦:\n\n函数名: ${functionName || '未知'}\n\n\`\`\`typescript\n${code}\n\`\`\``

    const messages: aiService.ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    let fullContent = ''

    try {
      res.write(`data: ${JSON.stringify({ status: 'analyzing', message: 'AI 正在分析代码...' })}\n\n`)

      const effectiveModelId = modelId ? new ObjectId(modelId) : undefined
      for await (const chunk of aiService.chatStream(userId, messages, {}, effectiveModelId)) {
        fullContent += chunk
        res.write(`data: ${JSON.stringify({ status: 'generating', content: chunk })}\n\n`)
      }

      let refactorPlan = null
      try {
        const jsonMatch = fullContent.match(/```json\s*([\s\S]*?)\s*```/)
        if (jsonMatch) {
          refactorPlan = JSON.parse(jsonMatch[1])
        } else {
          refactorPlan = JSON.parse(fullContent)
        }
      } catch {
        // 解析失败
      }

      if (autoExecute && refactorPlan && refactorPlan.shouldRefactor && refactorPlan.suggestions?.length > 0) {
        res.write(`data: ${JSON.stringify({ status: 'executing', message: '正在创建拆分后的函数...' })}\n\n`)

        const results: Array<{ type: string; name: string; success: boolean; error?: string }> = []

        for (const suggestion of refactorPlan.suggestions) {
          try {
            const insertResult = await db.collection('functions').insertOne({
              userId,
              folderId: folderId ? new ObjectId(folderId) : null,
              name: suggestion.name,
              code: suggestion.code,
              description: suggestion.description || '',
              published: false,
              createdAt: new Date(),
              updatedAt: new Date()
            })
            results.push({ type: 'create', name: suggestion.name, success: true })

            await logAIAction({
              functionId: insertResult.insertedId,
              functionName: suggestion.name,
              userId,
              username: req.user!.username,
              action: 'create',
              changes: {
                after: suggestion.code,
                description: `AI 重构创建: ${suggestion.description || '辅助函数'}`,
              },
            }, db)
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : '创建失败'
            results.push({ type: 'create', name: suggestion.name, success: false, error: errMsg })
          }
        }

        if (functionId && refactorPlan.entryFunction?.code) {
          try {
            const oldFunc = await db.collection('functions').findOne({ _id: new ObjectId(functionId), userId })

            await db.collection('functions').updateOne(
              { _id: new ObjectId(functionId), userId },
              { $set: { code: refactorPlan.entryFunction.code, updatedAt: new Date() } }
            )
            results.push({ type: 'update', name: functionName || '原函数', success: true })

            await logAIAction({
              functionId,
              functionName: functionName || '原函数',
              userId,
              username: req.user!.username,
              action: 'update',
              changes: {
                before: oldFunc?.code as string,
                after: refactorPlan.entryFunction.code,
                description: 'AI 重构更新入口函数',
              },
            }, db)
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : '更新失败'
            results.push({ type: 'update', name: functionName || '原函数', success: false, error: errMsg })
          }
        }

        res.write(`data: ${JSON.stringify({
          status: 'done',
          plan: refactorPlan,
          executed: true,
          results
        })}\n\n`)
      } else {
        res.write(`data: ${JSON.stringify({
          status: 'done',
          plan: refactorPlan,
          executed: false,
          message: refactorPlan?.shouldRefactor === false ? '代码结构良好，无需重构' : undefined
        })}\n\n`)
      }

      await aiService.saveAIHistory(userId, {
        action: 'refactor',
        prompt: userPrompt,
        response: fullContent,
        model: 'custom'
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

// 确认执行解耦计划
router.post('/refactor/confirm', async (req: AuthRequest, res: Response) => {
  try {
    const { functionId, folderId, plan } = req.body

    if (!plan || !plan.suggestions) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '无效的执行计划' }
      })
      return
    }

    const userId = new ObjectId(req.user!.userId)
    const db = getDB()

    const results: Array<{ type: string; name: string; success: boolean; error?: string }> = []

    for (const suggestion of plan.suggestions) {
      try {
        const insertResult = await db.collection('functions').insertOne({
          userId,
          folderId: folderId ? new ObjectId(folderId) : null,
          name: suggestion.name,
          code: suggestion.code,
          description: suggestion.description || '',
          published: false,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        results.push({ type: 'create', name: suggestion.name, success: true })

        await logAIAction({
          functionId: insertResult.insertedId,
          functionName: suggestion.name,
          userId,
          username: req.user!.username,
          action: 'create',
          changes: {
            after: suggestion.code,
            description: `AI 重构确认创建: ${suggestion.description || '辅助函数'}`,
          },
        }, db)
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : '创建失败'
        results.push({ type: 'create', name: suggestion.name, success: false, error: errMsg })
      }
    }

    if (functionId && plan.entryFunction?.code) {
      try {
        const oldFunc = await db.collection('functions').findOne({ _id: new ObjectId(functionId), userId })

        await db.collection('functions').updateOne(
          { _id: new ObjectId(functionId), userId },
          { $set: { code: plan.entryFunction.code, updatedAt: new Date() } }
        )
        results.push({ type: 'update', name: plan.entryFunction.name || '原函数', success: true })

        await logAIAction({
          functionId,
          functionName: plan.entryFunction.name || '原函数',
          userId,
          username: req.user!.username,
          action: 'update',
          changes: {
            before: oldFunc?.code as string,
            after: plan.entryFunction.code,
            description: 'AI 重构确认更新入口函数',
          },
        }, db)
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : '更新失败'
        results.push({ type: 'update', name: plan.entryFunction.name || '原函数', success: false, error: errMsg })
      }
    }

    const allSuccess = results.every(r => r.success)
    res.json({
      success: true,
      data: {
        success: allSuccess,
        message: allSuccess ? '重构完成，函数已创建/更新（未发布）' : '部分操作失败',
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
