/**
 * 全局日志查看器弹窗
 *
 * 支持:
 * - 日期范围筛选
 * - 两栏函数选择器（文件夹树 + 函数列表）
 * - 关键字搜索
 * - 日志列表展示
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Modal, Input, Button, Spin, Empty, Tag, Tooltip, Pagination, Select } from 'antd'
import {
  SearchOutlined,
  FolderOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import { executionLogsApi, type ExecutionLog } from '@/api/executionLogs'
import { folderApi, type TreeNode } from '@/api/folders'
import { functionApi } from '@/api/functions'
import type { CloudFunction } from '@/stores/function'
import styles from './styles.module.css'

// 日期范围选项
const DATE_RANGES = [
  { label: '今天', value: 'today' },
  { label: '最近 3 天', value: '3days' },
  { label: '最近 7 天', value: '7days' },
  { label: '最近 30 天', value: '30days' },
  { label: '全部', value: 'all' },
]

interface LogViewerModalProps {
  open: boolean
  onClose: () => void
}

// 格式化时间
const formatDateTime = (dateStr: string) => {
  const d = new Date(dateStr)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const formatFullDateTime = (dateStr: string) => {
  const d = new Date(dateStr)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// 计算日期范围
const getDateRange = (rangeType: string): { startDate?: string; endDate?: string } => {
  const now = new Date()
  const endDate = now.toISOString()

  switch (rangeType) {
    case 'today': {
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      return { startDate: start.toISOString(), endDate }
    }
    case '3days': {
      const start = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
      return { startDate: start.toISOString(), endDate }
    }
    case '7days': {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return { startDate: start.toISOString(), endDate }
    }
    case '30days': {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      return { startDate: start.toISOString(), endDate }
    }
    default:
      return {}
  }
}

export default function LogViewerModal({ open, onClose }: LogViewerModalProps) {
  const { isDark, t } = useThemeColors()

  // 筛选条件
  const [keyword, setKeyword] = useState('')
  const [dateRangeType, setDateRangeType] = useState('7days')
  const [selectedFunctionIds, setSelectedFunctionIds] = useState<string[]>([])

  // 数据
  const [folders, setFolders] = useState<TreeNode[]>([])
  const [allFunctions, setAllFunctions] = useState<CloudFunction[]>([])
  const [logs, setLogs] = useState<ExecutionLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)

  // 加载状态
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)

  // 选择器状态
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // 加载文件夹和函数列表
  const loadFoldersAndFunctions = useCallback(async () => {
    setLoadingData(true)
    try {
      const [foldersRes, functionsRes] = await Promise.all([
        folderApi.getTree(),
        functionApi.list(),
      ])
      setFolders(foldersRes.data.data || [])
      setAllFunctions(functionsRes.data.data || [])
    } catch {
      // 静默失败
    } finally {
      setLoadingData(false)
    }
  }, [])

  // 搜索日志
  const searchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const dateRange = getDateRange(dateRangeType)
      const params: {
        functionIds?: string[]
        keyword?: string
        startDate?: string
        endDate?: string
        limit: number
        offset: number
      } = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
        ...dateRange,
      }

      if (selectedFunctionIds.length > 0) {
        params.functionIds = selectedFunctionIds
      }
      if (keyword.trim()) {
        params.keyword = keyword.trim()
      }

      const res = await executionLogsApi.search(params)
      setLogs(res.data.data.logs)
      setTotal(res.data.data.total)
    } catch {
      // 静默失败
    } finally {
      setLoading(false)
    }
  }, [selectedFunctionIds, keyword, dateRangeType, page, pageSize])

  // 初始化加载
  useEffect(() => {
    if (open) {
      loadFoldersAndFunctions()
      searchLogs()
    }
  }, [open, loadFoldersAndFunctions, searchLogs])

  // 筛选条件变化时重新搜索
  useEffect(() => {
    if (open) {
      setPage(1)
    }
  }, [selectedFunctionIds, keyword, dateRangeType, open])

  useEffect(() => {
    if (open) {
      searchLogs()
    }
  }, [page, open, searchLogs])

  // 获取当前文件夹下的函数
  const currentFunctions = useMemo(() => {
    if (!selectedFolderId) {
      // 显示根目录下的函数
      return allFunctions.filter(f => !f.folderId)
    }
    return allFunctions.filter(f => f.folderId === selectedFolderId)
  }, [selectedFolderId, allFunctions])

  // 切换函数选择
  const toggleFunction = (fnId: string) => {
    setSelectedFunctionIds(prev => {
      if (prev.includes(fnId)) {
        return prev.filter(id => id !== fnId)
      }
      return [...prev, fnId]
    })
  }

  // 选择文件夹下所有函数
  const selectFolderFunctions = (folderId: string) => {
    const folderFunctions = allFunctions.filter(f => f.folderId === folderId)
    const folderFunctionIds = folderFunctions.map(f => f._id)
    setSelectedFunctionIds(prev => {
      const newIds = new Set(prev)
      folderFunctionIds.forEach(id => newIds.add(id))
      return Array.from(newIds)
    })
  }

  // 切换文件夹展开
  const toggleFolderExpand = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(folderId)) {
        newSet.delete(folderId)
      } else {
        newSet.add(folderId)
      }
      return newSet
    })
  }

  // 获取函数路径
  const getFunctionPath = (fn: CloudFunction) => {
    if (!fn.folderId) return fn.name
    const folder = findFolderById(folders, fn.folderId)
    if (!folder) return fn.name
    return `${getFolderPath(folder)}/${fn.name}`
  }

  // 获取文件夹路径
  const getFolderPath = (folder: TreeNode): string => {
    // 简化：只返回文件夹名称
    return folder.title
  }

  // 查找文件夹
  const findFolderById = (nodes: TreeNode[], id: string): TreeNode | null => {
    for (const node of nodes) {
      if (node.key === id) return node
      if (node.children) {
        const found = findFolderById(node.children, id)
        if (found) return found
      }
    }
    return null
  }

  // 格式化日志内容
  const formatLogContent = (log: ExecutionLog) => {
    if (log.logs.length === 0) return '无控制台输出'
    return log.logs.map(l => {
      const args = l.args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg)
          } catch {
            return String(arg)
          }
        }
        return String(arg)
      }).join(' ')
      return args
    }).join('\n')
  }

  // 渲染文件夹树
  const renderFolderTree = (nodes: TreeNode[], level = 0): React.ReactNode => {
    return nodes.map(node => {
      if (!node.isFolder) return null
      const isExpanded = expandedFolders.has(node.key)
      const isSelected = selectedFolderId === node.key
      const hasChildren = node.children?.some(c => c.isFolder)

      return (
        <div key={node.key}>
          <div
            className={`${styles.folderItem} ${isSelected ? styles.folderItemActive : ''}`}
            style={{ paddingLeft: 12 + level * 16 }}
            onClick={() => {
              setSelectedFolderId(node.key)
              if (hasChildren) {
                toggleFolderExpand(node.key)
              }
            }}
            onDoubleClick={() => selectFolderFunctions(node.key)}
          >
            <FolderOutlined className={styles.folderIcon} />
            <span className={styles.folderName}>{node.title}</span>
            {hasChildren && (
              <span className={styles.folderExpand}>
                {isExpanded ? '▼' : '▶'}
              </span>
            )}
          </div>
          {isExpanded && node.children && renderFolderTree(node.children.filter(c => c.isFolder), level + 1)}
        </div>
      )
    })
  }

  // 清除筛选
  const clearFilters = () => {
    setKeyword('')
    setDateRangeType('7days')
    setSelectedFunctionIds([])
    setSelectedFolderId(null)
    setPage(1)
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="70%"
      centered
      destroyOnClose
      title={
        <div className={styles.modalHeader}>
          <span>控制台日志</span>
          <Tag color="blue">{total} 条记录</Tag>
        </div>
      }
      styles={{
        body: { padding: 0, height: '70vh' },
        content: { borderRadius: 12, overflow: 'hidden' },
      }}
    >
      <div className={styles.container} style={{ background: t.bgCard }}>
        {/* 顶部筛选栏 */}
        <div className={styles.filterBar} style={{ borderColor: t.border }}>
          <Input
            placeholder="搜索关键字..."
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onPressEnter={() => searchLogs()}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            value={dateRangeType}
            onChange={setDateRangeType}
            options={DATE_RANGES}
            style={{ width: 140 }}
          />
          <Button icon={<ReloadOutlined />} onClick={searchLogs}>
            刷新
          </Button>
          {(keyword || dateRangeType !== '7days' || selectedFunctionIds.length > 0) && (
            <Button onClick={clearFilters}>
              清除筛选
            </Button>
          )}
          {selectedFunctionIds.length > 0 && (
            <Tag closable onClose={() => setSelectedFunctionIds([])}>
              已选 {selectedFunctionIds.length} 个函数
            </Tag>
          )}
        </div>

        {/* 主体内容 */}
        <div className={styles.mainContent}>
          {/* 左侧函数选择器 */}
          <div className={styles.selectorPanel} style={{ borderColor: t.border }}>
            {/* 文件夹列表 */}
            <div className={styles.selectorColumn} style={{ borderColor: t.border }}>
              <div className={styles.selectorHeader} style={{ background: t.bgMuted }}>
                文件夹
              </div>
              <div className={styles.selectorList}>
                {loadingData ? (
                  <div className={styles.loading}><Spin size="small" /></div>
                ) : (
                  <>
                    <div
                      className={`${styles.folderItem} ${selectedFolderId === null ? styles.folderItemActive : ''}`}
                      onClick={() => setSelectedFolderId(null)}
                    >
                      <FolderOutlined className={styles.folderIcon} />
                      <span className={styles.folderName}>根目录</span>
                    </div>
                    {renderFolderTree(folders)}
                  </>
                )}
              </div>
            </div>

            {/* 函数列表 */}
            <div className={styles.selectorColumn}>
              <div className={styles.selectorHeader} style={{ background: t.bgMuted }}>
                函数 ({currentFunctions.length})
              </div>
              <div className={styles.selectorList}>
                {currentFunctions.map(fn => {
                  const isSelected = selectedFunctionIds.includes(fn._id)
                  return (
                    <div
                      key={fn._id}
                      className={`${styles.functionItem} ${isSelected ? styles.functionItemActive : ''}`}
                      onClick={() => toggleFunction(fn._id)}
                    >
                      <FileTextOutlined className={styles.functionIcon} />
                      <span className={styles.functionName}>{fn.name}</span>
                      {isSelected && <CheckCircleOutlined className={styles.checkIcon} />}
                    </div>
                  )
                })}
                {currentFunctions.length === 0 && (
                  <div className={styles.emptyFolder}>此文件夹下无函数</div>
                )}
              </div>
            </div>
          </div>

          {/* 右侧日志列表 */}
          <div className={styles.logPanel}>
            {loading ? (
              <div className={styles.loading}><Spin /></div>
            ) : logs.length === 0 ? (
              <Empty description="暂无日志记录" />
            ) : (
              <div className={styles.logList}>
                {logs.map((log, idx) => {
                  const fn = allFunctions.find(f => f._id === log.functionId)
                  const path = fn ? getFunctionPath(fn) : log.functionName

                  return (
                    <div
                      key={log._id || idx}
                      className={styles.logItem}
                      style={{ borderColor: t.border }}
                    >
                      {/* 日志头部 */}
                      <div className={styles.logHeader}>
                        <span className={styles.logIndex}>#{(page - 1) * pageSize + idx + 1}</span>
                        <Tooltip title={formatFullDateTime(log.createdAt)}>
                          <span className={styles.logTime}>
                            <ClockCircleOutlined /> {formatDateTime(log.createdAt)}
                          </span>
                        </Tooltip>
                        <span className={styles.logPath}>{path}</span>
                        <span className={styles.logDuration}>{log.duration}ms</span>
                        {log.success ? (
                          <Tag color="success" icon={<CheckCircleOutlined />}>成功</Tag>
                        ) : (
                          <Tag color="error" icon={<CloseCircleOutlined />}>失败</Tag>
                        )}
                        <Tag>{log.trigger}</Tag>
                      </div>

                      {/* 日志内容 */}
                      <div
                        className={styles.logContent}
                        style={{ background: isDark ? '#1a1a1a' : '#f5f5f5' }}
                      >
                        {log.error ? (
                          <pre className={styles.logError}>{log.error}</pre>
                        ) : (
                          <pre className={styles.logText}>{formatLogContent(log)}</pre>
                        )}
                      </div>

                      {/* 返回结果预览 */}
                      {log.data !== undefined && log.data !== null && (
                        <div className={styles.logResult}>
                          <span className={styles.logResultLabel}>返回值:</span>
                          <code>
                            {(() => {
                              const str = typeof log.data === 'object'
                                ? JSON.stringify(log.data)
                                : String(log.data)
                              return str.length > 200 ? str.slice(0, 200) + '...' : str
                            })()}
                          </code>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* 分页 */}
            {total > pageSize && (
              <div className={styles.pagination}>
                <Pagination
                  current={page}
                  total={total}
                  pageSize={pageSize}
                  onChange={setPage}
                  showSizeChanger={false}
                  showQuickJumper
                  showTotal={(t) => `共 ${t} 条`}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
