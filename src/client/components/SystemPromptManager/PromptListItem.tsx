import { Tag, Tooltip, Popconfirm } from 'antd'
import { Star, History, Pencil, Trash2 } from 'lucide-react'
import type { AISystemPrompt } from '../../api/aiSystemPrompt'

interface PromptListItemProps {
  prompt: AISystemPrompt
  isDark: boolean
  selectable: boolean
  isSelected: boolean
  onSelect: (prompt: AISystemPrompt) => void
  onEdit: (prompt: AISystemPrompt) => void
  onDelete: (prompt: AISystemPrompt) => void
  onSetDefault: (prompt: AISystemPrompt) => void
  onViewHistory: (prompt: AISystemPrompt) => void
}

export function PromptListItem({
  prompt,
  isDark,
  selectable,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
  onViewHistory
}: PromptListItemProps) {
  return (
    <div
      onClick={() => onSelect(prompt)}
      style={{
        padding: 12,
        borderRadius: 8,
        cursor: selectable ? 'pointer' : 'default',
        border: isSelected
          ? '2px solid #10b981'
          : `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
        background: isDark ? '#1f2937' : '#f9fafb',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        {/* Left content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: isDark ? '#e5e7eb' : '#1f2937',
            }}>
              {prompt.name}
            </span>
            {prompt.isDefault && (
              <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>默认</Tag>
            )}
            <span style={{
              fontSize: 11,
              fontFamily: 'monospace',
              padding: '2px 6px',
              borderRadius: 4,
              background: isDark ? '#374151' : '#e5e7eb',
              color: isDark ? '#9ca3af' : '#6b7280',
            }}>
              v{prompt.currentVersion}
            </span>
          </div>
          <div style={{
            fontSize: 12,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: isDark ? '#6b7280' : '#9ca3af',
          }}>
            {prompt.content.substring(0, 100)}...
          </div>
        </div>

        {/* Right actions */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 12, flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {!prompt.isDefault ? (
            <Tooltip title="设为默认">
              <button
                onClick={() => onSetDefault(prompt)}
                style={{
                  padding: 6,
                  borderRadius: 4,
                  border: 'none',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: isDark ? '#6b7280' : '#9ca3af',
                }}
              >
                <Star size={14} />
              </button>
            </Tooltip>
          ) : (
            <Tooltip title="当前默认">
              <button style={{
                padding: 6,
                borderRadius: 4,
                border: 'none',
                background: 'transparent',
                color: '#f59e0b',
                cursor: 'default',
              }}>
                <Star size={14} fill="currentColor" />
              </button>
            </Tooltip>
          )}
          <Tooltip title="版本历史">
            <button
              onClick={() => onViewHistory(prompt)}
              style={{
                padding: 6,
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                background: 'transparent',
                color: isDark ? '#6b7280' : '#9ca3af',
              }}
            >
              <History size={14} />
            </button>
          </Tooltip>
          <Tooltip title="编辑">
            <button
              onClick={() => onEdit(prompt)}
              style={{
                padding: 6,
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                background: 'transparent',
                color: isDark ? '#6b7280' : '#9ca3af',
              }}
            >
              <Pencil size={14} />
            </button>
          </Tooltip>
          <Popconfirm
            title="确定删除？"
            onConfirm={() => onDelete(prompt)}
            okText="删除"
            cancelText="取消"
            zIndex={1100}
          >
            <Tooltip title="删除">
              <button style={{
                padding: 6,
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                background: 'transparent',
                color: isDark ? '#6b7280' : '#9ca3af',
              }}>
                <Trash2 size={14} />
              </button>
            </Tooltip>
          </Popconfirm>
        </div>
      </div>
    </div>
  )
}
