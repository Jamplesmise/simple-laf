import { useState, useEffect } from 'react'
import { aiProviderApi, aiModelApi } from '@/api/aiProvider'
import type { SiteAIConfigValue } from '../types'

export function useAIConfig() {
  const [aiConfig, setAiConfig] = useState<SiteAIConfigValue>({
    providerId: null,
    modelId: null,
    enableThinking: false,
    systemPromptId: null,
  })

  const [modelName, setModelName] = useState<string>('')

  // 加载默认配置
  useEffect(() => {
    const loadDefaultConfig = async () => {
      try {
        // 加载供应商
        const providerRes = await aiProviderApi.list()
        const providers = providerRes.data.data || []
        const defaultProvider = providers.find(p => p.isDefault) || providers[0]

        if (defaultProvider) {
          // 加载模型
          const modelRes = await aiModelApi.list(defaultProvider._id)
          const models = modelRes.data.data || []
          const defaultModel = models.find(m => m.isDefault) || models[0]

          setAiConfig(prev => ({
            ...prev,
            providerId: defaultProvider._id,
            modelId: defaultModel?._id || null,
          }))

          if (defaultModel) {
            setModelName(defaultModel.alias || defaultModel.name)
          }
        }
      } catch {
        // 静默失败
      }
    }

    loadDefaultConfig()
  }, [])

  // 配置变化时更新模型名称
  const handleConfigChange = async (newConfig: SiteAIConfigValue) => {
    setAiConfig(newConfig)

    if (newConfig.modelId && newConfig.providerId) {
      try {
        const res = await aiModelApi.list(newConfig.providerId)
        const models = res.data.data || []
        const model = models.find(m => m._id === newConfig.modelId)
        if (model) {
          setModelName(model.alias || model.name)
        }
      } catch {
        // 静默失败
      }
    }
  }

  const isConfigured = Boolean(aiConfig.providerId && aiConfig.modelId)

  return {
    aiConfig,
    modelName,
    isConfigured,
    handleConfigChange,
  }
}
