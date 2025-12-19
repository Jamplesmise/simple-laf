import client from './client'

const API_BASE = '/api/webhooks'

export interface Webhook {
  _id: string
  userId: string
  functionId: string
  functionName: string
  token: string
  secret?: string
  enabled: boolean
  methods: string[]
  callCount: number
  lastCalledAt?: string
  createdAt: string
  updatedAt: string
}

export const webhookApi = {
  // 获取 webhook 列表
  list: () =>
    client.get<{ success: boolean; data: Webhook[] }>(API_BASE),

  // 获取函数的 webhook
  getByFunction: (functionId: string) =>
    client.get<{ success: boolean; data: Webhook | null }>(
      `${API_BASE}/function/${functionId}`
    ),

  // 创建 webhook
  create: (functionId: string, options?: { methods?: string[]; generateSecret?: boolean }) =>
    client.post<{ success: boolean; data: Webhook }>(
      API_BASE,
      { functionId, ...options }
    ),

  // 更新 webhook
  update: (
    id: string,
    updates: {
      enabled?: boolean
      methods?: string[]
      regenerateToken?: boolean
      regenerateSecret?: boolean
    }
  ) =>
    client.patch<{ success: boolean; data: Webhook }>(
      `${API_BASE}/${id}`,
      updates
    ),

  // 删除 webhook
  remove: (id: string) =>
    client.delete<{ success: boolean }>(
      `${API_BASE}/${id}`
    ),
}

// 生成 webhook 调用 URL
export function getWebhookUrl(token: string): string {
  const baseUrl = window.location.origin
  return `${baseUrl}/api/webhooks/call/${token}`
}
