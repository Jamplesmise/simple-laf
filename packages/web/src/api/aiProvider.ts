import client from './client'

// 供应商类型
export type ProviderType = 'openai' | 'anthropic' | 'ollama' | 'custom'

// 模型定价
export interface ModelPricing {
  inputPricePerMillion: number
  outputPricePerMillion: number
  currency: 'USD' | 'CNY'
}

// 供应商接口
export interface AIProvider {
  _id: string
  userId: string
  name: string
  type: ProviderType
  baseUrl: string
  apiKey?: string  // 脱敏后的
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

// 模型接口
export interface AIModel {
  _id: string
  providerId: string
  userId: string
  name: string
  alias: string
  temperature: number
  maxTokens: number
  pricing?: ModelPricing
  supportsThinking?: boolean  // 是否支持深度思考模式
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

// 使用日志
export interface AIUsageLog {
  _id: string
  userId: string
  providerId: string
  modelId: string
  modelName: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: number
  source: string
  conversationId?: string
  createdAt: string
}

// 使用统计
export interface UsageStats {
  totalTokens: number
  totalCost: number
  totalRequests: number
  byProvider: Array<{ providerId: string; name: string; tokens: number; cost: number; requests: number }>
  byModel: Array<{ modelId: string; name: string; tokens: number; cost: number; requests: number }>
}

// ============ 供应商 API ============

export const aiProviderApi = {
  // 获取供应商列表
  list: () => {
    return client.get<{ success: boolean; data: AIProvider[] }>(
      '/api/ai/providers'
    )
  },

  // 获取单个供应商
  get: (id: string) => {
    return client.get<{ success: boolean; data: AIProvider }>(
      `/api/ai/providers/${id}`
    )
  },

  // 创建供应商
  create: (data: {
    name: string
    type: ProviderType
    baseUrl: string
    apiKey?: string
    isDefault?: boolean
  }) => {
    return client.post<{ success: boolean; data: AIProvider }>(
      '/api/ai/providers',
      data
    )
  },

  // 更新供应商
  update: (id: string, data: {
    name?: string
    baseUrl?: string
    apiKey?: string
    isDefault?: boolean
  }) => {
    return client.put<{ success: boolean; data: AIProvider }>(
      `/api/ai/providers/${id}`,
      data
    )
  },

  // 删除供应商
  delete: (id: string) => {
    return client.delete<{ success: boolean }>(
      `/api/ai/providers/${id}`
    )
  },
}

// ============ 模型 API ============

export const aiModelApi = {
  // 获取供应商的模型列表
  list: (providerId: string) => {
    return client.get<{ success: boolean; data: AIModel[] }>(
      `/api/ai/providers/${providerId}/models`
    )
  },

  // 获取所有模型
  listAll: () => {
    return client.get<{ success: boolean; data: AIModel[] }>(
      '/api/ai/all-models'
    )
  },

  // 获取默认模型
  getDefault: () => {
    return client.get<{ success: boolean; data: AIModel | null }>(
      '/api/ai/default-model'
    )
  },

  // 获取单个模型
  get: (id: string) => {
    return client.get<{ success: boolean; data: AIModel }>(
      `/api/ai/models/${id}`
    )
  },

  // 创建模型
  create: (providerId: string, data: {
    name: string
    alias: string
    temperature?: number
    maxTokens?: number
    pricing?: ModelPricing
    supportsThinking?: boolean
    isDefault?: boolean
  }) => {
    return client.post<{ success: boolean; data: AIModel }>(
      `/api/ai/providers/${providerId}/models`,
      data
    )
  },

  // 更新模型
  update: (id: string, data: {
    name?: string
    alias?: string
    temperature?: number
    maxTokens?: number
    pricing?: ModelPricing
    supportsThinking?: boolean
    isDefault?: boolean
  }) => {
    return client.put<{ success: boolean; data: AIModel }>(
      `/api/ai/models/${id}`,
      data
    )
  },

  // 删除模型
  delete: (id: string) => {
    return client.delete<{ success: boolean }>(
      `/api/ai/models/${id}`
    )
  },

  // 测试模型连接
  test: (id: string) => {
    return client.post<{ success: boolean; data: { success: boolean; message: string; latency?: number } }>(
      `/api/ai/models/${id}/test`
    )
  },
}
