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
  // 站点文件操作
  | 'siteCreateFile'    // 创建站点文件
  | 'siteUpdateFile'    // 更新站点文件
  | 'siteDeleteFile'    // 删除站点文件
  | 'siteCreateFolder'  // 创建站点文件夹
  | 'listSiteFiles'     // 列出站点文件
  | 'readSiteFile'      // 读取站点文件
  | 'getSiteInfo'       // 获取站点信息
  // 项目文件操作 (Sprint 14)
  | 'readProjectFile'   // 读取项目文件
  | 'writeProjectFile'  // 写入项目文件
  | 'getFileTree'       // 获取文件树
  | 'searchCode'        // 代码搜索
  // 依赖管理操作 (Sprint 15)
  | 'installDependency' // 安装依赖
  | 'updateDependency'  // 更新依赖
  | 'auditDependencies' // 审计依赖
  | 'listDependencies'  // 列出依赖
  // 环境变量操作 (Sprint 15)
  | 'setEnvVariable'    // 设置环境变量
  | 'deleteEnvVariable' // 删除环境变量
  | 'listEnvVariables'  // 列出环境变量
  // Git 操作 (Sprint 17)
  | 'gitStatus'         // 获取 Git 状态
  | 'gitDiff'           // 查看代码变更
  | 'gitCommit'         // 提交代码
  | 'gitSync'           // 同步远程仓库
  | 'gitBranch'         // 管理分支
  | 'gitLog'            // 获取提交历史
  // 数据库操作 (Sprint 18)
  | 'analyzeCollection' // 分析集合结构
  | 'executeQuery'      // 执行查询
  | 'suggestIndexes'    // 索引建议
  // 测试操作 (Sprint 19)
  | 'testFunction'      // 测试云函数
  | 'batchTestFunction' // 批量测试云函数
  | 'saveTestInput'     // 保存测试输入
  | 'getTestInput'      // 获取测试输入

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

// ==================== 站点文件操作 ====================

// 创建站点文件操作
export interface SiteCreateFileOperation extends AIOperationBase {
  type: 'siteCreateFile'
  path: string            // 文件路径，如 "/index.html"
  content: string         // 文件内容
}

// 更新站点文件操作
export interface SiteUpdateFileOperation extends AIOperationBase {
  type: 'siteUpdateFile'
  path: string
  content: string
}

// 删除站点文件操作
export interface SiteDeleteFileOperation extends AIOperationBase {
  type: 'siteDeleteFile'
  path: string
}

// 创建站点文件夹操作
export interface SiteCreateFolderOperation extends AIOperationBase {
  type: 'siteCreateFolder'
  path: string            // 文件夹路径，如 "/css"
}

// 列出站点文件操作
export interface ListSiteFilesOperation extends AIOperationBase {
  type: 'listSiteFiles'
  path?: string           // 目录路径（可选，默认 "/"）
  recursive?: boolean     // 是否递归（默认 true）
}

// 读取站点文件操作
export interface ReadSiteFileOperation extends AIOperationBase {
  type: 'readSiteFile'
  path: string            // 文件路径
}

// 获取站点信息操作
export interface GetSiteInfoOperation extends AIOperationBase {
  type: 'getSiteInfo'
}

// ==================== 项目文件操作 (Sprint 14) ====================

// 读取项目文件操作
export interface ReadProjectFileOperation extends AIOperationBase {
  type: 'readProjectFile'
  path: string            // 文件路径（相对于项目根目录）
  lineStart?: number      // 起始行号
  lineEnd?: number        // 结束行号
}

// 写入项目文件操作
export interface WriteProjectFileOperation extends AIOperationBase {
  type: 'writeProjectFile'
  path: string            // 文件路径
  content: string         // 文件内容
  createBackup?: boolean  // 是否创建备份
}

// 获取文件树操作
export interface GetFileTreeOperation extends AIOperationBase {
  type: 'getFileTree'
  path?: string           // 起始目录路径
  depth?: number          // 遍历深度
  exclude?: string[]      // 排除模式
}

