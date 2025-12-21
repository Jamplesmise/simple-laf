import type { AIProvider, AIModel, ProviderType } from '../../api/aiProvider'

export type { AIProvider, AIModel, ProviderType }

export interface TestResult {
  success: boolean
  message: string
}

export interface ProviderFormValues {
  name: string
  type: ProviderType
  baseUrl: string
  apiKey?: string
}

export interface ModelFormValues {
  name: string
  alias: string
  temperature: number
  maxTokens: number
  inputPrice?: number
  outputPrice?: number
  currency: string
  supportsThinking: boolean
}

export const providerTypes = [
  { value: 'openai' as const, label: 'OpenAI' },
  { value: 'anthropic' as const, label: 'Anthropic' },
  { value: 'ollama' as const, label: 'Ollama (本地)' },
  { value: 'custom' as const, label: '自定义' },
]
