import { useState, useEffect, useCallback } from 'react'
import {
  Button, Modal, Input, Select, InputNumber, Form, message, Spin,
  Empty, Popconfirm, Tag, Collapse, List, Space, Tooltip, Switch
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, StarOutlined, StarFilled,
  CloudServerOutlined, ApiOutlined, SettingOutlined, ThunderboltOutlined,
  CheckCircleOutlined, CloseCircleOutlined
} from '@ant-design/icons'
import { useThemeStore } from '../stores/theme'
import {
  aiProviderApi, aiModelApi,
  type AIProvider, type AIModel, type ProviderType, type ModelPricing
} from '../api/aiProvider'

const { Panel } = Collapse

export default function AIProviderManager() {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  // 供应商列表
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [loading, setLoading] = useState(true)

  // 每个供应商的模型列表
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, AIModel[]>>({})
  const [loadingModels, setLoadingModels] = useState<Record<string, boolean>>({})

  // 展开的供应商
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])

  // 供应商编辑弹窗
  const [providerModalOpen, setProviderModalOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null)
  const [providerForm] = Form.useForm()
  const [savingProvider, setSavingProvider] = useState(false)

  // 模型编辑弹窗
  const [modelModalOpen, setModelModalOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<AIModel | null>(null)
  const [modelProviderId, setModelProviderId] = useState<string | null>(null)
  const [modelForm] = Form.useForm()
  const [savingModel, setSavingModel] = useState(false)

  // 模型测试状态
  const [testingModels, setTestingModels] = useState<Record<string, boolean>>({})
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({})

  // 加载供应商列表
  const loadProviders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await aiProviderApi.list()
      setProviders(res.data.data || [])
    } catch {
      message.error('加载供应商列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  // 加载供应商的模型
  const loadModels = useCallback(async (providerId: string) => {
    setLoadingModels(prev => ({ ...prev, [providerId]: true }))
    try {
      const res = await aiModelApi.list(providerId)
      setModelsByProvider(prev => ({ ...prev, [providerId]: res.data.data || [] }))
    } catch {
      message.error('加载模型列表失败')
    } finally {
      setLoadingModels(prev => ({ ...prev, [providerId]: false }))
    }
  }, [])

  useEffect(() => {
    loadProviders()
  }, [loadProviders])

  // 展开时加载模型
  const handleCollapseChange = (keys: string | string[]) => {
    const newKeys = Array.isArray(keys) ? keys : [keys]
    setExpandedKeys(newKeys)
    // 加载新展开的供应商的模型
    newKeys.forEach(key => {
      if (!modelsByProvider[key]) {
        loadModels(key)
      }
    })
  }

  // 打开供应商编辑弹窗
  const openProviderModal = (provider?: AIProvider) => {
    setEditingProvider(provider || null)
    providerForm.setFieldsValue(provider || {
      name: '',
      type: 'openai',
      baseUrl: '',
      apiKey: '',
    })
    setProviderModalOpen(true)
  }

  // 保存供应商
  const handleSaveProvider = async () => {
    try {
      const values = await providerForm.validateFields()
      setSavingProvider(true)

      if (editingProvider) {
        await aiProviderApi.update(editingProvider._id, values)
        message.success('更新成功')
      } else {
        await aiProviderApi.create(values)
        message.success('创建成功')
      }

      setProviderModalOpen(false)
      loadProviders()
    } catch {
      message.error('保存失败')
    } finally {
      setSavingProvider(false)
    }
  }

  // 删除供应商
  const handleDeleteProvider = async (id: string) => {
    try {
      await aiProviderApi.delete(id)
      message.success('已删除')
      loadProviders()
    } catch {
      message.error('删除失败')
    }
  }

  // 设置默认供应商
  const handleSetDefaultProvider = async (provider: AIProvider) => {
    try {
      await aiProviderApi.update(provider._id, { isDefault: true })
      message.success('已设为默认')
      loadProviders()
    } catch {
      message.error('设置失败')
    }
  }

  // 打开模型编辑弹窗
  const openModelModal = (providerId: string, model?: AIModel) => {
    setModelProviderId(providerId)
    setEditingModel(model || null)
    modelForm.setFieldsValue(model ? {
      name: model.name,
      alias: model.alias,
      temperature: model.temperature,
      maxTokens: model.maxTokens,
      inputPrice: model.pricing?.inputPricePerMillion,
      outputPrice: model.pricing?.outputPricePerMillion,
      currency: model.pricing?.currency || 'USD',
      supportsThinking: model.supportsThinking || false,
    } : {
      name: '',
      alias: '',
      temperature: 0.7,
      maxTokens: 4096,
      inputPrice: 0,
      outputPrice: 0,
      currency: 'USD',
      supportsThinking: false,
    })
    setModelModalOpen(true)
  }

  // 保存模型
  const handleSaveModel = async () => {
    if (!modelProviderId) return

    try {
      const values = await modelForm.validateFields()
      setSavingModel(true)

      const pricing: ModelPricing | undefined = (values.inputPrice !== undefined || values.outputPrice !== undefined) ? {
        inputPricePerMillion: values.inputPrice || 0,
        outputPricePerMillion: values.outputPrice || 0,
        currency: values.currency || 'USD',
      } : undefined

      const data = {
        name: values.name,
        alias: values.alias,
        temperature: values.temperature,
        maxTokens: values.maxTokens,
        pricing,
        supportsThinking: values.supportsThinking || false,
      }

      if (editingModel) {
        await aiModelApi.update(editingModel._id, data)
        message.success('更新成功')
      } else {
        await aiModelApi.create(modelProviderId, data)
        message.success('创建成功')
      }

      setModelModalOpen(false)
      loadModels(modelProviderId)
    } catch {
      message.error('保存失败')
    } finally {
      setSavingModel(false)
    }
  }

  // 删除模型
  const handleDeleteModel = async (model: AIModel) => {
    try {
      await aiModelApi.delete(model._id)
      message.success('已删除')
      loadModels(model.providerId)
    } catch {
      message.error('删除失败')
    }
  }

  // 设置默认模型
  const handleSetDefaultModel = async (model: AIModel) => {
    try {
      await aiModelApi.update(model._id, { isDefault: true })
      message.success('已设为默认')
      loadModels(model.providerId)
    } catch {
      message.error('设置失败')
    }
  }

  // 测试模型连接
  const handleTestModel = async (model: AIModel) => {
    setTestingModels(prev => ({ ...prev, [model._id]: true }))
    setTestResults(prev => {
      const newResults = { ...prev }
      delete newResults[model._id]
      return newResults
    })

    try {
      const res = await aiModelApi.test(model._id)
      const result = res.data.data
      setTestResults(prev => ({ ...prev, [model._id]: result }))
      if (result.success) {
        message.success(result.message)
      } else {
        message.error(result.message)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '测试失败'
      setTestResults(prev => ({ ...prev, [model._id]: { success: false, message: errorMsg } }))
      message.error(errorMsg)
    } finally {
      setTestingModels(prev => ({ ...prev, [model._id]: false }))
    }
  }

  // 供应商类型选项
  const providerTypes = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'ollama', label: 'Ollama (本地)' },
    { value: 'custom', label: '自定义' },
  ]

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
    if (price === undefined || price === 0) return '-'
    const symbol = currency === 'CNY' ? '¥' : '$'
    return `${symbol}${price.toFixed(2)}/M`
  }

  return (
    <div style={{ padding: '16px 0' }}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
      }}>
        <span style={{ fontSize: 16, fontWeight: 500 }}>AI 模型供应商</span>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openProviderModal()}
        >
          添加供应商
        </Button>
      </div>

      {/* 供应商列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : providers.length === 0 ? (
        <Empty description="暂无供应商" />
      ) : (
        <Collapse
          activeKey={expandedKeys}
          onChange={handleCollapseChange}
          accordion={false}
        >
          {providers.map(provider => (
            <Panel
              key={provider._id}
              header={
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 18 }}>{getProviderIcon(provider.type)}</span>
                  <span style={{ fontWeight: 500 }}>{provider.name}</span>
                  <Tag>{provider.type}</Tag>
                  {provider.isDefault && <Tag color="blue">默认</Tag>}
                </div>
              }
              extra={
                <Space onClick={e => e.stopPropagation()}>
                  {!provider.isDefault && (
                    <Tooltip title="设为默认">
                      <Button
                        type="text"
                        size="small"
                        icon={<StarOutlined />}
                        onClick={() => handleSetDefaultProvider(provider)}
                      />
                    </Tooltip>
                  )}
                  {provider.isDefault && (
                    <Tooltip title="当前默认">
                      <Button
                        type="text"
                        size="small"
                        icon={<StarFilled style={{ color: '#faad14' }} />}
                        disabled
                      />
                    </Tooltip>
                  )}
                  <Tooltip title="编辑">
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => openProviderModal(provider)}
                    />
                  </Tooltip>
                  <Popconfirm
                    title="确定删除此供应商？"
                    description="该供应商下的所有模型也将被删除"
                    onConfirm={() => handleDeleteProvider(provider._id)}
                    okText="删除"
                    cancelText="取消"
                    zIndex={1100}
                  >
                    <Tooltip title="删除">
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                      />
                    </Tooltip>
                  </Popconfirm>
                </Space>
              }
            >
              {/* 供应商详情 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: isDark ? '#888' : '#666', fontSize: 13 }}>
                  <div>API 地址: {provider.baseUrl}</div>
                  <div>API Key: {provider.apiKey || '未设置'}</div>
                </div>
              </div>

              {/* 模型列表 */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12
              }}>
                <span style={{ fontWeight: 500 }}>模型列表</span>
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => openModelModal(provider._id)}
                >
                  添加模型
                </Button>
              </div>

              {loadingModels[provider._id] ? (
                <Spin size="small" />
              ) : (modelsByProvider[provider._id]?.length || 0) === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无模型" />
              ) : (
                <List
                  size="small"
                  dataSource={modelsByProvider[provider._id]}
                  renderItem={model => (
                    <List.Item
                      style={{
                        padding: '8px 12px',
                        background: isDark ? '#1a1a1a' : '#fafafa',
                        borderRadius: 6,
                        marginBottom: 8,
                      }}
                      actions={[
                        <Tooltip
                          key="test"
                          title={testResults[model._id]?.message || '测试连接'}
                        >
                          <Button
                            type="text"
                            size="small"
                            loading={testingModels[model._id]}
                            icon={
                              testResults[model._id]
                                ? testResults[model._id].success
                                  ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                                  : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                                : <ThunderboltOutlined />
                            }
                            onClick={() => handleTestModel(model)}
                          />
                        </Tooltip>,
                        model.isDefault ? (
                          <Tooltip title="当前默认" key="star">
                            <StarFilled style={{ color: '#faad14' }} />
                          </Tooltip>
                        ) : (
                          <Tooltip title="设为默认" key="star">
                            <Button
                              type="text"
                              size="small"
                              icon={<StarOutlined />}
                              onClick={() => handleSetDefaultModel(model)}
                            />
                          </Tooltip>
                        ),
                        <Tooltip title="编辑" key="edit">
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => openModelModal(provider._id, model)}
                          />
                        </Tooltip>,
                        <Popconfirm
                          key="delete"
                          title="确定删除此模型？"
                          onConfirm={() => handleDeleteModel(model)}
                          okText="删除"
                          cancelText="取消"
                          zIndex={1100}
                        >
                          <Tooltip title="删除">
                            <Button
                              type="text"
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                            />
                          </Tooltip>
                        </Popconfirm>,
                      ]}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 500 }}>{model.alias}</span>
                          <Tag style={{ fontSize: 11 }}>{model.name}</Tag>
                          {model.isDefault && <Tag color="blue">默认</Tag>}
                        </div>
                        <div style={{ fontSize: 12, color: isDark ? '#888' : '#999', marginTop: 4 }}>
                          温度: {model.temperature} | 最大Token: {model.maxTokens}
                          {model.pricing && (
                            <span>
                              {' | '}输入: {formatPrice(model.pricing.inputPricePerMillion, model.pricing.currency)}
                              {' | '}输出: {formatPrice(model.pricing.outputPricePerMillion, model.pricing.currency)}
                            </span>
                          )}
                        </div>
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </Panel>
          ))}
        </Collapse>
      )}

      {/* 供应商编辑弹窗 */}
      <Modal
        title={editingProvider ? '编辑供应商' : '添加供应商'}
        open={providerModalOpen}
        onOk={handleSaveProvider}
        onCancel={() => setProviderModalOpen(false)}
        confirmLoading={savingProvider}
        okText="保存"
        cancelText="取消"
        zIndex={1100}
      >
        <Form form={providerForm} layout="vertical" name="provider">
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入供应商名称' }]}
          >
            <Input placeholder="如: OpenAI, 本地 Ollama" />
          </Form.Item>
          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true }]}
          >
            <Select options={providerTypes} />
          </Form.Item>
          <Form.Item
            name="baseUrl"
            label="API 地址"
            rules={[{ required: true, message: '请输入 API 地址' }]}
          >
            <Input placeholder="如: https://api.openai.com/v1" />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key">
            <Input.Password placeholder="输入新的 API Key (留空则不更新)" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 模型编辑弹窗 */}
      <Modal
        title={editingModel ? '编辑模型' : '添加模型'}
        open={modelModalOpen}
        onOk={handleSaveModel}
        onCancel={() => setModelModalOpen(false)}
        confirmLoading={savingModel}
        okText="保存"
        cancelText="取消"
        width={500}
        zIndex={1100}
      >
        <Form form={modelForm} layout="vertical">
          <Form.Item
            name="name"
            label="模型 ID"
            rules={[{ required: true, message: '请输入模型 ID' }]}
          >
            <Input placeholder="如: gpt-4o, claude-3-opus-20240229" />
          </Form.Item>
          <Form.Item
            name="alias"
            label="显示名称"
            rules={[{ required: true, message: '请输入显示名称' }]}
          >
            <Input placeholder="如: GPT-4o, Claude 3 Opus" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="temperature" label="温度" style={{ flex: 1 }}>
              <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="maxTokens" label="最大 Token" style={{ flex: 1 }}>
              <InputNumber min={1} max={200000} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <div style={{
            padding: '12px',
            background: isDark ? '#1a1a1a' : '#f5f5f5',
            borderRadius: 6,
            marginBottom: 16
          }}>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>定价信息 (每百万 Token)</div>
            <div style={{ display: 'flex', gap: 16 }}>
              <Form.Item name="inputPrice" label="输入价格" style={{ flex: 1, marginBottom: 0 }}>
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} placeholder="0.00" />
              </Form.Item>
              <Form.Item name="outputPrice" label="输出价格" style={{ flex: 1, marginBottom: 0 }}>
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} placeholder="0.00" />
              </Form.Item>
              <Form.Item name="currency" label="货币" style={{ width: 100, marginBottom: 0 }}>
                <Select
                  options={[
                    { value: 'USD', label: 'USD' },
                    { value: 'CNY', label: 'CNY' },
                  ]}
                />
              </Form.Item>
            </div>
          </div>
          <Form.Item
            name="supportsThinking"
            label="支持深度思考"
            valuePropName="checked"
            tooltip="如 DeepSeek-R1 等支持思考模式的模型，开启后会输出思考过程"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
