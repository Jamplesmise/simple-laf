/**
 * 拖拽功能 Hook
 */

import { useState, useCallback, DragEvent } from 'react'
import { message } from 'antd'
import { folderApi, type TreeNode } from '@/api/folders'
import { findParentFolderId } from '../utils'

interface UseDragDropOptions {
  treeData: TreeNode[]
  expandFolder: (folderId: string) => void
  loadTree: () => void
}

export function useDragDrop({ treeData, expandFolder, loadTree }: UseDragDropOptions) {
  const [draggedNode, setDraggedNode] = useState<TreeNode | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)

  // 拖拽开始
  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, node: TreeNode) => {
    e.stopPropagation()
    setDraggedNode(node)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', node.key)
  }, [])

  // 拖拽经过
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, node: TreeNode) => {
    e.preventDefault()
    e.stopPropagation()

    if (!draggedNode) return

    // 不能拖到自己身上
    if (draggedNode.key === node.key) {
      setDragOverFolderId(null)
      return
    }

    // 如果是文件夹，不能拖到自己的子文件夹中
    if (draggedNode.isFolder && node.path.startsWith(draggedNode.path + '/')) {
      setDragOverFolderId(null)
      return
    }

    // 目标是文件夹，高亮该文件夹
    if (node.isFolder) {
      setDragOverFolderId(node.key)
    } else {
      // 目标是函数，高亮其父文件夹（或根目录）
      setDragOverFolderId('root')
    }
  }, [draggedNode])

  // 拖拽进入容器（用于根目录）
  const handleContainerDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (draggedNode) {
      setDragOverFolderId('root')
    }
  }, [draggedNode])

  // 拖拽离开
  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.stopPropagation()
  }, [])

  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    setDraggedNode(null)
    setDragOverFolderId(null)
  }, [])

  // 放置
  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>, targetNode: TreeNode | null) => {
    e.preventDefault()
    e.stopPropagation()

    if (!draggedNode) return

    const targetFolderId = targetNode?.isFolder ? targetNode.key : undefined

    // 检查是否需要移动
    const currentParentId = findParentFolderId(treeData, draggedNode.key)
    if (currentParentId === (targetFolderId || null)) {
      handleDragEnd()
      return
    }

    // 不能把文件夹拖到自己的子文件夹中
    if (draggedNode.isFolder && targetNode && targetNode.path.startsWith(draggedNode.path + '/')) {
      message.error('不能将文件夹移动到其子文件夹中')
      handleDragEnd()
      return
    }

    try {
      if (draggedNode.isFolder) {
        await folderApi.moveFolder(draggedNode.key, targetFolderId)
      } else {
        await folderApi.moveFunction(draggedNode.key, targetFolderId)
      }
      message.success('已移动')

      if (targetFolderId) {
        expandFolder(targetFolderId)
      }

      loadTree()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      message.error(err.response?.data?.error?.message || '移动失败')
    } finally {
      handleDragEnd()
    }
  }, [draggedNode, treeData, expandFolder, loadTree, handleDragEnd])

  return {
    draggedNode,
    dragOverFolderId,
    handleDragStart,
    handleDragOver,
    handleContainerDragOver,
    handleDragLeave,
    handleDragEnd,
    handleDrop,
  }
}
