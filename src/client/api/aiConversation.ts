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
  // Sprint 10.2 新增字段
  parentMessageId?: string
  version?: number
  feedback?: 'like' | 'dislike'
  feedbackNote?: string
  createdAt: string
  updatedAt?: string
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
  // Sprint 10.1: 新增状态事件类型
  | 'tool_call'
  | 'tool_result'
  | 'token_usage'

// Token 使用统计
export interface TokenUsage {
  input: number       // 输入 tokens
  output: number      // 输出 tokens
  total: number       // 总计
  cost: number        // 预估成本 (USD)
}

// 工具调用信息
export interface ToolCallInfo {
  tool: string
  params: Record<string, unknown>
  callId: string
}

// 工具调用结果
export interface ToolResultInfo {
  tool: string
  result: unknown
  success: boolean
  callId: string
  duration?: number
}

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
  // Sprint 10.1: 新增字段
  toolCall?: ToolCallInfo
  toolResult?: ToolResultInfo
  tokenUsage?: TokenUsage
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

  // ==================== Sprint 10.2: 消息操作 ====================

  // 编辑消息
  editMessage: (messageId: string, content: string) =>
    client.patch<{
      success: boolean
      data: {
        messageId: string
        version: number
        regenerating: boolean
        deletedCount: number
      }
    }>(`${API_BASE}/messages/${messageId}`, { content }),

  // 创建分支对话
  createBranch: (messageId: string, newContent?: string) =>
    client.post<{
      success: boolean
      data: {
        branchConversationId: string
        parentMessageId: string
        conversation: AIConversation
        messageCount: number
      }
    }>(`${API_BASE}/messages/${messageId}/branch`, { newContent }),

  // 消息反馈
  feedbackMessage: (
    messageId: string,
    feedback: 'like' | 'dislike' | null,
    note?: string
  ) =>
    client.post<{
      success: boolean
      data: {
        messageId: string
        feedback: 'like' | 'dislike' | null
        feedbackNote?: string
      }
    }>(`${API_BASE}/messages/${messageId}/feedback`, { feedback, note }),

  // ==================== Sprint 10.3: 上下文管理 ====================

  // 获取上下文统计
  getContextStats: (conversationId: string, model?: string) =>
    client.get<{ success: boolean; data: ContextStats }>(
      `${API_BASE}/conversations/${conversationId}/context`,
      { params: model ? { model } : {} }
    ),

  // 压缩上下文
  compressContext: (
    conversationId: string,
    options: CompressOptions
  ) =>
    client.post<{ success: boolean; data: CompressResult }>(
      `${API_BASE}/conversations/${conversationId}/compress`,
      options
    ),

  // 删除上下文项
  deleteContextItems: (conversationId: string, itemIds: string[]) =>
    client.delete<{ success: boolean; data: DeleteContextResult }>(
      `${API_BASE}/conversations/${conversationId}/context`,
      { data: { itemIds } }
    ),

  // ==================== Sprint 11.2: Canvas 代码快照 ====================

  // 获取快照列表
  getSnapshots: (conversationId: string, limit?: number) =>
    client.get<{ success: boolean; data: SnapshotListItem[] }>(
      `${API_BASE}/canvas/${conversationId}/snapshots`,
      { params: limit ? { limit } : {} }
    ),

  // 创建快照
  createSnapshot: (conversationId: string, request: CreateSnapshotRequest) =>
    client.post<{ success: boolean; data: CreateSnapshotResponse }>(
      `${API_BASE}/canvas/${conversationId}/snapshot`,
      request
    ),

  // 获取快照详情
  getSnapshot: (snapshotId: string) =>
    client.get<{ success: boolean; data: SnapshotDetail }>(
      `${API_BASE}/canvas/snapshot/${snapshotId}`
    ),

  // 删除快照
  deleteSnapshot: (snapshotId: string) =>
    client.delete<{ success: boolean; message: string }>(
      `${API_BASE}/canvas/snapshot/${snapshotId}`
    ),

  // 对比快照
  compareSnapshots: (snapshotId: string, baseSnapshotId?: string) =>
    client.post<{ success: boolean; data: CompareSnapshotsResponse }>(
      `${API_BASE}/canvas/snapshot/${snapshotId}/compare`,
      { baseSnapshotId }
    ),

  // 计算 Diff
  calculateDiff: (before: string, after: string) =>
    client.post<{ success: boolean; data: DiffResult }>(
      `${API_BASE}/canvas/diff`,
      { before, after }
    ),

  // 应用代码到函数
  applySnapshotToFunction: (snapshotId: string, functionId: string) =>
    client.post<{ success: boolean; message: string }>(
      `${API_BASE}/canvas/apply`,
      { snapshotId, functionId }
    ),

  // ==================== Sprint 16.1: 精准更新 ====================

  // 获取智能上下文（自动判断修改类型）
  getSmartContext: (functionId: string, request: string) =>
    client.post<{ success: boolean; data: SmartContextResult }>(
      `${API_BASE}/functions/${functionId}/smart-context`,
      { request }
    ),

  // 获取精准上下文（指定行号范围）
  getPreciseContext: (
    functionId: string,
    range: { startLine: number; endLine: number },
    contextLines?: number
  ) =>
    client.post<{ success: boolean; data: MinimalContextResult }>(
      `${API_BASE}/functions/${functionId}/precise-context`,
      { range, contextLines }
    ),

  // 应用精准更新
  applyPreciseUpdate: (
    functionId: string,
    newCode: string,
    range: { startLine: number; endLine: number }
  ) =>
    client.post<{ success: boolean; data: PreciseUpdateResult }>(
      `${API_BASE}/functions/${functionId}/precise-update`,
      { newCode, range }
    ),

  // 分析修改类型
  analyzeChangeType: (request: string) =>
    client.post<{ success: boolean; data: ChangeTypeAnalysis }>(
      `${API_BASE}/analyze-change-type`,
      { request }
    ),

  // ==================== Sprint 16.2: Plan 模式 ====================

  // 检查是否应该触发 Plan 模式
  checkPlanTrigger: (request: string) =>
    client.post<{ success: boolean; data: PlanTriggerResult }>(
      `${API_BASE}/plan/check`,
      { request }
    ),

  // 生成执行计划
  generatePlan: (
    conversationId: string,
    request: string,
    context?: { functionIds?: string[]; currentCode?: string }
  ) =>
    client.post<{ success: boolean; data: ExecutionPlan }>(
      `${API_BASE}/plan/generate`,
      { conversationId, request, context }
    ),

  // 获取计划详情
  getPlan: (planId: string) =>
    client.get<{ success: boolean; data: ExecutionPlan }>(
      `${API_BASE}/plan/${planId}`
    ),

  // 更新步骤选择
  updatePlanSteps: (planId: string, stepIds: string[], selected: boolean) =>
    client.patch<{ success: boolean; data: ExecutionPlan }>(
      `${API_BASE}/plan/${planId}/steps`,
      { stepIds, selected }
    ),

  // 执行计划 (SSE 流式)
  executePlan: async function* (
    planId: string,
    stepIds?: string[]
  ): AsyncGenerator<{ type: string } & Partial<StepResult>, void, unknown> {
    const token = useAuthStore.getState().token

    const response = await fetch(`${API_BASE}/plan/${planId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ stepIds }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || '执行计划失败')
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
              const data = JSON.parse(line.slice(6))
              yield data
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      if (buffer.startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.slice(6))
          yield data
        } catch {
          // 忽略
        }
      }
    } finally {
      reader.releaseLock()
    }
  },

  // 暂停计划
  pausePlan: (planId: string) =>
    client.post<{ success: boolean; message: string }>(
      `${API_BASE}/plan/${planId}/pause`
    ),

  // 恢复计划
  resumePlan: (planId: string) =>
    client.post<{ success: boolean; message: string }>(
      `${API_BASE}/plan/${planId}/resume`
    ),

  // 停止计划
  stopPlan: (planId: string) =>
    client.post<{ success: boolean; message: string }>(
      `${API_BASE}/plan/${planId}/stop`
    ),

  // 获取计划列表
  getPlans: (options?: { limit?: number; state?: PlanModeState }) =>
    client.get<{ success: boolean; data: ExecutionPlan[] }>(
      `${API_BASE}/plans`,
      { params: options }
    ),

  // 删除计划
  deletePlan: (planId: string) =>
    client.delete<{ success: boolean; message: string }>(
      `${API_BASE}/plan/${planId}`
    ),

  // ==================== Sprint 12.2: 导出功能 ====================

  // 导出对话 (JSON 格式)
  exportAsJson: (conversationId: string) =>
    client.get<{ success: boolean; data: ExportData }>(
      `${API_BASE}/conversations/${conversationId}/export`,
      { params: { format: 'json' } }
    ),

  // 导出对话 (Markdown 格式) - 返回文件下载
  exportAsMarkdown: async (conversationId: string): Promise<Blob> => {
    const token = useAuthStore.getState().token
    const response = await fetch(
      `${API_BASE}/conversations/${conversationId}/export?format=markdown`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    )
    if (!response.ok) {
      throw new Error('导出失败')
    }
    return response.blob()
  },
}

// ==================== Sprint 10.3: 上下文类型定义 ====================

// 上下文项类型
export type ContextItemType = 'system' | 'message' | 'code' | 'tool_result'

// 单个上下文项
export interface ContextItem {
  id: string
  type: ContextItemType
  source: string
  tokens: number
  content: string
  removable: boolean
  compressible: boolean
  messageId?: string
  createdAt?: string
}

// 上下文使用量
export interface ContextUsage {
  used: number
  total: number
  percentage: number
}

// 分类统计
export interface ContextCategoryStats {
  system: number
  messages: number
  code: number
  toolResults: number
}

// 完整上下文统计
export interface ContextStats {
  usage: ContextUsage
  categories: ContextCategoryStats
  items: ContextItem[]
  warningThreshold: number
  isWarning: boolean
}

// 压缩模式
export type CompressMode = 'smart' | 'manual'

// 压缩选项
export interface CompressOptions {
  mode: CompressMode
  targetPercentage?: number
  itemIds?: string[]
}

// 压缩结果
export interface CompressResult {
  success: boolean
  before: number
  after: number
  saved: number
  percentage: number
  actions: string[]
  message?: string
}

// 删除结果
export interface DeleteContextResult {
  success: boolean
  deleted: number
  tokensSaved: number
  newPercentage: number
}

// ==================== Sprint 11.2: Canvas 类型定义 ====================

// 快照列表项
export interface SnapshotListItem {
  id: string
  version: number
  description?: string
  createdAt: string
  codePreview?: string
}

// 创建快照请求
export interface CreateSnapshotRequest {
  functionId?: string
  messageId?: string
  code: string
  language?: string
  description?: string
}

// 创建快照响应
export interface CreateSnapshotResponse {
  id: string
  version: number
}

// 快照详情
export interface SnapshotDetail {
  id: string
  conversationId: string
  messageId?: string
  functionId?: string
  version: number
  code: string
  language?: string
  description?: string
  createdAt: string
}

// Diff 变更类型
export type DiffChangeType = 'add' | 'remove' | 'equal'

// Diff 变更项
export interface DiffChange {
  type: DiffChangeType
  content: string
  lineStart: number
  lineEnd: number
}

// Diff 统计
export interface DiffStats {
  added: number
  removed: number
  modified: number
}

// Diff 结果
export interface DiffResult {
  changes: DiffChange[]
  stats: DiffStats
}

// 快照对比响应
export interface CompareSnapshotsResponse {
  diff: DiffResult
  baseCode: string
  targetCode: string
}

// ==================== Sprint 12.2: 导出类型定义 ====================

// 导出数据结构
export interface ExportData {
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
    createdAt: string
  }>
}

// ==================== Sprint 16.2: Plan 模式类型定义 ====================

// Plan 模式状态
export type PlanModeState =
  | 'off'
  | 'planning'
  | 'reviewing'
  | 'executing'
  | 'paused'
  | 'completed'
  | 'failed'

// 步骤类型
export type StepType = 'create' | 'update' | 'delete' | 'test' | 'analyze' | 'refactor'

// 步骤状态
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

// 计划步骤
export interface PlanStep {
  id: string
  order: number
  title: string
  description?: string
  type: StepType
  status: StepStatus
  selected: boolean
  targetFile?: string
  estimatedTokens?: number
  result?: {
    success: boolean
    message?: string
    error?: string
    duration?: number
  }
}

// 影响分析
export interface ImpactAnalysis {
  newFiles: string[]
  modifiedFiles: string[]
  deletedFiles: string[]
  riskLevel: 'low' | 'medium' | 'high'
  riskFactors: string[]
}

// 执行计划
export interface ExecutionPlan {
  id: string
  conversationId: string
  userId: string
  title: string
  originalRequest: string
  analysis: {
    currentState: string
    issues: string[]
    goals: string[]
  }
  steps: PlanStep[]
  impact: ImpactAnalysis
  state: PlanModeState
  createdAt: string
  updatedAt: string
  completedAt?: string
}

// 步骤执行结果
export interface StepResult {
  stepId: string
  status: StepStatus
  message?: string
  error?: string
  duration?: number
  output?: unknown
}

// Plan 触发检查结果
export interface PlanTriggerResult {
  shouldTrigger: boolean
  reason?: string
}

// ==================== Sprint 16.1: 精准更新类型定义 ====================

// 修改类型
export type ChangeType = 'minor' | 'moderate' | 'refactor'

// 精准更新请求
export interface PreciseUpdateRequest {
  functionId: string
  range?: {
    startLine: number
    endLine: number
  }
  contextLines?: number
}

// 最小上下文结果
export interface MinimalContextResult {
  functionId: string
  functionName: string
  fullCode: string
  contextCode: string
  range: {
    startLine: number
    endLine: number
  }
  actualRange: {
    startLine: number
    endLine: number
  }
  totalLines: number
  tokensSaved: number
  savingsPercentage: number
  prompt: string
}

// 智能上下文结果
export interface SmartContextResult {
  changeType: ChangeType
  useMinimalContext: boolean
  context: MinimalContextResult | { fullCode: string; tokensSaved: number }
  prompt: string | null
}

// 精准更新结果
export interface PreciseUpdateResult {
  success: boolean
  functionId: string
  originalCode: string
  updatedCode: string
  changedLines: {
    startLine: number
    endLine: number
  }
  message?: string
  error?: string
  validation: {
    valid: boolean
    issues: string[]
  }
}

// 修改类型分析结果
export interface ChangeTypeAnalysis {
  changeType: ChangeType
  description: string
  suggestedContextLines: number | string
}

// ==================== Sprint 12.3: 文件上传类型定义 ====================

// 上传文件信息
export interface UploadedFile {
  id: string
  name: string
  type: string
  size: number
  content?: string
  tokens: number
  createdAt?: string
}

// 文件上传 API
export const fileUploadApi = {
  // 上传文件
  upload: async (conversationId: string, file: File): Promise<UploadedFile> => {
    const token = useAuthStore.getState().token
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(
      `${API_BASE}/conversations/${conversationId}/files`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || '上传失败')
    }

    const result = await response.json()
    return result.data
  },

  // 获取文件列表
  list: (conversationId: string) =>
    client.get<{ success: boolean; data: UploadedFile[] }>(
      `${API_BASE}/conversations/${conversationId}/files`
    ),

  // 删除文件
  delete: (conversationId: string, fileId: string) =>
    client.delete<{ success: boolean }>(
      `${API_BASE}/conversations/${conversationId}/files/${fileId}`
    ),
}
