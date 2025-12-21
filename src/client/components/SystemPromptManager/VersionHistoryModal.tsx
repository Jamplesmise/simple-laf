import { Modal, Spin, Tag, Popconfirm, Timeline } from 'antd'
import { History, RotateCcw } from 'lucide-react'
import type { AISystemPrompt, AIPromptVersion } from '../../api/aiSystemPrompt'

interface VersionHistoryModalProps {
  open: boolean
  prompt: AISystemPrompt | null
  versions: AIPromptVersion[]
  loading: boolean
  isDark: boolean
  onRollback: (version: number) => void
  onClose: () => void
}

export function VersionHistoryModal({
  open,
  prompt,
  versions,
  loading,
  isDark,
  onRollback,
  onClose
}: VersionHistoryModalProps) {
  return (
    <Modal
      title={`版本历史 - ${prompt?.name || ''}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      zIndex={1100}
    >
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : versions.length === 0 ? (
        <div style={{ padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <History size={32} color="#9ca3af" style={{ marginBottom: 12 }} />
          <span style={{ color: '#6b7280' }}>暂无版本历史</span>
        </div>
      ) : (
        <Timeline
          style={{ marginTop: 16, maxHeight: 400, overflow: 'auto', paddingRight: 8 }}
          items={versions.map((v) => ({
            color: v.version === prompt?.currentVersion ? 'green' : 'gray',
            children: (
              <div style={{
                padding: 12,
                borderRadius: 8,
                marginBottom: 8,
                background: isDark ? '#1f2937' : '#f9fafb',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag color={v.version === prompt?.currentVersion ? 'green' : 'default'}>
                      v{v.version}
                    </Tag>
                    {v.version === prompt?.currentVersion && (
                      <Tag color="blue">当前</Tag>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: isDark ? '#6b7280' : '#9ca3af' }}>
                    {new Date(v.createdAt).toLocaleString()}
                  </span>
                </div>
                {v.changeNote && (
                  <div style={{ fontSize: 12, marginBottom: 8, color: isDark ? '#9ca3af' : '#6b7280' }}>
                    {v.changeNote}
                  </div>
                )}
                <div style={{
                  fontSize: 12,
                  padding: 8,
                  borderRadius: 4,
                  fontFamily: 'monospace',
                  overflow: 'auto',
                  maxHeight: 100,
                  background: isDark ? '#111827' : '#fff',
                  color: isDark ? '#9ca3af' : '#6b7280',
                  border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                }}>
                  {v.content.substring(0, 200)}
                  {v.content.length > 200 && '...'}
                </div>
                {v.version !== prompt?.currentVersion && (
                  <div style={{ marginTop: 8, textAlign: 'right' }}>
                    <Popconfirm
                      title={`确定回滚到版本 ${v.version}？`}
                      onConfirm={() => onRollback(v.version)}
                      okText="确定"
                      cancelText="取消"
                      zIndex={1200}
                    >
                      <button style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        marginLeft: 'auto',
                        padding: '4px 8px',
                        fontSize: 12,
                        color: '#10b981',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                      }}>
                        <RotateCcw size={12} />
                        回滚到此版本
                      </button>
                    </Popconfirm>
                  </div>
                )}
              </div>
            )
          }))}
        />
      )}
    </Modal>
  )
}
