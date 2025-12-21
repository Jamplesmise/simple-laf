import { ObjectId, Db } from 'mongodb'
import { encryptApiKey, decryptApiKey } from './crypto.js'

// 供应商类型
export type ProviderType = 'openai' | 'anthropic' | 'ollama' | 'custom'

// 供应商接口
export interface AIProvider {
  _id: ObjectId
  userId: ObjectId
  name: string
  type: ProviderType
  baseUrl: string
  apiKey?: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

// 模型定价
export interface ModelPricing {
  inputPricePerMillion: number   // 输入每百万 token 价格 (USD)
  outputPricePerMillion: number  // 输出每百万 token 价格 (USD)
  currency: 'USD' | 'CNY'        // 货币单位
}

// 模型接口
export interface AIModel {
  _id: ObjectId
  providerId: ObjectId
  userId: ObjectId
  name: string        // 实际模型 ID (如 gpt-4)
  alias: string       // 显示名称 (如 GPT-4 Turbo)
  temperature: number
  maxTokens: number
  pricing?: ModelPricing // 定价信息
  supportsThinking?: boolean // 是否支持深度思考模式
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

// 使用日志
export interface AIUsageLog {
  _id: ObjectId
  userId: ObjectId
  providerId: ObjectId
  modelId: ObjectId
  modelName: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: number        // 估算成本 (USD)
  source: 'chat' | 'execute' | 'generate' | 'refactor' | 'diagnose'
  conversationId?: ObjectId
  createdAt: Date
}

// 创建供应商输入
export interface CreateProviderInput {
  name: string
  type: ProviderType
  baseUrl: string
  apiKey?: string
  isDefault?: boolean
}

// 更新供应商输入
export interface UpdateProviderInput {
  name?: string
  baseUrl?: string
  apiKey?: string
  isDefault?: boolean
}

// 创建模型输入
export interface CreateModelInput {
  name: string
  alias: string
  temperature?: number
  maxTokens?: number
  pricing?: ModelPricing
  supportsThinking?: boolean
  isDefault?: boolean
}

// 更新模型输入
export interface UpdateModelInput {
  name?: string
  alias?: string
  temperature?: number
  maxTokens?: number
  pricing?: ModelPricing
  supportsThinking?: boolean
  isDefault?: boolean
}

// 默认供应商配置
export const DEFAULT_PROVIDERS: Omit<CreateProviderInput, 'isDefault'>[] = [
  {
    name: 'OpenAI',
    type: 'openai',
    baseUrl: 'https://api.openai.com/v1',
  },
  {
    name: 'Anthropic',
    type: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
  },
  {
    name: 'Ollama (本地)',
    type: 'ollama',
    baseUrl: 'http://localhost:11434',
  },
]

// 默认模型配置 (定价基于 2025 年初公开价格)
// maxTokens: 单次输出上限，2025年主流模型支持 16K-64K 输出
export const DEFAULT_MODELS: Record<ProviderType, Omit<CreateModelInput, 'isDefault'>[]> = {
  openai: [
    { name: 'gpt-4o', alias: 'GPT-4o', temperature: 0.7, maxTokens: 16384, pricing: { inputPricePerMillion: 2.5, outputPricePerMillion: 10, currency: 'USD' } },
    { name: 'gpt-4o-mini', alias: 'GPT-4o Mini', temperature: 0.7, maxTokens: 16384, pricing: { inputPricePerMillion: 0.15, outputPricePerMillion: 0.6, currency: 'USD' } },
    { name: 'gpt-4-turbo', alias: 'GPT-4 Turbo', temperature: 0.7, maxTokens: 16384, pricing: { inputPricePerMillion: 10, outputPricePerMillion: 30, currency: 'USD' } },
    { name: 'gpt-3.5-turbo', alias: 'GPT-3.5 Turbo', temperature: 0.7, maxTokens: 16384, pricing: { inputPricePerMillion: 0.5, outputPricePerMillion: 1.5, currency: 'USD' } },
  ],
  anthropic: [
    { name: 'claude-sonnet-4-20250514', alias: 'Claude Sonnet 4', temperature: 0.7, maxTokens: 16384, pricing: { inputPricePerMillion: 3, outputPricePerMillion: 15, currency: 'USD' } },
    { name: 'claude-3-5-sonnet-20241022', alias: 'Claude 3.5 Sonnet', temperature: 0.7, maxTokens: 16384, pricing: { inputPricePerMillion: 3, outputPricePerMillion: 15, currency: 'USD' } },
    { name: 'claude-3-opus-20240229', alias: 'Claude 3 Opus', temperature: 0.7, maxTokens: 16384, pricing: { inputPricePerMillion: 15, outputPricePerMillion: 75, currency: 'USD' } },
    { name: 'claude-3-haiku-20240307', alias: 'Claude 3 Haiku', temperature: 0.7, maxTokens: 16384, pricing: { inputPricePerMillion: 0.25, outputPricePerMillion: 1.25, currency: 'USD' } },
  ],
  ollama: [
    { name: 'llama3.3', alias: 'Llama 3.3 70B', temperature: 0.7, maxTokens: 16384, pricing: { inputPricePerMillion: 0, outputPricePerMillion: 0, currency: 'USD' } },
    { name: 'qwen2.5', alias: 'Qwen 2.5', temperature: 0.7, maxTokens: 16384, pricing: { inputPricePerMillion: 0, outputPricePerMillion: 0, currency: 'USD' } },
    { name: 'deepseek-r1', alias: 'DeepSeek R1', temperature: 0.7, maxTokens: 16384, pricing: { inputPricePerMillion: 0, outputPricePerMillion: 0, currency: 'USD' } },
    { name: 'codellama', alias: 'Code Llama', temperature: 0.7, maxTokens: 16384, pricing: { inputPricePerMillion: 0, outputPricePerMillion: 0, currency: 'USD' } },
  ],
  custom: [],
}

// ============ 供应商操作 ============

// 获取供应商列表
export async function listProviders(db: Db, userId: ObjectId): Promise<AIProvider[]> {
  const collection = db.collection<AIProvider>('ai_providers')
  return collection.find({ userId }).sort({ isDefault: -1, createdAt: -1 }).toArray()
}

// 获取单个供应商
export async function getProvider(
  db: Db,
  userId: ObjectId,
  providerId: ObjectId
): Promise<AIProvider | null> {
  const collection = db.collection<AIProvider>('ai_providers')
  return collection.findOne({ _id: providerId, userId })
}

// 创建供应商
export async function createProvider(
  db: Db,
  userId: ObjectId,
  input: CreateProviderInput
): Promise<AIProvider> {
  const collection = db.collection<AIProvider>('ai_providers')

  // 如果设为默认，先取消其他默认
  if (input.isDefault) {
    await collection.updateMany(
      { userId, isDefault: true },
      { $set: { isDefault: false } }
    )
  }

  const now = new Date()
  const provider: AIProvider = {
    _id: new ObjectId(),
    userId,
    name: input.name,
    type: input.type,
    baseUrl: input.baseUrl,
    apiKey: input.apiKey ? encryptApiKey(input.apiKey) : undefined,
    isDefault: input.isDefault || false,
    createdAt: now,
    updatedAt: now,
  }

  await collection.insertOne(provider)
  return provider
}

// 更新供应商
export async function updateProvider(
  db: Db,
  userId: ObjectId,
  providerId: ObjectId,
  input: UpdateProviderInput
): Promise<AIProvider | null> {
  const collection = db.collection<AIProvider>('ai_providers')

  // 如果设为默认，先取消其他默认
  if (input.isDefault === true) {
    await collection.updateMany(
      { userId, isDefault: true, _id: { $ne: providerId } },
      { $set: { isDefault: false } }
    )
  }

  const updateData: Partial<AIProvider> = {
    updatedAt: new Date(),
  }

  if (input.name !== undefined) updateData.name = input.name
  if (input.baseUrl !== undefined) updateData.baseUrl = input.baseUrl
  if (input.apiKey !== undefined) updateData.apiKey = encryptApiKey(input.apiKey)
  if (input.isDefault !== undefined) updateData.isDefault = input.isDefault

  await collection.updateOne({ _id: providerId, userId }, { $set: updateData })
  return collection.findOne({ _id: providerId })
}

// 删除供应商
export async function deleteProvider(
  db: Db,
  userId: ObjectId,
  providerId: ObjectId
): Promise<boolean> {
  const providerCollection = db.collection<AIProvider>('ai_providers')
  const modelCollection = db.collection<AIModel>('ai_models')

  const result = await providerCollection.deleteOne({ _id: providerId, userId })
  if (result.deletedCount > 0) {
    // 删除该供应商下的所有模型
    await modelCollection.deleteMany({ providerId, userId })
    return true
  }
  return false
}

// 获取默认供应商
export async function getDefaultProvider(
  db: Db,
  userId: ObjectId
): Promise<AIProvider | null> {
  const collection = db.collection<AIProvider>('ai_providers')
  return collection.findOne({ userId, isDefault: true })
}

// 初始化默认供应商
export async function initDefaultProviders(
  db: Db,
  userId: ObjectId
): Promise<void> {
  const collection = db.collection<AIProvider>('ai_providers')
  const existing = await collection.countDocuments({ userId })

  if (existing > 0) return

  const now = new Date()
  const providers = DEFAULT_PROVIDERS.map((p, i) => ({
    _id: new ObjectId(),
    userId,
    name: p.name,
    type: p.type as ProviderType,
    baseUrl: p.baseUrl,
    isDefault: i === 0,
    createdAt: now,
    updatedAt: now,
  }))

  await collection.insertMany(providers)

  // 为每个供应商创建默认模型
  const modelCollection = db.collection<AIModel>('ai_models')
  for (const provider of providers) {
    const defaultModels = DEFAULT_MODELS[provider.type]
    if (defaultModels.length > 0) {
      const models: AIModel[] = defaultModels.map((m, i) => ({
        _id: new ObjectId(),
        providerId: provider._id,
        userId,
        name: m.name,
        alias: m.alias,
        temperature: m.temperature ?? 0.7,
        maxTokens: m.maxTokens ?? 4096,
        pricing: m.pricing,
        isDefault: i === 0 && provider.isDefault,
        createdAt: now,
        updatedAt: now,
      }))
      await modelCollection.insertMany(models)
    }
  }
}

// ============ 模型操作 ============

// 获取供应商的模型列表
export async function listModels(
  db: Db,
  userId: ObjectId,
  providerId: ObjectId
): Promise<AIModel[]> {
  const collection = db.collection<AIModel>('ai_models')
  return collection
    .find({ userId, providerId })
    .sort({ isDefault: -1, createdAt: -1 })
    .toArray()
}

// 获取所有模型
export async function listAllModels(db: Db, userId: ObjectId): Promise<AIModel[]> {
  const collection = db.collection<AIModel>('ai_models')
  return collection.find({ userId }).sort({ isDefault: -1, createdAt: -1 }).toArray()
}

// 获取单个模型
export async function getModel(
  db: Db,
  userId: ObjectId,
  modelId: ObjectId
): Promise<AIModel | null> {
  const collection = db.collection<AIModel>('ai_models')
  return collection.findOne({ _id: modelId, userId })
}

// 创建模型
export async function createModel(
  db: Db,
  userId: ObjectId,
  providerId: ObjectId,
  input: CreateModelInput
): Promise<AIModel | null> {
  // 验证供应商存在
  const providerCollection = db.collection<AIProvider>('ai_providers')
  const provider = await providerCollection.findOne({ _id: providerId, userId })
  if (!provider) return null

  const collection = db.collection<AIModel>('ai_models')

  // 如果设为默认，先取消其他默认
  if (input.isDefault) {
    await collection.updateMany(
      { userId, isDefault: true },
      { $set: { isDefault: false } }
    )
  }

  const now = new Date()
  const model: AIModel = {
    _id: new ObjectId(),
    providerId,
    userId,
    name: input.name,
    alias: input.alias,
    temperature: input.temperature ?? 0.7,
    maxTokens: input.maxTokens ?? 4096,
    pricing: input.pricing,
    supportsThinking: input.supportsThinking ?? false,
    isDefault: input.isDefault || false,
    createdAt: now,
    updatedAt: now,
  }

  await collection.insertOne(model)
  return model
}

// 更新模型
export async function updateModel(
  db: Db,
  userId: ObjectId,
  modelId: ObjectId,
  input: UpdateModelInput
): Promise<AIModel | null> {
  const collection = db.collection<AIModel>('ai_models')

  // 如果设为默认，先取消其他默认
  if (input.isDefault === true) {
    await collection.updateMany(
      { userId, isDefault: true, _id: { $ne: modelId } },
      { $set: { isDefault: false } }
    )
  }

  const updateData: Partial<AIModel> = {
    updatedAt: new Date(),
  }

  if (input.name !== undefined) updateData.name = input.name
  if (input.alias !== undefined) updateData.alias = input.alias
  if (input.temperature !== undefined) updateData.temperature = input.temperature
  if (input.maxTokens !== undefined) updateData.maxTokens = input.maxTokens
  if (input.pricing !== undefined) updateData.pricing = input.pricing
  if (input.supportsThinking !== undefined) updateData.supportsThinking = input.supportsThinking
  if (input.isDefault !== undefined) updateData.isDefault = input.isDefault

  await collection.updateOne({ _id: modelId, userId }, { $set: updateData })
  return collection.findOne({ _id: modelId })
}

// 删除模型
export async function deleteModel(
  db: Db,
  userId: ObjectId,
  modelId: ObjectId
): Promise<boolean> {
  const collection = db.collection<AIModel>('ai_models')
  const result = await collection.deleteOne({ _id: modelId, userId })
  return result.deletedCount > 0
}

// 获取默认模型
export async function getDefaultModel(
  db: Db,
  userId: ObjectId
): Promise<AIModel | null> {
  const collection = db.collection<AIModel>('ai_models')
  return collection.findOne({ userId, isDefault: true })
}

// 脱敏供应商 API Key
export function maskApiKey(provider: AIProvider): AIProvider {
  if (provider.apiKey) {
    // 先解密再脱敏
    const key = decryptApiKey(provider.apiKey)
    const masked = key.length > 8
      ? `${key.slice(0, 4)}${'*'.repeat(key.length - 8)}${key.slice(-4)}`
      : '*'.repeat(key.length)
    return { ...provider, apiKey: masked }
  }
  return provider
}

// ============ 使用日志 ============

export interface CreateUsageLogInput {
  providerId: ObjectId
  modelId: ObjectId
  modelName: string
  inputTokens: number
  outputTokens: number
  source: 'chat' | 'execute' | 'generate' | 'refactor' | 'diagnose'
  conversationId?: ObjectId
}

// 记录使用日志
export async function logUsage(
  db: Db,
  userId: ObjectId,
  input: CreateUsageLogInput
): Promise<AIUsageLog> {
  const collection = db.collection<AIUsageLog>('ai_usage_logs')

  // 获取模型定价计算成本
  const model = await getModel(db, userId, input.modelId)
  let cost = 0
  if (model?.pricing) {
    const inputCost = (input.inputTokens / 1000000) * model.pricing.inputPricePerMillion
    const outputCost = (input.outputTokens / 1000000) * model.pricing.outputPricePerMillion
    cost = inputCost + outputCost
  }

  const log: AIUsageLog = {
    _id: new ObjectId(),
    userId,
    providerId: input.providerId,
    modelId: input.modelId,
    modelName: input.modelName,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    totalTokens: input.inputTokens + input.outputTokens,
    cost,
    source: input.source,
    conversationId: input.conversationId,
    createdAt: new Date(),
  }

  await collection.insertOne(log)
  return log
}

// 获取使用日志列表
export async function listUsageLogs(
  db: Db,
  userId: ObjectId,
  options?: {
    limit?: number
    offset?: number
    startDate?: Date
    endDate?: Date
    providerId?: ObjectId
    modelId?: ObjectId
  }
): Promise<AIUsageLog[]> {
  const collection = db.collection<AIUsageLog>('ai_usage_logs')

  interface QueryFilter {
    userId: ObjectId
    createdAt?: { $gte?: Date; $lte?: Date }
    providerId?: ObjectId
    modelId?: ObjectId
  }

  const query: QueryFilter = { userId }

  if (options?.startDate || options?.endDate) {
    query.createdAt = {}
    if (options.startDate) query.createdAt.$gte = options.startDate
    if (options.endDate) query.createdAt.$lte = options.endDate
  }

  if (options?.providerId) query.providerId = options.providerId
  if (options?.modelId) query.modelId = options.modelId

  return collection
    .find(query)
    .sort({ createdAt: -1 })
    .skip(options?.offset || 0)
    .limit(options?.limit || 100)
    .toArray()
}

// 获取使用统计
export async function getUsageStats(
  db: Db,
  userId: ObjectId,
  options?: {
    startDate?: Date
    endDate?: Date
  }
): Promise<{
  totalTokens: number
  totalCost: number
  totalRequests: number
  byProvider: Array<{ providerId: string; name: string; tokens: number; cost: number; requests: number }>
  byModel: Array<{ modelId: string; name: string; tokens: number; cost: number; requests: number }>
}> {
  const collection = db.collection<AIUsageLog>('ai_usage_logs')

  interface MatchStage {
    userId: ObjectId
    createdAt?: { $gte?: Date; $lte?: Date }
  }

  const match: MatchStage = { userId }
  if (options?.startDate || options?.endDate) {
    match.createdAt = {}
    if (options.startDate) match.createdAt.$gte = options.startDate
    if (options.endDate) match.createdAt.$lte = options.endDate
  }

  const result = await collection.aggregate([
    { $match: match },
    {
      $facet: {
        total: [
          {
            $group: {
              _id: null,
              totalTokens: { $sum: '$totalTokens' },
              totalCost: { $sum: '$cost' },
              totalRequests: { $sum: 1 },
            },
          },
        ],
        byProvider: [
          {
            $group: {
              _id: '$providerId',
              tokens: { $sum: '$totalTokens' },
              cost: { $sum: '$cost' },
              requests: { $sum: 1 },
            },
          },
        ],
        byModel: [
          {
            $group: {
              _id: { modelId: '$modelId', modelName: '$modelName' },
              tokens: { $sum: '$totalTokens' },
              cost: { $sum: '$cost' },
              requests: { $sum: 1 },
            },
          },
        ],
      },
    },
  ]).toArray()

  const data = result[0] || { total: [], byProvider: [], byModel: [] }
  const total = data.total[0] || { totalTokens: 0, totalCost: 0, totalRequests: 0 }

  // 获取供应商名称
  const providerIds = data.byProvider.map((p: { _id: ObjectId }) => p._id)
  const providers = await db.collection<AIProvider>('ai_providers')
    .find({ _id: { $in: providerIds } })
    .toArray()
  const providerMap = new Map(providers.map(p => [p._id.toString(), p.name]))

  return {
    totalTokens: total.totalTokens,
    totalCost: total.totalCost,
    totalRequests: total.totalRequests,
    byProvider: data.byProvider.map((p: { _id: ObjectId; tokens: number; cost: number; requests: number }) => ({
      providerId: p._id.toString(),
      name: providerMap.get(p._id.toString()) || 'Unknown',
      tokens: p.tokens,
      cost: p.cost,
      requests: p.requests,
    })),
    byModel: data.byModel.map((m: { _id: { modelId: ObjectId; modelName: string }; tokens: number; cost: number; requests: number }) => ({
      modelId: m._id.modelId.toString(),
      name: m._id.modelName,
      tokens: m.tokens,
      cost: m.cost,
      requests: m.requests,
    })),
  }
}

// ============ 模型测试 ============

// 测试模型连接
export async function testModel(
  db: Db,
  userId: ObjectId,
  modelId: ObjectId
): Promise<{ success: boolean; message: string; latency?: number }> {
  // 获取模型
  const model = await getModel(db, userId, modelId)
  if (!model) {
    return { success: false, message: '模型不存在' }
  }

  // 获取供应商
  const provider = await getProvider(db, userId, model.providerId)
  if (!provider) {
    return { success: false, message: '供应商不存在' }
  }

  // 动态导入 providers
  const { OpenAIProvider } = await import('./providers/openai.js')
  const { AnthropicProvider } = await import('./providers/anthropic.js')
  const { OllamaProvider } = await import('./providers/ollama.js')
  const { CustomProvider } = await import('./providers/custom.js')

  const startTime = Date.now()

  try {
    let providerInstance
    // API Key 在数据库中是加密存储的，需要解密
    const apiKey = provider.apiKey ? decryptApiKey(provider.apiKey) : ''

    switch (provider.type) {
      case 'openai':
        providerInstance = new OpenAIProvider(apiKey, provider.baseUrl)
        break
      case 'anthropic':
        providerInstance = new AnthropicProvider(apiKey, provider.baseUrl)
        break
      case 'ollama':
        providerInstance = new OllamaProvider(provider.baseUrl)
        break
      case 'custom':
        providerInstance = new CustomProvider(apiKey, provider.baseUrl, model.name)
        break
      default:
        return { success: false, message: `不支持的供应商类型: ${provider.type}` }
    }

    // 使用指定模型发送测试消息
    const response = await providerInstance.chat(
      [{ role: 'user', content: 'Hi' }],
      { model: model.name, maxTokens: 5 }
    )
    const latency = Date.now() - startTime
    const success = !!response.content

    return {
      success,
      message: success ? `连接成功 (${latency}ms)` : '连接失败',
      latency
    }
  } catch (error) {
    const latency = Date.now() - startTime
    const message = error instanceof Error ? error.message : '连接失败'
    return { success: false, message, latency }
  }
}
