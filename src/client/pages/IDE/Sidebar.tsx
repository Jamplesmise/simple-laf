import { Tooltip } from 'antd'
import { useThemeStore } from '../../stores/theme'
import { useViewStore, type ViewType } from '../../stores/view'
import { navItems, toolItemsConfig, emerald } from './constants'
import type { ToolItem } from './types'

interface SidebarProps {
  onStatisticsOpen: () => void
  onWebhooksOpen: () => void
}

export default function Sidebar({ onStatisticsOpen, onWebhooksOpen }: SidebarProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'
  const currentView = useViewStore((state) => state.currentView)
  const setView = useViewStore((state) => state.setView)

  // 工具导航项 - 添加 onClick
  const toolItems: ToolItem[] = toolItemsConfig.map((item) => ({
    ...item,
    onClick: item.key === 'statistics' ? onStatisticsOpen : onWebhooksOpen,
  }))

  return (
    <div
      style={{
        width: 52,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 12,
        background: isDark ? '#1a1a1a' : '#FFFFFF',
        borderRight: `1px solid ${isDark ? '#2d2d2d' : '#E5E7EB'}`,
      }}
    >
      {/* 主视图导航 */}
      {navItems.map((item) => {
        const isActive = currentView === item.key
        return (
          <Tooltip key={item.key} title={item.label} placement="right">
            <div
              onClick={() => setView(item.key as ViewType)}
              style={{
                width: 38,
                height: 38,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                cursor: 'pointer',
                marginBottom: 6,
                color: isActive
                  ? emerald.primary
                  : (isDark ? '#71717A' : '#9CA3AF'),
                background: isActive
                  ? (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)')
                  : 'transparent',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
                  e.currentTarget.style.color = isDark ? '#A1A1AA' : '#6B7280'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = isDark ? '#71717A' : '#9CA3AF'
                }
              }}
            >
              {item.icon}
            </div>
          </Tooltip>
        )
      })}

      {/* 分隔线 */}
      <div style={{
        width: 24,
        height: 1,
        background: isDark ? '#2d2d2d' : '#E5E7EB',
        margin: '6px 0 12px',
      }} />

      {/* 工具面板入口 */}
      {toolItems.map((item) => (
        <Tooltip key={item.key} title={item.label} placement="right">
          <div
            onClick={item.onClick}
            style={{
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              cursor: 'pointer',
              marginBottom: 6,
              color: isDark ? '#71717A' : '#9CA3AF',
              background: 'transparent',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
              e.currentTarget.style.color = isDark ? '#A1A1AA' : '#6B7280'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = isDark ? '#71717A' : '#9CA3AF'
            }}
          >
            {item.icon}
          </div>
        </Tooltip>
      ))}
    </div>
  )
}
