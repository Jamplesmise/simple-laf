import { ObjectId } from 'mongodb'
import { getDB } from '../../db.js'
import type { AIConfig, AIHistory, ChatMessage, ChatOptions, AIAction } from './types.js'
import { encryptApiKey, decryptApiKey, maskApiKey } from './crypto.js'
import { createProvider, getDefaultModels, AIProviderError } from './providers/index.js'
import logger from '../../utils/logger.js'

export { encryptApiKey, decryptApiKey, maskApiKey }
export { AIProviderError }
export * from './types.js'

/**
 * 获取用户的 AI 配置
 */
export async function getAIConfig(userId: ObjectId): Promise<AIConfig | null> {
  const db = getDB()
  return db.collection<AIConfig>('ai_config').findOne({ userId })
}

/**
 * 获取用户的 AI 配置 (API Key 脱敏)
 */
export async function getAIConfigMasked(userId: ObjectId): Promise<(Omit<AIConfig, 'apiKey'> & { apiKeyMasked: string }) | null> {
  const config = await getAIConfig(userId)
  if (!config) return null

  const decrypted = decryptApiKey(config.apiKey)
  const { apiKey: _, ...rest } = config
  return {
    ...rest,
    apiKeyMasked: maskApiKey(decrypted)
  }
}

/**
 * 保存 AI 配置
 */
export async function saveAIConfig(
  userId: ObjectId,
  data: {
    provider: AIConfig['provider']
    model: string
    apiKey?: string
    baseUrl?: string
    params?: AIConfig['params']
  }
): Promise<void> {
  const db = getDB()
  const now = new Date()

  // 获取现有配置
  const existing = await getAIConfig(userId)

  // 如果没有传 apiKey，保留原有的
  let encryptedKey = existing?.apiKey || ''
  if (data.apiKey) {
    encryptedKey = encryptApiKey(data.apiKey)
  }

  await db.collection('ai_config').updateOne(
    { userId },
    {
      $set: {
        provider: data.provider,
        model: data.model,
        apiKey: encryptedKey,
        baseUrl: data.baseUrl || null,
        params: data.params || { temperature: 0.7, maxTokens: 4096 },
        updatedAt: now
      },
      $setOnInsert: {
        userId,  // 新建时需要设置 userId
        createdAt: now
      }
    },
    { upsert: true }
  )
}

/**
 * 测试 AI 连接
 */
