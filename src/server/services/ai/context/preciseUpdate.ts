/**
 * 精准更新策略服务 (Sprint 16.1)
 *
 * 功能：
 * 1. 修改范围检测 - 判断修改类型
 * 2. 部分代码加载 - 只加载修改点周围代码
 * 3. 精准 Diff 应用 - 只更新变化部分
 *
 * 目标：减少 80%+ Token 消耗
 */

import type { ObjectId } from 'mongodb'
import { getDB } from '../../../db.js'
import { estimateCodeTokens } from './calculator.js'

// 修改类型
export type ChangeType = 'minor' | 'moderate' | 'refactor'

// 精准更新请求
export interface PreciseUpdateRequest {
  functionId: string
  range?: {
    startLine: number
    endLine: number
  }
  minimalContext?: boolean  // 是否只加载最小上下文
  contextLines?: number     // 上下文行数，默认 10
}

// 最小上下文结果
export interface MinimalContextResult {
  functionId: string
  functionName: string
  fullCode: string           // 完整代码（用于最终合并）
  contextCode: string        // 最小上下文代码
  range: {
    startLine: number
    endLine: number
  }
  actualRange: {             // 实际返回的范围（含上下文）
    startLine: number
    endLine: number
  }
  totalLines: number
  tokensSaved: number        // 节省的 tokens
  savingsPercentage: number  // 节省百分比
}

// 精准 Diff 结果
export interface PreciseDiffResult {
  success: boolean
  functionId: string
  originalCode: string
  updatedCode: string
  changedLines: {
    startLine: number
    endLine: number
  }
  message?: string
  error?: string
}

// 修改类型关键词配置
const CHANGE_TYPE_KEYWORDS: Record<ChangeType, string[]> = {
  minor: [
    '修改', '改', '调整', '更新',
    '添加注释', '加注释',
    '修复bug', '修复错误', 'fix',
    '改名', '重命名变量',
    '格式化', '缩进',
    '删除', '移除',
    '改个', '换成', '替换为'
  ],
  moderate: [
    '添加', '新增', '增加',
    '优化', '改进', '提升',
    '添加功能', '新功能',
    '添加参数', '增加参数',
    '添加验证', '增加校验',
    '错误处理', '异常处理'
  ],
  refactor: [
    '重构', '重写', '重新设计',
    '拆分', '合并', '提取',
    '迁移', '移动',
    '批量', '全部',
    '架构', '设计模式',
    '完全重写', '从头开始'
  ]
}

// 影响范围阈值
const IMPACT_THRESHOLDS = {
  minor: { maxLines: 10, maxTokens: 200 },
  moderate: { maxLines: 50, maxTokens: 1000 },
  refactor: { maxLines: Infinity, maxTokens: Infinity }
}

/**
 * 判断修改类型
 *
 * @param request - 用户请求文本
 * @returns 修改类型：minor（小修改）、moderate（中等修改）、refactor（重构）
 */
export function determineChangeType(request: string): ChangeType {
  const normalizedRequest = request.toLowerCase()

  // 按优先级检测（refactor > moderate > minor）
  for (const keyword of CHANGE_TYPE_KEYWORDS.refactor) {
    if (normalizedRequest.includes(keyword.toLowerCase())) {
      return 'refactor'
    }
  }

  for (const keyword of CHANGE_TYPE_KEYWORDS.moderate) {
    if (normalizedRequest.includes(keyword.toLowerCase())) {
      return 'moderate'
    }
  }

  // 默认为 minor
  return 'minor'
}

/**
 * 解析代码中的修改位置提示
 *
 * 支持格式：
 * - "第 10 行"
 * - "第 10-20 行"
 * - "line 10"
 * - "lines 10-20"
 * - "函数 xxx"（查找函数定义行）
 */
export function parseLineHints(request: string, code: string): { startLine: number, endLine: number } | null {
  // 匹配 "第 X 行" 或 "第 X-Y 行"
  const chineseMatch = request.match(/第\s*(\d+)(?:\s*[-~到]\s*(\d+))?\s*行/)
  if (chineseMatch) {
    const start = parseInt(chineseMatch[1], 10)
    const end = chineseMatch[2] ? parseInt(chineseMatch[2], 10) : start
    return { startLine: start, endLine: end }
  }

  // 匹配 "line X" 或 "lines X-Y"
  const englishMatch = request.match(/lines?\s*(\d+)(?:\s*[-~to]\s*(\d+))?/i)
  if (englishMatch) {
    const start = parseInt(englishMatch[1], 10)
    const end = englishMatch[2] ? parseInt(englishMatch[2], 10) : start
    return { startLine: start, endLine: end }
  }

  // 匹配函数名，查找函数定义位置
  const funcMatch = request.match(/函数\s*[`'""]?(\w+)[`'""]?/)
  if (funcMatch) {
    const funcName = funcMatch[1]
    const lines = code.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`function ${funcName}`) ||
          lines[i].includes(`${funcName} =`) ||
          lines[i].includes(`${funcName}(`)) {
        // 找到函数开始，继续找函数结束
        let braceCount = 0
        let started = false
        let endLine = i + 1

        for (let j = i; j < lines.length; j++) {
          const line = lines[j]
          if (line.includes('{')) {
            braceCount += (line.match(/{/g) || []).length
            started = true
          }
          if (line.includes('}')) {
            braceCount -= (line.match(/}/g) || []).length
          }
          if (started && braceCount === 0) {
            endLine = j + 1
            break
          }
        }

        return { startLine: i + 1, endLine }
      }
    }
  }

  return null
}

