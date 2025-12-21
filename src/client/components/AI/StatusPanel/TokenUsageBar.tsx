/**
 * Token 使用量显示组件 (Sprint 10.1)
 */

import { Space, Typography, Tooltip, Progress } from 'antd'
import { DollarOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import type { TokenUsageBarProps } from './types'
import styles from './styles.module.css'

const { Text } = Typography

// 格式化 token 数量
function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`
  }
  return tokens.toString()
}

// 格式化成本
function formatCost(cost: number): string {
  if (cost < 0.0001) {
    return '< $0.0001'
  }
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`
  }
  return `$${cost.toFixed(2)}`
}

export function TokenUsageBar({ usage, showDetails = false }: TokenUsageBarProps) {
  const { input, output, total, cost } = usage

  // 假设最大 context 为 128K tokens
  const maxTokens = 128000
  const percentage = Math.min((total / maxTokens) * 100, 100)

  return (
    <div className={styles.tokenUsage}>
      <div className={styles.tokenUsageHeader}>
        <Space size="middle">
          <Tooltip title="输入 Tokens">
            <Text type="secondary">
              <ArrowUpOutlined /> {formatTokens(input)}
            </Text>
          </Tooltip>
          <Tooltip title="输出 Tokens">
            <Text type="secondary">
              <ArrowDownOutlined /> {formatTokens(output)}
            </Text>
          </Tooltip>
          <Tooltip title="预估成本">
            <Text type="secondary">
              <DollarOutlined /> {formatCost(cost)}
            </Text>
          </Tooltip>
        </Space>
      </div>

      {showDetails && (
        <div className={styles.tokenUsageDetails}>
          <div className={styles.tokenProgress}>
            <Progress
              percent={percentage}
              size="small"
              showInfo={false}
              strokeColor={{
                '0%': '#87d068',
                '50%': '#ffe58f',
                '100%': '#ff4d4f',
              }}
            />
            <Text type="secondary" className={styles.tokenTotal}>
              总计: {formatTokens(total)} tokens
            </Text>
          </div>
          <div className={styles.tokenBreakdown}>
            <Text type="secondary">
              输入: {input.toLocaleString()} | 输出: {output.toLocaleString()} | 成本: {formatCost(cost)}
            </Text>
          </div>
        </div>
      )}
    </div>
  )
}
