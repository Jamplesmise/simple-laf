/**
 * StatusPanel 类型定义 (Sprint 10.1)
 */

import type { TokenUsage } from '@/api/aiConversation'

// 工具调用状态
export type ToolCallStatus = 'pending' | 'running' | 'success' | 'error'

// 工具调用记录
export interface ToolCallRecord {
  callId: string
  tool: string
  params: Record<string, unknown>
  status: ToolCallStatus
  result?: unknown
  error?: string
  duration?: number
  startTime: number
  endTime?: number
}

// 状态面板数据
export interface StatusPanelData {
  // 当前状态
  status: 'idle' | 'thinking' | 'generating' | 'executing' | 'done' | 'error'
  statusMessage?: string

  // 思考内容
  thinkingContent?: string

  // 工具调用列表
  toolCalls: ToolCallRecord[]

  // Token 使用
  tokenUsage?: TokenUsage

  // 时间追踪
  startTime?: number
  endTime?: number
}

// StatusPanel 组件 Props
export interface StatusPanelProps {
  data: StatusPanelData
  expanded?: boolean
  onToggleExpand?: () => void
  className?: string
}

// ToolCallCard Props
export interface ToolCallCardProps {
  record: ToolCallRecord
  showParams?: boolean
}

// ThinkingView Props
export interface ThinkingViewProps {
  content: string
  expanded?: boolean
  onToggle?: () => void
}

// TokenUsageBar Props
export interface TokenUsageBarProps {
  usage: TokenUsage
  showDetails?: boolean
}
