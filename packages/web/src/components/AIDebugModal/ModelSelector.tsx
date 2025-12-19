/**
 * AI 模型选择器
 */

import { Spin, Alert } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import type { AIProvider, AIModel } from '@/api/aiProvider'

interface ModelSelectorProps {
  providers: AIProvider[]
  models: AIModel[]
  selectedProviderId: string | null
  selectedModelId: string | null
  loadingModels: boolean
  onProviderSelect: (id: string) => void
  onModelSelect: (id: string) => void
}

export function ModelSelector({
  providers,
  models,
  selectedProviderId,
  selectedModelId,
  loadingModels,
  onProviderSelect,
  onModelSelect,
}: ModelSelectorProps) {
  const { isDark, t } = useThemeColors()

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
        color: t.text,
        fontSize: 14
      }}>
        <RobotOutlined style={{ color: t.accent }} />
        选择 AI 模型进行调试
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        {/* 供应商列表 */}
        <div style={{
          flex: 1,
          border: `1px solid ${t.border}`,
          borderRadius: 8,
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '10px 12px',
            background: isDark ? '#1a1a1a' : '#fafafa',
            borderBottom: `1px solid ${t.border}`,
            fontSize: 12,
            fontWeight: 600,
            color: t.textSecondary,
            textTransform: 'uppercase'
          }}>
            供应商
          </div>
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            {providers.length === 0 ? (
              <div style={{
                padding: 20,
                textAlign: 'center',
                color: t.textMuted,
                fontSize: 13
              }}>
                暂无供应商，请先配置
              </div>
            ) : (
              providers.map(provider => (
                <div
                  key={provider._id}
                  onClick={() => onProviderSelect(provider._id)}
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    background: selectedProviderId === provider._id
                      ? (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)')
                      : 'transparent',
                    borderLeft: selectedProviderId === provider._id
                      ? `3px solid ${t.accent}`
                      : '3px solid transparent',
                    fontSize: 13,
                    color: t.text,
                    transition: 'all 0.2s'
                  }}
                >
                  {provider.name}
                  <span style={{ marginLeft: 8, fontSize: 11, color: t.textMuted }}>
                    ({provider.type})
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 模型列表 */}
        <div style={{
          flex: 1,
          border: `1px solid ${t.border}`,
          borderRadius: 8,
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '10px 12px',
            background: isDark ? '#1a1a1a' : '#fafafa',
            borderBottom: `1px solid ${t.border}`,
            fontSize: 12,
            fontWeight: 600,
            color: t.textSecondary,
            textTransform: 'uppercase'
          }}>
            模型
          </div>
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            {loadingModels ? (
              <div style={{ padding: 20, textAlign: 'center' }}>
                <Spin size="small" />
              </div>
            ) : !selectedProviderId ? (
              <div style={{
                padding: 20,
                textAlign: 'center',
                color: t.textMuted,
                fontSize: 13
              }}>
                请先选择供应商
              </div>
            ) : models.length === 0 ? (
              <div style={{
                padding: 20,
                textAlign: 'center',
                color: t.textMuted,
                fontSize: 13
              }}>
                该供应商暂无模型
              </div>
            ) : (
              models.map(model => (
                <div
                  key={model._id}
                  onClick={() => onModelSelect(model._id)}
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    background: selectedModelId === model._id
                      ? (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)')
                      : 'transparent',
                    borderLeft: selectedModelId === model._id
                      ? `3px solid ${t.accent}`
                      : '3px solid transparent',
                    fontSize: 13,
                    color: t.text,
                    transition: 'all 0.2s'
                  }}
                >
                  {model.alias || model.name}
                  {model.isDefault && (
                    <span style={{
                      marginLeft: 8,
                      fontSize: 10,
                      padding: '1px 4px',
                      borderRadius: 3,
                      background: t.accent,
                      color: '#fff'
                    }}>
                      默认
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {providers.length === 0 && (
        <Alert
          type="warning"
          message="请先配置 AI 供应商"
          description="前往 设置 → AI 模型 添加供应商和模型后再使用调试功能"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
    </div>
  )
}
