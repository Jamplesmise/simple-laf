/**
 * 系统提示词管理 Hook
 *
 * 独立管理提示词的加载、选择和缓存
 */

import { useState, useCallback, useEffect } from 'react'
import { aiSystemPromptApi, type AISystemPrompt } from '@/api/aiSystemPrompt'

export interface UseSystemPromptsOptions {
  /** 是否自动加载 */
  autoLoad?: boolean
  /** 加载触发条件 */
  loadWhen?: boolean
}

export interface UseSystemPromptsReturn {
  /** 提示词列表 */
  prompts: AISystemPrompt[]
  /** 选中的提示词 ID */
  selectedId: string | null
  /** 选中的提示词对象 */
  selectedPrompt: AISystemPrompt | undefined
  /** 是否加载中 */
  loading: boolean
  /** 选择提示词 */
  select: (id: string | null) => void
  /** 重新加载 */
  reload: () => Promise<void>
}

/**
 * 提示词管理 Hook
 */
export function useSystemPrompts(options: UseSystemPromptsOptions = {}): UseSystemPromptsReturn {
  const { autoLoad = true, loadWhen = true } = options

  const [prompts, setPrompts] = useState<AISystemPrompt[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await aiSystemPromptApi.list()
      const list = res.data.data || []
      setPrompts(list)

      // 自动选择默认提示词
      if (!selectedId) {
        const defaultPrompt = list.find(p => p.isDefault)
        if (defaultPrompt) {
          setSelectedId(defaultPrompt._id)
        }
      }
    } catch {
      // 静默失败，不影响主流程
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    if (autoLoad && loadWhen) {
      load()
    }
  }, [autoLoad, loadWhen, load])

  const selectedPrompt = prompts.find(p => p._id === selectedId)

  return {
    prompts,
    selectedId,
    selectedPrompt,
    loading,
    select: setSelectedId,
    reload: load,
  }
}
