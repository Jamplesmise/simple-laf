import client from './client'
import { useAuthStore } from '../stores/auth'

const API_BASE = '/api/ai'

// 对话接口
export interface AIConversation {
  _id: string
  userId: string
  title: string
  archived: boolean
  starred: boolean
  systemPromptId?: string
  createdAt: string
  updatedAt: string
}

// 消息接口
export interface AIMessage {
  _id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  executionResult?: {
    success: boolean
    operations?: Array<{
      type: string
      success: boolean
      error?: string
    }>
  }
  createdAt: string
}

// 对话详情响应
export interface ConversationDetail {
  conversation: AIConversation
  messages: AIMessage[]
}

// SSE 消息类型
export type ChatStatus =
  | 'user_message'
  | 'thinking'
  | 'generating'
  | 'plan'
  | 'executing'
  | 'done'
  | 'error'

export interface ChatMessage {
  status: ChatStatus
  messageId?: string
  message?: string
  content?: string
  plan?: {
    thinking: string
    operations: Array<{ type: string; description: string }>
    summary: string
  }
  result?: {
    success: boolean
    message: string
    results?: Array<{
      type: string
      success: boolean
      error?: string
      result?: unknown
    }>
  }
  error?: string
}

// 对话管理 API
export const aiConversationApi = {
  // 获取对话列表
  list: (filter?: { archived?: boolean; starred?: boolean }) =>
    client.get<{ success: boolean; data: AIConversation[] }>(
      `${API_BASE}/conversations`,
      { params: filter }
    ),

  // 创建对话
  create: (data?: { title?: string; systemPromptId?: string }) =>
    client.post<{ success: boolean; data: AIConversation }>(
      `${API_BASE}/conversations`,
      data
    ),

  // 获取对话详情
  get: (id: string) =>
    client.get<{ success: boolean; data: ConversationDetail }>(
      `${API_BASE}/conversations/${id}`
    ),

  // 更新对话
  update: (id: string, data: { title?: string; archived?: boolean; starred?: boolean }) =>
    client.patch<{ success: boolean; data: AIConversation }>(
      `${API_BASE}/conversations/${id}`,
      data
    ),

  // 删除对话
  delete: (id: string) =>
    client.delete<{ success: boolean }>(
      `${API_BASE}/conversations/${id}`
    ),

  // 发送消息 (SSE 流式)
  chat: async function* (
    conversationId: string,
    message: string,
    context?: {
      selectedCode?: string
      systemPromptId?: string
      modelId?: string
      enableThinking?: boolean
      // @ 引用的函数 ID 列表
      referencedFunctionIds?: string[]
      // 日志分析参数
      analyzeLog?: boolean
      logDays?: number
      logFunctionId?: string
    }
  ): AsyncGenerator<ChatMessage, void, unknown> {
    const token = useAuthStore.getState().token

    const response = await fetch(`${API_BASE}/conversations/${conversationId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        message,
        context: {
          selectedCode: context?.selectedCode,
          systemPromptId: context?.systemPromptId,
          // @ 引用的函数 ID 列表
          referencedFunctionIds: context?.referencedFunctionIds,
          // 日志分析参数
          analyzeLog: context?.analyzeLog,
          logDays: context?.logDays,
          logFunctionId: context?.logFunctionId,
        },
        modelId: context?.modelId,
        enableThinking: context?.enableThinking,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || '发送消息失败')
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as ChatMessage
              yield data
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      // 处理剩余 buffer
      if (buffer.startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.slice(6)) as ChatMessage
          yield data
        } catch {
          // 忽略
        }
      }
    } finally {
      reader.releaseLock()
    }
  },
}
