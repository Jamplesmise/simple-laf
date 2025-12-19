import { Router, type Response } from 'express'
import type { Router as RouterType } from 'express'
import { ObjectId } from 'mongodb'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import * as aiService from '../services/ai/index.js'
import * as debugService from '../services/ai/debug.js'
import * as conversationService from '../services/ai/conversation.js'
import * as systemPromptService from '../services/ai/systemPrompt.js'
import * as providerService from '../services/ai/provider.js'
import { AIExecutor, getActionSystemPrompt, getFlexibleSystemPrompt, type ConversationContext } from '../services/ai/executor.js'
import { parseToolCalls, toolToOperationType } from '../services/ai/tools.js'
import { getDB } from '../db.js'
import { getLogSummary, formatLogSummaryForAI } from '../services/logAnalysis.js'
import { logAIAction } from '../services/functionAudit.js'

const router: RouterType = Router()

// 所有路由都需要认证
router.use(authMiddleware)

// 获取 AI 配置 (apiKey 脱敏)
router.get('/config', async (req: AuthRequest, res) => {
  try {
    const config = await aiService.getAIConfigMasked(new ObjectId(req.user!.userId))
    res.json({ success: true, data: config })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取配置失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 保存 AI 配置
router.put('/config', async (req: AuthRequest, res) => {
  try {
    const { provider, model, apiKey, baseUrl, params } = req.body

    if (!provider || !model) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '供应商和模型不能为空' }
      })
      return
    }

    await aiService.saveAIConfig(new ObjectId(req.user!.userId), {
      provider,
      model,
      apiKey,
      baseUrl,
      params
    })

    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '保存配置失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 测试 AI 连接
router.post('/config/test', async (req: AuthRequest, res) => {
  try {
    const result = await aiService.testAIConnection(new ObjectId(req.user!.userId))
    res.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : '测试连接失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取可用模型列表
router.get('/models', async (req: AuthRequest, res) => {
  try {
    const models = await aiService.getAvailableModels(new ObjectId(req.user!.userId))
    res.json({ success: true, data: models })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取模型列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取供应商的默认模型列表
router.get('/models/:provider', async (req: AuthRequest, res) => {
  try {
    const { provider } = req.params
    const models = aiService.getProviderDefaultModels(provider as aiService.AIConfig['provider'])
    res.json({ success: true, data: models })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取模型列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

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

    // 构建 system prompt
    const systemPrompt = buildGenerateSystemPrompt(context)
    const messages: aiService.ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ]

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    let fullContent = ''

    try {
      for await (const chunk of aiService.chatStream(userId, messages)) {
        fullContent += chunk
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
      }

      // 发送完成信号
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`)

      // 保存历史记录
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

// 生成多个函数 (流式)
router.post('/generate-multi', async (req: AuthRequest, res: Response) => {
  try {
    const { prompt, folderId, context } = req.body

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

    // 构建 system prompt
    const systemPrompt = buildGenerateMultiSystemPrompt(context)
    const messages: aiService.ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ]

    // 设置 SSE 响应头
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
        action: 'generate-multi',
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

    // 如果没有指定 modelId，检查旧的 AI 配置
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

      // 尝试解析结果
      let refactorPlan = null
      try {
        // 提取 JSON 块
        const jsonMatch = fullContent.match(/```json\s*([\s\S]*?)\s*```/)
        if (jsonMatch) {
          refactorPlan = JSON.parse(jsonMatch[1])
        } else {
          // 尝试直接解析整个内容
          refactorPlan = JSON.parse(fullContent)
        }
      } catch {
        // 解析失败，继续流式返回原始内容
      }

      // 如果 autoExecute 为 true 且 AI 建议重构，自动创建新函数
      if (autoExecute && refactorPlan && refactorPlan.shouldRefactor && refactorPlan.suggestions?.length > 0) {
        res.write(`data: ${JSON.stringify({ status: 'executing', message: '正在创建拆分后的函数...' })}\n\n`)

        const results: Array<{ type: string; name: string; success: boolean; error?: string }> = []

        // 创建辅助函数
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

            // 记录审计日志
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

        // 更新原函数
        if (functionId && refactorPlan.entryFunction?.code) {
          try {
            // 获取更新前的代码
            const oldFunc = await db.collection('functions').findOne({ _id: new ObjectId(functionId), userId })

            await db.collection('functions').updateOne(
              { _id: new ObjectId(functionId), userId },
              { $set: { code: refactorPlan.entryFunction.code, updatedAt: new Date() } }
            )
            results.push({ type: 'update', name: functionName || '原函数', success: true })

            // 记录审计日志
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

// 确认执行解耦计划 (用户批准后执行)
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

    // 创建辅助函数 (不发布)
    for (const suggestion of plan.suggestions) {
      try {
        const insertResult = await db.collection('functions').insertOne({
          userId,
          folderId: folderId ? new ObjectId(folderId) : null,
          name: suggestion.name,
          code: suggestion.code,
          description: suggestion.description || '',
          published: false,  // 不自动发布
          createdAt: new Date(),
          updatedAt: new Date()
        })
        results.push({ type: 'create', name: suggestion.name, success: true })

        // 记录审计日志
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

    // 更新原函数 (不发布)
    if (functionId && plan.entryFunction?.code) {
      try {
        // 获取更新前的代码
        const oldFunc = await db.collection('functions').findOne({ _id: new ObjectId(functionId), userId })

        await db.collection('functions').updateOne(
          { _id: new ObjectId(functionId), userId },
          {
            $set: {
              code: plan.entryFunction.code,
              updatedAt: new Date()
              // 注意: 不修改 published 状态，保持原有发布状态
            }
          }
        )
        results.push({ type: 'update', name: plan.entryFunction.name || '原函数', success: true })

        // 记录审计日志
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

    // 如果没有指定 modelId，检查旧的 AI 配置
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

      // 尝试解析结果
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

// 确认执行合并计划 (用户批准后执行)
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

    // 创建合并后的函数 (不发布)
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

      // 记录审计日志
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

    // 可选: 标记原函数为已合并 (不删除，留给用户手动处理)

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

// ============ AI Action 执行系统 ============

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

    // 如果没有指定 modelId，检查旧的 AI 配置
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

    // 获取现有函数和文件夹作为上下文
    const existingFunctions = await db.collection<{ _id: ObjectId; name: string; code: string }>('functions')
      .find({ userId })
      .project<{ _id: ObjectId; name: string; code: string }>({ _id: 1, name: 1, code: 1 })
      .toArray()

    const folders = await db.collection<{ _id: ObjectId; name: string; path: string }>('folders')
      .find({ userId })
      .project<{ _id: ObjectId; name: string; path: string }>({ _id: 1, name: 1, path: 1 })
      .toArray()

    // 构建系统提示
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

    // 如果有额外上下文（如选中的函数代码）
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

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    let fullContent = ''

    try {
      // 发送思考中状态
      res.write(`data: ${JSON.stringify({ status: 'thinking', message: 'AI 正在分析...' })}\n\n`)

      // 收集 AI 响应
      const effectiveModelId = modelId ? new ObjectId(modelId) : undefined
      for await (const chunk of aiService.chatStream(userId, messages, { enableThinking }, effectiveModelId)) {
        fullContent += chunk
        res.write(`data: ${JSON.stringify({ status: 'generating', content: chunk })}\n\n`)
      }

      // 获取模型名称（用于审计日志）
      let modelName: string | undefined
      if (modelId) {
        const model = await db.collection('ai_models').findOne({ _id: new ObjectId(modelId) })
        modelName = model?.name as string || model?.alias as string
      }

      // 解析执行计划
      const executor = new AIExecutor(db, userId, {
        username: req.user!.username,
        modelName,
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

      // 发送计划
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

      // 执行操作
      res.write(`data: ${JSON.stringify({ status: 'executing', message: '正在执行操作...' })}\n\n`)

      const result = await executor.execute(plan)

      // 发送执行结果
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

      // 保存历史记录
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

    // 获取现有函数和文件夹
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

    // 非流式调用，获取完整计划
    const response = await aiService.chat(userId, messages)

    const executor = new AIExecutor(db, userId, {
      username: req.user!.username,
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

// ============ Prompt 构建函数 ============

function buildGenerateSystemPrompt(context?: {
  existingFunctions?: string[]
  dependencies?: string[]
  envVariables?: string[]
}): string {
  let prompt = `你是一个云函数开发助手。你的任务是根据用户的描述生成 TypeScript 云函数代码。

云函数的基本结构:
\`\`\`typescript
import cloud from '@/cloud-sdk'

export default async function (ctx: FunctionContext) {
  // 你的代码
  return { data: 'result' }
}
\`\`\`

FunctionContext 包含:
- ctx.body: 请求体 (POST/PUT)
- ctx.query: URL 查询参数
- ctx.headers: 请求头
- ctx.method: HTTP 方法

导入其他云函数:
\`\`\`typescript
import { someHelper } from '@/utils/helpers'
import validateInput from '@/validators/inputValidator'
\`\`\`

要求:
1. 生成完整可运行的代码
2. 使用 TypeScript，添加必要的类型注解
3. 包含基础错误处理
4. 代码简洁清晰
5. 如需调用其他函数，使用 \`import { xxx } from '@/函数路径'\` 导入
6. 只返回代码，不要额外解释`

  if (context?.existingFunctions?.length) {
    prompt += `\n\n已有函数: ${context.existingFunctions.join(', ')}`
  }

  if (context?.dependencies?.length) {
    prompt += `\n\n可用依赖: ${context.dependencies.join(', ')}`
  }

  if (context?.envVariables?.length) {
    prompt += `\n\n可用环境变量: ${context.envVariables.join(', ')}`
  }

  return prompt
}

function buildGenerateMultiSystemPrompt(context?: {
  existingFunctions?: string[]
  dependencies?: string[]
}): string {
  return `你是一个云函数开发助手。你的任务是根据用户的描述生成多个相关的 TypeScript 云函数。

请以 JSON 格式返回，结构如下:
\`\`\`json
{
  "functions": [
    {
      "name": "functionName",
      "code": "完整的函数代码",
      "description": "函数描述"
    }
  ],
  "folderName": "建议的文件夹名称"
}
\`\`\`

云函数的基本结构:
\`\`\`typescript
import cloud from '@/cloud-sdk'

export default async function (ctx: FunctionContext) {
  return { data: 'result' }
}
\`\`\`

导入其他云函数:
\`\`\`typescript
import { someHelper } from '@/utils/helpers'
import validateInput from '@/validators/inputValidator'
\`\`\`

要求:
1. 每个函数职责单一
2. 函数之间使用 \`import { xxx } from '@/函数路径'\` 相互调用
3. 使用 TypeScript
4. 包含基础错误处理
5. 可以使用命名导出 \`export function xxx()\` 供其他函数导入
6. 只返回 JSON，不要额外解释`
}

function buildRefactorSystemPrompt(): string {
  return `你是一个代码重构专家。你的任务是分析云函数代码，评估是否需要解耦重构。

**重要**: 请根据代码实际情况自行判断是否需要重构。不是所有代码都需要拆分，简单清晰的代码保持原样即可。

评估标准:
- 函数行数超过 50 行
- 存在深层嵌套（3层以上）
- 一个函数承担多个不相关的职责
- 存在重复逻辑可以提取
- 代码难以理解或维护

如果代码已经足够简洁，shouldRefactor 应为 false。

请以 JSON 格式返回分析结果:
\`\`\`json
{
  "analysis": "对当前代码的分析，包括代码质量、可读性、复杂度等",
  "shouldRefactor": true/false,
  "reason": "给出你的判断理由",
  "suggestions": [
    {
      "name": "新函数名 (如 helper_xxx)",
      "code": "拆分后的完整函数代码",
      "description": "这个函数的职责说明"
    }
  ],
  "entryFunction": {
    "name": "原函数名",
    "code": "重构后的入口函数代码，调用拆分出的辅助函数"
  }
}
\`\`\`

云函数代码规范:
- 使用 \`import cloud from '@/cloud-sdk'\` 导入云 SDK
- 使用 \`import { xxx } from '@/函数路径'\` 导入其他云函数
- 使用 \`export default async function (ctx: FunctionContext)\` 导出主函数
- 使用 \`export function xxx()\` 导出供其他函数调用的命名函数

注意:
- 如果 shouldRefactor 为 false，suggestions 和 entryFunction 可以为空
- 拆分的辅助函数应使用命名导出，方便其他函数导入
- 保持原有功能完全不变`
}

function buildDiagnoseSystemPrompt(): string {
  return `你是一个代码诊断专家。你的任务是分析代码错误并提供修复建议。

请以 JSON 格式返回诊断结果:
\`\`\`json
{
  "errorType": "错误类型",
  "analysis": "错误原因分析",
  "suggestion": "修复建议",
  "fixedCode": "修复后的完整代码"
}
\`\`\`

诊断要求:
1. 准确定位错误原因
2. 提供清晰的解释
3. 给出可直接使用的修复代码
4. 如果有多种可能，说明最可能的原因`
}

function buildMergeAnalyzePrompt(): string {
  return `你是一个代码重构专家。你的任务是分析多个云函数，评估是否适合合并为一个函数。

**重要**: 请根据代码实际情况自行判断是否需要合并。不是所有函数都需要合并，保持职责单一的函数更易维护。

合并评估标准:
- 函数功能高度相关或重复
- 存在大量重复代码
- 可以通过参数化实现统一处理
- 合并后能显著减少代码量且不影响可读性

不建议合并的情况:
- 函数职责清晰独立
- 合并后会导致代码过于复杂
- 函数之间只是调用关系而非重复

请以 JSON 格式返回分析结果:
\`\`\`json
{
  "analysis": "对这些函数的分析，包括功能关系、代码重复程度等",
  "shouldMerge": true/false,
  "reason": "给出你的判断理由",
  "mergedFunction": {
    "name": "合并后的函数名",
    "code": "合并后的完整函数代码",
    "description": "函数描述"
  }
}
\`\`\`

云函数代码规范:
- 使用 \`import cloud from '@/cloud-sdk'\` 导入云 SDK
- 使用 \`import { xxx } from '@/函数路径'\` 导入其他云函数
- 使用 \`export default async function (ctx: FunctionContext)\` 导出主函数
- 使用 \`export function xxx()\` 导出供其他函数调用的命名函数

注意:
- 如果 shouldMerge 为 false，mergedFunction 可以为空或省略
- 保持原有功能完全不变`
}

// ============ 对话管理 API ============

// 获取对话列表
router.get('/conversations', async (req: AuthRequest, res) => {
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
router.post('/conversations', async (req: AuthRequest, res) => {
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
router.get('/conversations/:id', async (req: AuthRequest, res) => {
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
router.patch('/conversations/:id', async (req: AuthRequest, res) => {
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
router.delete('/conversations/:id', async (req: AuthRequest, res) => {
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

// 发送消息并获取 AI 回复 (SSE 流式)
router.post('/conversations/:id/chat', async (req: AuthRequest, res: Response) => {
  try {
    const userId = new ObjectId(req.user!.userId)
    const conversationId = new ObjectId(req.params.id)
    const { message, context, modelId, enableThinking } = req.body

    if (!message?.trim()) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '消息内容不能为空' }
      })
      return
    }

    // 验证对话存在
    const conversationData = await conversationService.getConversation(userId, conversationId)
    if (!conversationData) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '对话不存在' }
      })
      return
    }

    // 保存用户消息
    const userMessage = await conversationService.addMessage(conversationId, 'user', message)

    // 如果是第一条消息，自动生成标题
    if (conversationData.messages.length === 0) {
      await conversationService.autoGenerateTitle(conversationId, message)
    }

    // 解析 modelId
    let modelObjectId: ObjectId | undefined
    if (modelId) {
      try {
        modelObjectId = new ObjectId(modelId)
      } catch {
        // 无效的 modelId，忽略
      }
    }

    // 如果没有指定 modelId，检查旧的 AI 配置
    if (!modelObjectId) {
      const config = await aiService.getAIConfig(userId)
      if (!config) {
        // 尝试获取默认模型
        const db = getDB()
        const defaultModel = await providerService.getDefaultModel(db, userId)
        if (defaultModel) {
          modelObjectId = defaultModel._id
        } else {
          // 保存错误消息
          await conversationService.addMessage(conversationId, 'assistant', '请先配置 AI 模型')
          res.status(400).json({
            success: false,
            error: { code: 'NO_CONFIG', message: '请先配置 AI 模型' }
          })
          return
        }
      }
    }

    const db = getDB()

    // 获取函数和文件夹作为上下文
    const existingFunctions = await db.collection<{ _id: ObjectId; name: string; code: string }>('functions')
      .find({ userId })
      .project<{ _id: ObjectId; name: string; code: string }>({ _id: 1, name: 1, code: 1 })
      .toArray()

    const folders = await db.collection<{ _id: ObjectId; name: string; path: string }>('folders')
      .find({ userId })
      .project<{ _id: ObjectId; name: string; path: string }>({ _id: 1, name: 1, path: 1 })
      .toArray()

    // 获取自定义系统提示词
    let customPromptContent = ''
    if (context?.systemPromptId) {
      try {
        const customPrompt = await systemPromptService.getSystemPrompt(
          db,
          userId,
          new ObjectId(context.systemPromptId)
        )
        if (customPrompt) {
          customPromptContent = customPrompt.content + '\n\n'
        }
      } catch {
        // 忽略错误，使用默认提示词
      }
    }

    // 解析 @ 引用的函数
    const referencedFunctions: Array<{ id: string; name: string; code: string }> = []
    if (context?.referencedFunctionIds?.length) {
      for (const fnId of context.referencedFunctionIds) {
        try {
          const fn = await db.collection<{ _id: ObjectId; name: string; code: string }>('functions')
            .findOne({ _id: new ObjectId(fnId), userId })
          if (fn) {
            referencedFunctions.push({
              id: fn._id.toString(),
              name: fn.name,
              code: fn.code
            })
          }
        } catch {
          // 忽略无效 ID
        }
      }
    }

    // 构建对话上下文
    const conversationContext: ConversationContext = {
      existingFunctions: existingFunctions.map((f) => ({
        id: f._id.toString(),
        name: f.name,
        code: f.code
      })),
      folders: folders.map((f) => ({
        id: f._id.toString(),
        name: f.name,
        path: f.path
      })),
      referencedFunctions: referencedFunctions.length > 0 ? referencedFunctions : undefined,
      customPrompt: customPromptContent || undefined
    }

    // 使用灵活的系统提示词（让 AI 自主决定使用工具还是对话）
    const systemPrompt = getFlexibleSystemPrompt(conversationContext)

    // 构建消息历史
    const messages: aiService.ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      // 历史消息
      ...conversationData.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })),
      // 当前消息
      { role: 'user', content: message }
    ]

    // 如果有上下文（选中的代码等）
    if (context?.selectedCode) {
      const lastIndex = messages.length - 1
      messages[lastIndex].content = `${message}\n\n当前代码:\n\`\`\`typescript\n${context.selectedCode}\n\`\`\``
    }

    // 日志分析模式 (通过 context.analyzeLog 显式触发)
    if (context?.analyzeLog) {
      try {
        const logDays = context.logDays || 7
        const logSummary = await getLogSummary(userId.toString(), {
          days: logDays,
          functionId: context.logFunctionId
        })
        const logSummaryText = formatLogSummaryForAI(logSummary, logDays)

        // 将日志摘要注入到用户消息中
        const lastIndex = messages.length - 1
        messages[lastIndex].content = `${messages[lastIndex].content}\n\n---\n\n以下是用户的执行日志数据，请基于这些数据进行分析和回答:\n\n${logSummaryText}`
      } catch {
        // 获取日志摘要失败，继续执行
      }
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    let fullContent = ''

    try {
      // 发送用户消息 ID
      res.write(`data: ${JSON.stringify({
        status: 'user_message',
        messageId: userMessage._id.toString()
      })}\n\n`)

      // 发送思考中状态
      res.write(`data: ${JSON.stringify({ status: 'thinking', message: 'AI 正在分析...' })}\n\n`)

      // 收集 AI 响应
      for await (const chunk of aiService.chatStream(userId, messages, undefined, modelObjectId)) {
        fullContent += chunk
        res.write(`data: ${JSON.stringify({ status: 'generating', content: chunk })}\n\n`)
      }

      // 解析 AI 响应（支持工具调用和纯文本）
      const aiResponse = parseToolCalls(fullContent)

      // 分析类工具（不需要执行，AI 的回复内容就是结果）
      const analysisTools = ['explain_code', 'analyze_refactor', 'analyze_merge', 'analyze_logs', 'debug_function', 'run_function']

      if (aiResponse.type === 'tool_use' && aiResponse.toolCalls?.length) {
        // 检查是否都是分析类工具
        const allAnalysisTools = aiResponse.toolCalls.every(call => analysisTools.includes(call.tool))

        if (allAnalysisTools) {
          // 分析类工具：AI 的自然语言回复就是结果，不需要执行
          // 发送计划（显示 AI 选择了什么分析操作）
          res.write(`data: ${JSON.stringify({
            status: 'plan',
            plan: {
              thinking: aiResponse.content,
              operations: aiResponse.toolCalls.map(call => ({
                type: call.tool,
                description: (call.arguments as { description?: string }).description || `${call.tool} 分析`
              })),
              summary: `分析完成`
            }
          })}\n\n`)

          // 保存 AI 回复消息（内容就是分析结果）
          const assistantMessage = await conversationService.addMessage(
            conversationId,
            'assistant',
            aiResponse.content || fullContent,
            {
              success: true,
              operations: aiResponse.toolCalls.map(call => ({
                type: call.tool,
                success: true
              }))
            }
          )

          res.write(`data: ${JSON.stringify({
            status: 'done',
            messageId: assistantMessage._id.toString(),
            result: { success: true, message: '分析完成' }
          })}\n\n`)
        } else {
          // 操作类工具：需要执行
          // 获取模型名称（用于审计日志）
          let modelName: string | undefined
          if (modelObjectId) {
            const model = await db.collection('ai_models').findOne({ _id: modelObjectId })
            modelName = model?.name as string || model?.alias as string
          }

          const executor = new AIExecutor(db, userId, {
            username: req.user!.username,
            modelName,
          })

          // 过滤出可执行的操作（排除分析类工具）
          const executableCalls = aiResponse.toolCalls.filter(call => !analysisTools.includes(call.tool))

          // 转换工具调用为执行计划
          const operations = executableCalls.map((call) => {
            // 将工具名转换为操作类型
            const operationType = toolToOperationType[call.tool] || call.tool
            return {
              type: operationType,
              ...call.arguments
            } as import('../services/ai/types.js').AIOperation
          })

          // 发送计划
          res.write(`data: ${JSON.stringify({
            status: 'plan',
            plan: {
              thinking: aiResponse.content,
              operations: operations.map((op) => ({
                type: op.type,
                description: (op as { description?: string }).description || `${op.type} 操作`
              })),
              summary: `执行 ${operations.length} 个操作`
            }
          })}\n\n`)

          // 执行操作
          res.write(`data: ${JSON.stringify({ status: 'executing', message: '正在执行操作...' })}\n\n`)

          const result = await executor.execute({
            operations,
            summary: `执行 ${operations.length} 个工具调用`
          })

          // 保存 AI 回复消息（包含执行结果）
          const assistantMessage = await conversationService.addMessage(
            conversationId,
            'assistant',
            fullContent,
            {
              success: result.success,
              operations: result.results.map((r: { operation: { type: string }; success: boolean; error?: string }) => ({
                type: r.operation.type,
                success: r.success,
                error: r.error
              }))
            }
          )

          // 发送执行结果
          res.write(`data: ${JSON.stringify({
            status: 'done',
            messageId: assistantMessage._id.toString(),
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
        }
      } else {
        // 纯文本回复（AI 选择不使用工具）
        const assistantMessage = await conversationService.addMessage(
          conversationId,
          'assistant',
          fullContent
        )

        res.write(`data: ${JSON.stringify({
          status: 'done',
          messageId: assistantMessage._id.toString(),
          result: { success: true, message: '回复完成' }
        })}\n\n`)
      }
    } catch (streamErr) {
      const errorMessage = streamErr instanceof Error ? streamErr.message : 'AI 处理失败'

      // 保存错误消息
      await conversationService.addMessage(conversationId, 'assistant', `错误: ${errorMessage}`)

      res.write(`data: ${JSON.stringify({
        status: 'error',
        error: errorMessage
      })}\n\n`)
    }

    res.end()
  } catch (err) {
    const message = err instanceof Error ? err.message : '发送消息失败'
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message }
      })
    }
  }
})

// ============ 系统提示词管理 API ============

// 获取默认系统提示词 (必须在 /prompts/:id 之前)
router.get('/prompts/default', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)

    const prompt = await systemPromptService.getDefaultSystemPrompt(db, userId)

    res.json({
      success: true,
      data: prompt ? {
        ...prompt,
        _id: prompt._id.toString(),
        userId: prompt.userId.toString(),
      } : null
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取默认提示词失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取系统提示词列表
router.get('/prompts', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const prompts = await systemPromptService.listSystemPrompts(db, userId)

    res.json({
      success: true,
      data: prompts.map(p => ({
        ...p,
        _id: p._id.toString(),
        userId: p.userId.toString(),
      }))
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取提示词列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 创建系统提示词
router.post('/prompts', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const { name, content, isDefault } = req.body

    if (!name?.trim() || !content?.trim()) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '名称和内容不能为空' }
      })
      return
    }

    const prompt = await systemPromptService.createSystemPrompt(db, userId, {
      name: name.trim(),
      content: content.trim(),
      isDefault
    })

    res.json({
      success: true,
      data: {
        ...prompt,
        _id: prompt._id.toString(),
        userId: prompt.userId.toString(),
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建提示词失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取单个系统提示词
router.get('/prompts/:id', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const promptId = new ObjectId(req.params.id)

    const prompt = await systemPromptService.getSystemPrompt(db, userId, promptId)

    if (!prompt) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '提示词不存在' }
      })
      return
    }

    res.json({
      success: true,
      data: {
        ...prompt,
        _id: prompt._id.toString(),
        userId: prompt.userId.toString(),
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取提示词失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 更新系统提示词
router.put('/prompts/:id', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const promptId = new ObjectId(req.params.id)
    const { name, content, isDefault, changeNote } = req.body

    const prompt = await systemPromptService.updateSystemPrompt(db, userId, promptId, {
      name,
      content,
      isDefault,
      changeNote
    })

    if (!prompt) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '提示词不存在' }
      })
      return
    }

    res.json({
      success: true,
      data: {
        ...prompt,
        _id: prompt._id.toString(),
        userId: prompt.userId.toString(),
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新提示词失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 删除系统提示词
router.delete('/prompts/:id', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const promptId = new ObjectId(req.params.id)

    const deleted = await systemPromptService.deleteSystemPrompt(db, userId, promptId)

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '提示词不存在' }
      })
      return
    }

    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除提示词失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取版本历史
router.get('/prompts/:id/versions', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const promptId = new ObjectId(req.params.id)

    const versions = await systemPromptService.listPromptVersions(db, userId, promptId)

    res.json({
      success: true,
      data: versions.map(v => ({
        ...v,
        _id: v._id.toString(),
        promptId: v.promptId.toString(),
      }))
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取版本历史失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 回滚到指定版本
router.post('/prompts/:id/rollback', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const promptId = new ObjectId(req.params.id)
    const { version } = req.body

    if (typeof version !== 'number') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '版本号无效' }
      })
      return
    }

    const prompt = await systemPromptService.rollbackToVersion(db, userId, promptId, version)

    if (!prompt) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '提示词或版本不存在' }
      })
      return
    }

    res.json({
      success: true,
      data: {
        ...prompt,
        _id: prompt._id.toString(),
        userId: prompt.userId.toString(),
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '回滚失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// ============ 供应商管理 API ============

// 获取供应商列表
router.get('/providers', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)

    // 初始化默认供应商
    await providerService.initDefaultProviders(db, userId)

    const providers = await providerService.listProviders(db, userId)

    res.json({
      success: true,
      data: providers.map(p => ({
        ...providerService.maskApiKey(p),
        _id: p._id.toString(),
        userId: p.userId.toString(),
      }))
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取供应商列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 创建供应商
router.post('/providers', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const { name, type, baseUrl, apiKey, isDefault } = req.body

    if (!name?.trim() || !type || !baseUrl?.trim()) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '名称、类型和地址不能为空' }
      })
      return
    }

    const provider = await providerService.createProvider(db, userId, {
      name: name.trim(),
      type,
      baseUrl: baseUrl.trim(),
      apiKey,
      isDefault
    })

    res.json({
      success: true,
      data: {
        ...providerService.maskApiKey(provider),
        _id: provider._id.toString(),
        userId: provider.userId.toString(),
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建供应商失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取单个供应商
router.get('/providers/:id', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const providerId = new ObjectId(req.params.id)

    const provider = await providerService.getProvider(db, userId, providerId)

    if (!provider) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '供应商不存在' }
      })
      return
    }

    res.json({
      success: true,
      data: {
        ...providerService.maskApiKey(provider),
        _id: provider._id.toString(),
        userId: provider.userId.toString(),
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取供应商失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 更新供应商
router.put('/providers/:id', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const providerId = new ObjectId(req.params.id)
    const { name, baseUrl, apiKey, isDefault } = req.body

    const provider = await providerService.updateProvider(db, userId, providerId, {
      name,
      baseUrl,
      apiKey,
      isDefault
    })

    if (!provider) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '供应商不存在' }
      })
      return
    }

    res.json({
      success: true,
      data: {
        ...providerService.maskApiKey(provider),
        _id: provider._id.toString(),
        userId: provider.userId.toString(),
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新供应商失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 删除供应商
router.delete('/providers/:id', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const providerId = new ObjectId(req.params.id)

    const deleted = await providerService.deleteProvider(db, userId, providerId)

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '供应商不存在' }
      })
      return
    }

    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除供应商失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// ============ 模型管理 API ============

// 获取供应商的模型列表
router.get('/providers/:providerId/models', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const providerId = new ObjectId(req.params.providerId)

    const models = await providerService.listModels(db, userId, providerId)

    res.json({
      success: true,
      data: models.map(m => ({
        ...m,
        _id: m._id.toString(),
        providerId: m.providerId.toString(),
        userId: m.userId.toString(),
      }))
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取模型列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取所有模型
router.get('/all-models', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)

    const models = await providerService.listAllModels(db, userId)

    res.json({
      success: true,
      data: models.map(m => ({
        ...m,
        _id: m._id.toString(),
        providerId: m.providerId.toString(),
        userId: m.userId.toString(),
      }))
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取模型列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 创建模型
router.post('/providers/:providerId/models', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const providerId = new ObjectId(req.params.providerId)
    const { name, alias, temperature, maxTokens, pricing, supportsThinking, isDefault } = req.body

    if (!name?.trim() || !alias?.trim()) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '模型名称和别名不能为空' }
      })
      return
    }

    const model = await providerService.createModel(db, userId, providerId, {
      name: name.trim(),
      alias: alias.trim(),
      temperature,
      maxTokens,
      pricing,
      supportsThinking,
      isDefault
    })

    if (!model) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '供应商不存在' }
      })
      return
    }

    res.json({
      success: true,
      data: {
        ...model,
        _id: model._id.toString(),
        providerId: model.providerId.toString(),
        userId: model.userId.toString(),
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建模型失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取单个模型
router.get('/models/:id', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const modelId = new ObjectId(req.params.id)

    const model = await providerService.getModel(db, userId, modelId)

    if (!model) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '模型不存在' }
      })
      return
    }

    res.json({
      success: true,
      data: {
        ...model,
        _id: model._id.toString(),
        providerId: model.providerId.toString(),
        userId: model.userId.toString(),
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取模型失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 更新模型
router.put('/models/:id', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const modelId = new ObjectId(req.params.id)
    const { name, alias, temperature, maxTokens, pricing, supportsThinking, isDefault } = req.body

    const model = await providerService.updateModel(db, userId, modelId, {
      name,
      alias,
      temperature,
      maxTokens,
      pricing,
      supportsThinking,
      isDefault
    })

    if (!model) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '模型不存在' }
      })
      return
    }

    res.json({
      success: true,
      data: {
        ...model,
        _id: model._id.toString(),
        providerId: model.providerId.toString(),
        userId: model.userId.toString(),
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新模型失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 删除模型
router.delete('/models/:id', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const modelId = new ObjectId(req.params.id)

    const deleted = await providerService.deleteModel(db, userId, modelId)

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '模型不存在' }
      })
      return
    }

    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除模型失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 测试模型连接
router.post('/models/:id/test', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const modelId = new ObjectId(req.params.id)

    const result = await providerService.testModel(db, userId, modelId)

    res.json({
      success: true,
      data: result
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '测试失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取默认模型
router.get('/default-model', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)

    const model = await providerService.getDefaultModel(db, userId)

    res.json({
      success: true,
      data: model ? {
        ...model,
        _id: model._id.toString(),
        providerId: model.providerId.toString(),
        userId: model.userId.toString(),
      } : null
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取默认模型失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// ==================== AI Debug ====================

// AI 自动调试 (SSE 流式)
router.post('/debug', async (req: AuthRequest, res: Response) => {
  try {
    const { functionId, modelId } = req.body

    if (!functionId) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'functionId 不能为空' }
      })
      return
    }

    const db = getDB()
    const userId = new ObjectId(req.user!.userId)

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    try {
      for await (const message of debugService.debugStream(
        db,
        userId,
        new ObjectId(functionId),
        modelId ? new ObjectId(modelId) : undefined
      )) {
        res.write(`data: ${JSON.stringify(message)}\n\n`)
      }
    } catch (streamError) {
      const errorMessage = streamError instanceof Error ? streamError.message : '调试失败'
      res.write(`data: ${JSON.stringify({ status: 'error', error: errorMessage })}\n\n`)
    }

    res.end()
  } catch (err) {
    const message = err instanceof Error ? err.message : '调试失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 应用调试修复
router.post('/debug/apply', async (req: AuthRequest, res) => {
  try {
    const { functionId, fixedCode } = req.body

    if (!functionId || !fixedCode) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'functionId 和 fixedCode 不能为空' }
      })
      return
    }

    const db = getDB()
    const userId = new ObjectId(req.user!.userId)

    const result = await debugService.applyDebugFix(
      db,
      userId,
      new ObjectId(functionId),
      fixedCode
    )

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: { code: 'APPLY_FAILED', message: result.error || '应用修复失败' }
      })
      return
    }

    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '应用修复失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// ==================== 日志分析 ====================

// 获取日志摘要
router.get('/log-summary', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 7
    const functionId = req.query.functionId as string | undefined

    const summary = await getLogSummary(userId, {
      days: Math.min(30, Math.max(1, days)),
      functionId
    })

    res.json({
      success: true,
      data: summary
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取日志摘要失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取格式化的日志摘要 (供 AI 使用)
router.get('/log-summary/formatted', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 7
    const functionId = req.query.functionId as string | undefined

    const summary = await getLogSummary(userId, {
      days: Math.min(30, Math.max(1, days)),
      functionId
    })
    const formatted = formatLogSummaryForAI(summary, days)

    res.json({
      success: true,
      data: {
        summary,
        formatted
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取日志摘要失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

export default router
