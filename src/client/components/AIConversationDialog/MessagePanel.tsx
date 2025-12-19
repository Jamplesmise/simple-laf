/**
 * 消息面板
 *
 * 显示对话消息列表
 */

import { useRef, useEffect } from 'react'
import { Spin, Avatar } from 'antd'
import { UserOutlined, RobotOutlined, MessageOutlined } from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import type { AIMessage } from '@/api/aiConversation'
import { MessageContent } from './MessageContent'
import styles from './styles.module.css'

interface MessagePanelProps {
  messages: AIMessage[]
  loading: boolean
  streamContent: string
  streamStatus: string
  currentTitle?: string
}

export function MessagePanel({
  messages,
  loading,
  streamContent,
  streamStatus,
  currentTitle,
}: MessagePanelProps) {
  const { t } = useThemeColors()
  const messagesEndRef = useRef<HTMLDivElement>(null)

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
        <MessageItem key={msg._id} message={msg} />
      ))}

      {/* 流式输出 */}
      {(streamContent || streamStatus) && (
        <StreamingMessage content={streamContent} status={streamStatus} />
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}

/**
 * 单条消息
 */
function MessageItem({ message }: { message: AIMessage }) {
  const { t } = useThemeColors()
  const isUser = message.role === 'user'

  return (
    <div className={styles.messageItem}>
      <Avatar
        className={`${styles.messageAvatar} ${isUser ? styles.userAvatar : styles.assistantAvatar}`}
        icon={isUser ? <UserOutlined /> : <RobotOutlined />}
        style={{
          background: isUser ? t.accent : t.bgMuted,
          color: isUser ? 'white' : t.textSecondary,
        }}
      />
      <div className={styles.messageContent}>
        {isUser ? (
          <div className={styles.messageText}>{message.content}</div>
        ) : (
          <MessageContent content={message.content} messageId={message._id} />
        )}
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
        icon={<RobotOutlined />}
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
