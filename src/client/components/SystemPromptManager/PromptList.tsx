import { Spin } from 'antd'
import type { AISystemPrompt } from '../../api/aiSystemPrompt'
import { EmptyState } from './EmptyState'
import { PromptListItem } from './PromptListItem'

interface PromptListProps {
  prompts: AISystemPrompt[]
  loading: boolean
  isDark: boolean
  selectable: boolean
  selectedId?: string
  onSelect: (prompt: AISystemPrompt) => void
  onEdit: (prompt: AISystemPrompt) => void
  onDelete: (prompt: AISystemPrompt) => void
  onSetDefault: (prompt: AISystemPrompt) => void
  onViewHistory: (prompt: AISystemPrompt) => void
  onCreateClick: () => void
}

export function PromptList({
  prompts,
  loading,
  isDark,
  selectable,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
  onViewHistory,
  onCreateClick
}: PromptListProps) {
  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin />
      </div>
    )
  }

  if (prompts.length === 0) {
    return <EmptyState isDark={isDark} onCreateClick={onCreateClick} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {prompts.map((prompt) => (
        <PromptListItem
          key={prompt._id}
          prompt={prompt}
          isDark={isDark}
          selectable={selectable}
          isSelected={selectedId === prompt._id}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
          onSetDefault={onSetDefault}
          onViewHistory={onViewHistory}
        />
      ))}
    </div>
  )
}
