/**
 * AI 路由共享工具函数
 */

import type { TokenUsage } from '../../services/ai/types.js'

// 生成唯一的工具调用 ID
export function generateCallId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// 估算 token 数量（简单估算：约 4 字符 = 1 token）
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// 计算 token 使用量和成本
export function calculateTokenUsage(inputText: string, outputText: string, modelName?: string): TokenUsage {
  const input = estimateTokens(inputText)
  const output = estimateTokens(outputText)
  const total = input + output

  // 简单的成本估算（基于 GPT-4 定价：$0.03/1K input, $0.06/1K output）
  let inputRate = 0.00003  // $0.03 / 1000
  let outputRate = 0.00006 // $0.06 / 1000

  // 根据模型名称调整费率
  if (modelName) {
    const lowerName = modelName.toLowerCase()
    if (lowerName.includes('gpt-3.5') || lowerName.includes('turbo')) {
      inputRate = 0.0000015
      outputRate = 0.000002
    } else if (lowerName.includes('claude-3-haiku')) {
      inputRate = 0.00000025
      outputRate = 0.00000125
    } else if (lowerName.includes('claude-3-sonnet')) {
      inputRate = 0.000003
      outputRate = 0.000015
    } else if (lowerName.includes('deepseek')) {
      inputRate = 0.00000014
      outputRate = 0.00000028
    }
  }

  const cost = input * inputRate + output * outputRate

  return { input, output, total, cost: Math.round(cost * 1000000) / 1000000 }
}
