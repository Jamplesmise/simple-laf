import client from './client'

const API_BASE = '/api/scheduler'

export interface IntervalConfig {
  days: number
  hours: number
  minutes: number
  seconds: number
}

export interface ScheduledTask {
  _id: string
  userId: string
  functionId: string
  functionName: string
  enabled: boolean
  interval: number
  intervalConfig: IntervalConfig
  lastRunAt?: string
  nextRunAt?: string
  lastResult?: {
    success: boolean
    data?: unknown
    error?: string
    duration: number
  }
  runCount: number
  createdAt: string
  updatedAt: string
}

export const schedulerApi = {
  // 获取定时任务列表
  list: () =>
    client.get<{ success: boolean; data: ScheduledTask[] }>(API_BASE),

  // 创建定时任务
  create: (functionId: string, intervalConfig: IntervalConfig) =>
    client.post<{ success: boolean; data: ScheduledTask }>(
      API_BASE,
      { functionId, intervalConfig }
    ),

  // 更新定时任务
  update: (id: string, data: { enabled?: boolean; intervalConfig?: IntervalConfig }) =>
    client.put<{ success: boolean; data: ScheduledTask }>(
      `${API_BASE}/${id}`,
      data
    ),

  // 删除定时任务
  remove: (id: string) =>
    client.delete<{ success: boolean }>(`${API_BASE}/${id}`),

  // 手动执行一次
  runOnce: (id: string) =>
    client.post<{ success: boolean; data: unknown }>(`${API_BASE}/${id}/run`, {}),
}
