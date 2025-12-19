import { useRef, useEffect, useState, useCallback } from 'react'
import MonacoEditor, { OnMount, loader } from '@monaco-editor/react'
import { message, Spin, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import { useFunctionStore } from '../stores/function'
import { useThemeStore } from '../stores/theme'
import { useAIStore } from '../stores/ai'
import { functionApi } from '../api/functions'
import FunctionImportPicker from './FunctionImportPicker'
import * as monaco from 'monaco-editor'

// 使用本地 Monaco
loader.config({ monaco })

// 自定义右键菜单项
interface ContextMenuState {
  visible: boolean
  x: number
  y: number
}

export default function Editor() {
  const { current, updateCurrent } = useFunctionStore()
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'
  const openConversationDialog = useAIStore((state) => state.openConversationDialog)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 函数导入选择器
  const [showImportPicker, setShowImportPicker] = useState(false)
  const importTriggerPositionRef = useRef<{ lineNumber: number; column: number } | null>(null)

  // 自定义右键菜单
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 })

  // 触发 Monaco 命令
  const triggerAction = useCallback((actionId: string) => {
    const editor = editorRef.current
    if (editor) {
      editor.trigger('contextMenu', actionId, null)
      editor.focus()
    }
    setContextMenu({ visible: false, x: 0, y: 0 })
  }, [])

  // 菜单项（精简版）
  const menuItems: MenuProps['items'] = [
    { key: 'cut', label: '剪切', extra: 'Ctrl+X', onClick: () => triggerAction('editor.action.clipboardCutAction') },
    { key: 'copy', label: '复制', extra: 'Ctrl+C', onClick: () => triggerAction('editor.action.clipboardCopyAction') },
    { key: 'paste', label: '粘贴', extra: 'Ctrl+V', onClick: () => { document.execCommand('paste'); setContextMenu({ visible: false, x: 0, y: 0 }) } },
    { type: 'divider' },
    { key: 'revealDefinition', label: '转到定义', extra: 'F12', onClick: () => triggerAction('editor.action.revealDefinition') },
    { key: 'goToReferences', label: '转到引用', extra: 'Shift+F12', onClick: () => triggerAction('editor.action.goToReferences') },
    { key: 'rename', label: '重命名符号', extra: 'F2', onClick: () => triggerAction('editor.action.rename') },
    { type: 'divider' },
    { key: 'formatDocument', label: '格式化文档', extra: 'Shift+Alt+F', onClick: () => triggerAction('editor.action.formatDocument') },
    {
      key: 'importFunction',
      label: '导入函数 (@/...)',
      extra: 'Ctrl+Shift+I',
      onClick: () => {
        const editor = editorRef.current
        if (editor) {
          const position = editor.getPosition()
          if (position) {
            importTriggerPositionRef.current = position
            setShowImportPicker(true)
          }
        }
        setContextMenu({ visible: false, x: 0, y: 0 })
      }
    },
    { type: 'divider' },
    {
      key: 'aiChat',
      label: 'AI 对话助手',
      onClick: () => {
        const editor = editorRef.current
        if (editor) {
          const selection = editor.getSelection()
          const selectedCode = selection ? editor.getModel()?.getValueInRange(selection) : ''
          openConversationDialog({
            selectedCode: selectedCode || undefined,
            functionId: current?._id
          })
        }
        setContextMenu({ visible: false, x: 0, y: 0 })
      }
    },
  ]

  // 处理函数导入选择
  const handleImportSelect = useCallback((importPath: string) => {
    const editor = editorRef.current
    if (!editor) return

    const position = importTriggerPositionRef.current
    if (!position) return

    const model = editor.getModel()
    if (!model) return

    // 删除触发的 @/ 字符
    const range = {
      startLineNumber: position.lineNumber,
      startColumn: position.column - 2,
      endLineNumber: position.lineNumber,
      endColumn: position.column
    }

    // 生成 import 语句
    const importStatement = `import { } from '@/${importPath}'`

    // 替换文本
    editor.executeEdits('function-import', [{
      range,
      text: importStatement,
      forceMoveMarkers: true
    }])

    // 将光标移动到 { } 之间
    const newColumn = position.column - 2 + 'import { '.length
    editor.setPosition({ lineNumber: position.lineNumber, column: newColumn })
    editor.focus()
  }, [])

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor

    // 添加保存快捷键
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => { saveCode() }
    )

    // 添加导入函数快捷键
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyI,
      () => {
        const position = editor.getPosition()
        if (position) {
          importTriggerPositionRef.current = position
          setShowImportPicker(true)
        }
      }
    )

    // 监听输入，检测 @/ 触发函数导入选择器
    editor.onDidChangeModelContent((e) => {
      for (const change of e.changes) {
        if (change.text === '/') {
          const model = editor.getModel()
          if (!model) continue

          const lineNumber = change.range.startLineNumber
          const insertColumn = change.range.startColumn
          const lineContent = model.getLineContent(lineNumber)
          const textBeforeSlash = lineContent.substring(0, insertColumn - 1)

          if (textBeforeSlash.endsWith('@')) {
            importTriggerPositionRef.current = {
              lineNumber: lineNumber,
              column: insertColumn + 1
            }
            setShowImportPicker(true)
          }
        }
      }
    })

    // 监听右键菜单
    editor.onContextMenu((e) => {
      e.event.preventDefault()
      e.event.stopPropagation()
      setContextMenu({
        visible: true,
        x: e.event.posx,
        y: e.event.posy
      })
    })
  }

  const handleEditorChange = (value: string | undefined) => {
    if (!current || value === undefined) return

    updateCurrent({ code: value })

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      autoSave(value)
    }, 2000)
  }

  const autoSave = async (code: string) => {
    if (!current) return
    try {
      await functionApi.update(current._id, code)
    } catch {
      // 静默失败
    }
  }

  const saveCode = async () => {
    if (!current) return
    try {
      await functionApi.update(current._id, current.code)
      message.success('保存成功')
    } catch {
      message.error('保存失败')
    }
  }

  // 点击其他地方关闭菜单
  useEffect(() => {
    const handleClick = () => {
      if (contextMenu.visible) {
        setContextMenu({ visible: false, x: 0, y: 0 })
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [contextMenu.visible])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  if (!current) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: isDark ? '#666' : '#999',
          background: isDark ? '#1e1e1e' : '#fff',
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY
          })
        }}
      >
        请选择或创建一个函数
        {/* 空状态下的右键菜单 */}
        <Dropdown
          menu={{ items: menuItems.filter(item => item.key === 'aiChat') }}
          open={contextMenu.visible}
          trigger={['contextMenu']}
          overlayStyle={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <div
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              width: 1,
              height: 1,
              pointerEvents: 'none'
            }}
          />
        </Dropdown>
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ height: '100%', position: 'relative' }}>
      <MonacoEditor
        height="100%"
        language="typescript"
        theme={isDark ? 'vs-dark' : 'light'}
        value={current.code}
        onChange={handleEditorChange}
        onMount={handleEditorMount}
        loading={<Spin tip="加载编辑器..." />}
        options={{
          fontSize: 14,
          fontFamily: '"JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          lineNumbers: 'on',
          renderWhitespace: 'selection',
          bracketPairColorization: { enabled: true },
          glyphMargin: false,
          overviewRulerBorder: false,
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          contextmenu: false, // 禁用默认右键菜单
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
        }}
      />

      {/* 自定义右键菜单 */}
      <Dropdown
        menu={{ items: menuItems }}
        open={contextMenu.visible}
        trigger={['contextMenu']}
        overlayStyle={{
          position: 'fixed',
          left: contextMenu.x,
          top: contextMenu.y,
        }}
      >
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            width: 1,
            height: 1,
            pointerEvents: 'none'
          }}
        />
      </Dropdown>

      {/* 函数导入选择器 */}
      <FunctionImportPicker
        open={showImportPicker}
        onClose={() => setShowImportPicker(false)}
        onSelect={handleImportSelect}
      />
    </div>
  )
}
