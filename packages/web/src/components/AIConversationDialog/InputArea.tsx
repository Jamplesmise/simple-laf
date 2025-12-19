/**
 * 输入区域组件
 *
 * 包含文本输入、函数选择器、斜杠命令菜单
 */

import { useRef, useState, useMemo } from 'react'
import { Tag, Input } from 'antd'
import {
  SendOutlined, FolderOutlined, FileOutlined,
  FileSearchOutlined
} from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import type { TreeNode } from '@/api/folders'
import type { CloudFunction } from '@/stores/function'
import { getLogAnalysisMenuItems } from './skills'
import styles from './styles.module.css'

const { TextArea } = Input

interface InputAreaProps {
  value: string
  sending: boolean
  selectedFunctions: string[]
  allFunctions: CloudFunction[]
  folders: TreeNode[]
  enableLogAnalysis: boolean
  logDays: number
  onValueChange: (value: string) => void
  onSend: () => void
  onFunctionSelect: (fnId: string) => void
  onFunctionRemove: (fnId: string) => void
  onLogAnalysisSelect: (days: number) => void
  onLogAnalysisRemove: () => void
}

export function InputArea({
  value,
  sending,
  selectedFunctions,
  allFunctions,
  folders,
  enableLogAnalysis,
  logDays,
  onValueChange,
  onSend,
  onFunctionSelect,
  onFunctionRemove,
  onLogAnalysisSelect,
  onLogAnalysisRemove,
}: InputAreaProps) {
  useThemeColors() // for theme consistency
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [showFunctionPicker, setShowFunctionPicker] = useState(false)
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)

  // 选中文件夹下的函数
  const functionsInFolder = useMemo(() => {
    if (!selectedFolder) return []
    return allFunctions.filter(fn => {
      if (selectedFolder === '__root__') return !fn.folderId
      return fn.folderId === selectedFolder
    })
  }, [selectedFolder, allFunctions])

  // 处理输入变化
  const handleInputChange = (newValue: string) => {
    onValueChange(newValue)

    // 检测 @ 引用函数
    const lastAtIndex = newValue.lastIndexOf('@')
    if (lastAtIndex !== -1 && (lastAtIndex === 0 || newValue[lastAtIndex - 1] === ' ')) {
      const afterAt = newValue.slice(lastAtIndex + 1)
      if (!afterAt.includes(' ')) {
        setShowFunctionPicker(true)
        setShowSlashMenu(false)
        return
      }
    }

    // 检测 / 斜杠命令
    if (newValue === '/' || newValue.endsWith(' /')) {
      setShowSlashMenu(true)
      setShowFunctionPicker(false)
      return
    }

    setShowFunctionPicker(false)
    setShowSlashMenu(false)
  }

  // 处理按键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !showFunctionPicker && !showSlashMenu) {
      e.preventDefault()
      onSend()
    }
    if (e.key === 'Escape') {
      setShowFunctionPicker(false)
      setShowSlashMenu(false)
    }
  }

  // 选择函数
  const handleSelectFunction = (fnId: string) => {
    onFunctionSelect(fnId)
    // 移除输入中的 @
    const lastAtIndex = value.lastIndexOf('@')
    if (lastAtIndex !== -1) {
      onValueChange(value.slice(0, lastAtIndex))
    }
    setShowFunctionPicker(false)
    inputRef.current?.focus()
  }

  // 选择斜杠命令
  const handleSelectSlashCommand = (days: number) => {
    onLogAnalysisSelect(days)
    // 移除输入中的 /
    if (value === '/') {
      onValueChange('')
    } else if (value.endsWith(' /')) {
      onValueChange(value.slice(0, -2))
    }
    setShowSlashMenu(false)
    inputRef.current?.focus()
  }

  const hasTags = selectedFunctions.length > 0 || enableLogAnalysis

  return (
    <div className={styles.inputArea}>
      <div className={styles.inputWrapper}>
        {/* 标签区域 */}
        {hasTags && (
          <div className={styles.inputTags}>
            {/* 日志分析标签 */}
            {enableLogAnalysis && (
              <Tag
                color="green"
                closable
                onClose={onLogAnalysisRemove}
                style={{ margin: 0 }}
              >
                <FileSearchOutlined style={{ marginRight: 4 }} />
                分析 {logDays} 天日志
              </Tag>
            )}

            {/* 选中的函数标签 */}
            {selectedFunctions.map(fnId => {
              const fn = allFunctions.find(f => f._id === fnId)
              return fn ? (
                <Tag
                  key={fnId}
                  closable
                  onClose={() => onFunctionRemove(fnId)}
                  style={{ margin: 0 }}
                >
                  <FileOutlined style={{ marginRight: 4 }} />
                  {fn.name}
                </Tag>
              ) : null
            })}
          </div>
        )}

        {/* 输入主区域 */}
        <div className={styles.inputMain}>
          <TextArea
            ref={inputRef}
            value={value}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (@ 引用函数, / 日志分析)"
            autoSize={{ minRows: 1, maxRows: 6 }}
            className={styles.textarea}
            disabled={sending}
          />
          <button
            className={styles.sendButton}
            onClick={onSend}
            disabled={sending || (!value.trim() && !selectedFunctions.length)}
          >
            <SendOutlined />
          </button>
        </div>

        {/* 函数选择器 */}
        {showFunctionPicker && (
          <FunctionPicker
            folders={folders}
            functions={functionsInFolder}
            selectedFolder={selectedFolder}
            onFolderSelect={setSelectedFolder}
            onFunctionSelect={handleSelectFunction}
            onClose={() => setShowFunctionPicker(false)}
          />
        )}

        {/* 斜杠命令菜单 */}
        {showSlashMenu && (
          <SlashCommandMenu
            onSelect={handleSelectSlashCommand}
            onClose={() => setShowSlashMenu(false)}
          />
        )}
      </div>
    </div>
  )
}

