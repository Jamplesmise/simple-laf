/**
 * Token 计算器 (Sprint 10.3)
 *
 * 使用字符估算方法计算 token 数量
 * - 英文: 约 4 字符 = 1 token
 * - 中文: 约 1.5 字符 = 1 token
 * - 代码: 约 3.5 字符 = 1 token
 */

import type { ObjectId } from 'mongodb'
import { getDB } from '../../../db.js'
import type {
  ContextItem,
  ContextStats,
  ContextUsage,
  ContextCategoryStats,
  ModelContextLimits,
} from './types.js'
import {
  DEFAULT_CONTEXT_LIMITS,
  DEFAULT_OUTPUT_RESERVE,
  WARNING_THRESHOLD,
} from './types.js'

// 中文字符正则
const CHINESE_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/g

/**
 * 估算文本的 token 数量
 */
export function estimateTokens(text: string): number {
  if (!text) return 0

  // 统计中文字符数
  const chineseChars = (text.match(CHINESE_REGEX) || []).length
  // 非中文字符数
  const otherChars = text.length - chineseChars

  // 中文约 1.5 字符 = 1 token，其他约 4 字符 = 1 token
  const tokens = Math.ceil(chineseChars / 1.5 + otherChars / 4)

  return Math.max(1, tokens)
}

/**
 * 估算代码的 token 数量（代码通常更紧凑）
 */
export function estimateCodeTokens(code: string): number {
  if (!code) return 0

  // 代码约 3.5 字符 = 1 token
  return Math.max(1, Math.ceil(code.length / 3.5))
}

/**
 * 获取模型的上下文限制
 * @param modelName 模型名称
 * @param userContextLimit 用户配置的上下文限制（优先使用）
 */
export function getModelContextLimit(modelName: string, userContextLimit?: number): ModelContextLimits {
  let maxTokens: number

  // 优先使用用户配置的上下文限制
  if (userContextLimit && userContextLimit > 0) {
    maxTokens = userContextLimit
  } else {
    // 尝试匹配模型名称
    const normalizedName = modelName.toLowerCase()
    maxTokens = 128000 // 默认值

    for (const [pattern, limit] of Object.entries(DEFAULT_CONTEXT_LIMITS)) {
      if (normalizedName.includes(pattern.toLowerCase())) {
        maxTokens = limit as number
        break
      }
    }
  }

  return {
    modelId: modelName,
    maxTokens,
    outputReserve: DEFAULT_OUTPUT_RESERVE,
    effectiveLimit: maxTokens - DEFAULT_OUTPUT_RESERVE,
  }
}

/**
 * 截断文本用于显示
 */
function truncateContent(content: string, maxLength: number = 100): string {
  if (content.length <= maxLength) return content
  return content.slice(0, maxLength) + '...'
}

/**
 * 获取对话的上下文统计信息
 * @param conversationId 对话 ID
 * @param modelName 模型名称
 * @param contextLimit 用户配置的上下文限制（可选）
 */
