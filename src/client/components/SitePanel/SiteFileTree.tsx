import { useState, useMemo } from 'react'
import { Tree, Dropdown, Input, Modal, message, Button, Space } from 'antd'
import {
  FileOutlined,
  FolderOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  Html5Outlined,
  FileTextOutlined,
  HistoryOutlined,
} from '@ant-design/icons'
import type { DataNode, TreeProps } from 'antd/es/tree'
import { useSiteStore } from '../../stores/site'
import { useThemeStore } from '../../stores/theme'
import type { SiteFile, SiteFileVersion } from '../../api/site'
import SiteVersionHistory from './SiteVersionHistory'

// 文件图标映射
function getFileIcon(name: string, isDirectory: boolean): React.ReactNode {
  if (isDirectory) return <FolderOutlined style={{ color: '#faad14' }} />

  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'html':
    case 'htm':
      return <Html5Outlined style={{ color: '#e34c26' }} />
    case 'css':
      return <FileTextOutlined style={{ color: '#264de4' }} />
    case 'js':
    case 'mjs':
      return <FileTextOutlined style={{ color: '#f7df1e' }} />
    case 'json':
      return <FileTextOutlined style={{ color: '#5b5b5b' }} />
    default:
      return <FileOutlined />
  }
}

// 文件模板
function getFileTemplate(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'html':
      return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>页面标题</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <h1>Hello World</h1>

  <script src="/js/app.js"></script>
</body>
</html>`
    case 'css':
      return `/* 样式文件 */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  margin: 0;
  padding: 20px;
}

h1 {
  color: #059669;
}
`
    case 'js':
      return `// JavaScript 文件

