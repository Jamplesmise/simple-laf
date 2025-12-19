import { create } from 'zustand'
import {
  aiApi,
  aiStreamApi,
  executeStream,
  type AIConfig,
  type AIProvider,
  type ModelInfo,
  type AIHistory,
  type AIExecuteStatus,
  type AIExecuteContext,
  type AIOperationResult
} from '../api/ai'

// AIActionType 已废弃，保留以兼容
type AIActionType = 'generate' | 'refactor' | 'diagnose' | 'explain' | 'execute' | null

// AI 执行状态
interface ExecuteState {
  status: AIExecuteStatus | null
  message: string
  thinking: string
  operations: Array<{ type: string; description: string }>
  summary: string
  results: AIOperationResult[]
}

interface AIState {
  // 配置
  config: AIConfig | null
  configLoading: boolean

  // 模型列表
  models: ModelInfo[]
  modelsLoading: boolean

  // 生成状态
  isGenerating: boolean
  currentOutput: string
  generateError: string | null

  // 执行状态 (直接操作模式)
  executeState: ExecuteState

  // 历史记录
  history: AIHistory[]
  historyLoading: boolean

  // 面板状态 (右键菜单触发)
  panelVisible: boolean
  pendingAction: AIActionType
  pendingCode: string
  pendingPrompt: string

  // 对话窗口状态
  conversationDialogOpen: boolean
  conversationContext: {
    selectedCode?: string
    functionId?: string
  } | null

  // Actions
  loadConfig: () => Promise<void>
  saveConfig: (data: {
    provider: AIProvider
    model: string
    apiKey?: string
    baseUrl?: string
    params?: { temperature: number; maxTokens: number }
  }) => Promise<boolean>
  testConnection: () => Promise<{ success: boolean; message: string }>
  loadModels: () => Promise<void>
  loadProviderModels: (provider: AIProvider) => Promise<void>

  // 生成函数
  generateFunction: (prompt: string, context?: Record<string, unknown>) => Promise<string>
  generateMultiFunctions: (prompt: string, folderId?: string) => Promise<string>
  refactorFunction: (code: string, functionName?: string) => Promise<string>
  diagnoseError: (code: string, error: string, errorStack?: string) => Promise<string>
  stopGenerating: () => void
  clearOutput: () => void

  // 执行操作 (直接创建/修改)
  executeAction: (prompt: string, context?: AIExecuteContext) => Promise<boolean>
  clearExecuteState: () => void

  // 历史
  loadHistory: () => Promise<void>
  deleteHistory: (id: string) => Promise<void>

  // 面板控制
  showPanel: (action?: AIActionType, code?: string, prompt?: string) => void
  hidePanel: () => void
  setPendingAction: (action: AIActionType) => void

  // 对话窗口控制
  openConversationDialog: (context?: { selectedCode?: string; functionId?: string }) => void
  closeConversationDialog: () => void
}

const initialExecuteState: ExecuteState = {
  status: null,
  message: '',
  thinking: '',
  operations: [],
  summary: '',
  results: [],
}

