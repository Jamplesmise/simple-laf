import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Globe, FileText, Key, GitBranch, Bot, MessageSquare, X } from 'lucide-react'
import { useThemeStore } from '../../stores/theme'
import AIProviderManager from '../AIProviderManager'
import SystemPromptManager from '../SystemPromptManager'
import CustomDomainManager from '../CustomDomainManager'
import ApiTokenManager from '../ApiTokenManager'
import GitPanel from '../GitPanel'
import EnvTab from './EnvTab'
import { getModalStyles } from './styles'
import type { SettingsModalProps, TabKey, TabConfig } from './types'

const tabs: TabConfig[] = [
  { key: 'env', label: '环境变量', icon: <FileText size={16} /> },
  { key: 'ai', label: 'AI 模型', icon: <Bot size={16} /> },
  { key: 'prompt', label: '系统提示词', icon: <MessageSquare size={16} /> },
  { key: 'domain', label: '自定义域名', icon: <Globe size={16} /> },
  { key: 'token', label: 'API Token', icon: <Key size={16} /> },
  { key: 'git', label: 'Git 同步', icon: <GitBranch size={16} /> },
]

export default function SettingsModal({ open, onClose, defaultTab = 'env' }: SettingsModalProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab)

  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab)
    }
  }, [open, defaultTab])

  const renderContent = () => {
    switch (activeTab) {
      case 'env':
        return <EnvTab />
      case 'ai':
        return <AIProviderManager />
      case 'prompt':
        return <SystemPromptManager />
      case 'domain':
        return <CustomDomainManager />
      case 'token':
        return <ApiTokenManager />
      case 'git':
        return <GitPanel />
      default:
        return null
    }
  }

  if (!open) return null

  const styles = getModalStyles(isDark)

  const modalContent = (
    <>
      {/* 遮罩层 */}
      <div style={styles.overlay} onClick={onClose} />

      {/* 弹窗容器 */}
      <div style={styles.container}>
        {/* 固定头部 */}
        <div style={styles.header}>
          {/* Tab 导航 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '16px 0',
                  fontSize: 13,
                  fontWeight: activeTab === tab.key ? 500 : 400,
                  color: activeTab === tab.key
                    ? (isDark ? '#f3f4f6' : '#111827')
                    : (isDark ? '#6b7280' : '#6b7280'),
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {tab.icon}
                {tab.label}
                {/* 选中指示器 */}
                {activeTab === tab.key && (
                  <span style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: '#10b981',
                    borderRadius: 1,
                  }} />
                )}
              </button>
            ))}
          </div>

          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            style={{
              padding: 8,
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              color: isDark ? '#9ca3af' : '#6b7280',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 滚动内容区 */}
        <div style={styles.content}>
          {renderContent()}
        </div>
      </div>
    </>
  )

  return createPortal(modalContent, document.body)
}
