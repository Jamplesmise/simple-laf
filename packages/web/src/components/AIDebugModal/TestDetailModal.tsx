/**
 * 测试详情弹窗
 */

import { Modal, Button } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import type { DebugTestCase, DebugTestResult } from '@/api/ai'

interface TestDetailModalProps {
  open: boolean
  testCase: DebugTestCase | null
  testResult: DebugTestResult | null
  onClose: () => void
}

export function TestDetailModal({ open, testCase, testResult, onClose }: TestDetailModalProps) {
  const { isDark, t } = useThemeColors()

  if (!testCase || !testResult) return null

  const codeFont = '"JetBrains Mono", Menlo, Monaco, monospace'

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {testResult.success ? (
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
          ) : (
            <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
          )}
          <span>{testCase.name}</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      width="70%"
      centered
      footer={<Button onClick={onClose}>关闭</Button>}
      styles={{
        body: { padding: '16px 24px', maxHeight: '70vh', overflow: 'auto' },
        content: { borderRadius: 12 }
      }}
    >
      {/* 测试用例输入 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 8,
          color: t.text
        }}>
          测试输入
        </div>
        <div style={{
          background: isDark ? '#1a1a1a' : '#f5f5f5',
          borderRadius: 6,
          padding: 12,
          fontFamily: codeFont,
          fontSize: 12,
          overflow: 'auto',
          maxHeight: 200
        }}>
          <pre style={{ margin: 0, color: t.text }}>
            {JSON.stringify(testCase.input, null, 2)}
          </pre>
        </div>
      </div>

      {/* 期望行为 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 8,
          color: t.text
        }}>
          期望行为
        </div>
        <div style={{
          background: isDark ? '#1a1a1a' : '#f5f5f5',
          borderRadius: 6,
          padding: 12,
          fontSize: 13,
          color: t.text
        }}>
          {testCase.expectedBehavior}
        </div>
      </div>

      {/* 执行结果 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 8,
          color: t.text,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          执行结果
          <span style={{ fontSize: 12, fontWeight: 400, color: t.textMuted }}>
            ({testResult.duration}ms)
          </span>
        </div>
        <div style={{
          background: isDark ? '#1a1a1a' : '#f5f5f5',
          borderRadius: 6,
          padding: 12,
          fontFamily: codeFont,
          fontSize: 12,
          overflow: 'auto',
          maxHeight: 200
        }}>
          {testResult.success ? (
            <pre style={{ margin: 0, color: '#52c41a' }}>
              {JSON.stringify(testResult.data, null, 2)}
            </pre>
          ) : (
            <pre style={{ margin: 0, color: '#ff4d4f' }}>
              {testResult.error || 'Unknown error'}
            </pre>
          )}
        </div>
      </div>

      {/* 控制台日志 */}
      {testResult.logs && testResult.logs.length > 0 && (
        <div>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 8,
            color: t.text
          }}>
            控制台日志
          </div>
          <div style={{
            background: isDark ? '#0d1117' : '#1e1e1e',
            borderRadius: 6,
            padding: 12,
            fontFamily: codeFont,
            fontSize: 12,
            overflow: 'auto',
            maxHeight: 200
          }}>
            {testResult.logs.map((log, i) => (
              <div key={i} style={{ color: '#d4d4d4', lineHeight: 1.6 }}>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
