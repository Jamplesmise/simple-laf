import client from './client'

const API_BASE = '/api/snippets'

export interface Snippet {
  _id: string
  userId: string
  name: string
  description?: string
  code: string
  tags: string[]
  useCount: number
  createdAt: string
  updatedAt: string
}

export const snippetsApi = {
  // 获取代码片段列表
  list: (tag?: string) =>
    client.get<{ success: boolean; data: Snippet[] }>(API_BASE, { params: { tag } }),

  // 获取所有标签
  getTags: () =>
    client.get<{ success: boolean; data: string[] }>(`${API_BASE}/tags`),

  // 搜索代码片段
  search: (q: string) =>
    client.get<{ success: boolean; data: Snippet[] }>(`${API_BASE}/search`, { params: { q } }),

  // 获取单个代码片段
  getById: (id: string) =>
    client.get<{ success: boolean; data: Snippet }>(`${API_BASE}/${id}`),

  // 创建代码片段
  create: (data: { name: string; description?: string; code: string; tags?: string[] }) =>
    client.post<{ success: boolean; data: Snippet }>(API_BASE, data),

  // 更新代码片段
  update: (id: string, data: { name?: string; description?: string; code?: string; tags?: string[] }) =>
    client.patch<{ success: boolean; data: Snippet }>(`${API_BASE}/${id}`, data),

  // 删除代码片段
  remove: (id: string) =>
    client.delete<{ success: boolean }>(`${API_BASE}/${id}`),

  // 增加使用次数
  incrementUseCount: (id: string) =>
    client.post<{ success: boolean }>(`${API_BASE}/${id}/use`, {}),
}
