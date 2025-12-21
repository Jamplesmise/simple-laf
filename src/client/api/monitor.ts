import client from './client'

export interface MonitorStats {
  callCount: number
  successRate: number
  avgLatency: number
  timeline: { time: string; count: number; successCount: number }[]
}

export interface TopFunction {
  functionId: string
  functionName: string
  count: number
  successRate: number
  avgDuration: number
}

export interface ConnectionStats {
  totalConnections: number
  rooms: { name: string; size: number }[]
}

type Period = '1h' | '24h' | '7d'

/**
 * 获取函数调用统计
 */
export async function getStats(period: Period = '24h', functionId?: string): Promise<MonitorStats> {
  const params = new URLSearchParams({ period })
  if (functionId) {
    params.append('functionId', functionId)
  }
  const res = await client.get<{ success: boolean; data: MonitorStats }>(
    `/api/monitor/stats?${params.toString()}`
  )
  return res.data.data
}

/**
 * 获取热门函数排行
 */
export async function getTopFunctions(period: Period = '24h', limit: number = 10): Promise<TopFunction[]> {
  const params = new URLSearchParams({ period, limit: String(limit) })
  const res = await client.get<{ success: boolean; data: TopFunction[] }>(
    `/api/monitor/top-functions?${params.toString()}`
  )
  return res.data.data
}

/**
 * 获取 WebSocket 连接统计
 */
export async function getConnections(): Promise<ConnectionStats> {
  const res = await client.get<{ success: boolean; data: ConnectionStats }>('/api/monitor/connections')
  return res.data.data
}

export interface ErrorGroup {
  errorType: string
  count: number
  firstOccurrence: string
  lastOccurrence: string
  affectedFunctions: string[]
  sampleError: string
}

export interface ErrorTrend {
  time: string
  count: number
}

export interface ErrorSummary {
  totalErrors: number
  errorRate: number
  topErrors: ErrorGroup[]
  trend: ErrorTrend[]
}

export interface FunctionError {
  error: string
  createdAt: string
  duration: number
  trigger: string
}

type ErrorPeriod = '24h' | '7d'

/**
 * 获取错误摘要
 */
export async function getErrorSummary(
  period: ErrorPeriod = '24h',
  functionId?: string
): Promise<ErrorSummary> {
  const params = new URLSearchParams({ period })
  if (functionId) {
    params.append('functionId', functionId)
  }
  const res = await client.get<{ success: boolean; data: ErrorSummary }>(
    `/api/monitor/errors?${params.toString()}`
  )
  return res.data.data
}

/**
 * 获取函数错误详情
 */
export async function getFunctionErrors(
  functionId: string,
  period: ErrorPeriod = '24h',
  limit: number = 50
): Promise<{ errors: FunctionError[]; total: number }> {
  const params = new URLSearchParams({ period, limit: String(limit) })
  const res = await client.get<{ success: boolean; data: { errors: FunctionError[]; total: number } }>(
    `/api/monitor/errors/${functionId}?${params.toString()}`
  )
  return res.data.data
}