export async function getConversationContextStats(
  conversationId: string | ObjectId,
  modelName: string = 'gpt-4',
  contextLimit?: number
): Promise<ContextStats> {
  const db = getDB()
  const convId = typeof conversationId === 'string'
    ? new (await import('mongodb')).ObjectId(conversationId)
    : conversationId

  // 获取对话信息
  const conversation = await db.collection('ai_conversations').findOne({ _id: convId })
  if (!conversation) {
    throw new Error('对话不存在')
  }

  // 获取所有消息
  const messages = await db.collection('ai_messages')
    .find({ conversationId: convId })
    .sort({ createdAt: 1 })
    .toArray()

  // 获取模型上下文限制（优先使用用户配置）
  const limits = getModelContextLimit(modelName, contextLimit)

  // 构建上下文项列表
  const items: ContextItem[] = []
  const categories: ContextCategoryStats = {
    system: 0,
    messages: 0,
    code: 0,
    toolResults: 0,
  }

  // 添加系统提示词（如果有）
  if (conversation.systemPromptId) {
    const prompt = await db.collection('ai_system_prompts').findOne({
      _id: conversation.systemPromptId
    })
    if (prompt) {
      const tokens = estimateTokens(prompt.content)
      categories.system += tokens
      items.push({
        id: `system-${prompt._id.toString()}`,
        type: 'system',
        source: `系统提示词: ${prompt.name}`,
        tokens,
        content: truncateContent(prompt.content),
        removable: false,
        compressible: false,
        createdAt: prompt.createdAt,
      })
    }
  }

  // 处理消息
  let messageIndex = 0
  for (const msg of messages) {
    messageIndex++
    const msgId = msg._id.toString()

    // 检测消息中是否包含代码块
    const codeBlocks = msg.content.match(/```[\s\S]*?```/g) || []
    const hasCode = codeBlocks.length > 0

    if (hasCode) {
      // 分离代码和文本
      let textContent = msg.content
      let codeTokens = 0

      for (const block of codeBlocks) {
        textContent = textContent.replace(block, '')
        codeTokens += estimateCodeTokens(block)
      }

      // 添加文本部分
      const textTokens = estimateTokens(textContent.trim())
      if (textTokens > 0) {
        categories.messages += textTokens
        items.push({
          id: `msg-text-${msgId}`,
          type: 'message',
          source: `${msg.role === 'user' ? '用户' : 'AI'} 消息 #${messageIndex}`,
          tokens: textTokens,
          content: truncateContent(textContent.trim()),
          removable: msg.role === 'user' ? false : messageIndex < messages.length - 2,
          compressible: messageIndex < messages.length - 2,
          messageId: msgId,
          createdAt: msg.createdAt,
        })
      }

      // 添加代码部分
      if (codeTokens > 0) {
        categories.code += codeTokens
        items.push({
          id: `msg-code-${msgId}`,
          type: 'code',
          source: `代码 (消息 #${messageIndex})`,
          tokens: codeTokens,
          content: truncateContent(codeBlocks[0]),
          removable: messageIndex < messages.length - 2,
          compressible: true,
          messageId: msgId,
          createdAt: msg.createdAt,
        })
      }
    } else {
      // 纯文本消息
      const tokens = estimateTokens(msg.content)
      categories.messages += tokens
      items.push({
        id: `msg-${msgId}`,
        type: 'message',
        source: `${msg.role === 'user' ? '用户' : 'AI'} 消息 #${messageIndex}`,
        tokens,
        content: truncateContent(msg.content),
        removable: msg.role === 'user' ? false : messageIndex < messages.length - 2,
        compressible: messageIndex < messages.length - 2,
        messageId: msgId,
        createdAt: msg.createdAt,
      })
    }

    // 检查执行结果（工具调用结果）
    if (msg.executionResult) {
      const resultStr = JSON.stringify(msg.executionResult)
      const tokens = estimateTokens(resultStr)
      categories.toolResults += tokens
      items.push({
        id: `tool-${msgId}`,
        type: 'tool_result',
        source: `工具结果 (消息 #${messageIndex})`,
        tokens,
        content: truncateContent(resultStr),
        removable: true,
        compressible: true,
        messageId: msgId,
        createdAt: msg.createdAt,
      })
    }
  }

  // 计算总使用量
  const totalUsed = categories.system + categories.messages + categories.code + categories.toolResults
  const percentage = Math.round((totalUsed / limits.effectiveLimit) * 100)

  const usage: ContextUsage = {
    used: totalUsed,
    total: limits.effectiveLimit,
    percentage,
  }

  return {
    usage,
    categories,
    items,
    warningThreshold: WARNING_THRESHOLD * 100,
    isWarning: percentage >= WARNING_THRESHOLD * 100,
  }
}

/**
 * 计算引用函数的 token 消耗
 */
export function calculateReferencedCodeTokens(
  functions: Array<{ name: string; code: string }>
): number {
  let total = 0
  for (const fn of functions) {
    // 函数名 + 代码
    total += estimateTokens(fn.name)
    total += estimateCodeTokens(fn.code)
  }
  return total
}
