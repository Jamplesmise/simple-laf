/**
 * 文件上传组件
 *
 * 整合 DropZone 和 FileList
 */

import { useState, useEffect, useCallback } from 'react'
import { message } from 'antd'
import { fileUploadApi, type UploadedFile } from '@/api/aiConversation'
import { DropZone } from './DropZone'
import { FileList } from './FileList'
import styles from './styles.module.css'

interface FileUploadProps {
  /** 对话 ID */
  conversationId: string | null
  /** 文件变化回调 */
  onFilesChange?: (files: UploadedFile[]) => void
  /** 是否展开 */
  expanded?: boolean
}

export function FileUpload({ conversationId, onFilesChange, expanded = true }: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)

  // 加载文件列表
  const loadFiles = useCallback(async () => {
    if (!conversationId) {
      setFiles([])
      return
    }

    setLoading(true)
    try {
      const response = await fileUploadApi.list(conversationId)
      if (response.data.success) {
        setFiles(response.data.data)
        onFilesChange?.(response.data.data)
      }
    } catch {
      // 静默失败
    } finally {
      setLoading(false)
    }
  }, [conversationId, onFilesChange])

  // 对话变化时加载文件
  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  // 处理文件选择
  const handleFilesSelected = useCallback(async (selectedFiles: File[]) => {
    if (!conversationId) {
      message.warning('请先选择或创建一个对话')
      return
    }

    setUploading(true)
    try {
      for (const file of selectedFiles) {
        // 检查文件大小
        if (file.size > 1024 * 1024) {
          message.error(`文件 ${file.name} 超过 1MB 限制`)
          continue
        }

        try {
          const uploaded = await fileUploadApi.upload(conversationId, file)
          setFiles(prev => {
            const newFiles = [uploaded, ...prev]
            onFilesChange?.(newFiles)
            return newFiles
          })
          message.success(`${file.name} 上传成功`)
        } catch (err) {
          message.error(`${file.name} 上传失败: ${err instanceof Error ? err.message : '未知错误'}`)
        }
      }
    } finally {
      setUploading(false)
    }
  }, [conversationId, onFilesChange])

  // 处理删除文件
  const handleDelete = useCallback(async (fileId: string) => {
    if (!conversationId) return

    try {
      await fileUploadApi.delete(conversationId, fileId)
      setFiles(prev => {
        const newFiles = prev.filter(f => f.id !== fileId)
        onFilesChange?.(newFiles)
        return newFiles
      })
      message.success('文件已删除')
    } catch {
      message.error('删除失败')
    }
  }, [conversationId, onFilesChange])

  if (!expanded) {
    return null
  }

  return (
    <div className={styles.fileUpload}>
      <DropZone
        uploading={uploading}
        onFilesSelected={handleFilesSelected}
        disabled={!conversationId}
      />
      <FileList
        files={files}
        onDelete={handleDelete}
        loading={loading}
      />
    </div>
  )
}

export default FileUpload
