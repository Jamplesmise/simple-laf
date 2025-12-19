import client from './client'

const API_BASE = '/api/execution-logs'

export interface ExecutionLog {
  _id: string
  userId: string
  functionId: string
  functionName: string
  trigger: 'manual' | 'scheduler' | 'webhook' | 'public'
  request: {
    method: string
    body?: unknown
    query?: Record<string, string>
    headers?: Record<string, string>
  }
  success: boolean
  data?: unknown
  error?: string
  logs: Array<{
    level: 'log' | 'info' | 'warn' | 'error'
    args: unknown[]
    timestamp: number
  }>
  duration: number
  createdAt: string
}

export interface ExecutionStats {
  totalCount: number
  successCount: number
  failCount: number
  avgDuration: number
  last24hCount: number
}

export interface OverallStats {
  totalExecutions: number
  successCount: number
  failCount: number
  successRate: number
  avgDuration: number
  last24hCount: number
  last7dCount: number
  triggerBreakdown: { trigger: string; count: number }[]
  topFunctions: { functionId: string; functionName: string; count: number; avgDuration: number }[]
}

export interface ExecutionTrend {
  hourly: { hour: string; count: number; successCount: number }[]
  daily: { date: string; count: number; successCount: number }[]
}

export interface LogSearchParams {
  functionIds?: string[]
  keyword?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}

export const executionLogsApi = {
  // 获取执行历史列表
  list: (options?: { functionId?: string; limit?: number; offset?: number }) =>
    client.get<{ success: boolean; data: { logs: ExecutionLog[]; total: number } }>(
      API_BASE,
      { params: options }
    ),

  // 高级搜索执行日志
  search: (params: LogSearchParams) =>
    client.post<{ success: boolean; data: { logs: ExecutionLog[]; total: number } }>(
      `${API_BASE}/search`,
      params
    ),

  // 获取单个函数的执行历史
  listByFunction: (functionId: string, options?: { limit?: number; offset?: number }) =>
    client.get<{ success: boolean; data: { logs: ExecutionLog[]; total: number } }>(
      `${API_BASE}/function/${functionId}`,
      { params: options }
    ),

  // 获取执行日志详情
  getById: (id: string) =>
    client.get<{ success: boolean; data: ExecutionLog }>(`${API_BASE}/${id}`),

  // 获取函数执行统计
  getStats: (functionId: string) =>
    client.get<{ success: boolean; data: ExecutionStats }>(
      `${API_BASE}/stats/${functionId}`
    ),

  // 删除函数的所有执行历史
  deleteByFunction: (functionId: string) =>
    client.delete<{ success: boolean; data: { deletedCount: number } }>(
      `${API_BASE}/function/${functionId}`
    ),

  // 清理过期日志
  cleanup: (retentionDays?: number) =>
    client.post<{ success: boolean; data: { deletedCount: number } }>(
      `${API_BASE}/cleanup`,
      { retentionDays }
    ),

  // 获取整体统计
  getOverallStats: () =>
    client.get<{ success: boolean; data: OverallStats }>(
      `${API_BASE}/stats/overall`
    ),

  // 获取执行趋势
  getTrend: (days?: number) =>
    client.get<{ success: boolean; data: ExecutionTrend }>(
      `${API_BASE}/stats/trend`,
      { params: { days } }
    ),
}