/**
 * 获取最小上下文
 *
 * 只加载修改点周围的代码，大幅减少 Token 消耗
 *
 * @param functionId - 函数 ID
 * @param range - 修改范围（行号，从 1 开始）
 * @param contextLines - 上下文行数（默认 10 行）
 */
export async function getMinimalContext(
  functionId: string | ObjectId,
  range: { startLine: number, endLine: number },
  contextLines: number = 10
): Promise<MinimalContextResult> {
  const db = getDB()
  const funcId = typeof functionId === 'string'
    ? new (await import('mongodb')).ObjectId(functionId)
    : functionId

  // 获取函数代码
  const func = await db.collection('functions').findOne({ _id: funcId })
  if (!func) {
    throw new Error('函数不存在')
  }

  const fullCode = func.code || ''
  const lines = fullCode.split('\n')
  const totalLines = lines.length

  // 计算实际范围（含上下文）
  const actualStart = Math.max(1, range.startLine - contextLines)
  const actualEnd = Math.min(totalLines, range.endLine + contextLines)

  // 提取上下文代码
  const contextLines2 = lines.slice(actualStart - 1, actualEnd)

  // 添加行号注释，便于 AI 定位
  const contextCode = contextLines2.map((line: string, index: number) => {
    const lineNum = actualStart + index
    return `/* L${lineNum} */ ${line}`
  }).join('\n')

  // 添加范围提示
  const rangeHint = `// 当前显示范围: 第 ${actualStart}-${actualEnd} 行 (共 ${totalLines} 行)\n`
    + `// 修改目标范围: 第 ${range.startLine}-${range.endLine} 行\n\n`

  const finalContextCode = rangeHint + contextCode

  // 计算节省的 tokens
  const fullTokens = estimateCodeTokens(fullCode)
  const contextTokens = estimateCodeTokens(finalContextCode)
  const tokensSaved = fullTokens - contextTokens
  const savingsPercentage = Math.round((tokensSaved / fullTokens) * 100)

  return {
    functionId: funcId.toString(),
    functionName: func.name,
    fullCode,
    contextCode: finalContextCode,
    range,
    actualRange: {
      startLine: actualStart,
      endLine: actualEnd
    },
    totalLines,
    tokensSaved,
    savingsPercentage
  }
}

/**
 * 智能获取上下文
 *
 * 根据修改类型自动决定上下文策略
 */
export async function getSmartContext(
  functionId: string | ObjectId,
  request: string
): Promise<{
  changeType: ChangeType
  context: MinimalContextResult | { fullCode: string, tokensSaved: 0 }
  useMinimalContext: boolean
}> {
  const db = getDB()
  const funcId = typeof functionId === 'string'
    ? new (await import('mongodb')).ObjectId(functionId)
    : functionId

  const func = await db.collection('functions').findOne({ _id: funcId })
  if (!func) {
    throw new Error('函数不存在')
  }

  const fullCode = func.code || ''
  const changeType = determineChangeType(request)

  // 如果是重构类型，返回完整代码
  if (changeType === 'refactor') {
    return {
      changeType,
      context: { fullCode, tokensSaved: 0 },
      useMinimalContext: false
    }
  }

  // 尝试解析行号提示
  const lineHints = parseLineHints(request, fullCode)

  if (lineHints) {
    // 有明确的行号提示，使用精准上下文
    const contextLines = changeType === 'minor' ? 10 : 20
    const context = await getMinimalContext(functionId, lineHints, contextLines)

    return {
      changeType,
      context,
      useMinimalContext: true
    }
  }

  // 没有行号提示，根据代码长度决定
  const lines = fullCode.split('\n')
  if (lines.length <= 50) {
    // 代码较短，返回完整代码
    return {
      changeType,
      context: { fullCode, tokensSaved: 0 },
      useMinimalContext: false
    }
  }

  // 代码较长但没有行号提示，返回完整代码并建议用户指定范围
  return {
    changeType,
    context: {
      fullCode,
      tokensSaved: 0,
    },
    useMinimalContext: false
  }
}

/**
 * 应用精准 Diff
 *
 * 将 AI 返回的部分代码合并回完整代码
 *
 * @param functionId - 函数 ID
 * @param newPartialCode - AI 返回的修改后代码片段
 * @param range - 原始修改范围
 */
