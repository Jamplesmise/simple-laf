import { useEffect, useRef, useCallback } from 'react'
import * as monaco from 'monaco-editor'
import { useSiteStore } from '../../stores/site'

// 根据文件扩展名获取语言
function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'html':
    case 'htm':
      return 'html'
    case 'css':
      return 'css'
    case 'js':
    case 'mjs':
      return 'javascript'
    case 'ts':
      return 'typescript'
    case 'json':
      return 'json'
    case 'md':
      return 'markdown'
    case 'xml':
      return 'xml'
    case 'svg':
      return 'xml'
    default:
      return 'plaintext'
  }
}

export default function SiteEditor() {
  const { currentFile, fileContent, setFileContent, saveFile } = useSiteStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  // 保存快捷键
  const handleSave = useCallback(() => {
    saveFile()
  }, [saveFile])

  // 初始化编辑器
  useEffect(() => {
    if (!containerRef.current) return

    const editor = monaco.editor.create(containerRef.current, {
      value: fileContent,
      language: currentFile ? getLanguage(currentFile.name) : 'plaintext',
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      tabSize: 2,
    })

    editorRef.current = editor

    // 监听内容变化
    editor.onDidChangeModelContent(() => {
      setFileContent(editor.getValue())
    })

    // 添加保存快捷键
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave()
    })

    return () => {
      editor.dispose()
    }
  }, [])

  // 更新编辑器内容和语言
  useEffect(() => {
    if (!editorRef.current) return

    const editor = editorRef.current
    const model = editor.getModel()

    if (model) {
      // 只有内容不同时才更新
      if (model.getValue() !== fileContent) {
        model.setValue(fileContent)
      }

      // 更新语言
      if (currentFile) {
        const lang = getLanguage(currentFile.name)
        if (model.getLanguageId() !== lang) {
          monaco.editor.setModelLanguage(model, lang)
        }
      }
    }
  }, [fileContent, currentFile])

  if (!currentFile) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#999',
          fontSize: 14,
        }}
      >
        选择一个文件开始编辑
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
