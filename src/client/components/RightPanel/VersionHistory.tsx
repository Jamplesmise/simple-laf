/**
 * 版本历史面板
 *
 * 显示函数版本列表，支持查看对比和回滚
 */

import { Button, Tag, Spin } from 'antd'
import { useThemeColors } from '@/hooks/useTheme'
import type { FunctionVersion } from '@/api/functions'
import { formatDate } from './utils'

interface VersionHistoryProps {
  versions: FunctionVersion[]
  loading: boolean
  onViewVersion: (version: FunctionVersion) => void
  onRollback: (version: number) => void
}

export function VersionHistory({
  versions,
  loading,
  onViewVersion,
  onRollback,
}: VersionHistoryProps) {
  const { isDark, t } = useThemeColors()

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin />
      </div>
    )
  }

  if (versions.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: 60,
        color: t.textSecondary,
      }}>
        <div style={{ fontSize: 14 }}>暂无版本记录</div>
        <div style={{ fontSize: 12, marginTop: 8, opacity: 0.7 }}>
          发布函数后将在此显示版本历史
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '12px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {versions.map((v, index) => (
          <div
            key={v.version}
            onClick={() => onViewVersion(v)}
            style={{
              padding: '14px 16px',
              background: t.bgCard,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.04)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#10B981'
              e.currentTarget.style.boxShadow = isDark
                ? '0 2px 8px rgba(16, 185, 129, 0.15)'
                : '0 2px 8px rgba(16, 185, 129, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = t.border
              e.currentTarget.style.boxShadow = isDark
                ? '0 1px 4px rgba(0,0,0,0.2)'
                : '0 1px 4px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: t.text,
                  }}>
                    v{v.version}
                  </span>
                  {index === 0 && (
                    <Tag
                      color="#10B981"
                      style={{
                        fontSize: 10,
                        lineHeight: '18px',
                        padding: '0 8px',
                        borderRadius: 10,
                        border: 'none',
                      }}
                    >
                      最新
                    </Tag>
                  )}
                </div>
                <div style={{
                  fontSize: 12,
                  color: t.textSecondary,
                  marginTop: 6,
                }}>
                  {formatDate(v.createdAt)}
                </div>
                {v.changelog && (
                  <div style={{
                    fontSize: 13,
                    color: t.textSecondary,
                    marginTop: 8,
                    lineHeight: 1.5,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {v.changelog}
                  </div>
                )}
              </div>
              <Button
                type="default"
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  onRollback(v.version)
                }}
                style={{
                  borderRadius: 6,
                  fontSize: 12,
                  color: t.textSecondary,
                  borderColor: t.border,
                  background: t.bgCard,
                }}
              >
                回滚
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
