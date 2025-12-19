import { BaseAIProvider, AIProviderError } from './base.js'
import type { ChatMessage, ChatOptions, ChatResponse, ModelInfo } from '../types.js'

/**
 * Ollama 本地模型适配器
 */
export class OllamaProvider extends BaseAIProvider {
  private defaultBaseUrl = 'http://localhost:11434'

  constructor(baseUrl?: string) {
    super('', baseUrl) // Ollama 不需要 API Key
  }

  get name(): string {
    return 'Ollama'
  }

  private getBaseUrl(): string {
    return this.baseUrl || this.defaultBaseUrl
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const url = `${this.getBaseUrl()}/api/chat`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options?.model || 'llama3',
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 4096
        }
      })
    })

    if (!response.ok) {
      const error = await response.text().catch(() => '')
      throw new AIProviderError(
        error || `Ollama API error: ${response.status}`,
        'OLLAMA_ERROR',
        response.status
      )
    }

    const data = await response.json() as { message?: { content?: string }; eval_count?: number }
    return {
      content: data.message?.content || '',
      tokensUsed: data.eval_count
    }
  }

  async *chatStream(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncGenerator<string, void, unknown> {
    const url = `${this.getBaseUrl()}/api/chat`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3',
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: true,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 4096
        }
      })
    })

    if (!response.ok) {
      const error = await response.text().catch(() => '')
      throw new AIProviderError(
        error || `Ollama API error: ${response.status}`,
        'OLLAMA_ERROR',
        response.status
      )
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new AIProviderError('No response body', 'OLLAMA_ERROR')
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
          if (!trimmed) continue

          try {
            const json = JSON.parse(trimmed)
            const content = json.message?.content
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
    const url = `${this.getBaseUrl()}/api/tags`

    try {
      const response = await fetch(url)

      if (!response.ok) {
        return this.getDefaultModels()
      }

      const data = await response.json() as { models?: { name: string }[] }
      const models = (data.models || []).map((m) => ({
        id: m.name,
        name: m.name
      }))

      return models.length > 0 ? models : this.getDefaultModels()
    } catch {
      return this.getDefaultModels()
    }
  }

  private getDefaultModels(): ModelInfo[] {
    return [
      { id: 'llama3', name: 'Llama 3' },
      { id: 'llama3:70b', name: 'Llama 3 70B' },
      { id: 'codellama', name: 'Code Llama' },
      { id: 'mistral', name: 'Mistral' },
      { id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder' }
    ]
  }

  async testConnection(): Promise<boolean> {
    try {
      const url = `${this.getBaseUrl()}/api/tags`
      const response = await fetch(url)
      return response.ok
    } catch {
      return false
    }
  }
}
