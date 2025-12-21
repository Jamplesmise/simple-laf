/**
 * QuickActions - Canvas 模式快捷操作栏
 *
 * Sprint 11.3: 提供 6 个预设操作按钮
 * 点击后触发对应的 AI 对话 Prompt
 */

import { Tooltip } from 'antd'
import styles from './styles.module.css'

/** 快捷操作定义 */
interface QuickAction {
  key: string
  label: string
  icon: string
  prompt: string
}

/** 预设快捷操作列表 */
const quickActions: QuickAction[] = [
  {
    key: 'review',
    label: 'Review',
    icon: '🔍',
    prompt: '审查这段代码，指出问题和改进建议',
  },
  {
    key: 'logs',
    label: 'Add logs',
    icon: '📝',
    prompt: '在关键位置添加调试日志',
  },
  {
    key: 'comments',
    label: 'Comments',
    icon: '💬',
    prompt: '为代码添加清晰的注释',
  },
  {
    key: 'fix',
    label: 'Fix bugs',
    icon: '🐛',
    prompt: '检测并修复代码中的问题',
  },
  {
    key: 'optimize',
    label: 'Optimize',
    icon: '⚡',
    prompt: '优化代码性能',
  },
  {
    key: 'types',
    label: 'Add types',
    icon: '📐',
    prompt: '添加 TypeScript 类型定义',
  },
]

interface QuickActionsProps {
  /** 点击快捷操作时触发，传递 prompt 内容 */
  onAction: (prompt: string) => void
  /** 是否禁用（如正在发送消息时） */
  disabled?: boolean
}

export function QuickActions({ onAction, disabled }: QuickActionsProps) {
  return (
    <div className={styles.quickActions}>
      {quickActions.map((action) => (
        <Tooltip key={action.key} title={action.prompt} placement="top">
          <button
            className={styles.quickActionButton}
            onClick={() => onAction(action.prompt)}
            disabled={disabled}
          >
            <span className={styles.quickActionIcon}>{action.icon}</span>
            <span className={styles.quickActionLabel}>{action.label}</span>
          </button>
        </Tooltip>
      ))}
    </div>
  )
}
