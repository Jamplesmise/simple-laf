import { useState } from 'react'
import { message } from 'antd'
import { aiSystemPromptApi, type AISystemPrompt } from '../../../api/aiSystemPrompt'

export function useEditModal(onSuccess: () => void) {
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<AISystemPrompt | null>(null)
  const [formName, setFormName] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formChangeNote, setFormChangeNote] = useState('')
  const [saving, setSaving] = useState(false)

  const openEditModal = (prompt?: AISystemPrompt) => {
    if (prompt) {
      setEditingPrompt(prompt)
      setFormName(prompt.name)
      setFormContent(prompt.content)
    } else {
      setEditingPrompt(null)
      setFormName('')
      setFormContent('')
    }
    setFormChangeNote('')
    setEditModalOpen(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      message.error('请输入提示词名称')
      return
    }
    if (!formContent.trim()) {
      message.error('请输入提示词内容')
      return
    }

    setSaving(true)
    try {
      if (editingPrompt) {
        await aiSystemPromptApi.update(editingPrompt._id, {
          name: formName.trim(),
          content: formContent.trim(),
          changeNote: formChangeNote.trim() || undefined
        })
        message.success('更新成功')
      } else {
        await aiSystemPromptApi.create({
          name: formName.trim(),
          content: formContent.trim()
        })
        message.success('创建成功')
      }
      setEditModalOpen(false)
      onSuccess()
    } catch {
      message.error(editingPrompt ? '更新失败' : '创建失败')
    } finally {
      setSaving(false)
    }
  }

  return {
    editModalOpen,
    editingPrompt,
    formName,
    formContent,
    formChangeNote,
    saving,
    setFormName,
    setFormContent,
    setFormChangeNote,
    openEditModal,
    handleSave,
    closeEditModal: () => setEditModalOpen(false)
  }
}
