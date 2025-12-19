/**
 * 函数树工具栏
 */

import { Tooltip } from 'antd'
import { PlusOutlined, CodeOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'

interface TreeToolbarProps {
  onNewFunction: () => void
  onOpenScheduler: () => void
  onOpenSnippets: () => void
}

export function TreeToolbar({ onNewFunction, onOpenScheduler, onOpenSnippets }: TreeToolbarProps) {
  const { isDark, t } = useThemeColors()

  const buttonStyle = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 6px',
    color: isDark ? '#888' : '#666',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
  }

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = isDark ? '#303030' : '#f0f0f0'
  }

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'transparent'
  }

  return (
    <div style={{
      padding: '10px 12px',
      borderBottom: `1px solid ${t.border}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'relative',
      paddingLeft: 16,
    }}>
      {/* 绿色指示器 */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 3,
        height: 16,
        backgroundColor: t.accent,
        borderRadius: '0 2px 2px 0',
      }} />

      <span style={{ fontSize: 13, fontWeight: 500, color: t.text }}>
        函数列表
      </span>

      <div style={{ display: 'flex', gap: 2 }}>
        <Tooltip title="代码片段">
          <button
            style={buttonStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={onOpenSnippets}
          >
            <CodeOutlined style={{ fontSize: 14 }} />
          </button>
        </Tooltip>
        <Tooltip title="定时执行器">
          <button
            style={buttonStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={onOpenScheduler}
          >
            <ClockCircleOutlined style={{ fontSize: 14 }} />
          </button>
        </Tooltip>
        <Tooltip title="新建函数">
          <button
            style={buttonStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={onNewFunction}
          >
            <PlusOutlined style={{ fontSize: 13 }} />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
