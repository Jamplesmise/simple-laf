/**
 * 上下文压缩服务 (Sprint 10.3)
 *
 * 压缩策略：
 * 1. 压缩工具结果（保留摘要）
 * 2. 压缩早期对话（保留关键信息）
 * 3. 代码转为骨架（保留函数签名）
 * 4. 删除低优先级内容
 */

import type { ObjectId } from 'mongodb'
import { getDB } from '../../../db.js'
import type {
  CompressOptions,
  CompressResult,
  CompressAction,
  DeleteContextOptions,
  DeleteContextResult,
  ContextItem,
} from './types.js'
import { getConversationContextStats, estimateTokens } from './calculator.js'

/**
 * 将代码转换为骨架（保留函数签名和注释）
 */
function codeToSkeleton(code: string): string {
  const lines = code.split('\n')
  const skeletonLines: string[] = []
  let inFunction = false
  let braceCount = 0

  for (const line of lines) {
    const trimmed = line.trim()

    // 保留导入语句
    if (trimmed.startsWith('import ') || trimmed.startsWith('export ')) {
      skeletonLines.push(line)
      continue
    }

    // 保留注释
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      skeletonLines.push(line)
      continue
    }

    // 保留函数签名
    if (trimmed.match(/^(async\s+)?function\s+\w+|^(export\s+)?(async\s+)?function\s+\w+|^\w+\s*[=:]\s*(async\s+)?\(/)) {
      skeletonLines.push(line)
      inFunction = true
      braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length
      if (braceCount === 0 && line.includes('{')) {
        skeletonLines.push('  // ... (代码已压缩)')
      }
      continue
    }

    // 跟踪函数体
    if (inFunction) {
      braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length
      if (braceCount <= 0) {
        skeletonLines.push(line) // 保留闭合括号
        inFunction = false
      }
      continue
    }

    // 保留类型定义和接口
    if (trimmed.startsWith('interface ') || trimmed.startsWith('type ') || trimmed.startsWith('class ')) {
      skeletonLines.push(line)
      continue
    }
  }

  return skeletonLines.join('\n')
}

/**
 * 压缩工具调用结果（保留关键信息）
 */
function compressToolResult(result: string): string {
  try {
    const parsed = JSON.parse(result)

    // 如果是数组，只保留摘要
    if (Array.isArray(parsed)) {
      return JSON.stringify({
        type: 'array',
        length: parsed.length,
        summary: `包含 ${parsed.length} 个项目`
      })
    }

    // 如果是对象，保留关键字段
    if (typeof parsed === 'object' && parsed !== null) {
      const summary: Record<string, unknown> = {}
      const keys = Object.keys(parsed)

      // 保留 success, error, message 等关键字段
      const importantKeys = ['success', 'error', 'message', 'status', 'code', 'name', 'id']
      for (const key of importantKeys) {
        if (key in parsed) {
          summary[key] = parsed[key]
        }
      }

      // 添加摘要
      summary._compressed = true
      summary._originalKeys = keys.slice(0, 10)

      return JSON.stringify(summary)
    }

    return result
  } catch {
    // 非 JSON，截断
    if (result.length > 200) {
      return result.slice(0, 200) + '... (已压缩)'
    }
    return result
  }
}

/**
 * 压缩消息内容（保留关键信息）
 */
function compressMessage(content: string): string {
  // 提取关键句子（问句、决策句等）
  const sentences = content.split(/[。！？.!?]/).filter(s => s.trim())

  if (sentences.length <= 3) {
    return content
  }

  // 保留前两句和最后一句
  const compressed = [
    sentences[0],
    sentences[1],
    `... (省略 ${sentences.length - 3} 句)`,
    sentences[sentences.length - 1]
  ].join('。')

  return compressed
}

/**
 * 智能压缩对话上下文
 */
