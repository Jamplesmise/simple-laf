import type { ObjectId } from 'mongodb'

// AI 供应商类型
export type AIProvider = 'openai' | 'anthropic' | 'ollama' | 'custom'

// AI 配置
export interface AIConfig {
  _id?: ObjectId
  userId: ObjectId
  provider: AIProvider
  model: string
  apiKey: string // 加密存储
  baseUrl?: string // 自定义 API 地址
  params: {
    temperature: number // 0-1
    maxTokens: number
  }
  createdAt: Date
  updatedAt: Date
}

// AI 操作类型
export type AIAction =
  | 'generate'
  | 'generate-multi'
  | 'refactor'
  | 'diagnose'
  | 'suggest-deps'
  | 'gen-docs'
  | 'security-check'
  | 'gen-cron'
  | 'extract-env'
  | 'js-to-ts'
  | 'explain'
  | 'add-comments'

// AI 历史记录
export interface AIHistory {
  _id?: ObjectId
  userId: ObjectId
  functionId?: ObjectId
  action: AIAction
  prompt: string
  response: string
  model: string
  tokensUsed?: number
  createdAt: Date
}

// 聊天消息格式
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// 聊天选项
export interface ChatOptions {
  model?: string       // 模型 ID 覆盖
  temperature?: number
  maxTokens?: number
  stream?: boolean
  enableThinking?: boolean  // 是否启用深度思考模式
}

// 聊天响应 (非流式)
export interface ChatResponse {
  content: string
  tokensUsed?: number
}

// 模型信息
export interface ModelInfo {
  id: string
  name: string
  description?: string
}

// 生成函数请求
export interface GenerateFunctionRequest {
  prompt: string
  context?: {
    existingFunctions?: string[]
    dependencies?: string[]
    envVariables?: string[]
  }
}

// 生成函数响应
export interface GenerateFunctionResponse {
  name: string
  code: string
  description?: string
  suggestedDeps?: string[]
}

// 多函数生成响应
export interface GenerateMultiFunctionResponse {
  functions: GenerateFunctionResponse[]
  folderName?: string
}

// 重构建议
export interface RefactorSuggestion {
  originalFunction: string
  suggestedFunctions: Array<{
    name: string
    code: string
    description: string
  }>
  entryFunction: {
    name: string
    code: string
  }
  reasoning: string
}

// 错误诊断结果
export interface DiagnoseResult {
  error: string
  analysis: string
  suggestedFix: string
  fixedCode?: string
}

// 依赖推荐
export interface DependencySuggestion {
  name: string
  version?: string
  reason: string
  importStatement: string
}

// 安全检查结果
export interface SecurityCheckResult {
  issues: Array<{
    severity: 'high' | 'medium' | 'low'
    type: string
    description: string
    line?: number
    suggestion: string
  }>
  summary: string
}

// ==================== AI Action 执行系统 ====================

// AI 可执行的操作类型
export type AIOperationType =
  | 'createFunction'    // 创建函数
  | 'updateFunction'    // 修改函数代码
  | 'deleteFunction'    // 删除函数
  | 'renameFunction'    // 重命名函数
  | 'createFolder'      // 创建文件夹
  | 'moveFunction'      // 移动函数到文件夹

// AI 操作基础接口
interface AIOperationBase {
  type: AIOperationType
  description?: string  // 操作说明
}

// 创建函数操作
export interface CreateFunctionOperation extends AIOperationBase {
  type: 'createFunction'
  name: string
  code: string
  folderId?: string     // 目标文件夹
}

// 修改函数操作
export interface UpdateFunctionOperation extends AIOperationBase {
  type: 'updateFunction'
  functionId: string    // 函数 ID
  code: string          // 新代码
}

// 删除函数操作
export interface DeleteFunctionOperation extends AIOperationBase {
  type: 'deleteFunction'
  functionId: string
}

// 重命名函数操作
export interface RenameFunctionOperation extends AIOperationBase {
  type: 'renameFunction'
  functionId: string
  newName: string
}

// 创建文件夹操作
export interface CreateFolderOperation extends AIOperationBase {
  type: 'createFolder'
  name: string
  parentId?: string
}

// 移动函数操作
export interface MoveFunctionOperation extends AIOperationBase {
  type: 'moveFunction'
  functionId: string
  targetFolderId?: string  // null 表示移到根目录
}

// 所有操作的联合类型
export type AIOperation =
  | CreateFunctionOperation
  | UpdateFunctionOperation
  | DeleteFunctionOperation
  | RenameFunctionOperation
  | CreateFolderOperation
  | MoveFunctionOperation

// AI 执行计划
export interface AIExecutionPlan {
  thinking?: string           // AI 的思考过程
  operations: AIOperation[]   // 要执行的操作列表
  summary: string             // 执行摘要
}

// AI 操作执行结果
export interface AIOperationResult {
  operation: AIOperation
  success: boolean
  error?: string
  result?: {
    functionId?: string
    folderId?: string
    name?: string
  }
}

// AI 执行响应
export interface AIExecutionResponse {
  success: boolean
  plan: AIExecutionPlan
  results: AIOperationResult[]
  message: string
}

// ==================== AI Debug 系统 ====================

// Debug 测试用例
export interface DebugTestCase {
  id: string
  name: string                    // 测试描述
  input: {
    body?: unknown
    query?: Record<string, string>
    headers?: Record<string, string>
    method?: string
  }
  expectedBehavior: string        // 期望行为描述
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
  issue: string           // 问题描述
  reason: string          // 修复原因
  originalCode: string    // 原始代码
  fixedCode: string       // 修复后代码
}

// Debug 状态类型
export type DebugStatus =
  | 'analyzing'           // 分析函数代码
  | 'generating_tests'    // 生成测试用例
  | 'tests_generated'     // 测试用例生成完成
  | 'running_tests'       // 运行测试
  | 'test_result'         // 单个测试结果
  | 'all_tests_passed'    // 所有测试通过
  | 'diagnosing'          // 诊断问题
  | 'fix_proposed'        // 修复建议
  | 'done'                // 完成
  | 'error'               // 错误

// Debug 流式消息
export interface DebugStreamMessage {
  status: DebugStatus
  message?: string
  content?: string                 // AI 生成内容
  testCases?: DebugTestCase[]      // 生成的测试用例
  testResult?: DebugTestResult     // 单个测试结果
  testResults?: DebugTestResult[]  // 所有测试结果
  fix?: DebugFix                   // 修复建议
  error?: string
}
