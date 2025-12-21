import { Plus, FileText } from 'lucide-react'
import { useThemeStore } from '../../stores/theme'

interface EnvTabEmptyProps {
  onAdd: () => void
}

export default function EnvTabEmpty({ onAdd }: EnvTabEmptyProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

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
        width: 64,
        height: 64,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        background: isDark ? '#1f2937' : '#f3f4f6',
      }}>
        <FileText size={28} color={isDark ? '#4b5563' : '#9ca3af'} />
      </div>
      <div style={{
        fontSize: 15,
        fontWeight: 500,
        marginBottom: 8,
        color: isDark ? '#d1d5db' : '#4b5563',
      }}>
        暂无环境变量
      </div>
      <div style={{
        fontSize: 13,
        marginBottom: 16,
        color: isDark ? '#6b7280' : '#9ca3af',
      }}>
        环境变量可在云函数中通过 process.env 访问
      </div>
      <button
        onClick={onAdd}
        style={{
          padding: '8px 16px',
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
        添加环境变量
      </button>
    </div>
  )
}
