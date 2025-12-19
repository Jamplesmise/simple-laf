import { useState } from 'react'
import { Button, Typography, Modal, Tooltip } from 'antd'
import { HistoryOutlined } from '@ant-design/icons'
import { useThemeStore } from '../stores/theme'
import { useFunctionStore } from '../stores/function'
import type { InvokeResult } from '../api/invoke'
import ExecutionHistory from './ExecutionHistory'

const { Text } = Typography

interface ResultPanelProps {
  result: InvokeResult | null
  collapsed?: boolean
  onToggle?: () => void
}

export default function ResultPanel({ result, collapsed, onToggle }: ResultPanelProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'
  const { current } = useFunctionStore()
  const [historyModalOpen, setHistoryModalOpen] = useState(false)

  // 面板标题样式（参考 LAF 的绿色左边框）
  const panelHeaderStyle = {
    padding: '8px 12px',
    borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: onToggle ? 'pointer' : 'default',
    userSelect: 'none' as const,
    position: 'relative' as const,
    paddingLeft: 16,
    background: isDark ? '#1a1a1a' : '#fafafa',
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
          运行结果
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={(e) => e.stopPropagation()}>
          {result && (
            <Text type={result.success ? 'success' : 'danger'} style={{ fontSize: 12 }}>
              {result.success ? '成功' : '失败'} · {result.time}ms
            </Text>
          )}
          {current && (
            <Tooltip title="执行历史">
              <Button
                type="text"
                size="small"
                icon={<HistoryOutlined />}
                onClick={() => setHistoryModalOpen(true)}
                style={{ color: isDark ? '#888' : '#666', padding: '0 4px' }}
              />
            </Tooltip>
          )}
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

      {/* 结果内容 */}
      {!collapsed && (
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: result ? 8 : 0,
          display: result ? 'block' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {result ? (
            <pre
              style={{
                margin: 0,
                padding: 8,
                background: isDark ? '#1a1a1a' : '#f5f5f5',
                borderRadius: 4,
                fontSize: 12,
                fontFamily: 'monospace',
                color: result.error ? '#ff4d4f' : isDark ? '#98c379' : '#52c41a',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {result.error || JSON.stringify(result.data, null, 2)}
            </pre>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>
              运行函数后查看结果
            </Text>
          )}
        </div>
      )}

      {/* 执行历史弹窗 */}
      <Modal
        title={`执行历史 - ${current?.name || ''}`}
        open={historyModalOpen}
        onCancel={() => setHistoryModalOpen(false)}
        width={900}
        centered
        footer={null}
        styles={{ body: { padding: 0, height: 500 } }}
      >
        <ExecutionHistory functionId={current?._id} />
      </Modal>
    </div>
  )
}
