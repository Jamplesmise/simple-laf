/**
 * 测试结果列表
 */

import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, ExperimentOutlined } from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import type { DebugTestResult } from '@/api/ai'

interface TestResultsListProps {
  results: DebugTestResult[]
  onViewDetail: (result: DebugTestResult) => void
}

export function TestResultsList({ results, onViewDetail }: TestResultsListProps) {
  const { isDark, t } = useThemeColors()

  if (results.length === 0) return null

  const passedCount = results.filter(r => r.success).length
  const failedCount = results.filter(r => !r.success).length

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        marginBottom: 8,
        color: t.text,
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        <ExperimentOutlined />
        测试结果
        <span style={{ fontWeight: 400, color: t.textSecondary }}>
          ({passedCount} 通过, {failedCount} 失败)
        </span>
      </div>
      <div style={{
        border: `1px solid ${t.border}`,
        borderRadius: 6,
        overflow: 'hidden',
        maxHeight: 200,
        overflowY: 'auto'
      }}>
        {results.map((result, index) => (
          <div
            key={result.testCaseId}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 12px',
              borderBottom: index < results.length - 1 ? `1px solid ${isDark ? '#303030' : '#f0f0f0'}` : 'none',
              background: isDark ? '#141414' : '#fff',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onClick={() => onViewDetail(result)}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark ? '#1a1a1a' : '#f5f5f5'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isDark ? '#141414' : '#fff'
            }}
          >
            {result.success ? (
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
            ) : (
              <CloseCircleOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
            )}
            <span style={{
              flex: 1,
              fontSize: 13,
              color: result.success ? (isDark ? '#52c41a' : '#389e0d') : (isDark ? '#ff4d4f' : '#cf1322'),
              fontWeight: 500
            }}>
              {result.testName}
            </span>
            <span style={{
              fontSize: 12,
              color: t.textMuted,
              marginRight: 8
            }}>
              {result.duration}ms
            </span>
            <EyeOutlined style={{ color: t.textMuted, fontSize: 14 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
