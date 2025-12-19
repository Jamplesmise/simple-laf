import type { ChatMessage, ChatOptions, ChatResponse, ModelInfo } from '../types.js'

/**
 * AI 供应商抽象基类
 */
export abstract class BaseAIProvider {
  protected apiKey: string
  protected baseUrl?: string

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  /**
   * 发送聊天请求 (非流式)
   */
  abstract chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>

  /**
   * 发送聊天请求 (流式)
   */
  abstract chatStream(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncGenerator<string, void, unknown>

  /**
   * 获取可用模型列表
   */
  abstract listModels(): Promise<ModelInfo[]>

  /**
   * 测试连接是否正常
   */
  abstract testConnection(): Promise<boolean>

  /**
   * 获取供应商名称
   */
  abstract get name(): string
}

/**
 * AI 供应商错误
 */
export class AIProviderError extends Error {
  public code: string
  public statusCode?: number

  constructor(message: string, code: string, statusCode?: number) {
    super(message)
    this.name = 'AIProviderError'
    this.code = code
    this.statusCode = statusCode
  }
}
