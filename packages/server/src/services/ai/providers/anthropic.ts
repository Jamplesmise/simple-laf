import { BaseAIProvider, AIProviderError } from './base.js'
import type { ChatMessage, ChatOptions, ChatResponse, ModelInfo } from '../types.js'

/**
 * Anthropic 供应商适配器
 */
export class AnthropicProvider extends BaseAIProvider {
  private defaultBaseUrl = 'https://api.anthropic.com/v1'

  get name(): string {
    return 'Anthropic'
  }

  private getBaseUrl(): string {
    return this.baseUrl || this.defaultBaseUrl
  }

  private convertMessages(messages: ChatMessage[]): {
    system?: string
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  } {
    let system: string | undefined
    const converted: Array<{ role: 'user' | 'assistant'; content: string }> = []

    for (const msg of messages) {
      if (msg.role === 'system') {
        system = msg.content
      } else {
        converted.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })
      }
    }

    return { system, messages: converted }
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const url = `${this.getBaseUrl()}/messages`
    const { system, messages: convertedMessages } = this.convertMessages(messages)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: options?.model || 'claude-sonnet-4-20250514',
        max_tokens: options?.maxTokens ?? 4096,
        system,
        messages: convertedMessages
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { error?: { message?: string } }
      throw new AIProviderError(
        error.error?.message || `Anthropic API error: ${response.status}`,
        'ANTHROPIC_ERROR',
        response.status
      )
    }

    const data = await response.json() as { content?: { text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } }
    const content = data.content?.[0]?.text || ''
    const tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)

    return { content, tokensUsed }
  }

  async *chatStream(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncGenerator<string, void, unknown> {
    const url = `${this.getBaseUrl()}/messages`
    const { system, messages: convertedMessages } = this.convertMessages(messages)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: options?.maxTokens ?? 4096,
        system,
        messages: convertedMessages,
        stream: true
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { error?: { message?: string } }
      throw new AIProviderError(
        error.error?.message || `Anthropic API error: ${response.status}`,
        'ANTHROPIC_ERROR',
        response.status
      )
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new AIProviderError('No response body', 'ANTHROPIC_ERROR')
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
          if (!trimmed || !trimmed.startsWith('data: ')) continue

          try {
            const json = JSON.parse(trimmed.slice(6))
            if (json.type === 'content_block_delta') {
              const text = json.delta?.text
              if (text) {
                yield text
              }
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
    // Anthropic 没有列出模型的 API，返回预定义列表
    return [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' }
    ]
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
