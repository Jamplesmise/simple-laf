import { create } from 'zustand'
import { functionApi } from '../api/functions'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

export interface CloudFunction {
  _id: string
  name: string
  code: string
  compiled: string
  published: boolean
  publishedAt?: string
  methods?: HttpMethod[]
  description?: string
  tags?: string[]
  folderId?: string
  path?: string
  createdAt: string
  updatedAt: string
}

interface FunctionState {
  functions: CloudFunction[]
  current: CloudFunction | null
  openTabs: CloudFunction[]
  loading: boolean
  // 追踪最新发布版本的代码，用于显示未发布标记
  lastPublishedCodes: Record<string, string>
  setFunctions: (functions: CloudFunction[]) => void
  setCurrent: (fn: CloudFunction | null) => void
  setLoading: (loading: boolean) => void
  updateCurrent: (updates: Partial<CloudFunction>) => void
  refreshCurrent: () => Promise<void>
  // Tab management
  openTab: (fn: CloudFunction) => void
  closeTab: (fnId: string) => void
  closeOtherTabs: (fnId: string) => void
  closeAllTabs: () => void
  // 检查函数是否有未发布的更改
  hasUnpublishedChanges: (fnId: string) => boolean
  // 加载函数的最新发布版本代码
  loadLastPublishedCode: (fnId: string) => Promise<void>
  // 设置函数的最新发布代码（发布成功后调用，从 store 当前状态获取代码）
  setLastPublishedCode: (fnId: string) => void
  // 刷新函数列表
  refreshList: () => Promise<void>
}

export const useFunctionStore = create<FunctionState>((set, get) => ({
  functions: [],
  current: null,
  openTabs: [],
  loading: false,
  lastPublishedCodes: {},
  setFunctions: (functions) => set({ functions }),
  setCurrent: (current) => set({ current }),
  setLoading: (loading) => set({ loading }),
  updateCurrent: (updates) =>
    set((state) => ({
      current: state.current ? { ...state.current, ...updates } : null,
      // Also update in openTabs
      openTabs: state.openTabs.map((tab) =>
        tab._id === state.current?._id ? { ...tab, ...updates } : tab
      ),
    })),
  refreshCurrent: async () => {
    const { current, loadLastPublishedCode } = get()
    if (!current) return
    try {
      const res = await functionApi.get(current._id)
      const updated = res.data.data
      set((state) => ({
        current: updated,
        openTabs: state.openTabs.map((tab) =>
          tab._id === updated._id ? updated : tab
        ),
      }))
      // 同时刷新最新发布版本的代码
      loadLastPublishedCode(updated._id)
    } catch {
      // 静默失败
    }
  },
  openTab: (fn) => {
    const { loadLastPublishedCode } = get()
    set((state) => {
      const exists = state.openTabs.find((tab) => tab._id === fn._id)
      if (exists) {
        return { current: fn }
      }
      return { openTabs: [...state.openTabs, fn], current: fn }
    })
    // 打开标签时加载最新发布版本代码
    loadLastPublishedCode(fn._id)
  },
  closeTab: (fnId) =>
    set((state) => {
      const newTabs = state.openTabs.filter((tab) => tab._id !== fnId)
      const newCurrent =
        state.current?._id === fnId
          ? newTabs[newTabs.length - 1] || null
          : state.current
      return { openTabs: newTabs, current: newCurrent }
    }),
  closeOtherTabs: (fnId) =>
    set((state) => ({
      openTabs: state.openTabs.filter((tab) => tab._id === fnId),
    })),
  closeAllTabs: () => set({ openTabs: [], current: null }),
  hasUnpublishedChanges: (fnId: string) => {
    const { openTabs, lastPublishedCodes } = get()
    const tab = openTabs.find((t) => t._id === fnId)
    if (!tab) return false
    const lastPublished = lastPublishedCodes[fnId]
    // 如果没有发布过，任何代码都算未发布
    if (lastPublished === undefined) return true
    return tab.code !== lastPublished
  },
  loadLastPublishedCode: async (fnId: string) => {
    try {
      const res = await functionApi.getVersions(fnId)
      const versions = res.data.data
      if (versions && versions.length > 0) {
        const detailRes = await functionApi.getVersion(fnId, versions[0].version)
        const code = detailRes.data.data?.code || ''
        set((state) => ({
          lastPublishedCodes: { ...state.lastPublishedCodes, [fnId]: code },
        }))
      } else {
        // 没有发布过，设置为空字符串表示"从未发布"
        set((state) => ({
          lastPublishedCodes: { ...state.lastPublishedCodes, [fnId]: '' },
        }))
      }
    } catch {
      // 静默失败
    }
  },
  setLastPublishedCode: (fnId) => {
    // 从当前 store 状态获取代码，避免闭包问题
    const tab = get().openTabs.find(t => t._id === fnId)
    if (tab) {
      set((state) => ({
        lastPublishedCodes: { ...state.lastPublishedCodes, [fnId]: tab.code },
      }))
    }
  },
  refreshList: async () => {
    try {
      const res = await functionApi.list()
      set({ functions: res.data.data || [] })
    } catch {
      // 静默失败
    }
  },
}))