/**
 * 函数选择器
 */
interface FunctionPickerProps {
  folders: TreeNode[]
  functions: CloudFunction[]
  selectedFolder: string | null
  onFolderSelect: (folderId: string) => void
  onFunctionSelect: (fnId: string) => void
  onClose: () => void
}

function FunctionPicker({
  folders,
  functions,
  selectedFolder,
  onFolderSelect,
  onFunctionSelect,
}: FunctionPickerProps) {
  // 构建文件夹列表（包含根目录）
  const folderList = [
    { id: '__root__', name: '根目录' },
    ...flattenFolders(folders)
  ]

  return (
    <div className={styles.functionPicker}>
      <div className={styles.pickerColumns}>
        {/* 文件夹列 */}
        <div className={styles.pickerColumn}>
          {folderList.map(folder => (
            <div
              key={folder.id}
              className={`${styles.pickerItem} ${selectedFolder === folder.id ? styles.pickerItemActive : ''}`}
              onClick={() => onFolderSelect(folder.id)}
            >
              <FolderOutlined />
              <span>{folder.name}</span>
            </div>
          ))}
        </div>

        {/* 函数列 */}
        <div className={styles.pickerColumn}>
          {selectedFolder ? (
            functions.length > 0 ? (
              functions.map(fn => (
                <div
                  key={fn._id}
                  className={styles.pickerItem}
                  onClick={() => onFunctionSelect(fn._id)}
                >
                  <FileOutlined />
                  <span>{fn.name}</span>
                </div>
              ))
            ) : (
              <div className={styles.pickerEmpty}>
                该文件夹下没有函数
              </div>
            )
          ) : (
            <div className={styles.pickerEmpty}>
              请先选择文件夹
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 扁平化文件夹树
function flattenFolders(nodes: TreeNode[], prefix = ''): { id: string; name: string }[] {
  const result: { id: string; name: string }[] = []
  for (const node of nodes) {
    if (!node.isFolder) continue
    const name = prefix ? `${prefix}/${node.title}` : node.title
    result.push({ id: node.key, name })
    if (node.children?.length) {
      result.push(...flattenFolders(node.children, name))
    }
  }
  return result
}

/**
 * 斜杠命令菜单
 */
interface SlashCommandMenuProps {
  onSelect: (days: number) => void
  onClose: () => void
}

function SlashCommandMenu({ onSelect }: SlashCommandMenuProps) {
  const commands = getLogAnalysisMenuItems()

  return (
    <div className={styles.slashMenu}>
      {commands.map(cmd => (
        <div
          key={cmd.command}
          className={styles.slashMenuItem}
          onClick={() => onSelect(cmd.days)}
        >
          <div className={styles.slashMenuCommand}>{cmd.command}</div>
          <div className={styles.slashMenuDesc}>{cmd.description}</div>
        </div>
      ))}
    </div>
  )
}
