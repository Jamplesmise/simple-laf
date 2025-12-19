import { BaseAIProvider, AIProviderError } from './base.js'
import type { ChatMessage, ChatOptions, ChatResponse, ModelInfo } from '../types.js'

/**
 * 自定义 API 适配器 (兼容 OpenAI 格式)
 */
export class CustomProvider extends BaseAIProvider {
  private model: string

  constructor(apiKey: string, baseUrl: string, model: string = 'default') {
    super(apiKey, baseUrl)
    this.model = model
  }

  get name(): string {
    return 'Custom'
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    if (!this.baseUrl) {
      throw new AIProviderError('Base URL is required for custom provider', 'CUSTOM_ERROR')
    }

    const url = `${this.baseUrl}/chat/completions`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: options?.model || this.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
        stream: false
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { error?: { message?: string } }
      throw new AIProviderError(
        error.error?.message || `Custom API error: ${response.status}`,
        'CUSTOM_ERROR',
        response.status
      )
    }

    const data = await response.json() as { choices?: { message?: { content?: string } }[]; usage?: { total_tokens?: number } }
    return {
      content: data.choices?.[0]?.message?.content || '',
      tokensUsed: data.usage?.total_tokens
    }
  }

  async *chatStream(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncGenerator<string, void, unknown> {
    if (!this.baseUrl) {
      throw new AIProviderError('Base URL is required for custom provider', 'CUSTOM_ERROR')
    }

    const url = `${this.baseUrl}/chat/completions`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
        stream: true
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { error?: { message?: string } }
      throw new AIProviderError(
        error.error?.message || `Custom API error: ${response.status}`,
        'CUSTOM_ERROR',
        response.status
      )
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new AIProviderError('No response body', 'CUSTOM_ERROR')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          if (!trimmed.startsWith('data: ')) continue

          try {
            const json = JSON.parse(trimmed.slice(6))
            const content = json.choices?.[0]?.delta?.content
            if (content) {
              yield content
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    if (!this.baseUrl) {
      return [{ id: 'default', name: 'Default' }]
    }

    try {
      const url = `${this.baseUrl}/models`
      const headers: Record<string, string> = {}

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`
      }

      const response = await fetch(url, { headers })

      if (!response.ok) {
        return [{ id: this.model, name: this.model }]
      }

      const data = await response.json() as { data?: { id: string }[] }
      const models = (data.data || []).map((m) => ({
        id: m.id,
        name: m.id
      }))

      return models.length > 0 ? models : [{ id: this.model, name: this.model }]
    } catch {
      return [{ id: this.model, name: this.model }]
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.chat(
        [{ role: 'user', content: 'Hi' }],
        { maxTokens: 5 }
      )
      return !!response.content
    } catch {
      return false
    }
  }
}
