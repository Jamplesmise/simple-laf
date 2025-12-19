/**
 * 修复建议显示
 */

import { MedicineBoxOutlined } from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import type { DebugFix } from '@/api/ai'
import DiffViewer from '../DiffViewer'

interface FixProposalProps {
  fix: DebugFix
}

export function FixProposal({ fix }: FixProposalProps) {
  const { isDark, t } = useThemeColors()

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
        <MedicineBoxOutlined style={{ color: t.accent }} />
        修复建议
      </div>

      {/* 问题描述 */}
      <div style={{
        padding: 12,
        marginBottom: 12,
        borderRadius: 6,
        background: isDark ? '#1a1a1a' : '#fffbe6',
        border: `1px solid ${isDark ? '#303030' : '#ffe58f'}`
      }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: isDark ? '#faad14' : '#d48806',
          marginBottom: 4
        }}>
          发现问题
        </div>
        <div style={{ fontSize: 13, color: t.text }}>
          {fix.issue}
        </div>
      </div>

      {/* 修复原因 */}
      <div style={{
        padding: 12,
        marginBottom: 12,
        borderRadius: 6,
        background: isDark ? '#1a1a1a' : '#f6ffed',
        border: `1px solid ${isDark ? '#303030' : '#b7eb8f'}`
      }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: isDark ? '#52c41a' : '#389e0d',
          marginBottom: 4
        }}>
          修复说明
        </div>
        <div style={{ fontSize: 13, color: t.text }}>
          {fix.reason}
        </div>
      </div>

      {/* 代码对比 */}
      <div style={{
        border: `1px solid ${t.border}`,
        borderRadius: 6,
        overflow: 'hidden'
      }}>
        <DiffViewer
          oldCode={fix.originalCode}
          newCode={fix.fixedCode}
          oldTitle="原始代码"
          newTitle="修复后代码"
          height={300}
        />
      </div>
    </div>
  )
}