// 调用云函数示例
async function callApi() {
  const response = await fetch('/invoke/hello')
  const data = await response.json()
  console.log(data)
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('页面加载完成')
})
`
    case 'json':
      return '{\n  \n}'
    default:
      return ''
  }
}

interface SiteFileTreeProps {
  onFileSelect?: (file: SiteFile) => void
}

export default function SiteFileTree({ onFileSelect }: SiteFileTreeProps) {
  const {
    files,
    currentFile,
    selectFile,
    createFile,
    createFolder,
    deleteFile,
    renameFile,
    fetchFiles,
    filesLoading,
  } = useSiteStore()

  const { mode: themeMode } = useThemeStore()
  const isDark = themeMode === 'dark'

  const [modalState, setModalState] = useState<{
    visible: boolean
    type: 'file' | 'folder' | 'rename'
    parentPath: string
    oldPath?: string
  }>({ visible: false, type: 'file', parentPath: '/' })
  const [inputValue, setInputValue] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<string[]>(['/'])
  const [versionHistoryPath, setVersionHistoryPath] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SiteFile | null>(null)
  const [deleting, setDeleting] = useState(false)

  // 构建树数据
  const treeData = useMemo(() => {
    const map = new Map<string, DataNode & { file: SiteFile }>()
    const roots: (DataNode & { file: SiteFile })[] = []

    // 排序：目录在前，文件在后，按名称排序
    const sortedFiles = [...files].sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })

    // 创建节点
    for (const file of sortedFiles) {
      const node: DataNode & { file: SiteFile } = {
        key: file.path,
        title: file.name,
        icon: getFileIcon(file.name, file.isDirectory),
        isLeaf: !file.isDirectory,
        children: [],
        file,
      }
      map.set(file.path, node)
    }

    // 构建树结构
    for (const file of sortedFiles) {
      const node = map.get(file.path)!
      const parentPath = file.path.substring(0, file.path.lastIndexOf('/')) || '/'

      if (parentPath === '' || parentPath === '/') {
        roots.push(node)
      } else {
        const parent = map.get(parentPath)
        if (parent) {
          parent.children = parent.children || []
          parent.children.push(node)
        } else {
          roots.push(node)
        }
      }
    }

    return roots
  }, [files])

  // 处理选择
  const handleSelect: TreeProps['onSelect'] = (keys) => {
    if (keys.length === 0) return
    const file = files.find((f) => f.path === keys[0])
    if (file && !file.isDirectory) {
      selectFile(file)
      // 通知父组件切换预览
      onFileSelect?.(file)
    }
  }

  // 处理展开
  const handleExpand: TreeProps['onExpand'] = (keys) => {
    setExpandedKeys(keys as string[])
  }

  // 打开创建对话框
  const openCreateModal = (type: 'file' | 'folder', parentPath: string) => {
    setModalState({ visible: true, type, parentPath })
    setInputValue('')
  }

  // 打开重命名对话框
  const openRenameModal = (file: SiteFile) => {
    setModalState({ visible: true, type: 'rename', parentPath: '', oldPath: file.path })
    setInputValue(file.name)
  }

  // 处理创建
  const handleCreate = async () => {
    if (!inputValue.trim()) {
      message.error('请输入名称')
      return
    }

    const { type, parentPath } = modalState
    const fullPath = parentPath === '/' ? `/${inputValue}` : `${parentPath}/${inputValue}`

    try {
      if (type === 'folder') {
        await createFolder(fullPath)
        message.success('文件夹创建成功')
      } else {
        await createFile(fullPath, getFileTemplate(inputValue))
        message.success('文件创建成功')
      }
      setModalState({ ...modalState, visible: false })
    } catch (error) {
      const err = error as Error
      message.error(err.message || '创建失败')
    }
  }

  // 处理重命名
  const handleRename = async () => {
    if (!inputValue.trim()) {
      message.error('请输入新名称')
      return
    }

    const { oldPath } = modalState
    if (!oldPath) return

    const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/')) || '/'
    const newPath = parentPath === '/' ? `/${inputValue}` : `${parentPath}/${inputValue}`

    try {
      await renameFile(oldPath, newPath)
      message.success('重命名成功')
      setModalState({ ...modalState, visible: false })
    } catch (error) {
      const err = error as Error
      message.error(err.message || '重命名失败')
    }
  }

  // 处理删除 - 打开确认弹窗
  const handleDelete = (file: SiteFile) => {
    setDeleteTarget(file)
  }

  // 确认删除
  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteFile(deleteTarget.path)
      await fetchFiles()
      message.success('删除成功')
      setDeleteTarget(null)
    } catch (error) {
      const err = error as Error
      message.error(err.message || '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  // 版本回滚后的处理
  const handleVersionRollback = async (_version: SiteFileVersion) => {
    // 刷新文件列表
    await fetchFiles()
    message.success('已回滚到选中版本')
  }

  // 预览版本
  const handlePreviewVersion = (version: SiteFileVersion) => {
    // 可以打开一个预览弹窗显示版本内容
    Modal.info({
      title: `版本: ${version.versionName}`,
      content: (
        <pre style={{ maxHeight: 400, overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 4, fontSize: 12 }}>
          {version.content}
        </pre>
      ),
      width: 600,
    })
  }

  // 右键菜单
  const getContextMenu = (file: SiteFile) => ({
    items: [
      ...(file.isDirectory
        ? [
            {
              key: 'new-file',
              label: '新建文件',
              icon: <PlusOutlined />,
            },
            {
              key: 'new-folder',
              label: '新建文件夹',
              icon: <FolderOutlined />,
            },
            { type: 'divider' as const },
          ]
        : [
            {
              key: 'version-history',
              label: '版本历史',
              icon: <HistoryOutlined />,
            },
            { type: 'divider' as const },
          ]),
      {
        key: 'rename',
        label: '重命名',
        icon: <EditOutlined />,
      },
      {
        key: 'delete',
        label: '删除',
        icon: <DeleteOutlined />,
        danger: true,
      },
    ],
    onClick: ({ key }: { key: string }) => {
      switch (key) {
        case 'new-file':
          openCreateModal('file', file.path)
          break
        case 'new-folder':
          openCreateModal('folder', file.path)
          break
        case 'version-history':
          setVersionHistoryPath(file.path)
          break
        case 'rename':
          openRenameModal(file)
          break
        case 'delete':
          handleDelete(file)
          break
      }
    },
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 工具栏 */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${isDark ? '#303030' : '#e5e7eb'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 500, fontSize: 13, color: isDark ? '#e5e5e5' : undefined }}>站点文件</span>
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => openCreateModal('file', '/')}
            title="新建文件"
          />
          <Button
            type="text"
            size="small"
            icon={<FolderOutlined />}
            onClick={() => openCreateModal('folder', '/')}
            title="新建文件夹"
          />
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={fetchFiles}
            loading={filesLoading}
            title="刷新"
          />
        </Space>
      </div>

      {/* 文件树 */}
      <div
        style={{ flex: 1, overflow: 'auto', padding: '8px 0', minHeight: 100 }}
        onContextMenu={(e) => {
          // 只在空白区域显示根目录菜单
          const target = e.target as HTMLElement
          if (target.closest('.ant-tree-treenode')) return
          e.preventDefault()
          openCreateModal('file', '/')
        }}
      >
        <Tree
          showIcon
          blockNode
          treeData={treeData}
          selectedKeys={currentFile ? [currentFile.path] : []}
          expandedKeys={expandedKeys}
          onSelect={handleSelect}
          onExpand={handleExpand}
          titleRender={(node) => {
            const dataNode = node as DataNode & { file: SiteFile }
            return (
              <Dropdown menu={getContextMenu(dataNode.file)} trigger={['contextMenu']}>
                <span style={{ userSelect: 'none' }} onContextMenu={(e) => e.stopPropagation()}>
                  {node.title as string}
                </span>
              </Dropdown>
            )
          }}
        />
      </div>

      {/* 创建/重命名对话框 */}
      <Modal
        title={
          modalState.type === 'file'
            ? '新建文件'
            : modalState.type === 'folder'
            ? '新建文件夹'
            : '重命名'
        }
        open={modalState.visible}
        onOk={modalState.type === 'rename' ? handleRename : handleCreate}
        onCancel={() => setModalState({ ...modalState, visible: false })}
        destroyOnClose
      >
        <Input
          placeholder={
            modalState.type === 'file'
              ? '文件名 (如 index.html)'
              : modalState.type === 'folder'
              ? '文件夹名'
              : '新名称'
          }
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onPressEnter={modalState.type === 'rename' ? handleRename : handleCreate}
          autoFocus
        />
      </Modal>

      {/* 版本历史弹窗 */}
      {versionHistoryPath && (
        <SiteVersionHistory
          open={!!versionHistoryPath}
          onClose={() => setVersionHistoryPath(null)}
          filePath={versionHistoryPath}
          onRollback={handleVersionRollback}
          onPreview={handlePreviewVersion}
        />
      )}

      {/* 删除确认弹窗 */}
      <Modal
        title="确认删除"
        open={!!deleteTarget}
        onOk={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        okText="删除"
        cancelText="取消"
        okType="danger"
        okButtonProps={{ loading: deleting }}
      >
        <p>
          确定要删除 <strong>{deleteTarget?.name}</strong> 吗？
          {deleteTarget?.isDirectory && (
            <span style={{ color: '#ff4d4f', display: 'block', marginTop: 8 }}>
              注意：目录下的所有文件也将被删除！
            </span>
          )}
        </p>
      </Modal>
    </div>
  )
}
