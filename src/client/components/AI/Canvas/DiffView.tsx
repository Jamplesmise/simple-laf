/**
 * DiffView - 代码 Diff 对比视图
 *
 * 使用 Monaco Editor 的 diff 模式显示代码变更
 */

import { DiffEditor } from '@monaco-editor/react'
import { useThemeColors } from '@/hooks/useTheme'
import type { DiffResult } from '@/api/aiConversation'
import styles from './styles.module.css'

interface DiffViewProps {
  /** 原始代码 */
  originalCode: string
  /** 修改后的代码 */
  modifiedCode: string
  /** Diff 统计信息 */
  diffStats?: DiffResult['stats']
  /** 语言 */
  language?: string
  /** 高度 */
  height?: string | number
}

export function DiffView({
  originalCode,
  modifiedCode,
  diffStats,
  language = 'typescript',
  height = '100%',
}: DiffViewProps) {
  const { isDark } = useThemeColors()

  return (
    <div className={styles.diffViewContainer}>
      {/* Diff 统计 */}
      {diffStats && (
        <div className={styles.diffStats}>
          <span className={styles.diffStatAdded}>+{diffStats.added} 新增</span>
          <span className={styles.diffStatRemoved}>-{diffStats.removed} 删除</span>
          {diffStats.modified > 0 && (
            <span className={styles.diffStatModified}>~{diffStats.modified} 修改</span>
          )}
        </div>
      )}

      {/* Diff 编辑器 */}
      <div className={styles.diffEditorWrapper}>
        <DiffEditor
          height={height}
          language={language}
          theme={isDark ? 'vs-dark' : 'light'}
          original={originalCode}
          modified={modifiedCode}
          options={{
            readOnly: true,
            fontSize: 13,
            fontFamily: '"JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            renderSideBySide: true,
            lineNumbers: 'on',
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
            renderOverviewRuler: false,
          }}
        />
      </div>
    </div>
  )
}
