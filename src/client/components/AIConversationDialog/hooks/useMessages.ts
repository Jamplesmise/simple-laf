/**
 * 消息管理 Hook
 *
 * 处理消息列表、发送消息、流式输出
 */

import { useState, useCallback, useRef } from 'react'
import { message } from 'antd'
import { aiConversationApi, type AIMessage, type ChatMessage } from '@/api/aiConversation'
import { useFunctionStore, type CloudFunction } from '@/stores/function'
import type { StatusPanelData, ToolCallRecord } from '@/components/AI/StatusPanel/types'

export interface UseMessagesOptions {
  onConversationCreated?: (id: string) => void
  onMessageSent?: () => void
}

export interface UseMessagesReturn {
  // 消息状态
  messages: AIMessage[]
  loading: boolean
  sending: boolean
  // 流式输出
  streamContent: string
  streamStatus: string
  // Sprint 10.1: 状态面板数据
  statusPanelData: StatusPanelData
  // 操作
  loadMessages: (conversationId: string) => Promise<void>
  sendMessage: (params: SendMessageParams) => Promise<void>
  clearMessages: () => void
}

export interface SendMessageParams {
  conversationId: string | null
  content: string
  selectedFunctions: CloudFunction[]
  options?: {
    systemPromptId?: string
    modelId?: string
    enableThinking?: boolean
    analyzeLog?: boolean
    logDays?: number
    initialContext?: {
      selectedCode?: string
      functionId?: string
    }
  }
}

// 初始状态面板数据
const initialStatusPanelData: StatusPanelData = {
  status: 'idle',
  toolCalls: [],
}

