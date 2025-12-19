import client from './client'
import { useAuthStore } from '../stores/auth'

// AI 供应商类型
export type AIProvider = 'openai' | 'anthropic' | 'ollama' | 'custom'

// AI 配置
export interface AIConfig {
  _id?: string
  provider: AIProvider
  model: string
  apiKeyMasked: string
  baseUrl?: string
  params: {
    temperature: number
    maxTokens: number
  }
}

// 模型信息
export interface ModelInfo {
  id: string
  name: string
}

// AI 历史记录
export interface AIHistory {
  _id: string
  action: string
  prompt: string
  response: string
  model: string
  tokensUsed?: number
  createdAt: string
}

interface ConfigResponse {
  success: boolean
  data: AIConfig | null
}

interface ModelsResponse {
  success: boolean
  data: ModelInfo[]
}

interface TestResponse {
  success: boolean
  data: { success: boolean; message: string }
}

interface HistoryResponse {
  success: boolean
  data: AIHistory[]
}

export const aiApi = {
  // 配置相关
  getConfig: () => client.get<ConfigResponse>('/api/ai/config'),

  saveConfig: (data: {
    provider: AIProvider
    model: string
    apiKey?: string
    baseUrl?: string
    params?: { temperature: number; maxTokens: number }
  }) => client.put<{ success: boolean }>('/api/ai/config', data),

  testConnection: () => client.post<TestResponse>('/api/ai/config/test'),

  getModels: () => client.get<ModelsResponse>('/api/ai/models'),

  getProviderModels: (provider: AIProvider) =>
    client.get<ModelsResponse>(`/api/ai/models/${provider}`),

  // 历史记录
  getHistory: (params?: { limit?: number; offset?: number; functionId?: string }) =>
    client.get<HistoryResponse>('/api/ai/history', { params }),

  deleteHistory: (id: string) =>
    client.delete<{ success: boolean }>(`/api/ai/history/${id}`),
}

