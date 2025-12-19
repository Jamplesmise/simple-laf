/**
 * 文件预览面板
 */

import { useEffect, useState } from 'react'
import { Button, Spin, Tooltip } from 'antd'
import { FileOutlined, DownloadOutlined, CloseOutlined } from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import { storageApi, type ObjectInfo } from '@/api/storage'
import { formatSize, formatDate, getFileName, isImageFile, isTextFile } from './utils'

interface FilePreviewProps {
  object: ObjectInfo
  bucket: string
  onClose: () => void
  onDownload: () => void
}

export function FilePreview({ object, bucket, onClose, onDownload }: FilePreviewProps) {
  const { t } = useThemeColors()

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fileName = getFileName(object.key)
  const isImage = isImageFile(fileName)
  const isText = isTextFile(fileName)

  useEffect(() => {
    const loadPreview = async () => {
      setLoading(true)
      setPreviewUrl(null)
      setTextContent(null)

      try {
        if (isImage) {
          const res = await storageApi.getPresignedUrl(bucket, object.key, 3600)
          if (res.data.success) {
            setPreviewUrl(res.data.data.url)
          }
        } else if (isText && object.size < 1024 * 1024) {
          // 文本文件且小于 1MB
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
      {/* Header */}
      <div
        style={{
          height: 56,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${t.borderLight}`,
          background: t.bgCard,
        }}
      >
        <span
          style={{
            fontWeight: 600,
            color: t.text,
            fontSize: 13,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {fileName}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <Tooltip title="下载">
            <Button type="text" size="small" icon={<DownloadOutlined />} onClick={onDownload} />
          </Tooltip>
          <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
        </div>
      </div>

      {/* 预览内容 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16, background: t.bgCard }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Spin />
          </div>
        ) : previewUrl ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <img
              src={previewUrl}
              alt={fileName}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          </div>
        ) : textContent !== null ? (
          <pre
            style={{
              margin: 0,
              padding: 12,
              background: t.bgMuted,
              borderRadius: 6,
              fontSize: 12,
              fontFamily: 'JetBrains Mono, monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              color: t.text,
              overflow: 'auto',
              maxHeight: '100%',
            }}
          >
            {textContent}
          </pre>
        ) : (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <FileOutlined style={{ fontSize: 48, color: t.textMuted }} />
            <p style={{ color: t.textSecondary, marginTop: 16 }}>无法预览此文件类型</p>
          </div>
        )}
      </div>

      {/* 文件信息 */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: `1px solid ${t.borderLight}`,
          background: t.bgMuted,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: t.textMuted }}>
          <span>大小</span>
          <span>{formatSize(object.size)}</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: t.textMuted,
            marginTop: 4,
          }}
        >
          <span>修改时间</span>
          <span>{formatDate(object.lastModified)}</span>
        </div>
      </div>
    </>
  )
}