export function useMessages(options: UseMessagesOptions = {}): UseMessagesReturn {
  const { onConversationCreated, onMessageSent } = options
  const { refreshList } = useFunctionStore()

  // 消息状态
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const [streamStatus, setStreamStatus] = useState('')

  // Sprint 10.1: 状态面板数据
  const [statusPanelData, setStatusPanelData] = useState<StatusPanelData>(initialStatusPanelData)

  // 流式输出引用
  const streamRef = useRef({ content: '', status: '' })

  // Sprint 10.1: 状态面板引用
  const statusRef = useRef<StatusPanelData>({ ...initialStatusPanelData })

  // 加载消息
  const loadMessages = useCallback(async (conversationId: string) => {
    setLoading(true)
    try {
      const res = await aiConversationApi.get(conversationId)
      setMessages(res.data.data.messages || [])
    } catch {
      message.error('加载消息失败')
    } finally {
      setLoading(false)
    }
  }, [])

  // 清空消息
  const clearMessages = useCallback(() => {
    setMessages([])
    setStreamContent('')
    setStreamStatus('')
  }, [])

  // 更新状态面板数据的辅助函数
  const updateStatusPanel = useCallback((updates: Partial<StatusPanelData>) => {
    statusRef.current = { ...statusRef.current, ...updates }
    setStatusPanelData({ ...statusRef.current })
  }, [])

  // 处理流式消息
  const handleStreamMessage = useCallback((msg: ChatMessage) => {
    switch (msg.status) {
      case 'user_message':
        updateStatusPanel({ status: 'thinking', statusMessage: '消息已发送' })
        break

      case 'thinking':
        streamRef.current.status = '🤔 正在思考...'
        setStreamStatus('🤔 正在思考...')
        updateStatusPanel({
          status: 'thinking',
          statusMessage: msg.message || 'AI 正在分析...',
          thinkingContent: msg.content,
        })
        break

      case 'generating':
        streamRef.current.content += msg.content || ''
        setStreamContent(streamRef.current.content)
        streamRef.current.status = ''
        setStreamStatus('')
        updateStatusPanel({ status: 'generating', statusMessage: '生成回复中...' })
        break

      case 'plan':
        // 显示具体要执行的操作
        if (msg.plan?.operations?.length) {
          const ops = msg.plan.operations.map(op => {
            const icons: Record<string, string> = {
              createFunction: '📝 创建函数',
              create_function: '📝 创建函数',
              updateFunction: '✏️ 修改函数',
              update_function: '✏️ 修改函数',
              deleteFunction: '🗑️ 删除函数',
              delete_function: '🗑️ 删除函数',
              debug_function: '🔧 调试函数',
              explain_code: '💡 解释代码',
              analyze_refactor: '🔄 重构分析',
            }
            return icons[op.type] || `⚡ ${op.type}`
          })
          const uniqueOps = [...new Set(ops)]
          streamRef.current.status = `🎯 准备执行: ${uniqueOps.join(', ')}`
          setStreamStatus(`🎯 准备执行: ${uniqueOps.join(', ')}`)
        } else {
          streamRef.current.status = '🎯 分析执行计划...'
          setStreamStatus('🎯 分析执行计划...')
        }
        updateStatusPanel({
          status: 'executing',
          statusMessage: '准备执行操作...',
          thinkingContent: msg.plan?.thinking,
        })
        break

      case 'executing':
        streamRef.current.status = '⚙️ 执行操作中...'
        setStreamStatus('⚙️ 执行操作中...')
        updateStatusPanel({ status: 'executing', statusMessage: '执行操作中...' })
        break

      // Sprint 10.1: 新增工具调用事件
      case 'tool_call':
        if (msg.toolCall) {
          const newToolCall: ToolCallRecord = {
            callId: msg.toolCall.callId,
            tool: msg.toolCall.tool,
            params: msg.toolCall.params,
            status: 'running',
            startTime: Date.now(),
          }
          const updatedCalls = [...statusRef.current.toolCalls, newToolCall]
          updateStatusPanel({ toolCalls: updatedCalls })
        }
        break

      // Sprint 10.1: 新增工具结果事件
      case 'tool_result':
        if (msg.toolResult) {
          const updatedCalls = statusRef.current.toolCalls.map(tc => {
            if (tc.callId === msg.toolResult!.callId) {
              return {
                ...tc,
                status: msg.toolResult!.success ? 'success' as const : 'error' as const,
                result: msg.toolResult!.result,
                duration: msg.toolResult!.duration,
                endTime: Date.now(),
              }
            }
            return tc
          })
          updateStatusPanel({ toolCalls: updatedCalls })
        }
        break

      // Sprint 10.1: 新增 Token 使用事件
      case 'token_usage':
        if (msg.tokenUsage) {
          updateStatusPanel({ tokenUsage: msg.tokenUsage })
        }
        break

      case 'done':
        streamRef.current.status = ''
        setStreamStatus('')
        updateStatusPanel({ status: 'done', statusMessage: '完成', endTime: Date.now() })
        break

      case 'error':
        streamRef.current.status = ''
        setStreamStatus('')
        message.error(msg.error || 'AI 处理出错')
        updateStatusPanel({ status: 'error', statusMessage: msg.error || 'AI 处理出错' })
        break
    }
  }, [updateStatusPanel])

  // 发送消息
  const sendMessage = useCallback(async (params: SendMessageParams) => {
    const { content, selectedFunctions, options = {} } = params
    let { conversationId } = params

    if (!content.trim() && selectedFunctions.length === 0) return
    if (sending) return

    // 如果没有对话，创建新对话
    if (!conversationId) {
      try {
        const res = await aiConversationApi.create()
        conversationId = res.data.data._id
        onConversationCreated?.(conversationId)
      } catch {
        message.error('创建对话失败')
        return
      }
    }

    // 构建用户消息
    // @ 引用的函数通过 referencedFunctionIds 传递给后端处理
    let userMessage = content.trim()
    const referencedFunctionIds = selectedFunctions.map(fn => fn._id)

    // 在消息中添加函数名称引用（供用户查看）
    if (selectedFunctions.length > 0) {
      const functionNames = selectedFunctions.map(fn => `@${fn.name}`).join(' ')
      userMessage = `${functionNames}\n\n${userMessage}`
    }

    // 重置流式输出状态
    streamRef.current = { content: '', status: '' }
    setSending(true)
    setStreamContent('')
    setStreamStatus('thinking')

    // Sprint 10.1: 重置状态面板
    statusRef.current = { ...initialStatusPanelData, status: 'thinking', startTime: Date.now() }
    setStatusPanelData({ ...statusRef.current })

    try {
      const generator = aiConversationApi.chat(conversationId, userMessage, {
        ...options.initialContext,
        systemPromptId: options.systemPromptId,
        modelId: options.modelId,
        enableThinking: options.enableThinking,
        analyzeLog: options.analyzeLog,
        logDays: options.logDays,
        // 发送引用的函数 ID，后端会查找完整代码
        referencedFunctionIds: referencedFunctionIds.length > 0 ? referencedFunctionIds : undefined,
      })

      for await (const msg of generator) {
        handleStreamMessage(msg)
      }

      // 刷新函数列表（AI 可能创建了新函数）
      refreshList()

      // 重新加载消息
      await loadMessages(conversationId)

      // 通知消息已发送
      onMessageSent?.()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '发送失败'
      message.error(errorMsg)
    } finally {
      setSending(false)
      setStreamContent('')
      setStreamStatus('')
    }
  }, [sending, handleStreamMessage, loadMessages, refreshList, onConversationCreated, onMessageSent])

  return {
    messages,
    loading,
    sending,
    streamContent,
    streamStatus,
    // Sprint 10.1: 状态面板数据
    statusPanelData,
    loadMessages,
    sendMessage,
    clearMessages,
  }
}
