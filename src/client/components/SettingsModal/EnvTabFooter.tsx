import { useThemeStore } from '../../stores/theme'

interface EnvTabFooterProps {
  hasChanges: boolean
  isSaving: boolean
  onReset: () => void
  onSave: () => void
}

export default function EnvTabFooter({ hasChanges, isSaving, onReset, onSave }: EnvTabFooterProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  return (
    <div style={{
      height: 64,
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 12,
      borderTop: `1px solid ${isDark ? '#374151' : '#f3f4f6'}`,
      flexShrink: 0,
      background: isDark ? 'rgba(31, 41, 55, 0.5)' : 'rgba(249, 250, 251, 0.5)',
      marginTop: 16,
    }}>
      <button
        onClick={onReset}
        disabled={!hasChanges}
        style={{
          padding: '8px 20px',
          fontSize: 13,
          fontWeight: 500,
          borderRadius: 6,
          border: 'none',
          cursor: hasChanges ? 'pointer' : 'not-allowed',
          background: hasChanges ? (isDark ? '#374151' : '#e5e7eb') : (isDark ? '#1f2937' : '#f3f4f6'),
          color: hasChanges ? (isDark ? '#d1d5db' : '#374151') : '#9ca3af',
        }}
      >
        重置
      </button>
      <button
        onClick={onSave}
        disabled={isSaving}
        style={{
          padding: '8px 20px',
          fontSize: 13,
          fontWeight: 500,
          borderRadius: 6,
          border: 'none',
          cursor: isSaving ? 'not-allowed' : 'pointer',
          background: isSaving ? '#6ee7b7' : '#10b981',
          color: '#fff',
        }}
      >
        {isSaving ? '保存中...' : '保存更改'}
      </button>
    </div>
  )
}