// 代码搜索操作
export interface SearchCodeOperation extends AIOperationBase {
  type: 'searchCode'
  query: string           // 搜索内容（支持正则）
  filePattern?: string    // 文件模式
  caseSensitive?: boolean // 区分大小写
}

// ==================== 依赖管理操作 (Sprint 15) ====================

// 安装依赖操作
export interface InstallDependencyOperation extends AIOperationBase {
  type: 'installDependency'
  packages: string[]      // 要安装的包列表
  dev?: boolean           // 是否为开发依赖
}

// 更新依赖操作
export interface UpdateDependencyOperation extends AIOperationBase {
  type: 'updateDependency'
  packages: string[]      // 要更新的包列表
  latest?: boolean        // 是否更新到最新版本
}

// 审计依赖操作
export interface AuditDependenciesOperation extends AIOperationBase {
  type: 'auditDependencies'
}

// 列出依赖操作
export interface ListDependenciesOperation extends AIOperationBase {
  type: 'listDependencies'
}

// ==================== 环境变量操作 (Sprint 15) ====================

// 设置环境变量操作
export interface SetEnvVariableOperation extends AIOperationBase {
  type: 'setEnvVariable'
  key: string             // 变量名
  value: string           // 变量值
  isSecret?: boolean      // 是否为敏感信息
  description?: string    // 变量描述
}

// 删除环境变量操作
export interface DeleteEnvVariableOperation extends AIOperationBase {
  type: 'deleteEnvVariable'
  key: string             // 变量名
}

// 列出环境变量操作
export interface ListEnvVariablesOperation extends AIOperationBase {
  type: 'listEnvVariables'
}

// ==================== Git 操作 (Sprint 17) ====================

// Git 状态操作
export interface GitStatusOperation extends AIOperationBase {
  type: 'gitStatus'
}

// Git Diff 操作
export interface GitDiffOperation extends AIOperationBase {
  type: 'gitDiff'
  ref?: string            // 参考点
  path?: string           // 指定文件路径
  staged?: boolean        // 是否查看暂存区
}

// Git Commit 操作
export interface GitCommitOperation extends AIOperationBase {
  type: 'gitCommit'
  message: string         // 提交信息
  files?: string[]        // 要提交的文件
}

// Git Sync 操作
export interface GitSyncOperation extends AIOperationBase {
  type: 'gitSync'
  action: 'pull' | 'push' // 同步操作类型
  remote?: string         // 远程仓库名
  branch?: string         // 分支名
}

// Git Branch 操作
export interface GitBranchOperation extends AIOperationBase {
  type: 'gitBranch'
  action: 'list' | 'create' | 'checkout' | 'delete'
  name?: string           // 分支名
}

// Git Log 操作
export interface GitLogOperation extends AIOperationBase {
  type: 'gitLog'
  count?: number          // 日志数量
  path?: string           // 指定文件路径
}

// ==================== 数据库操作 (Sprint 18) ====================

// 分析集合操作
export interface AnalyzeCollectionOperation extends AIOperationBase {
  type: 'analyzeCollection'
  collection: string      // 集合名称
}

// 执行查询操作
export interface ExecuteQueryOperation extends AIOperationBase {
  type: 'executeQuery'
  collection: string      // 集合名称
  query: Record<string, unknown>  // 查询条件
  projection?: Record<string, number>  // 字段投影
  sort?: Record<string, number>        // 排序条件
  limit?: number          // 返回数量限制
  skip?: number           // 跳过数量
}

// 索引建议操作
export interface SuggestIndexesOperation extends AIOperationBase {
  type: 'suggestIndexes'
  collection: string      // 集合名称
}

// ==================== 测试操作 (Sprint 19) ====================

// 测试输入
export interface TestInputData {
  body?: unknown
  query?: Record<string, string>
  headers?: Record<string, string>
  method?: string
}

// 测试云函数操作
export interface TestFunctionOperation extends AIOperationBase {
  type: 'testFunction'
  functionId: string      // 函数 ID
  input?: TestInputData   // 测试输入
}

// 批量测试云函数操作
export interface BatchTestFunctionOperation extends AIOperationBase {
  type: 'batchTestFunction'
  functionId: string      // 函数 ID
  testCases: Array<{
    name: string          // 测试用例名称
    input: TestInputData  // 测试输入
  }>
}

