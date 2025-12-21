import { Spin, Empty, Button } from 'antd'
import ExecuteState from './ExecuteState'
import type { AIOperationResult } from '@/api/ai'

interface ExecuteStateType {
  status: string | null
  message?: string
  thinking: string
  operations: Array<{ type: string; description: string }>
  results: AIOperationResult[]
  summary: string
}

interface OutputAreaProps {
  isDark: boolean
  isConfigured: boolean
  currentOutput: string
  isGenerating: boolean
  generateError: string | null
  executeState: ExecuteStateType
  placeholder: string
  onConfigOpen: () => void
}

export default function OutputArea({
  isDark,
  isConfigured,
  currentOutput,
  isGenerating,
  generateError,
  executeState,
  placeholder,
  onConfigOpen,
}: OutputAreaProps) {
  if (!isConfigured) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <span style={{ color: isDark ? '#666' : '#999' }}>
            请先配置 AI 供应商和模型
          </span>
        }
      >
        <Button
          type="primary"
          size="small"
          onClick={onConfigOpen}
          style={{ background: '#00a9a6', borderColor: '#00a9a6' }}
        >
          前往配置
        </Button>
      </Empty>
    )
  }

  if (!currentOutput && !isGenerating && !generateError && !executeState.status) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <span style={{ color: isDark ? '#666' : '#999' }}>
            {placeholder}
          </span>
        }
      />
    )
  }

  return (
    <div>
      {isGenerating && !currentOutput && !executeState.status && (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spin />
          <div style={{ marginTop: 8, color: isDark ? '#666' : '#999', fontSize: 12 }}>
            AI 正在思考...
          </div>
        </div>
      )}

      {executeState.status && executeState.status !== 'done' && executeState.status !== 'error' && (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spin />
          <div style={{ marginTop: 8, color: isDark ? '#666' : '#999', fontSize: 12 }}>
            {executeState.message || 'AI 正在处理...'}
          </div>
        </div>
      )}

      {currentOutput && (
        <pre style={{
          margin: 0,
          padding: 12,
          background: isDark ? '#141414' : '#fff',
          borderRadius: 8,
          border: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
          fontSize: 13,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: isDark ? '#e0e0e0' : '#333',
          fontFamily: 'Menlo, Monaco, Consolas, monospace',
        }}>
          {currentOutput}
          {isGenerating && <span className="cursor-blink">|</span>}
        </pre>
      )}

      <ExecuteState isDark={isDark} executeState={executeState} />

      {generateError && (
        <div style={{
          padding: 12,
          background: isDark ? '#2a1215' : '#fff2f0',
          border: `1px solid ${isDark ? '#58181c' : '#ffccc7'}`,
          borderRadius: 8,
          color: isDark ? '#ff7875' : '#ff4d4f',
          fontSize: 13,
          marginTop: 12,
        }}>
          {generateError}
        </div>
      )}
    </div>
  )
}
