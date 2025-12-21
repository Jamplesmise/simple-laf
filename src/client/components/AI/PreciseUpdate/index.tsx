/**
 * 精准更新组件 (Sprint 16.1)
 *
 * 功能：
 * - 显示修改类型分析结果
 * - 展示节省的 Token 数量
 * - 代码范围预览
 * - 修改前后对比
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  Modal,
  Button,
  Space,
  message,
  Spin,
  Typography,
  Tag,
  Divider,
  InputNumber,
  Tooltip,
  Alert,
  Progress,
} from 'antd'
import {
  ThunderboltOutlined,
  CodeOutlined,
  AimOutlined,
  QuestionCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import {
  aiConversationApi,
  type ChangeType,
  type MinimalContextResult,
  type SmartContextResult,
} from '../../../api/aiConversation'

const { Text, Title, Paragraph } = Typography

// 修改类型配置
const CHANGE_TYPE_CONFIG: Record<ChangeType, {
  label: string
  color: string
  description: string
  icon: React.ReactNode
}> = {
  minor: {
    label: '小范围修改',
    color: 'green',
    description: '修改变量、添加注释、格式化等',
    icon: <AimOutlined />,
  },
  moderate: {
    label: '中等修改',
    color: 'blue',
    description: '添加功能、优化逻辑、错误处理等',
    icon: <CodeOutlined />,
  },
  refactor: {
    label: '重构',
    color: 'orange',
    description: '拆分、合并、重写等大范围修改',
    icon: <ThunderboltOutlined />,
  },
}

interface PreciseUpdateProps {
  functionId: string
  functionName?: string
  request?: string         // 用户请求文本（用于自动分析）
  visible?: boolean
  onClose?: () => void
  onContextReady?: (context: MinimalContextResult | null, prompt: string | null) => void
}

export const PreciseUpdate: React.FC<PreciseUpdateProps> = ({
  functionId,
  functionName,
  request,
  visible = false,
  onClose,
  onContextReady,
}) => {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SmartContextResult | null>(null)
  const [manualRange, setManualRange] = useState<{ startLine: number; endLine: number } | null>(null)
  const [contextLines, setContextLines] = useState(10)

  // 分析修改类型并获取上下文
  const analyzeAndGetContext = useCallback(async () => {
    if (!functionId || !request) return

    setLoading(true)
    try {
      const response = await aiConversationApi.getSmartContext(functionId, request)
      if (response.data.success) {
        setResult(response.data.data)

        // 通知父组件上下文已准备好
        if (onContextReady) {
          const ctx = response.data.data
          if (ctx.useMinimalContext && 'contextCode' in ctx.context) {
            onContextReady(ctx.context as MinimalContextResult, ctx.prompt)
          } else {
            onContextReady(null, null)
          }
        }
      }
    } catch (err) {
      message.error('分析失败')
      console.error('Failed to analyze:', err)
    } finally {
      setLoading(false)
    }
  }, [functionId, request, onContextReady])

  // 手动获取精准上下文
  const getPreciseContext = async () => {
    if (!functionId || !manualRange) return

    setLoading(true)
    try {
      const response = await aiConversationApi.getPreciseContext(
        functionId,
        manualRange,
        contextLines
      )
      if (response.data.success) {
        const data = response.data.data
        setResult({
          changeType: 'minor',
          useMinimalContext: true,
          context: data,
          prompt: data.prompt,
        })

        if (onContextReady) {
          onContextReady(data, data.prompt)
        }
      }
    } catch (err) {
      message.error('获取上下文失败')
    } finally {
      setLoading(false)
    }
  }

  // 首次加载
  useEffect(() => {
    if (visible && request) {
      analyzeAndGetContext()
    }
  }, [visible, analyzeAndGetContext, request])

  // 格式化 token 数量
  const formatTokens = (tokens: number) => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`
    }
    return tokens.toString()
  }

  // 渲染修改类型标签
  const renderChangeTypeTag = () => {
    if (!result) return null

    const config = CHANGE_TYPE_CONFIG[result.changeType]
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.label}
      </Tag>
    )
  }

  // 渲染节省信息
  const renderSavingsInfo = () => {
    if (!result || !result.useMinimalContext) return null

    const ctx = result.context as MinimalContextResult
    if (!ctx.tokensSaved) return null

    return (
      <Alert
        type="success"
        showIcon
        icon={<CheckCircleOutlined />}
        message={
          <Space>
            <Text strong>节省 {formatTokens(ctx.tokensSaved)} tokens</Text>
            <Text type="secondary">({ctx.savingsPercentage}%)</Text>
          </Space>
        }
        description={
          <Text type="secondary">
            只加载第 {ctx.actualRange.startLine}-{ctx.actualRange.endLine} 行
            （共 {ctx.totalLines} 行）
          </Text>
        }
        style={{ marginBottom: 16 }}
      />
    )
  }

  // 渲染上下文预览
  const renderContextPreview = () => {
    if (!result || !result.useMinimalContext) return null

    const ctx = result.context as MinimalContextResult
    if (!ctx.contextCode) return null

    return (
      <div style={{ marginTop: 16 }}>
        <Title level={5}>
          <Space>
            <CodeOutlined />
            上下文预览
            <Tooltip title="只会发送这部分代码给 AI，大幅减少 Token 消耗">
              <QuestionCircleOutlined style={{ color: '#999' }} />
            </Tooltip>
          </Space>
        </Title>
        <div
          style={{
            background: '#f5f5f5',
            padding: 12,
            borderRadius: 4,
            maxHeight: 300,
            overflow: 'auto',
            fontFamily: 'monospace',
            fontSize: 12,
            whiteSpace: 'pre-wrap',
          }}
        >
          {ctx.contextCode}
        </div>
      </div>
    )
  }

  // 渲染手动范围选择
  const renderManualRangeSelector = () => {
    return (
      <div style={{ marginTop: 16 }}>
        <Divider orientation="left">手动指定范围</Divider>
        <Space wrap>
          <Text>起始行:</Text>
          <InputNumber
            min={1}
            value={manualRange?.startLine}
            onChange={(v) =>
              setManualRange((prev) => ({
                startLine: v || 1,
                endLine: prev?.endLine || 1,
              }))
            }
            style={{ width: 80 }}
          />
          <Text>结束行:</Text>
          <InputNumber
            min={1}
            value={manualRange?.endLine}
            onChange={(v) =>
              setManualRange((prev) => ({
                startLine: prev?.startLine || 1,
                endLine: v || 1,
              }))
            }
            style={{ width: 80 }}
          />
          <Text>上下文行数:</Text>
          <InputNumber
            min={5}
            max={50}
            value={contextLines}
            onChange={(v) => setContextLines(v || 10)}
            style={{ width: 80 }}
          />
          <Button
            type="primary"
            onClick={getPreciseContext}
            loading={loading}
            disabled={!manualRange?.startLine || !manualRange?.endLine}
          >
            获取上下文
          </Button>
        </Space>
      </div>
    )
  }

  return (
    <Modal
      title={
        <Space>
          <AimOutlined />
          <span>精准更新</span>
          {functionName && <Text type="secondary">- {functionName}</Text>}
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={700}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            onClick={() => {
              if (onContextReady && result) {
                if (result.useMinimalContext && 'contextCode' in result.context) {
                  onContextReady(result.context as MinimalContextResult, result.prompt)
                }
              }
              onClose?.()
            }}
            disabled={!result?.useMinimalContext}
          >
            使用精准上下文
          </Button>
        </Space>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin tip="分析中..." />
        </div>
      ) : (
        <>
          {/* 修改类型 */}
          {result && (
            <div style={{ marginBottom: 16 }}>
              <Space>
                <Text strong>修改类型:</Text>
                {renderChangeTypeTag()}
                <Text type="secondary">
                  {CHANGE_TYPE_CONFIG[result.changeType].description}
                </Text>
              </Space>
            </div>
          )}

          {/* 是否使用精准上下文 */}
          {result && (
            <div style={{ marginBottom: 16 }}>
              {result.useMinimalContext ? (
                <Tag color="green" icon={<CheckCircleOutlined />}>
                  使用精准上下文
                </Tag>
              ) : (
                <Tag color="orange" icon={<WarningOutlined />}>
                  使用完整代码（无法优化）
                </Tag>
              )}
            </div>
          )}

          {/* 节省信息 */}
          {renderSavingsInfo()}

          {/* 上下文预览 */}
          {renderContextPreview()}

          {/* 手动范围选择 */}
          {renderManualRangeSelector()}

          {/* 提示信息 */}
          {!result?.useMinimalContext && (
            <Alert
              type="info"
              showIcon
              message="提示"
              description="当前请求需要查看完整代码。如果你知道具体要修改哪些行，可以手动指定范围以节省 Token。"
              style={{ marginTop: 16 }}
            />
          )}
        </>
      )}
    </Modal>
  )
}

