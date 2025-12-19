/**
 * AI 模型管理 Hook
 *
 * 管理供应商和模型的选择
 */

import { useState, useCallback, useEffect } from 'react'
import { aiProviderApi, aiModelApi, type AIProvider, type AIModel } from '@/api/aiProvider'

export interface UseAIModelsOptions {
  /** 是否自动加载 */
  autoLoad?: boolean
  /** 加载触发条件 */
  loadWhen?: boolean
}

export interface UseAIModelsReturn {
  /** 供应商列表 */
  providers: AIProvider[]
  /** 模型列表 */
  models: AIModel[]
  /** 选中的供应商 ID */
  selectedProviderId: string | null
  /** 选中的模型 ID */
  selectedModelId: string | null
  /** 选中的模型对象 */
  selectedModel: AIModel | undefined
  /** 供应商加载中 */
  loadingProviders: boolean
  /** 模型加载中 */
  loadingModels: boolean
  /** 是否启用深度思考 */
  enableThinking: boolean
  /** 选择供应商 */
  selectProvider: (id: string | null) => void
  /** 选择模型 */
  selectModel: (id: string | null) => void
  /** 切换深度思考 */
  toggleThinking: () => void
  /** 设置深度思考 */
  setEnableThinking: (enable: boolean) => void
  /** 重新加载供应商 */
  reloadProviders: () => Promise<void>
}

/**
 * AI 模型管理 Hook
 */
export function useAIModels(options: UseAIModelsOptions = {}): UseAIModelsReturn {
  const { autoLoad = true, loadWhen = true } = options

  const [providers, setProviders] = useState<AIProvider[]>([])
  const [models, setModels] = useState<AIModel[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [loadingProviders, setLoadingProviders] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)
  const [enableThinking, setEnableThinking] = useState(false)

  // 加载供应商列表
  const loadProviders = useCallback(async () => {
    setLoadingProviders(true)
    try {
      const res = await aiProviderApi.list()
      const list = res.data.data || []
      setProviders(list)

      // 自动选择默认供应商
      if (!selectedProviderId) {
        const defaultProvider = list.find(p => p.isDefault) || list[0]
        if (defaultProvider) {
          setSelectedProviderId(defaultProvider._id)
        }
      }
    } catch {
      // 静默失败
    } finally {
      setLoadingProviders(false)
    }
  }, [selectedProviderId])

  // 加载模型列表
  const loadModels = useCallback(async (providerId: string) => {
    setLoadingModels(true)
    try {
      const res = await aiModelApi.list(providerId)
      const list = res.data.data || []
      setModels(list)

      // 自动选择默认模型
      const defaultModel = list.find(m => m.isDefault) || list[0]
      setSelectedModelId(defaultModel?._id || null)
    } catch {
      setModels([])
      setSelectedModelId(null)
    } finally {
      setLoadingModels(false)
    }
  }, [])

  // 初始加载供应商
  useEffect(() => {
    if (autoLoad && loadWhen) {
      loadProviders()
    }
  }, [autoLoad, loadWhen, loadProviders])

  // 供应商变化时加载模型
  useEffect(() => {
    if (selectedProviderId) {
      loadModels(selectedProviderId)
      setEnableThinking(false) // 切换供应商时重置思考模式
    }
  }, [selectedProviderId, loadModels])

  // 选择供应商
  const selectProvider = useCallback((id: string | null) => {
    setSelectedProviderId(id)
    setSelectedModelId(null)
    setModels([])
  }, [])

  // 选择模型
  const selectModel = useCallback((id: string | null) => {
    setSelectedModelId(id)
    setEnableThinking(false) // 切换模型时重置思考模式
  }, [])

  const selectedModel = models.find(m => m._id === selectedModelId)

  return {
    providers,
    models,
    selectedProviderId,
    selectedModelId,
    selectedModel,
    loadingProviders,
    loadingModels,
    enableThinking,
    selectProvider,
    selectModel,
    toggleThinking: () => setEnableThinking(prev => !prev),
    setEnableThinking,
    reloadProviders: loadProviders,
  }
}
