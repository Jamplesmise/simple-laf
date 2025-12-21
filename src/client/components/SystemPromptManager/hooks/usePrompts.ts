import { useState, useEffect, useCallback } from 'react'
import { message } from 'antd'
import { aiSystemPromptApi, type AISystemPrompt } from '../../../api/aiSystemPrompt'

export function usePrompts() {
  const [prompts, setPrompts] = useState<AISystemPrompt[]>([])
  const [loading, setLoading] = useState(true)

  const loadPrompts = useCallback(async () => {
    try {
      const res = await aiSystemPromptApi.list()
      setPrompts(res.data.data)
    } catch {
      message.error('加载提示词失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPrompts()
  }, [loadPrompts])

  const handleDelete = async (prompt: AISystemPrompt) => {
    try {
      await aiSystemPromptApi.delete(prompt._id)
      message.success('已删除')
      loadPrompts()
    } catch {
      message.error('删除失败')
    }
  }

  const handleSetDefault = async (prompt: AISystemPrompt) => {
    try {
      await aiSystemPromptApi.update(prompt._id, { isDefault: true })
      message.success('已设为默认')
      loadPrompts()
    } catch {
      message.error('设置失败')
    }
  }

  return {
    prompts,
    loading,
    loadPrompts,
    handleDelete,
    handleSetDefault
  }
}
