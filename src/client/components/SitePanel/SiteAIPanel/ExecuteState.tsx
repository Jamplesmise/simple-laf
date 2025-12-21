import type { AIOperationResult } from '@/api/ai'

interface Operation {
  type: string
  description: string
}

interface ExecuteStateType {
  status: string | null
  thinking: string
  operations: Operation[]
  results: AIOperationResult[]
  summary: string
}

interface ExecuteStateProps {
  isDark: boolean
  executeState: ExecuteStateType
}

export default function ExecuteState({ isDark, executeState }: ExecuteStateProps) {
  if (!executeState.status) return null

  return (
    <div style={{ marginTop: 12 }}>
      {/* 思考过程 */}
      {executeState.thinking && (
        <div style={{
          padding: 12,
          background: isDark ? '#1a2633' : '#e6f7ff',
          borderRadius: 8,
          marginBottom: 8,
          fontSize: 13,
          color: isDark ? '#69c0ff' : '#1890ff',
        }}>
          <strong>思考：</strong>{executeState.thinking}
        </div>
      )}

      {/* 操作列表 */}
      {executeState.operations.length > 0 && (
        <div style={{
          padding: 12,
          background: isDark ? '#1a1a1a' : '#fafafa',
          borderRadius: 8,
          marginBottom: 8,
        }}>
          <div style={{ fontWeight: 500, marginBottom: 8, color: isDark ? '#e0e0e0' : '#333' }}>
            计划执行的操作：
          </div>
          {executeState.operations.map((op: Operation, i: number) => (
            <div key={i} style={{
              padding: '4px 8px',
              fontSize: 12,
              color: isDark ? '#aaa' : '#666',
            }}>
              {i + 1}. [{op.type}] {op.description}
            </div>
          ))}
        </div>
      )}

      {/* 执行结果 */}
      {executeState.results.length > 0 && (
        <div style={{
          padding: 12,
          background: isDark ? '#162312' : '#f6ffed',
          borderRadius: 8,
          border: `1px solid ${isDark ? '#274916' : '#b7eb8f'}`,
        }}>
          <div style={{ fontWeight: 500, marginBottom: 8, color: isDark ? '#95de64' : '#52c41a' }}>
            执行结果：
          </div>
          {executeState.results.map((result: AIOperationResult, i: number) => (
            <div key={i} style={{
              padding: '4px 8px',
              fontSize: 12,
              color: result.success ? (isDark ? '#95de64' : '#52c41a') : (isDark ? '#ff7875' : '#ff4d4f'),
            }}>
              {result.success ? '✓' : '✗'} {result.type}: {result.result?.name || result.error}
            </div>
          ))}
        </div>
      )}

      {/* 摘要 */}
      {executeState.summary && executeState.status === 'done' && (
        <div style={{
          marginTop: 8,
          padding: 8,
          fontSize: 13,
          color: isDark ? '#aaa' : '#666',
          textAlign: 'center',
        }}>
          {executeState.summary}
        </div>
      )}
    </div>
  )
}
