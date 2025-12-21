/**
 * 上下文管理类型定义 (Sprint 10.3)
 */

// 上下文项类型
export type ContextItemType = 'system' | 'message' | 'code' | 'tool_result'

// 单个上下文项
export interface ContextItem {
  id: string                    // 唯一标识（消息 ID 或自动生成）
  type: ContextItemType         // 类型
  source: string                // 来源描述（如 "系统提示词" / "用户消息 #3"）
  tokens: number                // Token 数量
  content: string               // 内容摘要（截断显示）
  removable: boolean            // 是否可删除
  compressible: boolean         // 是否可压缩
  messageId?: string            // 关联的消息 ID
  createdAt?: Date              // 创建时间
}

// 上下文使用量统计
export interface ContextUsage {
  used: number                  // 已使用 tokens
  total: number                 // 总限制（模型上下文窗口）
  percentage: number            // 使用百分比
}

// 分类统计
export interface ContextCategoryStats {
  system: number                // 系统提示词 tokens
  messages: number              // 对话消息 tokens
  code: number                  // 引用代码 tokens
  toolResults: number           // 工具结果 tokens
}

// 完整上下文统计
export interface ContextStats {
  usage: ContextUsage
  categories: ContextCategoryStats
  items: ContextItem[]
  warningThreshold: number      // 警告阈值（默认 70%）
  isWarning: boolean            // 是否需要警告
}

// 压缩模式
export type CompressMode = 'smart' | 'manual'

// 压缩选项
export interface CompressOptions {
  mode: CompressMode
  targetPercentage?: number     // smart 模式目标百分比（默认 50%）
  itemIds?: string[]            // manual 模式指定要压缩的项 ID
}

// 压缩动作类型
export type CompressAction =
  | 'summarize_tool_result'     // 压缩工具结果
  | 'summarize_messages'        // 压缩早期对话
  | 'skeleton_code'             // 代码转骨架
  | 'remove_low_priority'       // 删除低优先级内容

// 压缩结果
export interface CompressResult {
  success: boolean
  before: number                // 压缩前 tokens
  after: number                 // 压缩后 tokens
  saved: number                 // 节省的 tokens
  percentage: number            // 压缩后使用百分比
  actions: CompressAction[]     // 执行的压缩动作
  message?: string              // 状态消息
}

// 删除选项
export interface DeleteContextOptions {
  itemIds: string[]             // 要删除的项 ID
}

// 删除结果
export interface DeleteContextResult {
  success: boolean
  deleted: number               // 删除的项数
  tokensSaved: number           // 节省的 tokens
  newPercentage: number         // 删除后使用百分比
}

// 模型上下文限制配置
export interface ModelContextLimits {
  modelId: string
  maxTokens: number             // 最大上下文窗口
  outputReserve: number         // 预留给输出的 tokens（默认 4096）
  effectiveLimit: number        // 有效输入限制 = maxTokens - outputReserve
}

// 默认模型上下文限制
export const DEFAULT_CONTEXT_LIMITS: Record<string, number> = {
  'gpt-4': 8192,
  'gpt-4-turbo': 128000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-3.5-turbo': 16385,
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'claude-3-5-sonnet': 200000,
  'claude-3-5-haiku': 200000,
  'deepseek-chat': 64000,
  'deepseek-coder': 64000,
  'qwen-turbo': 131072,
  'qwen-plus': 131072,
  'qwen-max': 32768,
}

// 默认输出预留
export const DEFAULT_OUTPUT_RESERVE = 4096

// 警告阈值
export const WARNING_THRESHOLD = 0.7  // 70%
