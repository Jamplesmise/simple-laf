import { DiffEditor } from '@monaco-editor/react'
import { useThemeStore } from '../stores/theme'

interface DiffViewerProps {
  oldCode: string
  newCode: string
  oldTitle?: string
  newTitle?: string
  height?: string | number
}

export default function DiffViewer({
  oldCode,
  newCode,
  oldTitle = '旧版本',
  newTitle = '新版本',
  height = 400
}: DiffViewerProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  return (
    <div className="diff-viewer">
      {/* 左右分栏标题 */}
      <div style={{
        display: 'flex',
        backgroundColor: isDark ? '#1e1e1e' : '#f5f5f5',
        borderBottom: `1px solid ${isDark ? '#333' : '#ddd'}`,
      }}>
        <div style={{
          flex: 1,
          padding: '8px 16px',
          fontSize: 12,
          color: isDark ? '#888' : '#666',
          borderRight: `1px solid ${isDark ? '#333' : '#ddd'}`,
          textAlign: 'center'
        }}>
          {oldTitle}
        </div>
        <div style={{
          flex: 1,
          padding: '8px 16px',
          fontSize: 12,
          color: isDark ? '#888' : '#666',
          textAlign: 'center'
        }}>
          {newTitle}
        </div>
      </div>
      <DiffEditor
        height={height}
        original={oldCode}
        modified={newCode}
        language="typescript"
        theme={isDark ? 'vs-dark' : 'light'}
        options={{
          readOnly: true,
          renderSideBySide: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          fontFamily: '"JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
          lineNumbers: 'on',
          folding: false,
          wordWrap: 'on',
          enableSplitViewResizing: true,
          glyphMargin: false,
        }}
      />
    </div>
  )
}
