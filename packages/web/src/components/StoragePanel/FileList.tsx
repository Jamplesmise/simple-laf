/**
 * 文件列表组件
 */

import { useState, useRef } from 'react'
import { Button, Spin, Empty, Tooltip, Popconfirm, message } from 'antd'
import {
  DeleteOutlined,
  ReloadOutlined,
  UploadOutlined,
  DownloadOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import { storageApi, type ObjectInfo } from '@/api/storage'
import { formatSize, formatDate, getFileIcon, getFileName } from './utils'

interface FileListProps {
  files: ObjectInfo[]
  currentPath: string
  pathParts: string[]
  bucketName: string
  loading: boolean
  hasMore: boolean
  selectedKeys: string[]
  onNavigate: (path: string) => void
  onRefresh: () => void
  onLoadMore: () => void
  onToggleSelect: (key: string) => void
  onClearSelection: () => void
  onDeleteSelected: () => void
  onPreview: (obj: ObjectInfo) => void
  onAddUploadTask: (file: File, key: string) => void
  onShowUploader: () => void
}

export function FileList({
  files,
  currentPath,
  pathParts,
  bucketName,
  loading,
  hasMore,
  selectedKeys,
  onNavigate,
  onRefresh,
  onLoadMore,
  onToggleSelect,
  onClearSelection,
  onDeleteSelected,
  onPreview,
  onAddUploadTask,
  onShowUploader,
}: FileListProps) {
  const { t } = useThemeColors()

  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputFiles = e.target.files
    if (!inputFiles) return

    for (let i = 0; i < inputFiles.length; i++) {
      const file = inputFiles[i]
      const key = currentPath + file.name
      onAddUploadTask(file, key)
    }

    onShowUploader()

    // 清除 input 值，允许重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 处理下载
  const handleDownload = async (obj: ObjectInfo) => {
    try {
      const url = await storageApi.downloadFile(bucketName, obj.key)
      const a = document.createElement('a')
      a.href = url
      a.download = getFileName(obj.key)
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('下载失败')
    }
  }

  // 处理单个删除
  const handleDelete = async (obj: ObjectInfo) => {
    try {
      await storageApi.deleteObjects(bucketName, [obj.key])
      message.success('删除成功')
      onRefresh()
    } catch {
      message.error('删除失败')
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* 工具栏 */}
      <div
        style={{
          height: 56,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: `1px solid ${t.borderLight}`,
          background: t.bgCard,
        }}
      >
        {/* 面包屑 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <span
            style={{
              color: pathParts.length > 0 ? t.accent : t.text,
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 13,
            }}
            onClick={() => onNavigate('')}
          >
            {bucketName || '存储'}
          </span>
          {pathParts.map((part, index) => (
            <span key={index} style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ color: t.textMuted, margin: '0 4px' }}>/</span>
              <span
                style={{
                  color: index === pathParts.length - 1 ? t.text : t.accent,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
                onClick={() => {
                  const path = pathParts.slice(0, index + 1).join('/') + '/'
                  onNavigate(path)
                }}
              >
                {part}
              </span>
            </span>
          ))}
        </div>

        {/* 选中状态 */}
        {selectedKeys.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: t.textSecondary, fontSize: 12 }}>已选 {selectedKeys.length} 项</span>
            <Button size="small" onClick={onClearSelection}>
              取消
            </Button>
            <Popconfirm title="确定删除选中的文件吗？" onConfirm={onDeleteSelected}>
              <Button size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* 操作按钮 */}
        <Tooltip title="上传文件">
          <Button
            type="text"
            size="small"
            icon={<UploadOutlined />}
            onClick={() => fileInputRef.current?.click()}
            style={{ color: t.textMuted }}
          />
        </Tooltip>
        <Tooltip title="刷新">
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined spin={loading} />}
            onClick={onRefresh}
            style={{ color: t.textMuted }}
          />
        </Tooltip>

        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </div>

      {/* 文件列表 */}
      <div style={{ flex: 1, overflow: 'auto', background: t.bgCard }}>
        {loading && files.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : files.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Empty description="暂无文件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        ) : (
          <>
            {files.map((obj) => {
              const isSelected = selectedKeys.includes(obj.key)
              const isHovered = hoveredKey === obj.key
              const fileName = getFileName(obj.key)

              return (
                <div
                  key={obj.key}
                  onClick={() => onToggleSelect(obj.key)}
                  onDoubleClick={() => onPreview(obj)}
                  onMouseEnter={() => setHoveredKey(obj.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 16px',
                    cursor: 'pointer',
                    background: isSelected
                      ? t.accentSurface
                      : isHovered
                      ? t.bgMuted
                      : t.bgCard,
                    borderLeft: isSelected
                      ? `4px solid ${t.accent}`
                      : isHovered
                      ? `4px solid ${t.accent}`
                      : '4px solid transparent',
                    borderBottom: `1px solid ${t.borderLight}`,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* 图标 */}
                  <div style={{ width: 24, marginRight: 12, fontSize: 18 }}>
                    {getFileIcon(obj.key, obj.isFolder)}
                  </div>

                  {/* 文件名 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        color: t.text,
                        fontWeight: 500,
                        fontSize: 13,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {fileName}
                    </div>
                  </div>

                  {/* 大小 */}
                  <div style={{ width: 80, textAlign: 'right', color: t.textMuted, fontSize: 12 }}>
                    {formatSize(obj.size)}
                  </div>

                  {/* 修改时间 */}
                  <div style={{ width: 140, textAlign: 'right', color: t.textMuted, fontSize: 12 }}>
                    {formatDate(obj.lastModified)}
                  </div>

                  {/* 操作按钮 */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      marginLeft: 16,
                      opacity: isHovered ? 1 : 0,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    <Tooltip title="预览">
                      <Button
                        type="text"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                          onPreview(obj)
                        }}
                        style={{ color: t.textMuted }}
                      />
                    </Tooltip>
                    <Tooltip title="下载">
                      <Button
                        type="text"
                        size="small"
                        icon={<DownloadOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDownload(obj)
                        }}
                        style={{ color: t.textMuted }}
                      />
                    </Tooltip>
                    <Popconfirm
                      title={`确定删除 "${fileName}" 吗？`}
                      onConfirm={(e) => {
                        e?.stopPropagation()
                        handleDelete(obj)
                      }}
                      onCancel={(e) => e?.stopPropagation()}
                    >
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: t.textMuted }}
                      />
                    </Popconfirm>
                  </div>
                </div>
              )
            })}

            {/* 加载更多 */}
            {hasMore && (
              <div style={{ padding: 16, textAlign: 'center' }}>
                <Button onClick={onLoadMore} loading={loading}>
                  加载更多
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
