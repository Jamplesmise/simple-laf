import { useState, useEffect, useCallback } from 'react'
import { Spin, Empty, Tag } from 'antd'
import { CloudServerOutlined, SettingOutlined, ApiOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useThemeStore } from '../stores/theme'
import {
  aiProviderApi, aiModelApi,
  type AIProvider, type AIModel, type ProviderType
} from '../api/aiProvider'

interface AIModelSelectorProps {
  value?: string  // modelId
  onChange?: (modelId: string, model: AIModel, provider: AIProvider) => void
}

export default function AIModelSelector({ value, onChange }: AIModelSelectorProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  // 供应商列表
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [loadingProviders, setLoadingProviders] = useState(true)

  // 当前选中的供应商
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)

  // 模型列表
  const [models, setModels] = useState<AIModel[]>([])
  const [loadingModels, setLoadingModels] = useState(false)

  // 当前选中的模型
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(value)

  // 加载供应商
  const loadProviders = useCallback(async () => {
    setLoadingProviders(true)
    try {
      const res = await aiProviderApi.list()
      const providerList = res.data.data || []
      setProviders(providerList)

      // 如果有值，找到对应的供应商
      if (value) {
        const allModelsRes = await aiModelApi.listAll()
        const allModels = allModelsRes.data.data || []
        const currentModel = allModels.find(m => m._id === value)
        if (currentModel) {
          setSelectedProviderId(currentModel.providerId)
        }
      } else {
        // 选择默认供应商
        const defaultProvider = providerList.find(p => p.isDefault) || providerList[0]
        if (defaultProvider) {
          setSelectedProviderId(defaultProvider._id)
        }
      }
    } catch {
      // 静默失败
    } finally {
      setLoadingProviders(false)
    }
  }, [value])

  // 加载模型
  const loadModels = useCallback(async (providerId: string) => {
    setLoadingModels(true)
    try {
      const res = await aiModelApi.list(providerId)
      setModels(res.data.data || [])
    } catch {
      // 静默失败
    } finally {
      setLoadingModels(false)
    }
  }, [])

  useEffect(() => {
    loadProviders()
  }, [loadProviders])

  useEffect(() => {
    if (selectedProviderId) {
      loadModels(selectedProviderId)
    }
  }, [selectedProviderId, loadModels])

  // 选择供应商
  const handleSelectProvider = (providerId: string) => {
    setSelectedProviderId(providerId)
    setSelectedModelId(undefined) // 切换供应商时清除选中的模型
  }

  // 选择模型
  const handleSelectModel = (model: AIModel) => {
    setSelectedModelId(model._id)
    const provider = providers.find(p => p._id === model.providerId)
    if (provider && onChange) {
      onChange(model._id, model, provider)
    }
  }

  // 获取供应商图标
  const getProviderIcon = (type: ProviderType) => {
    switch (type) {
      case 'openai':
      case 'anthropic':
        return <CloudServerOutlined />
      case 'ollama':
        return <SettingOutlined />
      default:
        return <ApiOutlined />
    }
  }

  // 格式化价格
  const formatPrice = (price?: number, currency?: string) => {
    if (price === undefined || price === 0) return null
    const symbol = currency === 'CNY' ? '¥' : '$'
    return `${symbol}${price.toFixed(2)}/M`
  }

  const baseItemStyle = {
    padding: '10px 12px',
    cursor: 'pointer',
    borderRadius: 6,
    marginBottom: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    transition: 'background 0.2s',
  }

  return (
    <div style={{ display: 'flex', height: 300, border: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`, borderRadius: 8, overflow: 'hidden' }}>
      {/* 左侧供应商列表 */}
      <div style={{
        width: 180,
        borderRight: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
        overflow: 'auto',
        background: isDark ? '#141414' : '#fafafa',
      }}>
        <div style={{
          padding: '8px 12px',
          fontSize: 12,
          fontWeight: 500,
          color: isDark ? '#888' : '#666',
          borderBottom: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
        }}>
          供应商
        </div>
        {loadingProviders ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Spin size="small" />
          </div>
        ) : providers.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无供应商" style={{ marginTop: 20 }} />
        ) : (
          <div style={{ padding: 4 }}>
            {providers.map(provider => (
              <div
                key={provider._id}
                onClick={() => handleSelectProvider(provider._id)}
                style={{
                  ...baseItemStyle,
                  background: selectedProviderId === provider._id
                    ? (isDark ? '#1890ff20' : '#e6f7ff')
                    : 'transparent',
                  borderLeft: selectedProviderId === provider._id
                    ? '3px solid #1890ff'
                    : '3px solid transparent',
                }}
              >
                <span style={{ fontSize: 16 }}>{getProviderIcon(provider.type)}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {provider.name}
                </span>
                {provider.isDefault && <Tag color="blue" style={{ fontSize: 10 }}>默认</Tag>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 右侧模型列表 */}
      <div style={{ flex: 1, overflow: 'auto', background: isDark ? '#1a1a1a' : '#fff' }}>
        <div style={{
          padding: '8px 12px',
          fontSize: 12,
          fontWeight: 500,
          color: isDark ? '#888' : '#666',
          borderBottom: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
        }}>
          模型
        </div>
        {loadingModels ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Spin size="small" />
          </div>
        ) : !selectedProviderId ? (
          <div style={{ textAlign: 'center', padding: 40, color: isDark ? '#666' : '#999' }}>
            请选择供应商
          </div>
        ) : models.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无模型" style={{ marginTop: 20 }} />
        ) : (
          <div style={{ padding: 4 }}>
            {models.map(model => (
              <div
                key={model._id}
                onClick={() => handleSelectModel(model)}
                style={{
                  ...baseItemStyle,
                  background: selectedModelId === model._id
                    ? (isDark ? '#52c41a20' : '#f6ffed')
                    : 'transparent',
                  border: selectedModelId === model._id
                    ? `1px solid ${isDark ? '#52c41a' : '#b7eb8f'}`
                    : '1px solid transparent',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 500 }}>{model.alias}</span>
                    {model.isDefault && <Tag color="blue" style={{ fontSize: 10 }}>默认</Tag>}
                    {selectedModelId === model._id && (
                      <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 'auto' }} />
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: isDark ? '#666' : '#999', marginTop: 2 }}>
                    {model.name}
                    {model.pricing && (
                      <span style={{ marginLeft: 8 }}>
                        {formatPrice(model.pricing.inputPricePerMillion, model.pricing.currency)}
                        {' / '}
                        {formatPrice(model.pricing.outputPricePerMillion, model.pricing.currency)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
