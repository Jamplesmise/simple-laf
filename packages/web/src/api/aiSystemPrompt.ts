import client from './client'

export interface AISystemPrompt {
  _id: string
  userId: string
  name: string
  content: string
  isDefault: boolean
  currentVersion: number
  createdAt: string
  updatedAt: string
}

export interface AIPromptVersion {
  _id: string
  promptId: string
  version: number
  content: string
  changeNote?: string
  createdAt: string
}

export interface CreatePromptInput {
  name: string
  content: string
  isDefault?: boolean
}

export interface UpdatePromptInput {
  name?: string
  content?: string
  isDefault?: boolean
  changeNote?: string
}

export const aiSystemPromptApi = {
  // 获取提示词列表
  list: () => {
    return client.get<{ success: boolean; data: AISystemPrompt[] }>(
      '/api/ai/prompts'
    )
  },

  // 获取默认提示词
  getDefault: () => {
    return client.get<{ success: boolean; data: AISystemPrompt | null }>(
      '/api/ai/prompts/default'
    )
  },

  // 获取单个提示词
  get: (id: string) => {
    return client.get<{ success: boolean; data: AISystemPrompt }>(
      `/api/ai/prompts/${id}`
    )
  },

  // 创建提示词
  create: (data: CreatePromptInput) => {
    return client.post<{ success: boolean; data: AISystemPrompt }>(
      '/api/ai/prompts',
      data
    )
  },

  // 更新提示词
  update: (id: string, data: UpdatePromptInput) => {
    return client.put<{ success: boolean; data: AISystemPrompt }>(
      `/api/ai/prompts/${id}`,
      data
    )
  },

  // 删除提示词
  delete: (id: string) => {
    return client.delete<{ success: boolean }>(
      `/api/ai/prompts/${id}`
    )
  },

  // 获取版本历史
  getVersions: (id: string) => {
    return client.get<{ success: boolean; data: AIPromptVersion[] }>(
      `/api/ai/prompts/${id}/versions`
    )
  },

  // 回滚到指定版本
  rollback: (id: string, version: number) => {
    return client.post<{ success: boolean; data: AISystemPrompt }>(
      `/api/ai/prompts/${id}/rollback`,
      { version }
    )
  },
}