export async function compressContext(
  conversationId: string | ObjectId,
  options: CompressOptions
): Promise<CompressResult> {
  const db = getDB()
  const convId = typeof conversationId === 'string'
    ? new (await import('mongodb')).ObjectId(conversationId)
    : conversationId

  // 获取对话信息以获取模型配置
  const conversation = await db.collection('ai_conversations').findOne({ _id: convId })
  let modelName = 'gpt-4'
  let contextLimit: number | undefined
  if (conversation?.modelId) {
    const modelDoc = await db.collection('ai_models').findOne({
      _id: new (await import('mongodb')).ObjectId(conversation.modelId)
    })
    if (modelDoc) {
      modelName = modelDoc.name
      contextLimit = modelDoc.contextLimit
    }
  }

  // 获取当前上下文统计
  const stats = await getConversationContextStats(conversationId, modelName, contextLimit)
  const beforeTokens = stats.usage.used
  const actions: CompressAction[] = []

  if (options.mode === 'smart') {
    const targetPercentage = options.targetPercentage || 50
    const targetTokens = Math.floor(stats.usage.total * targetPercentage / 100)

    // 如果已经低于目标，无需压缩
    if (beforeTokens <= targetTokens) {
      return {
        success: true,
        before: beforeTokens,
        after: beforeTokens,
        saved: 0,
        percentage: stats.usage.percentage,
        actions: [],
        message: '上下文使用量已低于目标，无需压缩'
      }
    }

    // 按优先级压缩
    let currentTokens = beforeTokens

    // 1. 首先压缩工具结果
    const toolItems = stats.items.filter(item => item.type === 'tool_result' && item.compressible)
    for (const item of toolItems) {
      if (currentTokens <= targetTokens) break
      if (item.messageId) {
        const message = await db.collection('ai_messages').findOne({
          _id: new (await import('mongodb')).ObjectId(item.messageId)
        })
        if (message?.executionResult) {
          const compressed = compressToolResult(JSON.stringify(message.executionResult))
          const newTokens = estimateTokens(compressed)
          const saved = item.tokens - newTokens

          await db.collection('ai_messages').updateOne(
            { _id: message._id },
            { $set: { executionResult: JSON.parse(compressed), _compressed: true } }
          )

          currentTokens -= saved
          actions.push('summarize_tool_result')
        }
      }
    }

    // 2. 压缩代码块
    const codeItems = stats.items.filter(item => item.type === 'code' && item.compressible)
    for (const item of codeItems) {
      if (currentTokens <= targetTokens) break
      if (item.messageId) {
        const message = await db.collection('ai_messages').findOne({
          _id: new (await import('mongodb')).ObjectId(item.messageId)
        })
        if (message) {
          // 将代码块转为骨架
          const newContent = message.content.replace(
            /```[\s\S]*?```/g,
            (match: string) => {
              const skeleton = codeToSkeleton(match)
              return skeleton
            }
          )

          const saved = estimateTokens(message.content) - estimateTokens(newContent)
          if (saved > 0) {
            await db.collection('ai_messages').updateOne(
              { _id: message._id },
              { $set: { content: newContent, _compressed: true } }
            )
            currentTokens -= saved
            actions.push('skeleton_code')
          }
        }
      }
    }

    // 3. 压缩早期对话消息
    const messageItems = stats.items
      .filter(item => item.type === 'message' && item.compressible && item.removable)
      .slice(0, -4) // 保留最近 4 条消息

    for (const item of messageItems) {
      if (currentTokens <= targetTokens) break
      if (item.messageId) {
        const message = await db.collection('ai_messages').findOne({
          _id: new (await import('mongodb')).ObjectId(item.messageId)
        })
        if (message && message.content.length > 200) {
          const compressed = compressMessage(message.content)
          const saved = estimateTokens(message.content) - estimateTokens(compressed)

          if (saved > 0) {
            await db.collection('ai_messages').updateOne(
              { _id: message._id },
              { $set: { content: compressed, _compressed: true } }
            )
            currentTokens -= saved
            actions.push('summarize_messages')
          }
        }
      }
    }

    const afterTokens = currentTokens
    const newPercentage = Math.round((afterTokens / stats.usage.total) * 100)

    return {
      success: true,
      before: beforeTokens,
      after: afterTokens,
      saved: beforeTokens - afterTokens,
      percentage: newPercentage,
      actions: [...new Set(actions)], // 去重
      message: `已压缩 ${beforeTokens - afterTokens} tokens，当前使用 ${newPercentage}%`
    }
  } else {
    // 手动模式：压缩指定项
    if (!options.itemIds || options.itemIds.length === 0) {
      return {
        success: false,
        before: beforeTokens,
        after: beforeTokens,
        saved: 0,
        percentage: stats.usage.percentage,
        actions: [],
        message: '请指定要压缩的项目'
      }
    }

    let savedTokens = 0
    for (const itemId of options.itemIds) {
      const item = stats.items.find(i => i.id === itemId)
      if (!item || !item.compressible) continue

      if (item.type === 'tool_result' && item.messageId) {
        const message = await db.collection('ai_messages').findOne({
          _id: new (await import('mongodb')).ObjectId(item.messageId)
        })
        if (message?.executionResult) {
          const compressed = compressToolResult(JSON.stringify(message.executionResult))
          const newTokens = estimateTokens(compressed)
          savedTokens += item.tokens - newTokens

          await db.collection('ai_messages').updateOne(
            { _id: message._id },
            { $set: { executionResult: JSON.parse(compressed), _compressed: true } }
          )
          actions.push('summarize_tool_result')
        }
      } else if (item.type === 'code' && item.messageId) {
        const message = await db.collection('ai_messages').findOne({
          _id: new (await import('mongodb')).ObjectId(item.messageId)
        })
        if (message) {
          const newContent = message.content.replace(
            /```[\s\S]*?```/g,
            (match: string) => codeToSkeleton(match)
          )
          savedTokens += estimateTokens(message.content) - estimateTokens(newContent)

          await db.collection('ai_messages').updateOne(
            { _id: message._id },
            { $set: { content: newContent, _compressed: true } }
          )
          actions.push('skeleton_code')
        }
      }
    }

    const afterTokens = beforeTokens - savedTokens
    const newPercentage = Math.round((afterTokens / stats.usage.total) * 100)

    return {
      success: true,
      before: beforeTokens,
      after: afterTokens,
      saved: savedTokens,
      percentage: newPercentage,
      actions: [...new Set(actions)],
      message: `已压缩 ${savedTokens} tokens`
    }
  }
}

