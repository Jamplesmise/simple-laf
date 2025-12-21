/**
 * 消息编辑弹窗
 *
 * Sprint 10.2: 消息编辑
 */

import { useState, useEffect } from 'react'
import { Modal, Input, message } from 'antd'
import { aiConversationApi, type AIMessage } from '@/api/aiConversation'

const { TextArea } = Input

interface EditDialogProps {
  open: boolean
  message: AIMessage
  onClose: () => void
  onSuccess: (regenerating: boolean) => void
}

export function EditDialog({ open, message: msg, onClose, onSuccess }: EditDialogProps) {
  const [content, setContent] = useState(msg.content)
  const [loading, setLoading] = useState(false)

  // 打开时重置内容
  useEffect(() => {
    if (open) {
      setContent(msg.content)
    }
  }, [open, msg.content])

  const handleSubmit = async () => {
    const trimmed = content.trim()
    if (!trimmed) {
      message.error('消息内容不能为空')
      return
    }

    if (trimmed === msg.content) {
      onClose()
      return
    }

    try {
      setLoading(true)
      const res = await aiConversationApi.editMessage(msg._id, trimmed)

      if (res.data.success) {
        const { regenerating, deletedCount } = res.data.data
        if (regenerating) {
          message.success(`消息已更新，已删除 ${deletedCount} 条后续消息`)
        } else {
          message.success('消息已更新')
        }
        onSuccess(regenerating)
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : '编辑失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="编辑消息"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="保存"
      cancelText="取消"
      confirmLoading={loading}
      destroyOnClose
    >
      <TextArea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        autoSize={{ minRows: 3, maxRows: 10 }}
        placeholder="输入消息内容..."
        style={{ marginTop: 16 }}
      />
      <p style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
        注意：编辑用户消息后，后续的 AI 回复将被删除，需要重新生成。
      </p>
    </Modal>
  )
}