export async function applyPreciseDiff(
  functionId: string | ObjectId,
  newPartialCode: string,
  range: { startLine: number, endLine: number }
): Promise<PreciseDiffResult> {
  const db = getDB()
  const funcId = typeof functionId === 'string'
    ? new (await import('mongodb')).ObjectId(functionId)
    : functionId

  const func = await db.collection('functions').findOne({ _id: funcId })
  if (!func) {
    return {
      success: false,
      functionId: funcId.toString(),
      originalCode: '',
      updatedCode: '',
      changedLines: range,
      error: '函数不存在'
    }
  }

  const originalCode = func.code || ''
  const lines = originalCode.split('\n')

  // 移除行号注释（如果存在）
  const cleanedCode = newPartialCode
    .split('\n')
    .map(line => line.replace(/^\/\*\s*L\d+\s*\*\/\s*/, ''))
    .join('\n')

  // 移除范围提示注释
  const codeWithoutHints = cleanedCode
    .replace(/\/\/\s*当前显示范围:.*\n/g, '')
    .replace(/\/\/\s*修改目标范围:.*\n/g, '')
    .trim()

  const newLines = codeWithoutHints.split('\n')

  // 合并代码
  const beforeRange = lines.slice(0, range.startLine - 1)
  const afterRange = lines.slice(range.endLine)

  const updatedLines = [...beforeRange, ...newLines, ...afterRange]
  const updatedCode = updatedLines.join('\n')

  // 更新数据库
  try {
    await db.collection('functions').updateOne(
      { _id: funcId },
      {
        $set: {
          code: updatedCode,
          updatedAt: new Date()
        }
      }
    )

    return {
      success: true,
      functionId: funcId.toString(),
      originalCode,
      updatedCode,
      changedLines: {
        startLine: range.startLine,
        endLine: range.startLine + newLines.length - 1
      },
      message: `成功更新第 ${range.startLine}-${range.endLine} 行`
    }
  } catch (error) {
    return {
      success: false,
      functionId: funcId.toString(),
      originalCode,
      updatedCode,
      changedLines: range,
      error: error instanceof Error ? error.message : '更新失败'
    }
  }
}

/**
 * 验证 Diff 结果
 *
 * 确保修改后的代码语法正确且符合预期
 */
export function validateDiff(
  originalCode: string,
  updatedCode: string,
  range: { startLine: number, endLine: number }
): { valid: boolean, issues: string[] } {
  const issues: string[] = []

  // 检查代码是否为空
  if (!updatedCode.trim()) {
    issues.push('更新后的代码为空')
    return { valid: false, issues }
  }

  // 检查括号匹配
  const brackets = { '(': 0, '[': 0, '{': 0 }
  for (const char of updatedCode) {
    if (char === '(') brackets['(']++
    if (char === ')') brackets['(']--
    if (char === '[') brackets['[']++
    if (char === ']') brackets['[']--
    if (char === '{') brackets['{']++
    if (char === '}') brackets['{']--

    if (brackets['('] < 0 || brackets['['] < 0 || brackets['{'] < 0) {
      issues.push('括号不匹配：闭合括号多于开放括号')
      break
    }
  }

  if (brackets['('] !== 0) issues.push('小括号不匹配')
  if (brackets['['] !== 0) issues.push('方括号不匹配')
  if (brackets['{'] !== 0) issues.push('花括号不匹配')

  // 检查代码行数变化是否合理
  const originalLines = originalCode.split('\n').length
  const updatedLines = updatedCode.split('\n').length
  const diff = Math.abs(updatedLines - originalLines)

  if (diff > originalLines * 0.5 && diff > 50) {
    issues.push(`代码行数变化较大：${originalLines} -> ${updatedLines}，请确认修改范围`)
  }

  return {
    valid: issues.length === 0,
    issues
  }
}

/**
 * 获取修改建议的上下文行数
 */
export function getSuggestedContextLines(changeType: ChangeType): number {
  switch (changeType) {
    case 'minor':
      return 10
    case 'moderate':
      return 20
    case 'refactor':
      return Infinity // 全文
  }
}

/**
 * 格式化精准更新的系统提示
 */
export function formatPreciseUpdatePrompt(context: MinimalContextResult): string {
  return `你正在修改函数 "${context.functionName}" 的第 ${context.range.startLine}-${context.range.endLine} 行代码。

以下是相关代码片段（第 ${context.actualRange.startLine}-${context.actualRange.endLine} 行，共 ${context.totalLines} 行）：

\`\`\`typescript
${context.contextCode}
\`\`\`

请只返回修改后的代码片段（第 ${context.range.startLine}-${context.range.endLine} 行），保持相同的缩进格式。
注意：不要返回完整函数代码，只返回需要修改的部分。`
}
