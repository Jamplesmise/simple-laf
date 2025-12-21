import { Plus } from 'lucide-react'

interface PromptListHeaderProps {
  isDark: boolean
  onCreateClick: () => void
}

export function PromptListHeader({ isDark, onCreateClick }: PromptListHeaderProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 16,
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 14, fontWeight: 500, color: isDark ? '#e5e7eb' : '#374151' }}>
        系统提示词
      </span>
      <button
        onClick={onCreateClick}
        style={{
          padding: '6px 12px',
          fontSize: 13,
          fontWeight: 500,
          color: '#fff',
          background: '#10b981',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Plus size={16} />
        新建
      </button>
    </div>
  )
}
