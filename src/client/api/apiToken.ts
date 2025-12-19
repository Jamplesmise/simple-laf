import client from './client'

export interface ApiToken {
  _id: string
  name: string
  tokenPrefix: string
  expiresAt: string
  createdAt: string
  lastUsedAt?: string
}

export interface TokenAuthSettings {
  enabled: boolean
  updatedAt: string
}

interface ListResponse {
  success: boolean
  data: ApiToken[]
}

interface SettingsResponse {
  success: boolean
  data: TokenAuthSettings
}

interface CreateResponse {
  success: boolean
  data: {
    token: string
    id: string
  }
}

export const apiTokenApi = {
  // 获取 token 列表
  list: () =>
    client.get<ListResponse>('/api/tokens'),

  // 创建 token
  create: (name: string, expireDays: number) =>
    client.post<CreateResponse>('/api/tokens', { name, expireDays }),

  // 删除 token
  delete: (id: string) =>
    client.delete<{ success: boolean }>(`/api/tokens/${id}`),

  // 获取认证设置
  getSettings: () =>
    client.get<SettingsResponse>('/api/tokens/settings'),

  // 更新认证设置
  updateSettings: (enabled: boolean) =>
    client.put<SettingsResponse>('/api/tokens/settings', { enabled }),
}
