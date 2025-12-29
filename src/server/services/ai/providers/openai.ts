import { BaseAIProvider, AIProviderError } from './base.js'
import type { ChatMessage, ChatOptions, ChatResponse, ModelInfo } from '../types.js'

/**
 * OpenAI 供应商适配器
 */
export class OpenAIProvider extends BaseAIProvider {
  private defaultBaseUrl = 'https://api.openai.com/v1'

  get name(): string {
    return 'OpenAI'
  }

  private getBaseUrl(): string {
    return this.baseUrl || this.defaultBaseUrl
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const url = `${this.getBaseUrl()}/chat/completions`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: options?.model || (options?.maxTokens ? 'gpt-4o' : 'gpt-4o-mini'),
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
        stream: false
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { error?: { message?: string } }
      throw new AIProviderError(
        error.error?.message || `OpenAI API error: ${response.status}`,
        'OPENAI_ERROR',
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
    const url = `${this.getBaseUrl()}/chat/completions`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: options?.model || (options?.maxTokens ? 'gpt-4o' : 'gpt-4o-mini'),
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
        stream: true
      })
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      let errorMessage = `OpenAI API error: ${response.status}`
      try {
        const errorJson = JSON.parse(errorText) as { error?: { message?: string; type?: string; code?: string } }
        if (errorJson.error?.message) {
          errorMessage = `${errorJson.error.message} (${errorJson.error.type || errorJson.error.code || response.status})`
        }
      } catch {
        // 如果不是 JSON，直接使用文本
        if (errorText) {
          errorMessage = `OpenAI API error: ${response.status} - ${errorText.slice(0, 200)}`
        }
      }
      console.error('[OpenAI] API error:', response.status, errorText.slice(0, 500))
      throw new AIProviderError(errorMessage, 'OPENAI_ERROR', response.status)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new AIProviderError('No response body', 'OPENAI_ERROR')
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
    const url = `${this.getBaseUrl()}/models`

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    })

    if (!response.ok) {
      throw new AIProviderError(
        `Failed to list models: ${response.status}`,
        'OPENAI_ERROR',
        response.status
      )
    }

    const data = await response.json() as { data?: { id: string }[] }
    const chatModels = (data.data || [])
      .filter((m) =>
        m.id.includes('gpt') && !m.id.includes('instruct')
      )
      .map((m) => ({
        id: m.id,
        name: m.id
      }))

    return chatModels.length > 0 ? chatModels : [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
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
