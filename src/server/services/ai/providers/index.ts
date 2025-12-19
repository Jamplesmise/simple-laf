import type { AIProvider as ProviderType } from '../types.js'
import type { AIConfig } from '../types.js'
import { BaseAIProvider, AIProviderError } from './base.js'
import { OpenAIProvider } from './openai.js'
import { AnthropicProvider } from './anthropic.js'
import { OllamaProvider } from './ollama.js'
import { CustomProvider } from './custom.js'
import { decryptApiKey } from '../crypto.js'

export { BaseAIProvider, AIProviderError }
export { OpenAIProvider }
export { AnthropicProvider }
export { OllamaProvider }
export { CustomProvider }

/**
 * 根据配置创建 AI 供应商实例
 */
export function createProvider(config: AIConfig): BaseAIProvider {
  const apiKey = decryptApiKey(config.apiKey)

  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(apiKey, config.baseUrl)

    case 'anthropic':
      return new AnthropicProvider(apiKey, config.baseUrl)

    case 'ollama':
      return new OllamaProvider(config.baseUrl)

    case 'custom':
      if (!config.baseUrl) {
        throw new AIProviderError('自定义供应商需要设置 API 地址', 'CONFIG_ERROR')
      }
      return new CustomProvider(apiKey, config.baseUrl, config.model)

    default:
      throw new AIProviderError(`不支持的供应商: ${config.provider}`, 'CONFIG_ERROR')
  }
}

/**
 * 获取供应商的默认模型列表
 */
export function getDefaultModels(provider: ProviderType): Array<{ id: string; name: string }> {
  switch (provider) {
    case 'openai':
      return [
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
      ]

    case 'anthropic':
      return [
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' }
      ]

    case 'ollama':
      return [
        { id: 'llama3', name: 'Llama 3' },
        { id: 'llama3:70b', name: 'Llama 3 70B' },
        { id: 'codellama', name: 'Code Llama' },
        { id: 'mistral', name: 'Mistral' },
        { id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder' }
      ]

    case 'custom':
      return [
        { id: 'default', name: 'Default' }
      ]

    default:
      return []
  }
}
