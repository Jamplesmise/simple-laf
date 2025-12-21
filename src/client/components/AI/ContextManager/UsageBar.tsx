/**
 * 上下文使用量指示器 (Sprint 10.3)
 *
 * 改进版：
 * - 移除顶部文字
 * - 使用量显示在进度条后面
 * - 更紧凑的设计
 */

import React from 'react'
import { Progress, Tooltip } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import type { ContextUsage } from '../../../api/aiConversation'

interface UsageBarProps {
  usage: ContextUsage
  warningThreshold: number
  isWarning: boolean
  onClick?: () => void
}

export const UsageBar: React.FC<UsageBarProps> = ({
  usage,
  warningThreshold,
  isWarning,
  onClick
}) => {
  // 根据使用量确定颜色
  const getStrokeColor = () => {
    if (usage.percentage >= 90) return '#ff4d4f' // 红色
    if (usage.percentage >= warningThreshold) return '#1890ff' // 蓝色（警告）
    return '#52c41a' // 绿色
  }

  // 格式化 token 数量
  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`
    }
    return tokens.toString()
  }

  return (
    <Tooltip title="点击管理上下文">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 12px',
          background: isWarning ? 'rgba(24, 144, 255, 0.08)' : 'rgba(0, 0, 0, 0.02)',
          borderRadius: 20,
          cursor: onClick ? 'pointer' : 'default',
          transition: 'all 0.2s',
          border: isWarning ? '1px solid rgba(24, 144, 255, 0.2)' : '1px solid transparent',
          minWidth: 140,
        }}
        onClick={onClick}
        onMouseEnter={(e) => {
          if (onClick) {
            e.currentTarget.style.background = isWarning
              ? 'rgba(24, 144, 255, 0.12)'
              : 'rgba(0, 0, 0, 0.04)'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isWarning
            ? 'rgba(24, 144, 255, 0.08)'
            : 'rgba(0, 0, 0, 0.02)'
        }}
      >
        {/* 进度条 */}
        <Progress
          percent={usage.percentage}
          size="small"
          strokeColor={getStrokeColor()}
          trailColor="rgba(0,0,0,0.06)"
          showInfo={false}
          style={{ width: 60, margin: 0 }}
        />

        {/* 使用量文字 */}
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: isWarning ? '#1890ff' : '#666',
            whiteSpace: 'nowrap',
          }}
        >
          {formatTokens(usage.used)}/{formatTokens(usage.total)}
        </span>

        {/* 详情图标 */}
        <InfoCircleOutlined
          style={{
            fontSize: 12,
            color: isWarning ? '#1890ff' : '#999',
          }}
        />
      </div>
    </Tooltip>
  )
}

export default UsageBar
