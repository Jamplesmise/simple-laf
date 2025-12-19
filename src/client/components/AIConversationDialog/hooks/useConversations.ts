/**
 * 对话列表管理 Hook
 */

import { useState, useCallback, useEffect } from 'react'
import { message } from 'antd'
import { aiConversationApi, type AIConversation } from '@/api/aiConversation'

export type ConversationFilter = 'all' | 'starred' | 'archived'

export interface UseConversationsOptions {
  /** 是否自动加载 */
  autoLoad?: boolean
  /** 加载触发条件 */
  loadWhen?: boolean
}

export interface UseConversationsReturn {
  /** 对话列表 */
  conversations: AIConversation[]
  /** 当前选中的对话 ID */
  currentId: string | null
  /** 当前筛选条件 */
  filter: ConversationFilter
  /** 是否加载中 */
  loading: boolean
  /** 正在编辑的对话 ID */
  editingId: string | null
  /** 编辑中的标题 */
  editingTitle: string
  /** 选择对话 */
  select: (id: string | null) => void
  /** 设置筛选条件 */
  setFilter: (filter: ConversationFilter) => void
  /** 创建新对话 */
  create: () => Promise<AIConversation | null>
  /** 删除对话 */
  remove: (id: string) => Promise<boolean>
  /** 切换收藏 */
  toggleStar: (conv: AIConversation) => Promise<boolean>
  /** 归档对话 */
  archive: (conv: AIConversation) => Promise<boolean>
  /** 开始编辑标题 */
  startEdit: (id: string, title: string) => void
  /** 保存标题 */
  saveTitle: (id: string) => Promise<boolean>
  /** 取消编辑 */
  cancelEdit: () => void
  /** 设置编辑标题 */
  setEditingTitle: (title: string) => void
  /** 重新加载 */
  reload: () => Promise<void>
  /** 添加对话到列表 */
  addConversation: (conv: AIConversation) => void
}

/**
 * 对话列表管理 Hook
 */
export function useConversations(options: UseConversationsOptions = {}): UseConversationsReturn {
  const { autoLoad = true, loadWhen = true } = options

  const [conversations, setConversations] = useState<AIConversation[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [filter, setFilter] = useState<ConversationFilter>('all')
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  // 加载对话列表
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: { archived?: boolean; starred?: boolean } = {}
      if (filter === 'archived') params.archived = true
      if (filter === 'starred') params.starred = true
      if (filter === 'all') params.archived = false

      const res = await aiConversationApi.list(params)
      setConversations(res.data.data || [])
    } catch {
      message.error('加载对话列表失败')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    if (autoLoad && loadWhen) {
      load()
    }
  }, [autoLoad, loadWhen, load])

  // 创建新对话
  const create = useCallback(async (): Promise<AIConversation | null> => {
    try {
      const res = await aiConversationApi.create()
      const newConv = res.data.data
      setConversations(prev => [newConv, ...prev])
      setCurrentId(newConv._id)
      return newConv
    } catch {
      message.error('创建对话失败')
      return null
    }
  }, [])

  // 删除对话
  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      await aiConversationApi.delete(id)
      setConversations(prev => prev.filter(c => c._id !== id))
      if (currentId === id) {
        setCurrentId(null)
      }
      message.success('对话已删除')
      return true
    } catch {
      message.error('删除失败')
      return false
    }
  }, [currentId])

  // 切换收藏
  const toggleStar = useCallback(async (conv: AIConversation): Promise<boolean> => {
    try {
      const res = await aiConversationApi.update(conv._id, { starred: !conv.starred })
      setConversations(prev =>
        prev.map(c => c._id === conv._id ? res.data.data : c)
      )
      return true
    } catch {
      message.error('操作失败')
      return false
    }
  }, [])

  // 归档对话
  const archive = useCallback(async (conv: AIConversation): Promise<boolean> => {
    try {
      await aiConversationApi.update(conv._id, { archived: !conv.archived })
      await load()
      if (currentId === conv._id && !conv.archived) {
        setCurrentId(null)
      }
      message.success(conv.archived ? '已取消归档' : '已归档')
      return true
    } catch {
      message.error('操作失败')
      return false
    }
  }, [currentId, load])

  // 开始编辑标题
  const startEdit = useCallback((id: string, title: string) => {
    setEditingId(id)
    setEditingTitle(title)
  }, [])

  // 保存标题
  const saveTitle = useCallback(async (id: string): Promise<boolean> => {
    if (!editingTitle.trim()) {
      setEditingId(null)
      return false
    }
    try {
      const res = await aiConversationApi.update(id, { title: editingTitle.trim() })
      setConversations(prev =>
        prev.map(c => c._id === id ? res.data.data : c)
      )
      setEditingId(null)
      return true
    } catch {
      message.error('保存失败')
      return false
    }
  }, [editingTitle])

  // 取消编辑
  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditingTitle('')
  }, [])

  // 添加对话到列表
  const addConversation = useCallback((conv: AIConversation) => {
    setConversations(prev => [conv, ...prev])
  }, [])

  return {
    conversations,
    currentId,
    filter,
    loading,
    editingId,
    editingTitle,
    select: setCurrentId,
    setFilter,
    create,
    remove,
    toggleStar,
    archive,
    startEdit,
    saveTitle,
    cancelEdit,
    setEditingTitle,
    reload: load,
    addConversation,
  }
}