export const useAIStore = create<AIState>((set, get) => ({
  config: null,
  configLoading: false,
  models: [],
  modelsLoading: false,
  isGenerating: false,
  currentOutput: '',
  generateError: null,
  executeState: { ...initialExecuteState },
  history: [],
  historyLoading: false,
  panelVisible: false,
  pendingAction: null,
  pendingCode: '',
  pendingPrompt: '',
  conversationDialogOpen: false,
  conversationContext: null,

  loadConfig: async () => {
    set({ configLoading: true })
    try {
      const res = await aiApi.getConfig()
      set({ config: res.data.data })
    } catch {
      // 静默失败
    } finally {
      set({ configLoading: false })
    }
  },

  saveConfig: async (data) => {
    try {
      await aiApi.saveConfig(data)
      // 重新加载配置
      await get().loadConfig()
      return true
    } catch {
      return false
    }
  },

  testConnection: async () => {
    try {
      const res = await aiApi.testConnection()
      return res.data.data
    } catch (err) {
      const message = err instanceof Error ? err.message : '测试失败'
      return { success: false, message }
    }
  },

  loadModels: async () => {
    set({ modelsLoading: true })
    try {
      const res = await aiApi.getModels()
      set({ models: res.data.data })
    } catch {
      // 静默失败
    } finally {
      set({ modelsLoading: false })
    }
  },

  loadProviderModels: async (provider) => {
    set({ modelsLoading: true })
    try {
      const res = await aiApi.getProviderModels(provider)
      set({ models: res.data.data })
    } catch {
      // 静默失败
    } finally {
      set({ modelsLoading: false })
    }
  },

  generateFunction: async (prompt, context) => {
    set({ isGenerating: true, currentOutput: '', generateError: null })

    let fullContent = ''

    try {
      for await (const chunk of aiStreamApi.generate(prompt, context)) {
        if (chunk.error) {
          set({ generateError: chunk.error })
          break
        }
        if (chunk.content) {
          fullContent += chunk.content
          set({ currentOutput: fullContent })
        }
        if (chunk.done) {
          break
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '生成失败'
      set({ generateError: message })
    } finally {
      set({ isGenerating: false })
    }

    return fullContent
  },

  generateMultiFunctions: async (prompt, folderId) => {
    set({ isGenerating: true, currentOutput: '', generateError: null })

    let fullContent = ''

    try {
      for await (const chunk of aiStreamApi.generateMulti(prompt, folderId)) {
        if (chunk.error) {
          set({ generateError: chunk.error })
          break
        }
        if (chunk.content) {
          fullContent += chunk.content
          set({ currentOutput: fullContent })
        }
        if (chunk.done) {
          break
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '生成失败'
      set({ generateError: message })
    } finally {
      set({ isGenerating: false })
    }

    return fullContent
  },

  refactorFunction: async (code, functionName) => {
    set({ isGenerating: true, currentOutput: '', generateError: null })

    let fullContent = ''

    try {
      for await (const chunk of aiStreamApi.refactor(code, functionName)) {
        if (chunk.error) {
          set({ generateError: chunk.error })
          break
        }
        if (chunk.content) {
          fullContent += chunk.content
          set({ currentOutput: fullContent })
        }
        if (chunk.done) {
          break
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '分析失败'
      set({ generateError: message })
    } finally {
      set({ isGenerating: false })
    }

    return fullContent
  },

  diagnoseError: async (code, error, errorStack) => {
    set({ isGenerating: true, currentOutput: '', generateError: null })

    let fullContent = ''

    try {
      for await (const chunk of aiStreamApi.diagnose(code, error, errorStack)) {
        if (chunk.error) {
          set({ generateError: chunk.error })
          break
        }
        if (chunk.content) {
          fullContent += chunk.content
          set({ currentOutput: fullContent })
        }
        if (chunk.done) {
          break
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '诊断失败'
      set({ generateError: message })
    } finally {
      set({ isGenerating: false })
    }

    return fullContent
  },

  stopGenerating: () => {
    set({ isGenerating: false })
  },

  clearOutput: () => {
    set({ currentOutput: '', generateError: null })
  },

  // 执行 AI 操作 (直接创建/修改函数)
  executeAction: async (prompt, context) => {
    set({
      isGenerating: true,
      currentOutput: '',
      generateError: null,
      executeState: { ...initialExecuteState, status: 'thinking', message: 'AI 正在分析...' }
    })

    let success = false

    try {
      for await (const msg of executeStream(prompt, context)) {
        switch (msg.status) {
          case 'thinking':
            set({
              executeState: {
                ...get().executeState,
                status: 'thinking',
                message: msg.message || 'AI 正在思考...'
              }
            })
            break

          case 'generating':
            if (msg.content) {
              set({
                currentOutput: get().currentOutput + msg.content,
                executeState: {
                  ...get().executeState,
                  status: 'generating',
                  message: '正在生成计划...'
                }
              })
            }
            break

          case 'plan':
            if (msg.plan) {
              set({
                executeState: {
                  ...get().executeState,
                  status: 'plan',
                  message: '计划已生成',
                  thinking: msg.plan.thinking || '',
                  operations: msg.plan.operations,
                  summary: msg.plan.summary
                }
              })
            }
            break

          case 'executing':
            set({
              executeState: {
                ...get().executeState,
                status: 'executing',
                message: msg.message || '正在执行操作...'
              }
            })
            break

          case 'done':
            if (msg.result) {
              success = msg.result.success
              set({
                executeState: {
                  ...get().executeState,
                  status: 'done',
                  message: msg.result.message,
                  results: msg.result.results
                }
              })
            }
            break

          case 'error':
            set({
              generateError: msg.error || '执行失败',
              executeState: {
                ...get().executeState,
                status: 'error',
                message: msg.error || '执行失败'
              }
            })
            break
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '执行失败'
      set({
        generateError: message,
        executeState: {
          ...get().executeState,
          status: 'error',
          message
        }
      })
    } finally {
      set({ isGenerating: false })
    }

    return success
  },

  clearExecuteState: () => {
    set({ executeState: { ...initialExecuteState } })
  },

  loadHistory: async () => {
    set({ historyLoading: true })
    try {
      const res = await aiApi.getHistory({ limit: 50 })
      set({ history: res.data.data })
    } catch {
      // 静默失败
    } finally {
      set({ historyLoading: false })
    }
  },

  deleteHistory: async (id) => {
    try {
      await aiApi.deleteHistory(id)
      set((state) => ({
        history: state.history.filter((h) => h._id !== id)
      }))
    } catch {
      // 静默失败
    }
  },

  showPanel: (action = null, code = '', prompt = '') => {
    set({
      panelVisible: true,
      pendingAction: action,
      pendingCode: code,
      pendingPrompt: prompt,
      currentOutput: '',
      generateError: null,
    })
  },

  hidePanel: () => {
    set({
      panelVisible: false,
      pendingAction: null,
      pendingCode: '',
      pendingPrompt: '',
    })
  },

  setPendingAction: (action) => {
    set({ pendingAction: action })
  },

  openConversationDialog: (context) => {
    set({
      conversationDialogOpen: true,
      conversationContext: context || null
    })
  },

  closeConversationDialog: () => {
    set({
      conversationDialogOpen: false,
      conversationContext: null
    })
  },
}))
