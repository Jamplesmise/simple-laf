/**
 * 文件拖拽上传区域
 *
 * 支持拖拽和点击上传
 */

import { useState, useRef, useCallback } from 'react'
import { InboxOutlined, LoadingOutlined } from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import styles from './styles.module.css'

interface DropZoneProps {
  /** 上传中 */
  uploading: boolean
  /** 文件选择回调 */
  onFilesSelected: (files: File[]) => void
  /** 接受的文件类型 */
  accept?: string
  /** 是否禁用 */
  disabled?: boolean
}

export function DropZone({
  uploading,
  onFilesSelected,
  accept = '.txt,.md,.json,.js,.ts,.tsx,.jsx,.css,.html,.xml,.yaml,.yml',
  disabled = false,
}: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { t } = useThemeColors()

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled && !uploading) {
      setIsDragOver(true)
    }
  }, [disabled, uploading])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (disabled || uploading) return

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      onFilesSelected(files)
    }
  }, [disabled, uploading, onFilesSelected])

  const handleClick = useCallback(() => {
    if (!disabled && !uploading) {
      inputRef.current?.click()
    }
  }, [disabled, uploading])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      onFilesSelected(files)
    }
    // 清空 input 以便重复选择同一文件
    e.target.value = ''
  }, [onFilesSelected])

  const containerClass = `${styles.dropZone} ${isDragOver ? styles.dropZoneDragOver : ''} ${disabled ? styles.dropZoneDisabled : ''}`

  return (
    <div
      className={containerClass}
      style={{ borderColor: isDragOver ? '#059669' : t.border }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <div className={styles.dropZoneContent}>
        {uploading ? (
          <>
            <LoadingOutlined className={styles.dropZoneIcon} spin />
            <div className={styles.dropZoneText}>上传中...</div>
          </>
        ) : (
          <>
            <InboxOutlined className={styles.dropZoneIcon} />
            <div className={styles.dropZoneText}>拖拽文件到这里，或点击上传</div>
            <div className={styles.dropZoneHint}>
              支持: .txt .md .json .js .ts .css .html
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default DropZone