// 保存测试输入操作
export interface SaveTestInputOperation extends AIOperationBase {
  type: 'saveTestInput'
  functionId: string      // 函数 ID
  input: TestInputData    // 测试输入
}

// 获取测试输入操作
export interface GetTestInputOperation extends AIOperationBase {
  type: 'getTestInput'
  functionId: string      // 函数 ID
}

// 所有操作的联合类型
export type AIOperation =
  | CreateFunctionOperation
  | UpdateFunctionOperation
  | DeleteFunctionOperation
  | RenameFunctionOperation
  | CreateFolderOperation
  | MoveFunctionOperation
  | SiteCreateFileOperation
  | SiteUpdateFileOperation
  | SiteDeleteFileOperation
  | SiteCreateFolderOperation
  | ListSiteFilesOperation
  | ReadSiteFileOperation
  | GetSiteInfoOperation
  | ReadProjectFileOperation
  | WriteProjectFileOperation
  | GetFileTreeOperation
  | SearchCodeOperation
  // Sprint 15
  | InstallDependencyOperation
  | UpdateDependencyOperation
  | AuditDependenciesOperation
  | ListDependenciesOperation
  | SetEnvVariableOperation
  | DeleteEnvVariableOperation
  | ListEnvVariablesOperation
  // Sprint 17: Git 操作
  | GitStatusOperation
  | GitDiffOperation
  | GitCommitOperation
  | GitSyncOperation
  | GitBranchOperation
  | GitLogOperation
  // Sprint 18: 数据库操作
  | AnalyzeCollectionOperation
  | ExecuteQueryOperation
  | SuggestIndexesOperation
  // Sprint 19: 测试操作
  | TestFunctionOperation
  | BatchTestFunctionOperation
  | SaveTestInputOperation
  | GetTestInputOperation

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
    // Git 操作结果
    commitHash?: string
    message?: string
    branches?: string[]
    current?: string
    details?: string
    // 通用扩展
    [key: string]: unknown
  }
}

// AI 执行响应
export interface AIExecutionResponse {
  success: boolean
  plan: AIExecutionPlan
  results: AIOperationResult[]
  message: string
}

// ==================== AI 状态可视化 (Sprint 10.1) ====================

// AI 实时状态类型
export type AIStatusType =
  | 'idle'            // 空闲
  | 'thinking'        // 思考中
  | 'calling_tool'    // 调用工具
  | 'executing'       // 执行操作
  | 'streaming'       // 流式输出
  | 'waiting_confirm' // 等待确认
  | 'error'           // 错误

// AI 状态详情
export type AIStatus =
  | { type: 'idle' }
  | { type: 'thinking'; content?: string }
  | { type: 'calling_tool'; tool: string; params: Record<string, unknown> }
  | { type: 'executing'; operation: string; progress?: number }
  | { type: 'streaming'; tokens: number }
  | { type: 'waiting_confirm'; operations: AIOperation[] }
  | { type: 'error'; message: string }

// Token 使用统计
export interface TokenUsage {
  input: number       // 输入 tokens
  output: number      // 输出 tokens
  total: number       // 总计
  cost: number        // 预估成本 (USD)
}

// AI 状态更新事件
export interface AIStatusUpdate {
  status: AIStatus
  timestamp: number
  tokenUsage?: TokenUsage
}

// SSE 状态事件类型
export type AIStatusEventType =
  | 'status'          // 状态变更
  | 'tool_call'       // 工具调用开始
  | 'tool_result'     // 工具调用结果
  | 'thinking'        // 思考内容
  | 'token_usage'     // Token 使用更新

// SSE 状态事件
export type AIStatusEvent =
  | { type: 'status'; data: AIStatus }
  | { type: 'tool_call'; data: { tool: string; params: Record<string, unknown>; callId: string } }
  | { type: 'tool_result'; data: { tool: string; result: unknown; success: boolean; callId: string; duration?: number } }
  | { type: 'thinking'; data: { content: string } }
  | { type: 'token_usage'; data: TokenUsage }

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
