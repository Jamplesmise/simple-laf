import { useState, useEffect, useCallback } from 'react'
import { Modal, Button } from 'antd'
import { folderApi, type TreeNode } from '../api/folders'
import { functionApi } from '../api/functions'
import { useThemeStore } from '../stores/theme'
import type { CloudFunction } from '../stores/function'

interface FunctionOption {
  value: string
  label: string
  path?: string
  folderId?: string
}

interface FunctionImportPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (importPath: string) => void
}

export default function FunctionImportPicker({ open, onClose, onSelect }: FunctionImportPickerProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  const [folders, setFolders] = useState<TreeNode[]>([])
  const [allFunctions, setAllFunctions] = useState<FunctionOption[]>([])
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // 加载文件夹和函数
  const loadData = useCallback(async () => {
    try {
      const [foldersRes, functionsRes] = await Promise.all([
        folderApi.getTree(),
        functionApi.list()
      ])
      // 只取文件夹节点 (isFolder: true)
      const folderNodes = (foldersRes.data.data || []).filter(node => node.isFolder)
      setFolders(folderNodes)
      setAllFunctions((functionsRes.data.data || []).map((fn: CloudFunction) => ({
        value: fn._id,
        label: fn.name,
        path: fn.path || fn.name,
        folderId: fn.folderId
      })))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (open) {
      loadData()
      setSelectedFolder(null)
    }
  }, [open, loadData])

  // 获取当前文件夹下的函数
  const getFunctionsInFolder = (folderId: string | null): FunctionOption[] => {
    return allFunctions.filter(fn => {
      const fnFolderId = (fn as unknown as { folderId?: string }).folderId
      if (folderId === '__root__') {
        return !fnFolderId
      }
      return fnFolderId === folderId
    })
  }

  const functionsInFolder = selectedFolder ? getFunctionsInFolder(selectedFolder) : []

  // 切换文件夹展开状态
  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId)
    } else {
      newExpanded.add(folderId)
    }
    setExpandedFolders(newExpanded)
  }

  // 选择函数
  const handleSelectFunction = (fn: FunctionOption) => {
    const importPath = fn.path || fn.label
    onSelect(importPath)
    onClose()
  }

  // 渲染文件夹树
  const renderFolderTree = (nodes: TreeNode[], level: number): React.ReactNode => {
    // 只渲染文件夹节点
    const folderNodes = nodes.filter(n => n.isFolder)
    return folderNodes.map(node => (
      <div key={node.key}>
        <div
          onClick={() => {
            setSelectedFolder(node.key)
            const childFolders = node.children?.filter(c => c.isFolder) || []
            if (childFolders.length > 0) {
              toggleFolder(node.key)
            }
          }}
          style={{
            padding: '6px 8px',
            paddingLeft: 8 + level * 16,
            cursor: 'pointer',
            borderRadius: 4,
            fontSize: 13,
            background: selectedFolder === node.key
              ? (isDark ? 'rgba(0, 169, 166, 0.15)' : 'rgba(0, 169, 166, 0.1)')
              : 'transparent',
            color: isDark ? '#e0e0e0' : '#333',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {node.children?.some(c => c.isFolder) && (
            <span style={{ fontSize: 10, color: isDark ? '#666' : '#999' }}>
              {expandedFolders.has(node.key) ? '▼' : '▶'}
            </span>
          )}
          <span>📁 {node.title}</span>
        </div>
        {node.children && expandedFolders.has(node.key) && renderFolderTree(node.children, level + 1)}
      </div>
    ))
  }

  return (
    <Modal
      title="选择要导入的函数"
      open={open}
      onCancel={onClose}
      footer={
        <Button onClick={onClose}>取消</Button>
      }
      width={500}
      styles={{
        body: { padding: 0 }
      }}
    >
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: isDark ? '#888' : '#666', marginBottom: 12 }}>
          选择函数后将插入 <code style={{ background: isDark ? '#333' : '#f0f0f0', padding: '2px 6px', borderRadius: 4 }}>import {'{ ... }'} from '@/path'</code>
        </div>
        <div style={{ display: 'flex', gap: 12, height: 280 }}>
          {/* 左栏: 文件夹树 */}
          <div style={{
            flex: 1,
            border: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
            borderRadius: 6,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{
              padding: '8px 12px',
              background: isDark ? '#1a1a1a' : '#fafafa',
              borderBottom: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
              fontSize: 12,
              fontWeight: 600,
              color: isDark ? '#888' : '#666',
            }}>
              文件夹
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 4 }}>
              {/* 根目录 */}
              <div
                onClick={() => setSelectedFolder('__root__')}
                style={{
                  padding: '6px 8px',
                  cursor: 'pointer',
                  borderRadius: 4,
                  fontSize: 13,
                  background: selectedFolder === '__root__'
                    ? (isDark ? 'rgba(0, 169, 166, 0.15)' : 'rgba(0, 169, 166, 0.1)')
                    : 'transparent',
                  color: isDark ? '#e0e0e0' : '#333',
                }}
              >
                📁 根目录
              </div>
              {renderFolderTree(folders, 0)}
            </div>
          </div>

          {/* 右栏: 函数列表 */}
          <div style={{
            flex: 1,
            border: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
            borderRadius: 6,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{
              padding: '8px 12px',
              background: isDark ? '#1a1a1a' : '#fafafa',
              borderBottom: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
              fontSize: 12,
              fontWeight: 600,
              color: isDark ? '#888' : '#666',
            }}>
              函数
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 4 }}>
              {!selectedFolder ? (
                <div style={{ padding: 20, textAlign: 'center', color: isDark ? '#666' : '#999', fontSize: 12 }}>
                  请先选择文件夹
                </div>
              ) : functionsInFolder.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: isDark ? '#666' : '#999', fontSize: 12 }}>
                  该文件夹下没有函数
                </div>
              ) : (
                functionsInFolder.map(fn => (
                  <div
                    key={fn.value}
                    onClick={() => handleSelectFunction(fn)}
                    style={{
                      padding: '8px 10px',
                      cursor: 'pointer',
                      borderRadius: 4,
                      fontSize: 13,
                      color: isDark ? '#e0e0e0' : '#333',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isDark ? '#2a2a2a' : '#f5f5f5'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <span style={{ color: '#00a9a6', fontWeight: 600 }}>ƒ</span>
                    <div>
                      <div>{fn.label}</div>
                      {fn.path && fn.path !== fn.label && (
                        <div style={{ fontSize: 11, color: isDark ? '#666' : '#999' }}>
                          @/{fn.path}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
