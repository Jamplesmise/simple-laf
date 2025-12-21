/**
 * AI 状态面板 (Sprint 10.1)
 *
 * 实时显示 AI 工作状态、工具调用和 Token 消耗
 */

import { useState } from 'react'
import { Card, Collapse, Space, Tag, Typography, Spin } from 'antd'
import {
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RobotOutlined,
  ToolOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { ToolCallCard } from './ToolCallCard'
import { ThinkingView } from './ThinkingView'
import { TokenUsageBar } from './TokenUsageBar'
import type { StatusPanelProps } from './types'
import styles from './styles.module.css'

const { Text } = Typography

// 状态图标映射
const statusIcons: Record<string, React.ReactNode> = {
  idle: <RobotOutlined />,
  thinking: <Spin indicator={<LoadingOutlined spin />} size="small" />,
  generating: <Spin indicator={<LoadingOutlined spin />} size="small" />,
  executing: <ThunderboltOutlined className={styles.executing} />,
  done: <CheckCircleOutlined className={styles.success} />,
  error: <CloseCircleOutlined className={styles.error} />,
}

// 状态文本映射
const statusTexts: Record<string, string> = {
  idle: '等待中',
  thinking: '正在分析...',
  generating: '生成回复中...',
  executing: '执行操作中...',
  done: '完成',
  error: '出错',
}

// 状态颜色映射
const statusColors: Record<string, string> = {
  idle: 'default',
  thinking: 'processing',
  generating: 'processing',
  executing: 'warning',
  done: 'success',
  error: 'error',
}

export function StatusPanel({
  data,
  expanded = false,
  onToggleExpand,
  className,
}: StatusPanelProps) {
  const [localExpanded, setLocalExpanded] = useState(expanded)
  const isExpanded = onToggleExpand ? expanded : localExpanded

  const handleToggle = () => {
    if (onToggleExpand) {
      onToggleExpand()
    } else {
      setLocalExpanded(!localExpanded)
    }
  }

  const { status, statusMessage, thinkingContent, toolCalls, tokenUsage } = data

  // 如果是空闲状态且没有数据，不显示面板
  if (status === 'idle' && !toolCalls.length && !tokenUsage) {
    return null
  }

  const hasActiveToolCalls = toolCalls.some(tc => tc.status === 'pending' || tc.status === 'running')

  return (
    <Card
      size="small"
      className={`${styles.statusPanel} ${className || ''}`}
      title={
        <Space>
          {statusIcons[status]}
          <Text>{statusMessage || statusTexts[status]}</Text>
          <Tag color={statusColors[status]}>{status}</Tag>
        </Space>
      }
      extra={
        (thinkingContent || toolCalls.length > 0) && (
          <Text
            type="secondary"
            className={styles.expandToggle}
            onClick={handleToggle}
          >
            {isExpanded ? '收起 ▲' : '展开 ▼'}
          </Text>
        )
      }
    >
      {/* Token 使用量（始终显示） */}
      {tokenUsage && <TokenUsageBar usage={tokenUsage} showDetails={isExpanded} />}

      {/* 可折叠内容 */}
      {isExpanded && (
        <div className={styles.expandedContent}>
          {/* 思考内容 */}
          {thinkingContent && (
            <ThinkingView content={thinkingContent} expanded={true} />
          )}

          {/* 工具调用列表 */}
          {toolCalls.length > 0 && (
            <div className={styles.toolCallsSection}>
              <Text type="secondary" className={styles.sectionTitle}>
                <ToolOutlined /> 工具调用 ({toolCalls.length})
              </Text>
              <Collapse
                size="small"
                defaultActiveKey={hasActiveToolCalls ? toolCalls.filter(tc => tc.status !== 'success').map(tc => tc.callId) : []}
                items={toolCalls.map((tc) => ({
                  key: tc.callId,
                  label: <ToolCallCard record={tc} showParams={false} />,
                  children: <ToolCallCard record={tc} showParams={true} />,
                }))}
              />
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

export { ToolCallCard } from './ToolCallCard'
export { ThinkingView } from './ThinkingView'
export { TokenUsageBar } from './TokenUsageBar'
export * from './types'
