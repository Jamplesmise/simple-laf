import { useState } from 'react'
import { Button, Typography, Tooltip } from 'antd'
import { ClearOutlined, HistoryOutlined } from '@ant-design/icons'
import { useThemeStore } from '../stores/theme'
import LogViewerModal from './LogViewerModal'

const { Text } = Typography

interface ConsolePanelProps {
  logs: string[]
  onClear: () => void
  collapsed?: boolean
  onToggle?: () => void
}

export default function ConsolePanel({ logs, onClear, collapsed, onToggle }: ConsolePanelProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'
  const [logViewerOpen, setLogViewerOpen] = useState(false)

  // 面板标题样式（参考 LAF 的绿色左边框）
  const panelHeaderStyle = {
    padding: '8px 12px',
    borderTop: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: isDark ? '#1a1a1a' : '#fafafa',
    cursor: onToggle ? 'pointer' : 'default',
    userSelect: 'none' as const,
    position: 'relative' as const,
    paddingLeft: 16,
  }

  const greenIndicatorStyle = {
    position: 'absolute' as const,
    left: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 3,
    height: 16,
    backgroundColor: '#00a9a6',
    borderRadius: '0 2px 2px 0',
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 标题栏 */}
      <div style={panelHeaderStyle} onClick={onToggle}>
        <div style={greenIndicatorStyle} />
        <span style={{ fontSize: 13, fontWeight: 500, color: isDark ? '#e0e0e0' : '#333' }}>
          控制台
        </span>
        <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="查看所有日志">
            <Button
              type="text"
              size="small"
              onClick={() => setLogViewerOpen(true)}
              style={{
                padding: '0 6px',
                height: 24,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <HistoryOutlined style={{ fontSize: 12 }} />
            </Button>
          </Tooltip>
          <Button
            type="text"
            size="small"
            onClick={onClear}
            disabled={logs.length === 0}
            style={{
              padding: '0 6px',
              height: 24,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ClearOutlined style={{ fontSize: 12 }} />
          </Button>
          {onToggle && (
            <Button
              type="text"
              size="small"
              onClick={onToggle}
              style={{ fontSize: 10, padding: '0 4px' }}
            >
              {collapsed ? '展开' : '收起'}
            </Button>
          )}
        </div>
      </div>

      {/* 日志内容 */}
      {!collapsed && (
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: logs.length > 0 ? 8 : 0,
            background: isDark ? '#0d0d0d' : '#fff',
            fontFamily: 'monospace',
            fontSize: 12,
            display: logs.length === 0 ? 'flex' : 'block',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {logs.length > 0 ? (
            logs.map((log, index) => (
              <div
                key={index}
                style={{
                  padding: '2px 0',
                  borderBottom: `1px solid ${isDark ? '#1a1a1a' : '#f0f0f0'}`,
                  color: isDark ? '#d4d4d4' : '#333',
                }}
              >
                <span style={{ color: '#888', marginRight: 8, userSelect: 'none' }}>
                  [{index + 1}]
                </span>
                <span style={{ whiteSpace: 'pre-wrap' }}>{log}</span>
              </div>
            ))
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>
              暂无日志
            </Text>
          )}
        </div>
      )}

      {/* 日志查看器弹窗 */}
      <LogViewerModal
        open={logViewerOpen}
        onClose={() => setLogViewerOpen(false)}
      />
    </div>
  )
}
