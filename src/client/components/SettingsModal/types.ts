export type TabKey = 'env' | 'ai' | 'prompt' | 'domain' | 'token' | 'git'

export interface SettingsModalProps {
  open: boolean
  onClose: () => void
  defaultTab?: TabKey
}

export interface TabConfig {
  key: TabKey
  label: string
  icon: React.ReactNode
}