export async function testAIConnection(userId: ObjectId): Promise<{ success: boolean; message: string }> {
  const config = await getAIConfig(userId)
  if (!config) {
    return { success: false, message: '未配置 AI 设置' }
  }

  try {
    const provider = createProvider(config)
    const success = await provider.testConnection()
    return {
      success,
      message: success ? '连接成功' : '连接失败'
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '连接失败'
    return { success: false, message }
  }
}

/**
 * 获取可用模型列表
 */
export async function getAvailableModels(
  userId: ObjectId
): Promise<Array<{ id: string; name: string }>> {
  const config = await getAIConfig(userId)

  if (!config) {
    // 返回 OpenAI 的默认模型作为示例
    return getDefaultModels('openai')
  }

  try {
    const provider = createProvider(config)
    return await provider.listModels()
  } catch {
    // 返回预定义的模型列表
    return getDefaultModels(config.provider)
  }
}

/**
 * 获取供应商的默认模型列表 (不需要配置)
 */
export function getProviderDefaultModels(provider: AIConfig['provider']): Array<{ id: string; name: string }> {
  return getDefaultModels(provider)
}

/**
 * 发送 AI 聊天请求 (非流式)
 */
export async function chat(
  userId: ObjectId,
  messages: ChatMessage[],
  options?: ChatOptions
): Promise<{ content: string; tokensUsed?: number }> {
  const config = await getAIConfig(userId)
  if (!config) {
    throw new AIProviderError('未配置 AI 设置', 'CONFIG_ERROR')
  }

  const provider = createProvider(config)
  return provider.chat(messages, {
    temperature: config.params.temperature,
    maxTokens: config.params.maxTokens,
    ...options
  })
}

/**
 * 发送 AI 聊天请求 (流式)
 * @param modelId 可选的模型 ID，如果提供则使用新的 provider/model 系统
 */
export async function* chatStream(
  userId: ObjectId,
  messages: ChatMessage[],
  options?: ChatOptions,
  modelId?: ObjectId
): AsyncGenerator<string, void, unknown> {
  const db = getDB()

  // 如果指定了 modelId，使用新的 provider/model 系统
  if (modelId) {
    const { getModel, getProvider } = await import('./provider.js')
    const { OpenAIProvider } = await import('./providers/openai.js')
    const { AnthropicProvider } = await import('./providers/anthropic.js')
    const { OllamaProvider } = await import('./providers/ollama.js')
    const { CustomProvider } = await import('./providers/custom.js')

    const model = await getModel(db, userId, modelId)
    if (!model) {
      throw new AIProviderError('模型不存在', 'MODEL_NOT_FOUND')
    }

    const providerData = await getProvider(db, userId, model.providerId)
    if (!providerData) {
      throw new AIProviderError('供应商不存在', 'PROVIDER_NOT_FOUND')
    }

    let providerInstance
    // API Key 在数据库中是加密存储的，需要解密
    const apiKey = providerData.apiKey ? decryptApiKey(providerData.apiKey) : ''

    switch (providerData.type) {
      case 'openai':
        providerInstance = new OpenAIProvider(apiKey, providerData.baseUrl)
        break
      case 'anthropic':
        providerInstance = new AnthropicProvider(apiKey, providerData.baseUrl)
        break
      case 'ollama':
        providerInstance = new OllamaProvider(providerData.baseUrl)
        break
      case 'custom':
        providerInstance = new CustomProvider(apiKey, providerData.baseUrl, model.name)
        break
      default:
        throw new AIProviderError(`不支持的供应商类型: ${providerData.type}`, 'INVALID_PROVIDER')
    }

    try {
      for await (const chunk of providerInstance.chatStream(messages, {
        model: model.name,
        temperature: model.temperature,
        maxTokens: model.maxTokens,
        ...options
      })) {
        yield chunk
      }
    } catch (err) {
      logger.error('[chatStream] 流式响应出错:', err)
      throw err
    }
    return
  }

  // 否则使用旧的 ai_config 系统 (向后兼容)
  const config = await getAIConfig(userId)
  if (!config) {
    throw new AIProviderError('未配置 AI 设置', 'CONFIG_ERROR')
  }

  const provider = createProvider(config)
  yield* provider.chatStream(messages, {
    temperature: config.params.temperature,
    maxTokens: config.params.maxTokens,
    ...options
  })
}

/**
 * 记录 AI 历史
 */
export async function saveAIHistory(
  userId: ObjectId,
  data: {
    functionId?: ObjectId
    action: AIAction
    prompt: string
    response: string
    model: string
    tokensUsed?: number
  }
): Promise<void> {
  const db = getDB()
  await db.collection<AIHistory>('ai_history').insertOne({
    userId,
    functionId: data.functionId,
    action: data.action,
    prompt: data.prompt,
    response: data.response,
    model: data.model,
    tokensUsed: data.tokensUsed,
    createdAt: new Date()
  })
}

/**
 * 获取 AI 历史记录
 */
export async function getAIHistory(
  userId: ObjectId,
  options?: { limit?: number; offset?: number; functionId?: ObjectId }
): Promise<AIHistory[]> {
  const db = getDB()
  const query: Record<string, unknown> = { userId }

  if (options?.functionId) {
    query.functionId = options.functionId
  }

  return db.collection<AIHistory>('ai_history')
    .find(query)
    .sort({ createdAt: -1 })
    .skip(options?.offset || 0)
    .limit(options?.limit || 50)
    .toArray()
}

/**
 * 删除 AI 历史记录
 */
export async function deleteAIHistory(userId: ObjectId, historyId: ObjectId): Promise<boolean> {
  const db = getDB()
  const result = await db.collection('ai_history').deleteOne({
    _id: historyId,
    userId
  })
  return result.deletedCount > 0
}
