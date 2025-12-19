import { useEffect, useState, useRef } from 'react'
import { message, Modal, Input, Button, Spin, Empty, Tooltip, Popconfirm, Progress } from 'antd'
import {
  DeleteOutlined,
  ReloadOutlined,
  FolderOutlined,
  FileOutlined,
  UploadOutlined,
  DownloadOutlined,
  FolderAddOutlined,
  CloudOutlined,
  EyeOutlined,
  CloseOutlined,
  CheckOutlined,
  RightOutlined,
  HomeOutlined,
} from '@ant-design/icons'
import { useStorageStore, type UploadTask } from '../stores/storage'
import { useThemeStore } from '../stores/theme'
import { storageApi, type ObjectInfo } from '../api/storage'

// Emerald Green 配色
const lightColors = {
  bg: '#FFFFFF',
  bgSubtle: '#F8FAFC',
  bgMuted: '#F1F5F9',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  text: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  accent: '#10B981',
  accentHover: '#059669',
  accentLight: '#ECFDF5',
  accentSurface: 'rgba(16, 185, 129, 0.08)',
}

const darkColors = {
  bg: '#18181B',
  bgSubtle: '#1F1F23',
  bgMuted: '#27272A',
  border: '#3F3F46',
  borderLight: '#2D2D31',
  text: '#FAFAFA',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  accent: '#10B981',
  accentHover: '#34D399',
  accentLight: 'rgba(16, 185, 129, 0.15)',
  accentSurface: 'rgba(16, 185, 129, 0.08)',
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getFileIcon(key: string, isFolder: boolean) {
  if (isFolder) return <FolderOutlined style={{ color: '#FBBF24' }} />
  const ext = key.split('.').pop()?.toLowerCase()
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico']
  const codeExts = ['js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'md']
  const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
  if (imageExts.includes(ext || '')) return <FileOutlined style={{ color: '#10B981' }} />
  if (codeExts.includes(ext || '')) return <FileOutlined style={{ color: '#3B82F6' }} />
  if (docExts.includes(ext || '')) return <FileOutlined style={{ color: '#EF4444' }} />
  return <FileOutlined style={{ color: '#6B7280' }} />
}

function getFileName(key: string): string {
  const parts = key.split('/')
  return parts[parts.length - 1] || parts[parts.length - 2] || key
}

export default function StoragePanel() {
  const mode = useThemeStore((s) => s.mode)
  const isDark = mode === 'dark'
  const colors = isDark ? darkColors : lightColors

  const {
    configStatus,
    configLoading,
    currentBucket,
    objects,
    currentPath,
    objectsLoading,
    selectedKeys,
    hasMore,
    uploadTasks,
    uploaderVisible,
    previewObject,
    refreshConfigStatus,
    setCurrentBucket,
    refreshObjects,
    loadMoreObjects,
    navigateTo,
    toggleSelectKey,
    clearSelection,
    deleteSelected,
    createFolder,
    addUploadTask,
    removeUploadTask,
    startUpload,
    setUploaderVisible,
    clearCompletedUploads,
    setPreviewObject,
  } = useStorageStore()

  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [hoveredFolder, setHoveredFolder] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    refreshConfigStatus()
  }, [refreshConfigStatus])

  useEffect(() => {
    if (configStatus?.configured && configStatus.bucket && !currentBucket) {
      setCurrentBucket(configStatus.bucket)
    }
  }, [configStatus, currentBucket, setCurrentBucket])

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      message.warning('请输入文件夹名称')
      return
    }
    try {
      await createFolder(newFolderName.trim())
      message.success('创建成功')
      setCreateFolderOpen(false)
      setNewFolderName('')
    } catch (err) {
      message.error((err as Error).message || '创建失败')
    }
  }

  const handleObjectClick = (obj: ObjectInfo) => {
    if (obj.isFolder) {
      navigateTo(obj.key)
    } else {
      toggleSelectKey(obj.key)
    }
  }

  const handleObjectDoubleClick = (obj: ObjectInfo) => {
    if (!obj.isFolder) {
      setPreviewObject(obj)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || !currentBucket) return
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const key = currentPath + file.name
      addUploadTask(file, key)
    }
    setUploaderVisible(true)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDownload = async (obj: ObjectInfo) => {
    if (!currentBucket) return
    try {
      const url = await storageApi.downloadFile(currentBucket, obj.key)
      const a = document.createElement('a')
      a.href = url
      a.download = getFileName(obj.key)
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      message.error('下载失败')
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedKeys.length === 0) return
    try {
      await deleteSelected()
      message.success('删除成功')
    } catch (err) {
      message.error((err as Error).message || '删除失败')
    }
  }

  const handleDeleteSingle = async (obj: ObjectInfo) => {
    if (!currentBucket) return
    try {
      await storageApi.deleteObjects(currentBucket, [obj.key])
      message.success('删除成功')
      refreshObjects()
    } catch (err) {
      message.error('删除失败')
    }
  }

  const handleStartUpload = async (taskId: string) => {
    await startUpload(taskId)
  }

  const handleStartAllUploads = async () => {
    const pendingTasks = uploadTasks.filter((t) => t.status === 'pending')
    for (const task of pendingTasks) {
      await startUpload(task.id)
    }
  }

  const folders = objects.filter((o) => o.isFolder)
  const files = objects.filter((o) => !o.isFolder)
  const pathParts = currentPath.split('/').filter(Boolean)

  if (configLoading && configStatus === null) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.bg }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!configLoading && (!configStatus || !configStatus.configured)) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.bg }}>
        <Empty
          image={<CloudOutlined style={{ fontSize: 64, color: colors.textMuted }} />}
          description={
            <div>
              <p style={{ color: colors.textSecondary, marginBottom: 8 }}>S3 存储未配置</p>
              <p style={{ color: colors.textMuted, fontSize: 12 }}>
                请设置环境变量: S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY
              </p>
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', background: colors.bg, flex: 1 }}>
      {/* 左侧：文件夹树 */}
      <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', background: colors.bg, borderRight: `1px solid ${colors.borderLight}` }}>
        <div style={{ height: 40, padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${colors.borderLight}` }}>
          <span style={{ fontWeight: 600, color: colors.text, fontSize: 13 }}>文件夹</span>
          <div style={{ display: 'flex', gap: 2 }}>
            <Tooltip title="刷新">
              <Button type="text" size="small" icon={<ReloadOutlined spin={objectsLoading} style={{ fontSize: 13 }} />} onClick={() => refreshObjects()} style={{ color: colors.textMuted, width: 26, height: 26 }} />
            </Tooltip>
            <Tooltip title="新建文件夹">
              <Button type="text" size="small" icon={<FolderAddOutlined style={{ fontSize: 13 }} />} onClick={() => setCreateFolderOpen(true)} style={{ color: colors.textMuted, width: 26, height: 26 }} />
            </Tooltip>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          <div
            style={{
              height: 38, padding: '0 10px', cursor: 'pointer', display: 'flex', alignItems: 'center',
              background: currentPath === '' ? `linear-gradient(90deg, ${colors.accentLight} 0%, ${colors.accentSurface} 100%)` : hoveredFolder === '/' ? colors.bgSubtle : 'transparent',
              borderLeft: currentPath === '' ? `3px solid ${colors.accent}` : '3px solid transparent',
            }}
            onClick={() => navigateTo('')}
            onMouseEnter={() => setHoveredFolder('/')}
            onMouseLeave={() => setHoveredFolder(null)}
          >
            <HomeOutlined style={{ color: currentPath === '' ? colors.accent : colors.textMuted, fontSize: 14, marginRight: 8 }} />
            <span style={{ color: currentPath === '' ? colors.accent : colors.text, fontWeight: 500, fontSize: 13 }}>根目录</span>
          </div>

          {objectsLoading && folders.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center' }}><Spin size="small" /></div>
          ) : (
            folders.map((folder) => {
              const folderName = getFileName(folder.key.replace(/\/$/, ''))
              const isSelected = currentPath === folder.key
              const isHovered = hoveredFolder === folder.key
              return (
                <div
                  key={folder.key}
                  style={{
                    height: 38, padding: '0 10px 0 28px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    background: isSelected ? `linear-gradient(90deg, ${colors.accentLight} 0%, ${colors.accentSurface} 100%)` : isHovered ? colors.bgSubtle : 'transparent',
                    borderLeft: isSelected ? `3px solid ${colors.accent}` : '3px solid transparent',
                  }}
                  onClick={() => navigateTo(folder.key)}
                  onMouseEnter={() => setHoveredFolder(folder.key)}
                  onMouseLeave={() => setHoveredFolder(null)}
                >
                  <FolderOutlined style={{ color: '#FBBF24', fontSize: 14, marginRight: 8 }} />
                  <span style={{ color: isSelected ? colors.accent : colors.text, fontWeight: 500, fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folderName}</span>
                  <RightOutlined style={{ color: colors.textMuted, fontSize: 10 }} />
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 中间：文件列表 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ height: 56, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${colors.borderLight}`, background: colors.bg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <span style={{ color: pathParts.length > 0 ? colors.accent : colors.text, cursor: 'pointer', fontWeight: 500, fontSize: 13 }} onClick={() => navigateTo('')}>
              {configStatus?.bucket || '存储'}
            </span>
            {pathParts.map((part, index) => (
              <span key={index} style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: colors.textMuted, margin: '0 4px' }}>/</span>
                <span style={{ color: index === pathParts.length - 1 ? colors.text : colors.accent, cursor: 'pointer', fontSize: 13 }} onClick={() => navigateTo(pathParts.slice(0, index + 1).join('/') + '/')}>
                  {part}
                </span>
              </span>
            ))}
          </div>

          {selectedKeys.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: colors.textSecondary, fontSize: 12 }}>已选 {selectedKeys.length} 项</span>
              <Button size="small" onClick={clearSelection}>取消</Button>
              <Popconfirm title="确定删除选中的文件吗？" onConfirm={handleDeleteSelected}>
                <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            </div>
          )}

          <div style={{ flex: 1 }} />

          <Tooltip title="上传文件">
            <Button type="text" size="small" icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()} style={{ color: colors.textMuted }} />
          </Tooltip>
          <Tooltip title="刷新">
            <Button type="text" size="small" icon={<ReloadOutlined spin={objectsLoading} />} onClick={() => refreshObjects()} style={{ color: colors.textMuted }} />
          </Tooltip>

          <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileSelect} />
        </div>

        <div style={{ flex: 1, overflow: 'auto', background: colors.bg }}>
          {objectsLoading && files.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
          ) : files.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Empty description="暂无文件" image={Empty.PRESENTED_IMAGE_SIMPLE} /></div>
          ) : (
            <>
              {files.map((obj) => {
                const isSelected = selectedKeys.includes(obj.key)
                const isHovered = hoveredKey === obj.key
                const fileName = getFileName(obj.key)

                return (
                  <div
                    key={obj.key}
                    onClick={() => handleObjectClick(obj)}
                    onDoubleClick={() => handleObjectDoubleClick(obj)}
                    onMouseEnter={() => setHoveredKey(obj.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '10px 16px', cursor: 'pointer',
                      background: isSelected ? colors.accentSurface : isHovered ? colors.bgSubtle : colors.bg,
                      borderLeft: isSelected || isHovered ? `4px solid ${colors.accent}` : '4px solid transparent',
                      borderBottom: `1px solid ${colors.borderLight}`,
                    }}
                  >
                    <div style={{ width: 24, marginRight: 12, fontSize: 18 }}>{getFileIcon(obj.key, obj.isFolder)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: colors.text, fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</div>
                    </div>
                    <div style={{ width: 80, textAlign: 'right', color: colors.textMuted, fontSize: 12 }}>{formatSize(obj.size)}</div>
                    <div style={{ width: 140, textAlign: 'right', color: colors.textMuted, fontSize: 12 }}>{formatDate(obj.lastModified)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 16, opacity: isHovered ? 1 : 0 }}>
                      <Tooltip title="预览">
                        <Button type="text" size="small" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); setPreviewObject(obj) }} style={{ color: colors.textMuted }} />
                      </Tooltip>
                      <Tooltip title="下载">
                        <Button type="text" size="small" icon={<DownloadOutlined />} onClick={(e) => { e.stopPropagation(); handleDownload(obj) }} style={{ color: colors.textMuted }} />
                      </Tooltip>
                      <Popconfirm title={`确定删除 "${fileName}" 吗？`} onConfirm={() => handleDeleteSingle(obj)} onCancel={(e) => e?.stopPropagation()}>
                        <Button type="text" size="small" icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} style={{ color: colors.textMuted }} />
                      </Popconfirm>
                    </div>
                  </div>
                )
              })}

              {hasMore && (
                <div style={{ padding: 16, textAlign: 'center' }}>
                  <Button onClick={loadMoreObjects} loading={objectsLoading}>加载更多</Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 右侧：上传队列或预览 */}
      {(uploaderVisible || previewObject) && (
        <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', background: colors.bgSubtle, borderLeft: `1px solid ${colors.borderLight}` }}>
          {previewObject ? (
            <FilePreviewPanel object={previewObject} bucket={currentBucket!} colors={colors} onClose={() => setPreviewObject(null)} onDownload={() => handleDownload(previewObject)} />
          ) : (
            <UploadQueuePanel tasks={uploadTasks} colors={colors} onClose={() => setUploaderVisible(false)} onStartUpload={handleStartUpload} onStartAll={handleStartAllUploads} onRemove={removeUploadTask} onClearCompleted={clearCompletedUploads} />
          )}
        </div>
      )}

      <Modal title="新建文件夹" open={createFolderOpen} onOk={handleCreateFolder} onCancel={() => { setCreateFolderOpen(false); setNewFolderName('') }} okButtonProps={{ style: { background: colors.accent, borderColor: colors.accent } }} okText="创建" cancelText="取消">
        <Input placeholder="文件夹名称" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onPressEnter={handleCreateFolder} style={{ marginTop: 8 }} />
      </Modal>
    </div>
  )
}

