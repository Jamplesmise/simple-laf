import { Plus, MessageSquare } from 'lucide-react'

interface EmptyStateProps {
  isDark: boolean
  onCreateClick: () => void
}

export function EmptyState({ isDark, onCreateClick }: EmptyStateProps) {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 48,
    }}>
      <div style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        background: isDark ? '#1f2937' : '#ecfdf5',
      }}>
        <MessageSquare size={36} color={isDark ? '#4b5563' : '#10b981'} />
      </div>
      <div style={{
        fontSize: 17,
        fontWeight: 500,
        marginBottom: 8,
        color: isDark ? '#e5e7eb' : '#374151',
      }}>
        暂无系统提示词
      </div>
      <div style={{
        fontSize: 13,
        textAlign: 'center',
        maxWidth: 280,
        marginBottom: 20,
        color: isDark ? '#6b7280' : '#9ca3af',
      }}>
        系统提示词可以定义 AI 的行为方式和角色设定，帮助获得更精准的回答
      </div>
      <button
        onClick={onCreateClick}
        style={{
          padding: '10px 20px',
          fontSize: 13,
          fontWeight: 500,
          color: '#fff',
          background: '#10b981',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Plus size={18} />
        创建提示词
      </button>
    </div>
  )
}
