/**
 * 已上传文件列表
 */

import { Tooltip } from 'antd'
import { FileTextOutlined, DeleteOutlined } from '@ant-design/icons'
import type { UploadedFile } from '@/api/aiConversation'
import { useThemeColors } from '@/hooks/useTheme'
import styles from './styles.module.css'

interface FileListProps {
  /** 文件列表 */
  files: UploadedFile[]
  /** 删除回调 */
  onDelete: (fileId: string) => void
  /** 是否加载中 */
  loading?: boolean
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

// 格式化 token 数量
function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`
  return `${(tokens / 1000).toFixed(1)}K`
}

export function FileList({ files, onDelete, loading }: FileListProps) {
  const { t } = useThemeColors()

  if (files.length === 0) {
    return null
  }

  return (
    <div className={styles.fileList}>
      <div className={styles.fileListTitle}>已上传文件:</div>
      {files.map(file => (
        <div
          key={file.id}
          className={styles.fileItem}
          style={{ borderColor: t.border }}
        >
          <FileTextOutlined className={styles.fileIcon} />
          <div className={styles.fileInfo}>
            <div className={styles.fileName}>{file.name}</div>
            <div className={styles.fileMeta}>
              {formatSize(file.size)} · {formatTokens(file.tokens)} tokens
            </div>
          </div>
          <Tooltip title="删除">
            <button
              className={styles.fileDeleteBtn}
              onClick={() => onDelete(file.id)}
              disabled={loading}
            >
              <DeleteOutlined />
            </button>
          </Tooltip>
        </div>
      ))}
    </div>
  )
}

export default FileList
