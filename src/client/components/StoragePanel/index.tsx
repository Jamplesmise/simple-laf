/**
 * 存储面板
 *
 * S3 对象存储管理界面，支持文件浏览、上传、下载、预览等功能
 */

import { useEffect, useState } from 'react'
import { message, Modal, Input, Spin, Empty } from 'antd'
import { CloudOutlined } from '@ant-design/icons'
import { useStorageStore } from '@/stores/storage'
import { useThemeColors } from '@/hooks/useTheme'
import { storageApi, type ObjectInfo } from '@/api/storage'
import { FolderTree } from './FolderTree'
import { FileList } from './FileList'
import { UploadQueue } from './UploadQueue'
import { FilePreview } from './FilePreview'
import { getFileName } from './utils'

export default function StoragePanel() {
  const { t } = useThemeColors()

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

  // 状态
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // 初始化 - 检查配置状态
  useEffect(() => {
    refreshConfigStatus()
  }, [refreshConfigStatus])

  // 配置成功后自动使用默认存储桶
  useEffect(() => {
    if (configStatus?.configured && configStatus.bucket && !currentBucket) {
      setCurrentBucket(configStatus.bucket)
    }
  }, [configStatus, currentBucket, setCurrentBucket])

  // 处理创建文件夹
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

  // 处理下载
  const handleDownload = async (obj: ObjectInfo) => {
    if (!currentBucket) return
    try {
      const url = await storageApi.downloadFile(currentBucket, obj.key)
      const a = document.createElement('a')
      a.href = url
      a.download = getFileName(obj.key)
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('下载失败')
    }
  }

  // 处理批量删除
  const handleDeleteSelected = async () => {
    if (selectedKeys.length === 0) return
    try {
      await deleteSelected()
      message.success('删除成功')
    } catch (err) {
      message.error((err as Error).message || '删除失败')
    }
  }

  // 开始上传
  const handleStartUpload = async (taskId: string) => {
    await startUpload(taskId)
  }

  // 开始所有上传
  const handleStartAllUploads = async () => {
    const pendingTasks = uploadTasks.filter((t) => t.status === 'pending')
    for (const task of pendingTasks) {
      await startUpload(task.id)
    }
  }

  // 从对象列表中提取文件夹和文件
  const folders = objects.filter((o) => o.isFolder)
  const files = objects.filter((o) => !o.isFolder)

  // 面包屑路径
  const pathParts = currentPath.split('/').filter(Boolean)

  // 初始加载中
  if (configLoading && configStatus === null) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bgCard }}>
        <Spin size="large" />
      </div>
    )
  }

  // 未配置 S3
  if (!configLoading && (!configStatus || !configStatus.configured)) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bgCard }}>
        <Empty
          image={<CloudOutlined style={{ fontSize: 64, color: t.textMuted }} />}
          description={
            <div>
              <p style={{ color: t.textSecondary, marginBottom: 8 }}>S3 存储未配置</p>
              <p style={{ color: t.textMuted, fontSize: 12 }}>
                请设置环境变量: S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY
              </p>
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', background: t.bgCard, flex: 1 }}>
      {/* 左侧：文件夹树 */}
      <FolderTree
        folders={folders}
        currentPath={currentPath}
        loading={objectsLoading}
        onNavigate={navigateTo}
        onRefresh={refreshObjects}
        onCreateFolder={() => setCreateFolderOpen(true)}
      />

      {/* 中间：文件列表 */}
      <FileList
        files={files}
        currentPath={currentPath}
        pathParts={pathParts}
        bucketName={configStatus?.bucket || '存储'}
        loading={objectsLoading}
        hasMore={hasMore}
        selectedKeys={selectedKeys}
        onNavigate={navigateTo}
        onRefresh={refreshObjects}
        onLoadMore={loadMoreObjects}
        onToggleSelect={toggleSelectKey}
        onClearSelection={clearSelection}
        onDeleteSelected={handleDeleteSelected}
        onPreview={setPreviewObject}
        onAddUploadTask={addUploadTask}
        onShowUploader={() => setUploaderVisible(true)}
      />

      {/* 右侧：上传队列或预览 */}
      {(uploaderVisible || previewObject) && (
        <div
          style={{
            width: 360,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            background: t.bgMuted,
            borderLeft: `1px solid ${t.borderLight}`,
          }}
        >
          {previewObject ? (
            <FilePreview
              object={previewObject}
              bucket={currentBucket!}
              onClose={() => setPreviewObject(null)}
              onDownload={() => handleDownload(previewObject)}
            />
          ) : (
            <UploadQueue
              tasks={uploadTasks}
              onClose={() => setUploaderVisible(false)}
              onStartUpload={handleStartUpload}
              onStartAll={handleStartAllUploads}
              onRemove={removeUploadTask}
              onClearCompleted={clearCompletedUploads}
            />
          )}
        </div>
      )}

      {/* 创建文件夹弹窗 */}
      <Modal
        title="新建文件夹"
        open={createFolderOpen}
        onOk={handleCreateFolder}
        onCancel={() => {
          setCreateFolderOpen(false)
          setNewFolderName('')
        }}
        okButtonProps={{ style: { background: t.accent, borderColor: t.accent } }}
        okText="创建"
        cancelText="取消"
      >
        <Input
          placeholder="文件夹名称"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onPressEnter={handleCreateFolder}
          style={{ marginTop: 8 }}
        />
      </Modal>
    </div>
  )
}
