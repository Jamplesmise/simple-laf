import type { AISystemPrompt } from '../../api/aiSystemPrompt'

export interface SystemPromptManagerProps {
  onSelect?: (prompt: AISystemPrompt | null) => void
  selectedId?: string
  selectable?: boolean
}
