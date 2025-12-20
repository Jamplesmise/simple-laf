/**
 * 站点 AI 配置弹窗
 *
 * 供应商/模型选择、深度思考开关、系统提示词选择
 */

import { useState, useEffect, useCallback } from 'react'
import { Modal, Select, Switch, Spin, Empty, Button } from 'antd'
import {
  CloudServerOutlined,
  ThunderboltOutlined,
  BulbOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { aiProviderApi, aiModelApi, type AIProvider, type AIModel } from '@/api/aiProvider'
import { aiSystemPromptApi, type AISystemPrompt } from '@/api/aiSystemPrompt'
import { useThemeStore } from '@/stores/theme'

export interface SiteAIConfigValue {
  providerId: string | null
  modelId: string | null
  enableThinking: boolean
  systemPromptId: string | null
}

interface SiteAIConfigProps {
  open: boolean
  onClose: () => void
  value: SiteAIConfigValue
  onChange: (value: SiteAIConfigValue) => void
}

export default function SiteAIConfig({
  open,
  onClose,
  value,
  onChange,
}: SiteAIConfigProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  // 供应商
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [loadingProviders, setLoadingProviders] = useState(false)

  // 模型
  const [models, setModels] = useState<AIModel[]>([])
  const [loadingModels, setLoadingModels] = useState(false)

  // 系统提示词
  const [prompts, setPrompts] = useState<AISystemPrompt[]>([])
  const [loadingPrompts, setLoadingPrompts] = useState(false)

  // 当前选中的模型
  const selectedModel = models.find(m => m._id === value.modelId)

  // 加载供应商
  const loadProviders = useCallback(async () => {
    setLoadingProviders(true)
    try {
      const res = await aiProviderApi.list()
      const list = res.data.data || []
      setProviders(list)

      // 如果没有选中供应商，自动选择默认的
      if (!value.providerId && list.length > 0) {
        const defaultProvider = list.find(p => p.isDefault) || list[0]
        onChange({ ...value, providerId: defaultProvider._id })
      }
    } catch {
      // 静默失败
    } finally {
      setLoadingProviders(false)
    }
  }, [value, onChange])

  // 加载模型
  const loadModels = useCallback(async (providerId: string) => {
    setLoadingModels(true)
    try {
      const res = await aiModelApi.list(providerId)
      const list = res.data.data || []
      setModels(list)

      // 如果当前模型不在列表中，自动选择默认的
      if (!value.modelId || !list.find(m => m._id === value.modelId)) {
        const defaultModel = list.find(m => m.isDefault) || list[0]
        onChange({ ...value, modelId: defaultModel?._id || null, enableThinking: false })
      }
    } catch {
      setModels([])
    } finally {
      setLoadingModels(false)
    }
  }, [value, onChange])

  // 加载系统提示词
  const loadPrompts = useCallback(async () => {
    setLoadingPrompts(true)
    try {
      const res = await aiSystemPromptApi.list()
      const list = res.data.data || []
      setPrompts(list)
    } catch {
      // 静默失败
    } finally {
      setLoadingPrompts(false)
    }
  }, [])

  // 打开时加载数据
  useEffect(() => {
    if (open) {
      loadProviders()
      loadPrompts()
    }
  }, [open, loadProviders, loadPrompts])

  // 供应商变化时加载模型
  useEffect(() => {
    if (value.providerId) {
      loadModels(value.providerId)
    }
  }, [value.providerId, loadModels])

  // 处理供应商变化
  const handleProviderChange = (providerId: string) => {
    onChange({
      ...value,
      providerId,
      modelId: null,
      enableThinking: false,
    })
  }

  // 处理模型变化
  const handleModelChange = (modelId: string) => {
    onChange({
      ...value,
      modelId,
      enableThinking: false,
    })
  }

  // 处理思考模式变化
  const handleThinkingChange = (enabled: boolean) => {
    onChange({
      ...value,
      enableThinking: enabled,
    })
  }

  // 处理系统提示词变化
  const handlePromptChange = (promptId: string | null) => {
    onChange({
      ...value,
      systemPromptId: promptId || null,
    })
  }

  const labelStyle = {
    fontSize: 13,
    fontWeight: 500,
    color: isDark ? '#e0e0e0' : '#333',
    marginBottom: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  }

  const itemStyle = {
    marginBottom: 20,
  }

  return (
    <Modal
      title="AI 配置"
      open={open}
      onCancel={onClose}
      footer={
        <Button type="primary" onClick={onClose} style={{ background: '#00a9a6', borderColor: '#00a9a6' }}>
          完成
        </Button>
      }
      width={400}
    >
      {/* 供应商 */}
      <div style={itemStyle}>
        <div style={labelStyle}>
          <CloudServerOutlined />
          供应商
        </div>
        {loadingProviders ? (
          <Spin size="small" />
        ) : providers.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无供应商配置" />
        ) : (
          <Select
            style={{ width: '100%' }}
            placeholder="选择供应商"
            value={value.providerId}
            onChange={handleProviderChange}
            options={providers.map(p => ({
              label: p.name,
              value: p._id,
            }))}
          />
        )}
      </div>

      {/* 模型 */}
      <div style={itemStyle}>
        <div style={labelStyle}>
          <ThunderboltOutlined />
          模型
        </div>
        {loadingModels ? (
          <Spin size="small" />
        ) : models.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请先选择供应商" />
        ) : (
          <Select
            style={{ width: '100%' }}
            placeholder="选择模型"
            value={value.modelId}
            onChange={handleModelChange}
            options={models.map(m => ({
              label: m.alias || m.name,
              value: m._id,
            }))}
          />
        )}
      </div>

      {/* 深度思考 */}
      {selectedModel?.supportsThinking && (
        <div style={itemStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={labelStyle}>
              <BulbOutlined />
              深度思考模式
            </div>
            <Switch
              checked={value.enableThinking}
              onChange={handleThinkingChange}
            />
          </div>
          <div style={{ fontSize: 12, color: isDark ? '#888' : '#999', marginTop: 4 }}>
            启用后 AI 会进行更深入的思考，适合复杂问题
          </div>
        </div>
      )}

      {/* 系统提示词 */}
      <div style={itemStyle}>
        <div style={labelStyle}>
          <FileTextOutlined />
          系统提示词
        </div>
        {loadingPrompts ? (
          <Spin size="small" />
        ) : (
          <Select
            style={{ width: '100%' }}
            placeholder="使用默认提示词"
            value={value.systemPromptId}
            onChange={handlePromptChange}
            allowClear
            options={prompts.map(p => ({
              label: p.name,
              value: p._id,
            }))}
          />
        )}
      </div>
    </Modal>
  )
}