// ==================== 精准更新指示器组件 ====================

interface PreciseUpdateIndicatorProps {
  tokensSaved: number
  savingsPercentage: number
  range: { startLine: number; endLine: number }
  totalLines: number
}

export const PreciseUpdateIndicator: React.FC<PreciseUpdateIndicatorProps> = ({
  tokensSaved,
  savingsPercentage,
  range,
  totalLines,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 8px',
        background: '#f6ffed',
        border: '1px solid #b7eb8f',
        borderRadius: 4,
        fontSize: 12,
      }}
    >
      <AimOutlined style={{ color: '#52c41a' }} />
      <Text style={{ color: '#52c41a' }}>
        精准模式
      </Text>
      <Divider type="vertical" />
      <Tooltip title={`只加载第 ${range.startLine}-${range.endLine} 行，共 ${totalLines} 行`}>
        <Text type="secondary">
          节省 {tokensSaved >= 1000 ? `${(tokensSaved / 1000).toFixed(1)}K` : tokensSaved} tokens
          ({savingsPercentage}%)
        </Text>
      </Tooltip>
      <Progress
        percent={100 - savingsPercentage}
        size="small"
        showInfo={false}
        strokeColor="#52c41a"
        style={{ width: 60, margin: 0 }}
      />
    </div>
  )
}

export default PreciseUpdate