function UploadQueuePanel({ tasks, colors, onClose, onStartUpload, onStartAll, onRemove, onClearCompleted }: { tasks: UploadTask[]; colors: typeof lightColors; onClose: () => void; onStartUpload: (id: string) => void; onStartAll: () => void; onRemove: (id: string) => void; onClearCompleted: () => void }) {
  const pendingCount = tasks.filter((t) => t.status === 'pending').length
  const completedCount = tasks.filter((t) => t.status === 'done').length

  return (
    <>
      <div style={{ height: 56, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${colors.borderLight}`, background: colors.bg }}>
        <span style={{ fontWeight: 600, color: colors.text, fontSize: 13 }}>上传队列 ({tasks.length})</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {completedCount > 0 && <Button size="small" onClick={onClearCompleted}>清除已完成</Button>}
          {pendingCount > 0 && <Button size="small" type="primary" onClick={onStartAll} style={{ background: colors.accent }}>全部上传</Button>}
          <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tasks.length === 0 ? (
          <Empty description="暂无上传任务" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 40 }} />
        ) : (
          tasks.map((task) => (
            <div key={task.id} style={{ padding: '12px 16px', borderBottom: `1px solid ${colors.borderLight}`, background: colors.bg }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <FileOutlined style={{ color: colors.textMuted }} />
                <span style={{ flex: 1, color: colors.text, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.file.name}</span>
                <span style={{ color: colors.textMuted, fontSize: 11 }}>{formatSize(task.file.size)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {task.status === 'pending' && (<><Progress percent={0} size="small" style={{ flex: 1 }} /><Button size="small" onClick={() => onStartUpload(task.id)}>上传</Button><Button size="small" type="text" icon={<CloseOutlined />} onClick={() => onRemove(task.id)} /></>)}
                {task.status === 'uploading' && (<><Progress percent={task.progress} size="small" style={{ flex: 1 }} status="active" /><Spin size="small" /></>)}
                {task.status === 'done' && (<><Progress percent={100} size="small" style={{ flex: 1 }} /><CheckOutlined style={{ color: colors.accent }} /></>)}
                {task.status === 'error' && (<><div style={{ flex: 1, color: '#EF4444', fontSize: 12 }}>{task.error}</div><Button size="small" onClick={() => onStartUpload(task.id)}>重试</Button></>)}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}

function FilePreviewPanel({ object, bucket, colors, onClose, onDownload }: { object: ObjectInfo; bucket: string; colors: typeof lightColors; onClose: () => void; onDownload: () => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fileName = getFileName(object.key)
  const ext = fileName.split('.').pop()?.toLowerCase()
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico']
  const textExts = ['txt', 'json', 'md', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'xml', 'yaml', 'yml', 'log']
  const isImage = imageExts.includes(ext || '')
  const isText = textExts.includes(ext || '')

  useEffect(() => {
    const loadPreview = async () => {
      setLoading(true)
      setPreviewUrl(null)
      setTextContent(null)
      try {
        if (isImage) {
          const res = await storageApi.getPresignedUrl(bucket, object.key, 3600)
          if (res.data.success) setPreviewUrl(res.data.data.url)
        } else if (isText && object.size < 1024 * 1024) {
          const blobUrl = await storageApi.downloadFile(bucket, object.key)
          const response = await fetch(blobUrl)
          const text = await response.text()
          setTextContent(text)
          URL.revokeObjectURL(blobUrl)
        }
      } catch (err) {
        console.error('加载预览失败:', err)
      } finally {
        setLoading(false)
      }
    }
    loadPreview()
  }, [object, bucket, isImage, isText])

  return (
    <>
      <div style={{ height: 56, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${colors.borderLight}`, background: colors.bg }}>
        <span style={{ fontWeight: 600, color: colors.text, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{fileName}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <Tooltip title="下载"><Button type="text" size="small" icon={<DownloadOutlined />} onClick={onDownload} /></Tooltip>
          <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16, background: colors.bg }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Spin /></div>
        ) : previewUrl ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <img src={previewUrl} alt={fileName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
        ) : textContent !== null ? (
          <pre style={{ margin: 0, padding: 12, background: colors.bgMuted, borderRadius: 6, fontSize: 12, fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: colors.text, overflow: 'auto', maxHeight: '100%' }}>{textContent}</pre>
        ) : (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <FileOutlined style={{ fontSize: 48, color: colors.textMuted }} />
            <p style={{ color: colors.textSecondary, marginTop: 16 }}>无法预览此文件类型</p>
          </div>
        )}
      </div>
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${colors.borderLight}`, background: colors.bgSubtle }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: colors.textMuted }}><span>大小</span><span>{formatSize(object.size)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: colors.textMuted, marginTop: 4 }}><span>修改时间</span><span>{formatDate(object.lastModified)}</span></div>
      </div>
    </>
  )
}