/**
 * 删除指定的上下文项
 */
export async function deleteContextItems(
  conversationId: string | ObjectId,
  options: DeleteContextOptions
): Promise<DeleteContextResult> {
  const db = getDB()
  const convId = typeof conversationId === 'string'
    ? new (await import('mongodb')).ObjectId(conversationId)
    : conversationId

  // 获取对话信息以获取模型配置
  const conversation = await db.collection('ai_conversations').findOne({ _id: convId })
  let modelName = 'gpt-4'
  let contextLimit: number | undefined
  if (conversation?.modelId) {
    const modelDoc = await db.collection('ai_models').findOne({
      _id: new (await import('mongodb')).ObjectId(conversation.modelId)
    })
    if (modelDoc) {
      modelName = modelDoc.name
      contextLimit = modelDoc.contextLimit
    }
  }

  // 获取当前统计
  const stats = await getConversationContextStats(conversationId, modelName, contextLimit)
  let tokensSaved = 0
  let deletedCount = 0

  for (const itemId of options.itemIds) {
    const item = stats.items.find(i => i.id === itemId)
    if (!item || !item.removable) continue

    // 根据项目类型处理删除
    if (item.messageId) {
      // 如果是消息的一部分，需要特殊处理
      if (item.type === 'tool_result') {
        // 只删除执行结果
        await db.collection('ai_messages').updateOne(
          { _id: new (await import('mongodb')).ObjectId(item.messageId) },
          { $unset: { executionResult: '' } }
        )
        tokensSaved += item.tokens
        deletedCount++
      } else if (item.id.startsWith('msg-')) {
        // 删除整条消息
        await db.collection('ai_messages').deleteOne({
          _id: new (await import('mongodb')).ObjectId(item.messageId)
        })
        tokensSaved += item.tokens
        deletedCount++
      }
    }
  }

  const newUsed = stats.usage.used - tokensSaved
  const newPercentage = Math.round((newUsed / stats.usage.total) * 100)

  return {
    success: true,
    deleted: deletedCount,
    tokensSaved,
    newPercentage
  }
}
