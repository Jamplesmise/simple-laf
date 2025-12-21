export type SiteAIAction = 'create-page' | 'create-component' | 'create-site'

export interface ActionButton {
  key: SiteAIAction
  icon: React.ReactNode
  label: string
  placeholder: string
}

export interface SiteAIConfigValue {
  providerId: string | null
  modelId: string | null
  enableThinking: boolean
  systemPromptId: string | null
}
