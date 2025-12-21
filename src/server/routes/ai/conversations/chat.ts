/**
 * 对话聊天功能
 * POST /api/ai/conversations/:id/chat
 */

import { Router, type Response, type Router as RouterType } from 'express'
import { ObjectId } from 'mongodb'
import type { AuthRequest } from '../../../middleware/auth.js'
import * as aiService from '../../../services/ai/index.js'
import * as conversationService from '../../../services/ai/conversation.js'
import * as systemPromptService from '../../../services/ai/systemPrompt.js'
import * as providerService from '../../../services/ai/provider.js'
import { AIExecutor, getFlexibleSystemPrompt, type ConversationContext } from '../../../services/ai/executor.js'
import { parseToolCalls, toolToOperationType } from '../../../services/ai/tools.js'
import { getDB } from '../../../db.js'
import { getLogSummary, formatLogSummaryForAI } from '../../../services/logAnalysis.js'
import { generateCallId, calculateTokenUsage } from '../utils.js'

const router: RouterType = Router()

// 发送消息并获取 AI 回复 (SSE 流式)
router.post('/:id/chat', async (req: AuthRequest, res: Response) => {
  try {
    const userId = new ObjectId(req.user!.userId)
    const conversationId = new ObjectId(req.params.id)
    const { message, context, modelId } = req.body

    if (!message?.trim()) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '消息内容不能为空' }
      })
      return
    }

    const conversationData = await conversationService.getConversation(userId, conversationId)
    if (!conversationData) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '对话不存在' }
      })
      return
    }

    const userMessage = await conversationService.addMessage(conversationId, 'user', message)

    if (conversationData.messages.length === 0) {
      await conversationService.autoGenerateTitle(conversationId, message)
    }

    let modelObjectId: ObjectId | undefined
    if (modelId) {
      try {
        modelObjectId = new ObjectId(modelId)
      } catch {
        // 无效的 modelId
      }
    }

    if (!modelObjectId) {
      const config = await aiService.getAIConfig(userId)
      if (!config) {
        const db = getDB()
        const defaultModel = await providerService.getDefaultModel(db, userId)
        if (defaultModel) {
          modelObjectId = defaultModel._id
        } else {
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

    const existingFunctions = await db.collection<{ _id: ObjectId; name: string; code: string }>('functions')
      .find({ userId })
      .project<{ _id: ObjectId; name: string; code: string }>({ _id: 1, name: 1, code: 1 })
      .toArray()

    const folders = await db.collection<{ _id: ObjectId; name: string; path: string }>('folders')
      .find({ userId })
      .project<{ _id: ObjectId; name: string; path: string }>({ _id: 1, name: 1, path: 1 })
      .toArray()

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
        // 忽略错误
      }
    }

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

    const systemPrompt = getFlexibleSystemPrompt(conversationContext)

    const messages: aiService.ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationData.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })),
      { role: 'user', content: message }
    ]

    if (context?.selectedCode) {
      const lastIndex = messages.length - 1
      messages[lastIndex].content = `${message}\n\n当前代码:\n\`\`\`typescript\n${context.selectedCode}\n\`\`\``
    }

    if (context?.analyzeLog) {
      try {
        const logDays = context.logDays || 7
        const logSummary = await getLogSummary(userId.toString(), {
          days: logDays,
          functionId: context.logFunctionId
        })
        const logSummaryText = formatLogSummaryForAI(logSummary, logDays)

        const lastIndex = messages.length - 1
        messages[lastIndex].content = `${messages[lastIndex].content}\n\n---\n\n以下是用户的执行日志数据，请基于这些数据进行分析和回答:\n\n${logSummaryText}`
      } catch {
        // 获取日志摘要失败
      }
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    let fullContent = ''

    let modelName: string | undefined
    if (modelObjectId) {
      const model = await db.collection('ai_models').findOne({ _id: modelObjectId })
      modelName = model?.name as string || model?.alias as string
    }

    try {
      res.write(`data: ${JSON.stringify({
        status: 'user_message',
        messageId: userMessage._id.toString()
      })}\n\n`)

      res.write(`data: ${JSON.stringify({ status: 'thinking', message: 'AI 正在分析...' })}\n\n`)

      for await (const chunk of aiService.chatStream(userId, messages, undefined, modelObjectId)) {
        fullContent += chunk
        res.write(`data: ${JSON.stringify({ status: 'generating', content: chunk })}\n\n`)
      }

      const aiResponse = parseToolCalls(fullContent)
      const analysisTools = ['explain_code', 'analyze_refactor', 'analyze_merge', 'analyze_logs', 'debug_function', 'run_function']

      if (aiResponse.type === 'tool_use' && aiResponse.toolCalls?.length) {
        const allAnalysisTools = aiResponse.toolCalls.every(call => analysisTools.includes(call.tool))

        if (allAnalysisTools) {
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

          const inputText = messages.map(m => m.content).join('\n')
          const tokenUsage = calculateTokenUsage(inputText, fullContent, modelName)
          res.write(`data: ${JSON.stringify({
            status: 'token_usage',
            tokenUsage
          })}\n\n`)

          res.write(`data: ${JSON.stringify({
            status: 'done',
            messageId: assistantMessage._id.toString(),
            result: { success: true, message: '分析完成' }
          })}\n\n`)
        } else {
          const executor = new AIExecutor(db, userId, {
            username: req.user!.username,
            modelName,
          })

          const executableCalls = aiResponse.toolCalls.filter(call => !analysisTools.includes(call.tool))
          const toolCallIds = new Map<number, string>()

          for (let i = 0; i < executableCalls.length; i++) {
            const call = executableCalls[i]
            const callId = generateCallId()
            toolCallIds.set(i, callId)

            res.write(`data: ${JSON.stringify({
              status: 'tool_call',
              toolCall: {
                tool: call.tool,
                params: call.arguments as Record<string, unknown>,
                callId
              }
            })}\n\n`)
          }

          const operations = executableCalls.map((call) => {
            const operationType = toolToOperationType[call.tool] || call.tool
            return {
              type: operationType,
              ...call.arguments
            } as import('../../../services/ai/types.js').AIOperation
          })

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

          res.write(`data: ${JSON.stringify({ status: 'executing', message: '正在执行操作...' })}\n\n`)

          const execStartTime = Date.now()
          const result = await executor.execute({
            operations,
            summary: `执行 ${operations.length} 个工具调用`
          })
          const execDuration = Date.now() - execStartTime

          for (let i = 0; i < result.results.length; i++) {
            const r = result.results[i] as { operation: { type: string }; success: boolean; error?: string; result?: unknown }
            const callId = toolCallIds.get(i) || generateCallId()

            res.write(`data: ${JSON.stringify({
              status: 'tool_result',
              toolResult: {
                tool: r.operation.type,
                result: r.result,
                success: r.success,
                callId,
                duration: Math.round(execDuration / result.results.length)
              }
            })}\n\n`)
          }

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

          const inputText = messages.map(m => m.content).join('\n')
          const tokenUsage = calculateTokenUsage(inputText, fullContent, modelName)
          res.write(`data: ${JSON.stringify({
            status: 'token_usage',
            tokenUsage
          })}\n\n`)

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
        const assistantMessage = await conversationService.addMessage(
          conversationId,
          'assistant',
          fullContent
        )

        const inputText = messages.map(m => m.content).join('\n')
        const tokenUsage = calculateTokenUsage(inputText, fullContent, modelName)
        res.write(`data: ${JSON.stringify({
          status: 'token_usage',
          tokenUsage
        })}\n\n`)

        res.write(`data: ${JSON.stringify({
          status: 'done',
          messageId: assistantMessage._id.toString(),
          result: { success: true, message: '回复完成' }
        })}\n\n`)
      }
    } catch (streamErr) {
      const errorMessage = streamErr instanceof Error ? streamErr.message : 'AI 处理失败'
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

export default router
