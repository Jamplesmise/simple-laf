import { ObjectId } from 'mongodb'
import { getDB } from '../db.js'
import type { ExecutionLog } from './executionLog.js'
import type { FunctionVersion } from './version.js'

export interface LogSummary {
  // 执行统计
  executionStats: {
    total: number
    success: number
    failed: number
    avgDuration: number
    byTrigger: Record<string, number>
  }
  // 近期错误
  recentErrors: Array<{
    functionName: string
    error: string
    count: number
    lastOccurred: Date
  }>
  // 性能问题 (耗时超过1秒的)
  slowExecutions: Array<{
    functionName: string
    avgDuration: number
    maxDuration: number
    count: number
  }>
  // 近期版本变更
  recentVersions: Array<{
    functionName: string
    version: number
    changelog: string
    createdAt: Date
  }>
  // 热门函数
  hotFunctions: Array<{
    functionName: string
    callCount: number
    successRate: number
  }>
  // 原始日志样本 (最近失败的)
  errorSamples: Array<{
    functionName: string
    error: string
    request: unknown
    logs: unknown[]
    createdAt: Date
  }>
}

/**
 * 获取用户的日志摘要供 AI 分析
 */
export async function getLogSummary(
  userId: string,
  options: {
    days?: number
    functionId?: string
  } = {}
): Promise<LogSummary> {
  const db = getDB()
  const { days = 7, functionId } = options

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // 构建查询条件
  const logFilter: Record<string, unknown> = {
    userId,
    createdAt: { $gte: startDate }
  }
  if (functionId) {
    logFilter.functionId = functionId
  }

  // 获取执行日志
  const logs = await db.collection<ExecutionLog>('execution_logs')
    .find(logFilter)
    .sort({ createdAt: -1 })
    .limit(1000)
    .toArray()

  // 获取版本历史
  const versionFilter: Record<string, unknown> = {
    userId: new ObjectId(userId),
    createdAt: { $gte: startDate }
  }
  if (functionId) {
    versionFilter.functionId = new ObjectId(functionId)
  }

  const versions = await db.collection<FunctionVersion>('function_versions')
    .find(versionFilter)
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray()

  // 获取函数名称映射
  const functionIds = [...new Set(versions.map(v => v.functionId.toString()))]
  const functions = await db.collection('functions')
    .find({ _id: { $in: functionIds.map(id => new ObjectId(id)) } })
    .toArray()
  const functionNameMap = new Map(functions.map(f => [f._id.toString(), f.name as string]))

  // 计算执行统计
  const total = logs.length
  const success = logs.filter(l => l.success).length
  const failed = total - success
  const avgDuration = total > 0
    ? Math.round(logs.reduce((sum, l) => sum + l.duration, 0) / total)
    : 0

  const byTrigger: Record<string, number> = {}
  logs.forEach(l => {
    byTrigger[l.trigger] = (byTrigger[l.trigger] || 0) + 1
  })

  // 统计错误
  const errorMap = new Map<string, { count: number; lastOccurred: Date; functionName: string }>()
  logs.filter(l => !l.success && l.error).forEach(l => {
    const key = `${l.functionName}:${l.error?.substring(0, 100)}`
    const existing = errorMap.get(key)
    if (existing) {
      existing.count++
      if (l.createdAt > existing.lastOccurred) {
        existing.lastOccurred = l.createdAt
      }
    } else {
      errorMap.set(key, {
        count: 1,
        lastOccurred: l.createdAt,
        functionName: l.functionName
      })
    }
  })

  const recentErrors = Array.from(errorMap.entries())
    .map(([key, value]) => ({
      functionName: value.functionName,
      error: key.split(':').slice(1).join(':'),
      count: value.count,
      lastOccurred: value.lastOccurred
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // 统计慢执行 (> 1000ms)
  const slowMap = new Map<string, { durations: number[] }>()
  logs.filter(l => l.duration > 1000).forEach(l => {
    const existing = slowMap.get(l.functionName)
    if (existing) {
      existing.durations.push(l.duration)
    } else {
      slowMap.set(l.functionName, { durations: [l.duration] })
    }
  })

  const slowExecutions = Array.from(slowMap.entries())
    .map(([name, value]) => ({
      functionName: name,
      avgDuration: Math.round(value.durations.reduce((a, b) => a + b, 0) / value.durations.length),
      maxDuration: Math.max(...value.durations),
      count: value.durations.length
    }))
    .sort((a, b) => b.avgDuration - a.avgDuration)
    .slice(0, 10)

  // 版本变更
  const recentVersions = versions.slice(0, 10).map(v => ({
    functionName: functionNameMap.get(v.functionId.toString()) || 'unknown',
    version: v.version,
    changelog: v.changelog || '',
    createdAt: v.createdAt
  }))

  // 热门函数
  const callCountMap = new Map<string, { total: number; success: number }>()
  logs.forEach(l => {
    const existing = callCountMap.get(l.functionName)
    if (existing) {
      existing.total++
      if (l.success) existing.success++
    } else {
      callCountMap.set(l.functionName, { total: 1, success: l.success ? 1 : 0 })
    }
  })

  const hotFunctions = Array.from(callCountMap.entries())
    .map(([name, value]) => ({
      functionName: name,
      callCount: value.total,
      successRate: Math.round((value.success / value.total) * 100)
    }))
    .sort((a, b) => b.callCount - a.callCount)
    .slice(0, 10)

  // 错误样本
  const errorSamples = logs
    .filter(l => !l.success)
    .slice(0, 5)
    .map(l => ({
      functionName: l.functionName,
      error: l.error || '',
      request: l.request,
      logs: l.logs || [],
      createdAt: l.createdAt
    }))

  return {
    executionStats: {
      total,
      success,
      failed,
      avgDuration,
      byTrigger
    },
    recentErrors,
    slowExecutions,
    recentVersions,
    hotFunctions,
    errorSamples
  }
}

/**
 * 将日志摘要格式化为 AI 可读的文本
 */
export function formatLogSummaryForAI(summary: LogSummary, days: number): string {
  const lines: string[] = []

  lines.push(`## 近 ${days} 天执行日志分析\n`)

  // 执行统计
  lines.push('### 执行统计')
  lines.push(`- 总执行次数: ${summary.executionStats.total}`)
  lines.push(`- 成功: ${summary.executionStats.success} (${summary.executionStats.total > 0 ? Math.round(summary.executionStats.success / summary.executionStats.total * 100) : 0}%)`)
  lines.push(`- 失败: ${summary.executionStats.failed}`)
  lines.push(`- 平均耗时: ${summary.executionStats.avgDuration}ms`)
  lines.push(`- 触发来源: ${Object.entries(summary.executionStats.byTrigger).map(([k, v]) => `${k}(${v})`).join(', ')}`)
  lines.push('')

  // 热门函数
  if (summary.hotFunctions.length > 0) {
    lines.push('### 热门函数 (按调用量)')
    summary.hotFunctions.forEach((f, i) => {
      lines.push(`${i + 1}. ${f.functionName}: ${f.callCount}次, 成功率${f.successRate}%`)
    })
    lines.push('')
  }

  // 错误统计
  if (summary.recentErrors.length > 0) {
    lines.push('### 近期错误 (按频率)')
    summary.recentErrors.forEach((e, i) => {
      lines.push(`${i + 1}. [${e.functionName}] ${e.error} (${e.count}次)`)
    })
    lines.push('')
  }

  // 性能问题
  if (summary.slowExecutions.length > 0) {
    lines.push('### 性能问题 (耗时>1秒)')
    summary.slowExecutions.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.functionName}: 平均${s.avgDuration}ms, 最大${s.maxDuration}ms (${s.count}次)`)
    })
    lines.push('')
  }

  // 版本变更
  if (summary.recentVersions.length > 0) {
    lines.push('### 近期版本变更')
    summary.recentVersions.forEach(v => {
      const date = new Date(v.createdAt).toLocaleString('zh-CN')
      lines.push(`- [${v.functionName}] v${v.version}: ${v.changelog || '无描述'} (${date})`)
    })
    lines.push('')
  }

  // 错误样本
  if (summary.errorSamples.length > 0) {
    lines.push('### 错误详情样本')
    summary.errorSamples.forEach((e, i) => {
      lines.push(`\n#### 错误 ${i + 1}: ${e.functionName}`)
      lines.push(`错误信息: ${e.error}`)
      lines.push(`请求: ${JSON.stringify(e.request, null, 2)}`)
      if (e.logs.length > 0) {
        lines.push(`控制台输出: ${JSON.stringify(e.logs, null, 2)}`)
      }
    })
  }

  return lines.join('\n')
}
