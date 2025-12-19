/**
 * 文档编辑器组件
 *
 * 使用 Monaco Editor 编辑 JSON 文档
 */

import { useRef, useEffect, useCallback } from 'react'
import { Button, Tooltip, Empty, message } from 'antd'
import { SaveOutlined, CodeOutlined } from '@ant-design/icons'
import * as monaco from 'monaco-editor'
import { useThemeColors } from '@/hooks/useTheme'
import type { Document } from '@/api/database'
import styles from './styles.module.css'

interface DocumentEditorProps {
  document: Document | null
  isCreating: boolean
  onSave: (doc: Record<string, unknown>) => Promise<void>
}

export function DocumentEditor({
  document,
  isCreating,
  onSave,
}: DocumentEditorProps) {
  const { isDark, t } = useThemeColors()
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 初始化编辑器
  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      editorRef.current = monaco.editor.create(containerRef.current, {
        language: 'json',
        theme: isDark ? 'vs-dark' : 'vs',
        minimap: { enabled: false },
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        fontSize: 13,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
        tabSize: 2,
        wordWrap: 'on',
        folding: true,
        formatOnPaste: true,
        renderLineHighlight: 'none',
        overviewRulerBorder: false,
        hideCursorInOverviewRuler: true,
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
        },
        padding: { top: 12, bottom: 12 },
      })
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.dispose()
        editorRef.current = null
      }
    }
  }, [])

  // 更新编辑器主题
  useEffect(() => {
    monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs')
  }, [isDark])

  // 更新编辑器内容
  useEffect(() => {
    if (editorRef.current) {
      if (isCreating) {
        editorRef.current.setValue('{\n  \n}')
      } else if (document) {
        editorRef.current.setValue(JSON.stringify(document, null, 2))
      } else {
        editorRef.current.setValue('')
      }
    }
  }, [document, isCreating])

  // 保存文档
  const handleSave = useCallback(async () => {
    if (!editorRef.current) return

    try {
      const content = editorRef.current.getValue()
      const doc = JSON.parse(content)
      await onSave(doc)
      message.success(isCreating ? '创建成功' : '更新成功')
    } catch (err) {
      if (err instanceof SyntaxError) {
        message.error('JSON 格式错误')
      } else {
        message.error((err as Error).message || '保存失败')
      }
    }
  }, [isCreating, onSave])

  // 复制 ID
  const handleCopyId = useCallback(() => {
    if (document) {
      navigator.clipboard.writeText(document._id)
      message.success('已复制')
    }
  }, [document])

  const showEditor = document || isCreating

  return (
    <div className={styles.editor} style={{ background: t.bgHover }}>
      {/* 编辑器头部 */}
      <div className={styles.editorHeader} style={{ background: t.bg, borderColor: t.borderLight }}>
        <div className={styles.editorTitle}>
          {isCreating ? (
            <span style={{ color: t.text, fontSize: 13, fontWeight: 500 }}>
              New Document
            </span>
          ) : document ? (
            <>
              <span className={styles.editorDocId} style={{ color: t.textMuted }}>
                {document._id.slice(0, 8)}...{document._id.slice(-6)}
              </span>
              <Tooltip title="复制 ID">
                <Button
                  type="text"
                  size="small"
                  icon={<CodeOutlined style={{ fontSize: 12 }} />}
                  onClick={handleCopyId}
                  style={{ color: t.textMuted, width: 24, height: 24 }}
                />
              </Tooltip>
            </>
          ) : (
            <span style={{ color: t.textMuted, fontSize: 13 }}>No Selection</span>
          )}
        </div>
        {showEditor && (
          <Button
            type="primary"
            size="small"
            icon={<SaveOutlined />}
            onClick={handleSave}
            style={{
              background: '#10B981',
              borderColor: '#10B981',
              borderRadius: 5,
              fontSize: 12,
              height: 28,
              paddingLeft: 10,
              paddingRight: 10,
            }}
          >
            保存
          </Button>
        )}
      </div>

      {/* 编辑器主体 */}
      <div className={styles.editorBody} style={{ background: t.bg }}>
        {!showEditor && (
          <div className={styles.editorPlaceholder} style={{ color: t.textMuted }}>
            <Empty description="选择或创建文档" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        )}
        <div
          ref={containerRef}
          style={{
            height: '100%',
            visibility: showEditor ? 'visible' : 'hidden',
          }}
        />
      </div>
    </div>
  )
}
