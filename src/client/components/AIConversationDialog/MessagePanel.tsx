/**
 * 消息面板
 *
 * 显示对话消息列表
 * Sprint 10.2: 添加消息操作（编辑/分支/复制/反馈）
 * Sprint 10.1: 添加 AI 状态面板
 */

import { useRef, useEffect, useState } from 'react'
import { Spin, Avatar } from 'antd'
import { UserOutlined, MessageOutlined } from '@ant-design/icons'
import { Sparkles } from 'lucide-react'
import { useThemeColors } from '@/hooks/useTheme'
import type { AIMessage } from '@/api/aiConversation'
import { MessageContent } from './MessageContent'
import { MessageActions } from './MessageActions'
import { StatusPanel, type StatusPanelData } from '@/components/AI/StatusPanel'
import styles from './styles.module.css'

interface MessagePanelProps {
  messages: AIMessage[]
  loading: boolean
  streamContent: string
  streamStatus: string
  currentTitle?: string
  // Sprint 10.1: 状态面板数据
  statusPanelData?: StatusPanelData
  // Sprint 10.2: 消息操作回调
  onEditSuccess?: (regenerating: boolean) => void
  onBranchSuccess?: (conversationId: string) => void
}

export function MessagePanel({
  messages,
  loading,
  streamContent,
  streamStatus,
  currentTitle,
  statusPanelData,
  onEditSuccess,
  onBranchSuccess,
}: MessagePanelProps) {
  const { t } = useThemeColors()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  // Sprint 10.1: 状态面板展开状态
  const [statusPanelExpanded, setStatusPanelExpanded] = useState(false)

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamContent])

  if (loading) {
    return (
      <div className={styles.emptyState}>
        <Spin size="large" />
      </div>
    )
  }

  if (messages.length === 0 && !streamContent) {
    return (
      <div className={styles.emptyState}>
        <MessageOutlined className={styles.emptyIcon} />
        <span className={styles.emptyText}>
          {currentTitle ? '暂无消息' : '选择一个对话或创建新对话'}
        </span>
      </div>
    )
  }

  return (
    <div className={styles.messageArea} style={{ background: t.bgCard }}>
      {messages.map(msg => (
        <MessageItem
          key={msg._id}
          message={msg}
          onEditSuccess={onEditSuccess}
          onBranchSuccess={onBranchSuccess}
        />
      ))}

      {/* 流式输出 */}
      {(streamContent || streamStatus) && (
        <StreamingMessage content={streamContent} status={streamStatus} />
      )}

      {/* Sprint 10.1: AI 状态面板 */}
      {statusPanelData && statusPanelData.status !== 'idle' && (
        <div className={styles.statusPanelWrapper}>
          <StatusPanel
            data={statusPanelData}
            expanded={statusPanelExpanded}
            onToggleExpand={() => setStatusPanelExpanded(!statusPanelExpanded)}
          />
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}

/**
 * 单条消息
 */
interface MessageItemProps {
  message: AIMessage
  onEditSuccess?: (regenerating: boolean) => void
  onBranchSuccess?: (conversationId: string) => void
}

function MessageItem({ message, onEditSuccess, onBranchSuccess }: MessageItemProps) {
  const { t } = useThemeColors()
  const isUser = message.role === 'user'

  return (
    <div className={styles.messageItem}>
      <Avatar
        className={`${styles.messageAvatar} ${isUser ? styles.userAvatar : styles.assistantAvatar}`}
        icon={isUser ? <UserOutlined /> : <Sparkles size={16} />}
        style={{
          background: isUser ? t.accent : t.bgMuted,
          color: isUser ? 'white' : t.textSecondary,
        }}
      />
      <div className={styles.messageBody}>
        <div className={styles.messageContent}>
          {isUser ? (
            <div className={styles.messageText}>{message.content}</div>
          ) : (
            <MessageContent content={message.content} messageId={message._id} />
          )}
        </div>
        {/* Sprint 10.2: 消息操作按钮 - 放在消息末尾 */}
        <div className={styles.messageActions}>
          <MessageActions
            message={message}
            onEditSuccess={onEditSuccess}
            onBranchSuccess={onBranchSuccess}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * 流式输出消息
 */
function StreamingMessage({ content, status }: { content: string; status: string }) {
  const { t } = useThemeColors()

  return (
    <div className={styles.messageItem}>
      <Avatar
        className={`${styles.messageAvatar} ${styles.assistantAvatar}`}
        icon={<Sparkles size={16} />}
        style={{ background: t.bgMuted, color: t.textSecondary }}
      />
      <div className={styles.messageContent}>
        {status && (
          <div
            className={styles.statusBadge}
            style={{
              background: t.accentSurface,
              borderColor: t.accent,
              color: t.accent,
            }}
          >
            {status}
            <StreamingIndicator />
          </div>
        )}
        {content && (
          <MessageContent content={content} messageId="streaming" />
        )}
        {!status && content && <StreamingIndicator />}
      </div>
    </div>
  )
}

/**
 * 流式输出指示器
 */
function StreamingIndicator() {
  return (
    <span className={styles.streamingIndicator}>
      <span className={styles.streamingDot} />
      <span className={styles.streamingDot} />
      <span className={styles.streamingDot} />
    </span>
  )
}
