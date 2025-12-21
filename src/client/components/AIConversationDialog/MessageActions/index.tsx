/**
 * 消息操作按钮组
 *
 * Sprint 10.2: 消息编辑与分支
 * - 编辑按钮（用户消息）
 * - 分支按钮
 * - 复制按钮
 * - 反馈按钮（AI 消息）
 */

import { useState } from 'react'
import { Tooltip, message } from 'antd'
import {
  EditOutlined,
  BranchesOutlined,
  CopyOutlined,
  CheckOutlined,
  LikeOutlined,
  DislikeOutlined,
  LikeFilled,
  DislikeFilled,
} from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import { aiConversationApi, type AIMessage } from '@/api/aiConversation'
import { EditDialog } from './EditDialog'
import styles from './styles.module.css'

interface MessageActionsProps {
  message: AIMessage
  onEditSuccess?: (regenerating: boolean) => void
  onBranchSuccess?: (conversationId: string) => void
  onFeedbackChange?: (feedback: 'like' | 'dislike' | null) => void
}

export function MessageActions({
  message: msg,
  onEditSuccess,
  onBranchSuccess,
  onFeedbackChange,
}: MessageActionsProps) {
  const { t } = useThemeColors()
  const [copied, setCopied] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(
    msg.feedback || null
  )
  const [loading, setLoading] = useState(false)

  const isUser = msg.role === 'user'

  // 复制消息内容
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content)
      setCopied(true)
      message.success('已复制到剪贴板')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      message.error('复制失败')
    }
  }

  // 创建分支
  const handleBranch = async () => {
    try {
      setLoading(true)
      const res = await aiConversationApi.createBranch(msg._id)
      if (res.data.success) {
        message.success('分支创建成功')
        onBranchSuccess?.(res.data.data.branchConversationId)
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : '创建分支失败')
    } finally {
      setLoading(false)
    }
  }

  // 反馈
  const handleFeedback = async (newFeedback: 'like' | 'dislike') => {
    try {
      // 如果点击已选中的反馈，则取消
      const finalFeedback = feedback === newFeedback ? null : newFeedback

      const res = await aiConversationApi.feedbackMessage(msg._id, finalFeedback)
      if (res.data.success) {
        setFeedback(finalFeedback)
        onFeedbackChange?.(finalFeedback)
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : '反馈失败')
    }
  }

  // 编辑成功回调
  const handleEditSuccess = (regenerating: boolean) => {
    setEditDialogOpen(false)
    onEditSuccess?.(regenerating)
  }

  return (
    <>
      <div className={styles.actions} style={{ '--action-color': t.textMuted } as React.CSSProperties}>
        {/* 用户消息：编辑按钮 */}
        {isUser && (
          <Tooltip title="编辑">
            <button
              className={styles.actionBtn}
              onClick={() => setEditDialogOpen(true)}
            >
              <EditOutlined />
            </button>
          </Tooltip>
        )}

        {/* AI 消息：反馈按钮 */}
        {!isUser && (
          <>
            <Tooltip title="有帮助">
              <button
                className={`${styles.actionBtn} ${feedback === 'like' ? styles.active : ''}`}
                onClick={() => handleFeedback('like')}
                style={feedback === 'like' ? { color: t.success } : undefined}
              >
                {feedback === 'like' ? <LikeFilled /> : <LikeOutlined />}
              </button>
            </Tooltip>
            <Tooltip title="没帮助">
              <button
                className={`${styles.actionBtn} ${feedback === 'dislike' ? styles.active : ''}`}
                onClick={() => handleFeedback('dislike')}
                style={feedback === 'dislike' ? { color: t.error } : undefined}
              >
                {feedback === 'dislike' ? <DislikeFilled /> : <DislikeOutlined />}
              </button>
            </Tooltip>
          </>
        )}

        {/* 分支按钮 */}
        <Tooltip title="创建分支">
          <button
            className={styles.actionBtn}
            onClick={handleBranch}
            disabled={loading}
          >
            <BranchesOutlined />
          </button>
        </Tooltip>

        {/* 复制按钮 */}
        <Tooltip title={copied ? '已复制' : '复制'}>
          <button className={styles.actionBtn} onClick={handleCopy}>
            {copied ? <CheckOutlined style={{ color: t.success }} /> : <CopyOutlined />}
          </button>
        </Tooltip>
      </div>

      {/* 编辑弹窗 */}
      <EditDialog
        open={editDialogOpen}
        message={msg}
        onClose={() => setEditDialogOpen(false)}
        onSuccess={handleEditSuccess}
      />
    </>
  )
}

export { EditDialog } from './EditDialog'