// SSE 流式请求封装
export async function* streamRequest(
  url: string,
  body: Record<string, unknown>
): AsyncGenerator<{ content?: string; done?: boolean; error?: string }> {
  const token = useAuthStore.getState().token

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: '请求失败' } }))
    yield { error: error.error?.message || '请求失败' }
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    yield { error: '无法读取响应' }
    return
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
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        try {
          const json = JSON.parse(trimmed.slice(6))
          yield json
        } catch {
          // 忽略解析错误
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// AI 功能 API (流式)
export const aiStreamApi = {
  generate: (prompt: string, context?: Record<string, unknown>) =>
    streamRequest('/api/ai/generate', { prompt, context }),

  generateMulti: (prompt: string, folderId?: string, context?: Record<string, unknown>) =>
    streamRequest('/api/ai/generate-multi', { prompt, folderId, context }),

  refactor: (code: string, functionName?: string) =>
    streamRequest('/api/ai/refactor', { code, functionName }),

  diagnose: (code: string, error: string, errorStack?: string) =>
    streamRequest('/api/ai/diagnose', { code, error, errorStack }),
}

// ============ 合并分析 API ============

// 合并分析状态
export type MergeAnalyzeStatus = 'analyzing' | 'generating' | 'done' | 'error'

// 合并计划
export interface MergePlan {
  analysis: string
  shouldMerge: boolean
  reason: string
  mergedFunction?: {
    name: string
    code: string
    description: string
  }
}

// 合并分析消息
export interface MergeAnalyzeMessage {
  status: MergeAnalyzeStatus
  message?: string
  content?: string
  plan?: MergePlan
  error?: string
}

// 合并分析流式 API
export async function* mergeAnalyzeStream(
  functions: Array<{ name: string; code: string }>,
  modelId?: string
): AsyncGenerator<MergeAnalyzeMessage> {
  const token = useAuthStore.getState().token

  const response = await fetch('/api/ai/merge-analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ functions, modelId })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: '请求失败' } }))
    yield { status: 'error', error: error.error?.message || '请求失败' }
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    yield { status: 'error', error: '无法读取响应' }
    return
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
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        try {
          const json = JSON.parse(trimmed.slice(6))
          yield json as MergeAnalyzeMessage
        } catch {
          // 忽略解析错误
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// 确认执行合并
export async function confirmMerge(
  folderId: string | null,
  plan: MergePlan,
  originalFunctionIds?: string[]
): Promise<{ success: boolean; error?: string; results?: Array<{ type: string; name: string; success: boolean; error?: string }> }> {
  try {
    const response = await client.post<{
      success: boolean
      data: {
        success: boolean
        message: string
        results: Array<{ type: string; name: string; success: boolean; error?: string }>
      }
    }>('/api/ai/merge/confirm', { folderId, plan, originalFunctionIds })
    return {
      success: response.data.data.success,
      results: response.data.data.results
    }
  } catch (err) {
    const error = err as { response?: { data?: { error?: { message?: string } } } }
    return {
      success: false,
      error: error.response?.data?.error?.message || '执行合并失败'
    }
  }
}

// ============ AI Action 执行系统 ============

// AI 操作类型
export type AIOperationType =
  | 'createFunction'
  | 'updateFunction'
  | 'deleteFunction'
  | 'renameFunction'
  | 'createFolder'
  | 'moveFunction'

// AI 操作
export interface AIOperation {
  type: AIOperationType
  description?: string
  // createFunction
  name?: string
  code?: string
  folderId?: string
  // updateFunction
  functionId?: string
  // renameFunction
  newName?: string
  // createFolder
  parentId?: string
  // moveFunction
  targetFolderId?: string
}

// AI 执行计划
export interface AIExecutionPlan {
  thinking?: string
  operations: AIOperation[]
  summary: string
}

// AI 操作执行结果
export interface AIOperationResult {
  type: AIOperationType
  success: boolean
  error?: string
  result?: {
    functionId?: string
    folderId?: string
    name?: string
  }
}

// AI 执行状态消息
export type AIExecuteStatus =
  | 'thinking'    // AI 正在思考
  | 'generating'  // AI 正在生成
  | 'plan'        // 收到执行计划
  | 'executing'   // 正在执行操作
  | 'done'        // 执行完成
  | 'error'       // 出错

// AI 执行流式消息
export interface AIExecuteMessage {
  status: AIExecuteStatus
  message?: string
  content?: string  // generating 时的内容
  plan?: {
    thinking?: string
    operations: Array<{ type: string; description: string }>
    summary: string
  }
  result?: {
    success: boolean
    message: string
    results: AIOperationResult[]
  }
  error?: string
}

// AI 执行上下文
export interface AIExecuteContext {
  selectedCode?: string
  selectedFunctionId?: string
  selectedFunctions?: string[]  // 引用的函数 ID 列表
  modelId?: string  // 指定使用的模型
  enableThinking?: boolean  // 是否启用深度思考
}

// AI 执行流式 API
export async function* executeStream(
  prompt: string,
  context?: AIExecuteContext
): AsyncGenerator<AIExecuteMessage> {
  const token = useAuthStore.getState().token

  const response = await fetch('/api/ai/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ prompt, context, modelId: context?.modelId, enableThinking: context?.enableThinking })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: '请求失败' } }))
    yield { status: 'error', error: error.error?.message || '请求失败' }
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    yield { status: 'error', error: '无法读取响应' }
    return
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
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        try {
          const json = JSON.parse(trimmed.slice(6))
          yield json as AIExecuteMessage
        } catch {
          // 忽略解析错误
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// 预览 AI 操作计划 (非流式)
export async function previewPlan(
  prompt: string,
  context?: AIExecuteContext
): Promise<{ plan: AIExecutionPlan; rawResponse: string } | null> {
  try {
    const response = await client.post<{
      success: boolean
      data: { plan: AIExecutionPlan; rawResponse: string }
    }>('/api/ai/preview', { prompt, context })
    return response.data.data
  } catch {
    return null
  }
}

// ============ AI Debug 系统 ============

// Debug 测试用例
export interface DebugTestCase {
  id: string
  name: string
  input: {
    body?: unknown
    query?: Record<string, string>
    headers?: Record<string, string>
    method?: string
  }
  expectedBehavior: string
}

// Debug 测试结果
export interface DebugTestResult {
  testCaseId: string
  testName: string
  success: boolean
  data?: unknown
  error?: string
  logs: string[]
  duration: number
}

// Debug 修复建议
export interface DebugFix {
  issue: string
  reason: string
  originalCode: string
  fixedCode: string
}

// Debug 状态类型
export type DebugStatus =
  | 'analyzing'
  | 'generating_tests'
  | 'tests_generated'
  | 'running_tests'
  | 'test_result'
  | 'all_tests_passed'
  | 'diagnosing'
  | 'fix_proposed'
  | 'done'
  | 'error'

// Debug 流式消息
export interface DebugStreamMessage {
  status: DebugStatus
  message?: string
  content?: string
  testCases?: DebugTestCase[]
  testResult?: DebugTestResult
  testResults?: DebugTestResult[]
  fix?: DebugFix
  error?: string
}

// AI Debug 流式 API
export async function* debugStream(
  functionId: string,
  _unused?: unknown,  // 保留参数位置以兼容旧调用
  modelId?: string
): AsyncGenerator<DebugStreamMessage> {
  const token = useAuthStore.getState().token

  const response = await fetch('/api/ai/debug', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ functionId, modelId })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: '请求失败' } }))
    yield { status: 'error', error: error.error?.message || '请求失败' }
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    yield { status: 'error', error: '无法读取响应' }
    return
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
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        try {
          const json = JSON.parse(trimmed.slice(6))
          yield json as DebugStreamMessage
        } catch {
          // 忽略解析错误
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// 应用 Debug 修复
export async function applyDebugFix(
  functionId: string,
  fixedCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await client.post<{ success: boolean }>('/api/ai/debug/apply', {
      functionId,
      fixedCode
    })
    return { success: response.data.success }
  } catch (err) {
    const error = err as { response?: { data?: { error?: { message?: string } } } }
    return {
      success: false,
      error: error.response?.data?.error?.message || '应用修复失败'
    }
  }
}

// ============ 日志分析 API ============

// 日志摘要
export interface LogSummary {
  executionStats: {
    total: number
    success: number
    failed: number
    avgDuration: number
    byTrigger: Record<string, number>
  }
  recentErrors: Array<{
    functionName: string
    error: string
    count: number
    lastOccurred: string
  }>
  slowExecutions: Array<{
    functionName: string
    avgDuration: number
    maxDuration: number
    count: number
  }>
  recentVersions: Array<{
    functionName: string
    version: number
    changelog: string
    createdAt: string
  }>
  hotFunctions: Array<{
    functionName: string
    callCount: number
    successRate: number
  }>
  errorSamples: Array<{
    functionName: string
    error: string
    request: unknown
    logs: unknown[]
    createdAt: string
  }>
}

// 获取日志摘要
export async function getLogSummary(
  days?: number,
  functionId?: string
): Promise<LogSummary | null> {
  try {
    const params: Record<string, string> = {}
    if (days) params.days = days.toString()
    if (functionId) params.functionId = functionId

    const response = await client.get<{
      success: boolean
      data: LogSummary
    }>('/api/ai/log-summary', { params })
    return response.data.data
  } catch {
    return null
  }
}

// 获取格式化的日志摘要
export async function getFormattedLogSummary(
  days?: number,
  functionId?: string
): Promise<{ summary: LogSummary; formatted: string } | null> {
  try {
    const params: Record<string, string> = {}
    if (days) params.days = days.toString()
    if (functionId) params.functionId = functionId

    const response = await client.get<{
      success: boolean
      data: { summary: LogSummary; formatted: string }
    }>('/api/ai/log-summary/formatted', { params })
    return response.data.data
  } catch {
    return null
  }
}
