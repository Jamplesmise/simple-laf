/**
 * AI Skill 系统类型定义
 *
 * Skill 模式：将 AI 操作拆分为可插拔的技能模块
 * - 渐进式披露：只在需要时加载
 * - 成本控制：按需调用，避免浪费
 * - 可扩展：易于添加新技能
 */

export interface AISkill {
  /** 技能唯一标识 */
  id: string
  /** 技能名称 */
  name: string
  /** 技能描述 */
  description: string
  /** 触发命令（斜杠命令） */
  command?: string
  /** 图标 */
  icon: React.ReactNode
  /** 是否需要选中函数 */
  requiresFunction?: boolean
  /** 是否需要多个函数 */
  requiresMultipleFunctions?: boolean
  /** 最小函数数量 */
  minFunctions?: number
  /** 是否启用 */
  enabled: boolean
  /** 执行技能 */
  execute: (context: SkillContext) => Promise<SkillResult>
}

export interface SkillContext {
  /** 用户输入 */
  userInput: string
  /** 选中的函数 ID 列表 */
  selectedFunctions: string[]
  /** 函数代码映射 */
  functionCodes: Record<string, { name: string; code: string }>
  /** 模型 ID */
  modelId: string | null
  /** 系统提示词 ID */
  systemPromptId: string | null
  /** 是否启用深度思考 */
  enableThinking: boolean
  /** 额外参数 */
  extra?: Record<string, unknown>
}

export interface SkillResult {
  /** 是否成功 */
  success: boolean
  /** 结果消息 */
  message?: string
  /** 执行的操作 */
  operations?: AIOperation[]
  /** 错误信息 */
  error?: string
}

export interface AIOperation {
  type: 'create' | 'update' | 'delete' | 'analyze' | 'explain'
  name?: string
  description?: string
  code?: string
  functionId?: string
}

/**
 * 技能注册表
 */
export interface SkillRegistry {
  /** 所有技能 */
  skills: AISkill[]
  /** 根据 ID 获取技能 */
  getSkill: (id: string) => AISkill | undefined
  /** 根据命令获取技能 */
  getSkillByCommand: (command: string) => AISkill | undefined
  /** 获取可用技能（基于当前上下文） */
  getAvailableSkills: (context: { hasFunction: boolean; functionCount: number }) => AISkill[]
  /** 注册技能 */
  register: (skill: AISkill) => void
}

/**
 * 内置技能 ID
 */
export const BuiltinSkillIds = {
  CHAT: 'chat',
  LOG_ANALYSIS: 'log-analysis',
  DEBUG: 'debug',
  EXPLAIN: 'explain',
  REFACTOR: 'refactor',
  MERGE: 'merge',
  CREATE_FUNCTION: 'create-function',
  UPDATE_FUNCTION: 'update-function',
} as const

export type BuiltinSkillId = typeof BuiltinSkillIds[keyof typeof BuiltinSkillIds]
