/**
 * 函数树组件
 *
 * 显示函数和文件夹树，支持拖拽、右键菜单等操作
 */

import { useState, useCallback, useEffect } from 'react'
import { Dropdown, Modal, Input, message } from 'antd'
import type { MenuProps } from 'antd'
import {
  FolderOutlined,
  FileTextOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  BugOutlined,
  RobotOutlined,
  SplitCellsOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import SchedulerPanel from '../SchedulerPanel'
import SnippetsPanel from '../SnippetsPanel'
import AIDebugModal from '../AIDebugModal'
import { folderApi, type TreeNode } from '@/api/folders'
import { functionApi } from '@/api/functions'
import { useFunctionStore } from '@/stores/function'
import { useAIStore } from '@/stores/ai'
import { TreeToolbar } from './TreeToolbar'
import { TreeNodeItem } from './TreeNode'
import { useTreeData } from './hooks/useTreeData'
import { useDragDrop } from './hooks/useDragDrop'
import { DEFAULT_CODE, findNode } from './utils'

interface FunctionTreeProps {
  onRefresh?: () => void
}

export default function FunctionTree({ onRefresh }: FunctionTreeProps) {
  // 订阅 lastPublishedCodes 和 openTabs 以确保发布后红点状态能及时更新
  const { openTab, hasUnpublishedChanges, lastPublishedCodes, openTabs } = useFunctionStore()
  const { openConversationDialog } = useAIStore()

  // 树数据
  const tree = useTreeData()

  // 拖拽
  const dragDrop = useDragDrop({
    treeData: tree.treeData,
    expandFolder: tree.expandFolder,
    loadTree: tree.loadTree,
  })

  // 弹窗状态
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'folder' | 'function' | 'rename'>('folder')
  const [inputValue, setInputValue] = useState('')
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  // 右键菜单状态
  const [contextMenuVisible, setContextMenuVisible] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const [contextMenuNode, setContextMenuNode] = useState<TreeNode | null>(null)

  // 删除确认弹窗状态
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TreeNode | null>(null)
  const [deleting, setDeleting] = useState(false)

  // 功能面板状态
  const [schedulerOpen, setSchedulerOpen] = useState(false)
  const [snippetsOpen, setSnippetsOpen] = useState(false)

  // AI Debug 弹窗状态
  const [debugModalOpen, setDebugModalOpen] = useState(false)
  const [debugTarget, setDebugTarget] = useState<{ id: string; name: string } | null>(null)

  // 关闭右键菜单
  const closeContextMenu = useCallback(() => {
    setContextMenuVisible(false)
  }, [])

  // 点击页面其他地方关闭菜单
  useEffect(() => {
    const handleClick = () => closeContextMenu()
    if (contextMenuVisible) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [contextMenuVisible, closeContextMenu])

  // 右键菜单项
  const getContextMenuItems = (node: TreeNode): MenuProps['items'] => {
    if (node.isFolder) {
      return [
        { key: 'newFolder', icon: <FolderOutlined />, label: '新建文件夹' },
        { key: 'newFunction', icon: <FileTextOutlined />, label: '新建函数' },
        { type: 'divider' },
        { key: 'rename', icon: <EditOutlined />, label: '重命名' },
        { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true },
        { type: 'divider' },
        { key: 'refresh', icon: <ReloadOutlined />, label: '刷新列表' },
      ]
    }
    return [
      {
        key: 'ai',
        icon: <RobotOutlined />,
        label: 'AI',
        children: [
          { key: 'aiDebug', icon: <BugOutlined />, label: '自动 Debug' },
          { key: 'aiRefactor', icon: <SplitCellsOutlined />, label: '解耦分析' },
          { key: 'aiExplain', icon: <QuestionCircleOutlined />, label: '解释代码' },
        ]
      },
      { type: 'divider' },
      { key: 'rename', icon: <EditOutlined />, label: '重命名' },
      { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true },
      { type: 'divider' },
      { key: 'refresh', icon: <ReloadOutlined />, label: '刷新列表' },
    ]
  }

  // 菜单点击处理
  const handleMenuClick = async (key: string, node: TreeNode) => {
    setSelectedNode(node)
    switch (key) {
      case 'newFolder':
        setModalType('folder')
        setInputValue('')
        setModalOpen(true)
        break
      case 'newFunction':
        setModalType('function')
        setInputValue('')
        setModalOpen(true)
        break
      case 'rename':
        setModalType('rename')
        setInputValue(node.title)
        setModalOpen(true)
        break
      case 'delete':
        setDeleteTarget(node)
        setDeleteModalOpen(true)
        break
      case 'refresh':
        tree.loadTree()
        break
      case 'aiDebug':
        setDebugTarget({ id: node.key, name: node.title })
        setDebugModalOpen(true)
        break
      case 'aiRefactor':
      case 'aiExplain':
        // 打开对话窗口，用户可以在对话中让 AI 分析函数
        openConversationDialog({ functionId: node.key })
        break
    }
  }

  // 删除确认
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      if (deleteTarget.isFolder) {
        await folderApi.remove(deleteTarget.key)
      } else {
        await functionApi.remove(deleteTarget.key)
      }
      message.success('已删除')
      setDeleteModalOpen(false)
      setDeleteTarget(null)
      tree.loadTree()
      onRefresh?.()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      message.error(err.response?.data?.error?.message || '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  // 弹窗确认
  const handleModalOk = async () => {
    if (!inputValue.trim()) {
      message.error('名称不能为空')
      return
    }

    setConfirmLoading(true)
    try {
      if (modalType === 'folder') {
        await folderApi.create(inputValue.trim(), selectedNode?.isFolder ? selectedNode.key : undefined)
        message.success('文件夹已创建')
        if (selectedNode?.isFolder) {
          tree.expandFolder(selectedNode.key)
        }
      } else if (modalType === 'function') {
        const fullPath = inputValue.trim()
        const parts = fullPath.split('/').filter(p => p.length > 0)
        const funcName = parts.pop()!
        const folderParts = parts

        let targetFolderId: string | undefined = selectedNode?.isFolder ? selectedNode.key : undefined
        const expandKeys: string[] = targetFolderId ? [targetFolderId] : []

        if (folderParts.length > 0) {
          const treeRes = await folderApi.getTree()
          let currentTree = treeRes.data.data

          for (const folderName of folderParts) {
            let existingFolder: TreeNode | undefined
            if (targetFolderId) {
              const parent = findNode(currentTree, targetFolderId)
              existingFolder = parent?.children?.find(n => n.isFolder && n.title === folderName)
            } else {
              existingFolder = currentTree.find(n => n.isFolder && n.title === folderName)
            }

            if (existingFolder) {
              targetFolderId = existingFolder.key
              expandKeys.push(existingFolder.key)
            } else {
              const folderRes = await folderApi.create(folderName, targetFolderId)
              targetFolderId = folderRes.data.data._id
              expandKeys.push(targetFolderId)
              const newTreeRes = await folderApi.getTree()
              currentTree = newTreeRes.data.data
            }
          }
        }

        // 直接创建函数到目标文件夹（后端会计算正确的 path）
        const res = await functionApi.create(funcName, DEFAULT_CODE, targetFolderId)
        if (res.data.success) {
          if (expandKeys.length > 0) {
            tree.setExpandedKeys(prev => [...new Set([...prev, ...expandKeys])])
          }
          message.success('函数已创建')
          openTab(res.data.data)
        } else {
          message.error('函数创建失败')
        }
      } else if (modalType === 'rename') {
        if (selectedNode?.isFolder) {
          await folderApi.rename(selectedNode.key, inputValue.trim())
        } else if (selectedNode) {
          const res = await functionApi.rename(selectedNode.key, inputValue.trim())
          if (!res.data.success) {
            message.error('重命名失败')
            setModalOpen(false)
            setConfirmLoading(false)
            return
          }
        }
        message.success('已重命名')
      }

      setModalOpen(false)
      tree.loadTree()
      onRefresh?.()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      message.error(err.response?.data?.error?.message || '操作失败')
    } finally {
      setConfirmLoading(false)
    }
  }

  // 节点点击
  const handleNodeClick = (node: TreeNode) => {
    if (node.isFolder) {
      tree.toggleExpand(node.key)
    } else {
      functionApi.get(node.key).then((res) => {
        if (res.data.success) {
          openTab(res.data.data)
        }
      })
    }
  }

  // 右键点击处理
  const handleContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenuNode(node)
    setContextMenuPosition({ x: e.clientX, y: e.clientY })
    setContextMenuVisible(true)
  }

  // 渲染树节点
  const renderTreeNode = (node: TreeNode, level: number = 0): React.ReactNode => {
    const isExpanded = tree.expandedKeys.includes(node.key)
    const isSelected = tree.selectedKeys.includes(node.key)
    const hasChanges = !node.isFolder && hasUnpublishedChanges(node.key)
    const isDragOver = dragDrop.dragOverFolderId === node.key

    return (
      <TreeNodeItem
        key={node.key}
        node={node}
        level={level}
        isExpanded={isExpanded}
        isSelected={isSelected}
        hasChanges={hasChanges}
        isDragOver={isDragOver}
        onDragStart={dragDrop.handleDragStart}
        onDragOver={dragDrop.handleDragOver}
        onDragLeave={dragDrop.handleDragLeave}
        onDragEnd={dragDrop.handleDragEnd}
        onDrop={(e, n) => dragDrop.handleDrop(e, n)}
        onClick={handleNodeClick}
        onContextMenu={handleContextMenu}
      >
        {node.children?.map(child => renderTreeNode(child, level + 1))}
      </TreeNodeItem>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 工具栏 */}
      <TreeToolbar
        onNewFunction={() => {
          setSelectedNode(null)
          setModalType('function')
          setInputValue('')
          setModalOpen(true)
        }}
        onOpenScheduler={() => setSchedulerOpen(true)}
        onOpenSnippets={() => setSnippetsOpen(true)}
      />

      {/* 树 */}
      <div
        style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}
        onDragOver={dragDrop.handleContainerDragOver}
        onDrop={(e) => dragDrop.handleDrop(e, null)}
      >
        {tree.treeData.map(node => renderTreeNode(node))}
        {!tree.loading && tree.treeData.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 12 }}>
            暂无函数，点击上方按钮创建
          </div>
        )}
      </div>

      {/* 新建/重命名弹窗 */}
      <Modal
        title={
          modalType === 'folder'
            ? '新建文件夹'
            : modalType === 'function'
              ? '新建函数'
              : '重命名'
        }
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={() => setModalOpen(false)}
        confirmLoading={confirmLoading}
        destroyOnClose
      >
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={modalType === 'folder' ? '文件夹名称' : '函数名称或路径，如 api/user/login'}
          onPressEnter={handleModalOk}
          autoFocus
          style={{ marginTop: 16 }}
        />
        {modalType === 'function' && (
          <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>
            支持路径格式，如 "api/user/login" 将自动创建文件夹结构
          </div>
        )}
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal
        title="确认删除"
        open={deleteModalOpen}
        onOk={handleDeleteConfirm}
        onCancel={() => {
          setDeleteModalOpen(false)
          setDeleteTarget(null)
        }}
        confirmLoading={deleting}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>
          确定要删除 "{deleteTarget?.title}" 吗？
          {deleteTarget?.isFolder && '文件夹必须为空才能删除。'}
        </p>
      </Modal>

      {/* 右键菜单 */}
      {contextMenuVisible && contextMenuNode && (
        <Dropdown
          menu={{
            items: getContextMenuItems(contextMenuNode),
            onClick: ({ key }) => {
              handleMenuClick(key, contextMenuNode)
              closeContextMenu()
            },
          }}
          open={contextMenuVisible}
          onOpenChange={(open) => !open && closeContextMenu()}
        >
          <div
            style={{
              position: 'fixed',
              left: contextMenuPosition.x,
              top: contextMenuPosition.y,
              width: 1,
              height: 1,
            }}
          />
        </Dropdown>
      )}

      {/* 功能面板 */}
      <SchedulerPanel open={schedulerOpen} onClose={() => setSchedulerOpen(false)} />
      <SnippetsPanel open={snippetsOpen} onClose={() => setSnippetsOpen(false)} />

      {/* AI Debug 弹窗 */}
      <AIDebugModal
        open={debugModalOpen}
        functionId={debugTarget?.id || ''}
        functionName={debugTarget?.name || ''}
        onClose={() => setDebugModalOpen(false)}
        onCodeUpdated={() => tree.loadTree()}
      />
    </div>
  )
}
