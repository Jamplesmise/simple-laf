/**
 * 树数据管理 Hook
 */

import { useState, useCallback, useEffect } from 'react'
import { message } from 'antd'
import { folderApi, type TreeNode } from '@/api/folders'
import { functionApi } from '@/api/functions'
import { useFunctionStore } from '@/stores/function'
import { findFirstFunction } from '../utils'

export function useTreeData() {
  const [treeData, setTreeData] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const { current, openTab } = useFunctionStore()

  // 加载树数据
  const loadTree = useCallback(async () => {
    setLoading(true)
    try {
      const res = await folderApi.getTree()
      if (res.data.success) {
        setTreeData(res.data.data)
      }
    } catch {
      message.error('加载文件树失败')
    } finally {
      setLoading(false)
    }
  }, [])

  // 初始加载
  useEffect(() => {
    loadTree()
  }, [loadTree])

  // 自动选中第一个函数
  useEffect(() => {
    if (!loading && treeData.length > 0 && !current) {
      const firstFunc = findFirstFunction(treeData)
      if (firstFunc) {
        functionApi.get(firstFunc.key).then((res) => {
          if (res.data.success) {
            openTab(res.data.data)
          }
        })
      }
    }
  }, [loading, treeData, current, openTab])

  // 同步选中状态
  useEffect(() => {
    if (current) {
      setSelectedKeys([current._id])
    } else {
      setSelectedKeys([])
    }
  }, [current])

  // 展开文件夹
  const expandFolder = useCallback((folderId: string) => {
    setExpandedKeys(prev => [...new Set([...prev, folderId])])
  }, [])

  // 切换展开状态
  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    )
  }, [])

  return {
    treeData,
    loading,
    expandedKeys,
    selectedKeys,
    loadTree,
    expandFolder,
    toggleExpand,
    setExpandedKeys,
  }
}
