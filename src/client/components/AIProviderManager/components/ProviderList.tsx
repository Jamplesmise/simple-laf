import { useState } from 'react'
import {
  Button, Spin, Empty, Collapse, Tag, Space, Tooltip, Popconfirm, List
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, StarOutlined, StarFilled,
  ThunderboltOutlined, CheckCircleOutlined, CloseCircleOutlined
} from '@ant-design/icons'
import { useThemeStore } from '../../../stores/theme'
import type { AIProvider, AIModel } from '../types'
import { getProviderIcon, formatPrice } from '../utils.tsx'

const { Panel } = Collapse

interface ProviderListProps {
  providers: AIProvider[]
  loading: boolean
  modelsByProvider: Record<string, AIModel[]>
  loadingModels: Record<string, boolean>
  testingModels: Record<string, boolean>
  testResults: Record<string, { success: boolean; message: string }>
  onEditProvider: (provider: AIProvider) => void
  onDeleteProvider: (id: string) => void
  onSetDefaultProvider: (provider: AIProvider) => void
  onLoadModels: (providerId: string) => void
  onAddModel: (providerId: string) => void
  onEditModel: (providerId: string, model: AIModel) => void
  onDeleteModel: (model: AIModel) => void
  onSetDefaultModel: (model: AIModel) => void
  onTestModel: (model: AIModel) => void
}

export function ProviderList({
  providers,
  loading,
  modelsByProvider,
  loadingModels,
  testingModels,
  testResults,
  onEditProvider,
  onDeleteProvider,
  onSetDefaultProvider,
  onLoadModels,
  onAddModel,
  onEditModel,
  onDeleteModel,
  onSetDefaultModel,
  onTestModel,
}: ProviderListProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])

  const handleCollapseChange = (keys: string | string[]) => {
    const newKeys = Array.isArray(keys) ? keys : [keys]
    setExpandedKeys(newKeys)
    newKeys.forEach(key => {
      if (!modelsByProvider[key]) {
        onLoadModels(key)
      }
    })
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin />
      </div>
    )
  }

  if (providers.length === 0) {
    return <Empty description="暂无供应商" />
  }

  return (
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
                    onClick={() => onSetDefaultProvider(provider)}
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
                  onClick={() => onEditProvider(provider)}
                />
              </Tooltip>
              <Popconfirm
                title="确定删除此供应商？"
                description="该供应商下的所有模型也将被删除"
                onConfirm={() => onDeleteProvider(provider._id)}
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
              onClick={() => onAddModel(provider._id)}
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
                        onClick={() => onTestModel(model)}
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
                          onClick={() => onSetDefaultModel(model)}
                        />
                      </Tooltip>
                    ),
                    <Tooltip title="编辑" key="edit">
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => onEditModel(provider._id, model)}
                      />
                    </Tooltip>,
                    <Popconfirm
                      key="delete"
                      title="确定删除此模型？"
                      onConfirm={() => onDeleteModel(model)}
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
  )
}
