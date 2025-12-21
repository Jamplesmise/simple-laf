/**
 * 获取模态框样式
 */
export function getModalStyles(isDark: boolean) {
  return {
    overlay: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.3)',
      backdropFilter: 'blur(4px)',
      zIndex: 1000,
    },
    container: {
      position: 'fixed' as const,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '60vw',
      height: '65vh',
      maxWidth: 900,
      minWidth: 600,
      maxHeight: 700,
      minHeight: 500,
      borderRadius: 16,
      display: 'flex',
      flexDirection: 'column' as const,
      overflow: 'hidden',
      zIndex: 1001,
      background: isDark ? '#111827' : '#fff',
      boxShadow: isDark
        ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)'
        : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    },
    header: {
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      flexShrink: 0,
      borderBottom: `1px solid ${isDark ? '#374151' : '#f3f4f6'}`,
    },
    content: {
      flex: 1,
      overflow: 'auto' as const,
      padding: 24,
    },
  }
}
