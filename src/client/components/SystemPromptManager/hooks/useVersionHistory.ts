import { useState } from 'react'
import { message } from 'antd'
import { aiSystemPromptApi, type AISystemPrompt, type AIPromptVersion } from '../../../api/aiSystemPrompt'

export function useVersionHistory(onSuccess: () => void) {
  const [versionModalOpen, setVersionModalOpen] = useState(false)
  const [versionPrompt, setVersionPrompt] = useState<AISystemPrompt | null>(null)
  const [versions, setVersions] = useState<AIPromptVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)

  const openVersionHistory = async (prompt: AISystemPrompt) => {
    setVersionPrompt(prompt)
    setVersionModalOpen(true)
    setLoadingVersions(true)
    try {
      const res = await aiSystemPromptApi.getVersions(prompt._id)
      setVersions(res.data.data)
    } catch {
      message.error('获取版本历史失败')
    } finally {
      setLoadingVersions(false)
    }
  }

  const handleRollback = async (version: number) => {
    if (!versionPrompt) return
    try {
      await aiSystemPromptApi.rollback(versionPrompt._id, version)
      message.success(`已回滚到版本 ${version}`)
      setVersionModalOpen(false)
      onSuccess()
    } catch {
      message.error('回滚失败')
    }
  }

  return {
    versionModalOpen,
    versionPrompt,
    versions,
    loadingVersions,
    openVersionHistory,
    handleRollback,
    closeVersionModal: () => setVersionModalOpen(false)
  }
}
