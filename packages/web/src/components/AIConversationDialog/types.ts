/**
 * AIConversationDialog 类型定义
 */

import type { AIConversation, AIMessage } from '@/api/aiConversation'
import type { AIProvider, AIModel } from '@/api/aiProvider'
import type { AISystemPrompt } from '@/api/aiSystemPrompt'
import type { TreeNode } from '@/api/folders'
import type { CloudFunction } from '@/stores/function'

export interface AIConversationDialogProps {
  open: boolean
  onClose: () => void
  initialContext?: {
    selectedCode?: string
    functionId?: string
  }
}

// 对话列表状态
export interface ConversationListState {
  conversations: AIConversation[]
  loadingList: boolean
  filter: 'all' | 'starred' | 'archived'
  currentId: string | null
  editingId: string | null
  editingTitle: string
}

// 消息状态
export interface MessageState {
  messages: AIMessage[]
  loadingMessages: boolean
  sending: boolean
  streamContent: string
  streamStatus: string
}

// AI 模型状态
export interface AIModelState {
  providers: AIProvider[]
  models: AIModel[]
  selectedProviderId: string | null
  selectedModelId: string | null
  loadingProviders: boolean
  loadingModels: boolean
  enableThinking: boolean
  systemPrompts: AISystemPrompt[]
  selectedPromptId: string | null
  loadingPrompts: boolean
}

// 函数引用状态
export interface FunctionReferenceState {
  folders: TreeNode[]
  allFunctions: CloudFunction[]
  selectedFunctions: string[]
  showFunctionPicker: boolean
  selectedFolder: string | null
  expandedFolders: Set<string>
}

// 日志分析状态
export interface LogAnalysisState {
  enableLogAnalysis: boolean
  logDays: number
  showSlashMenu: boolean
}

// 斜杠命令定义
export interface SlashCommand {
  command: string
  label: string
  description: string
  days: number
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/log', label: '分析日志', description: '分析最近 3 天的执行日志', days: 3 },
  { command: '/log7', label: '7天日志', description: '分析最近 7 天的执行日志', days: 7 },
  { command: '/log15', label: '15天日志', description: '分析最近 15 天的执行日志', days: 15 },
  { command: '/log30', label: '30天日志', description: '分析最近 30 天的执行日志', days: 30 },
]
