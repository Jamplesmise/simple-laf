import { useState, useEffect } from 'react'
import { Modal, Input, Spin, Typography } from 'antd'
import DiffViewer from './DiffViewer'
import { functionApi } from '../api/functions'

interface PublishModalProps {
  open: boolean
  functionId: string
  functionName: string
  currentCode: string
  onClose: () => void
  onPublished: (version: number) => void
}

export default function PublishModal({
  open,
  functionId,
  functionName,
  currentCode,
  onClose,
  onPublished
}: PublishModalProps) {
  const [changelog, setChangelog] = useState('')
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [lastPublishedCode, setLastPublishedCode] = useState('')
  const [currentVersion, setCurrentVersion] = useState(0)

  // 加载最新发布版本的代码
  useEffect(() => {
    if (open && functionId) {
      loadLastVersion()
    }
  }, [open, functionId])

  const loadLastVersion = async () => {
    setLoading(true)
    try {
      const res = await functionApi.getVersions(functionId)
      const versions = res.data.data
      if (versions.length > 0) {
        setCurrentVersion(versions[0].version)
        const detailRes = await functionApi.getVersion(functionId, versions[0].version)
        setLastPublishedCode(detailRes.data.data.code || '')
      } else {
        setLastPublishedCode('')
        setCurrentVersion(0)
      }
    } catch {
      setLastPublishedCode('')
      setCurrentVersion(0)
    } finally {
      setLoading(false)
    }
  }

  const handlePublish = async () => {
    setPublishing(true)
    try {
      const res = await functionApi.publish(functionId, changelog || '无变更日志')
      onPublished(res.data.data.version)
      onClose()
      setChangelog('')
    } catch {
      // 错误处理由调用方处理
    } finally {
      setPublishing(false)
    }
  }

  const handleCancel = () => {
    onClose()
    setChangelog('')
  }

  // 计算 Diff 高度：视口高度的 60%
  const diffHeight = Math.max(400, Math.floor(window.innerHeight * 0.6))

  return (
    <Modal
      title={`发版 ${functionName}`}
      open={open}
      onCancel={handleCancel}
      onOk={handlePublish}
      okText="确认发版"
      cancelText="取消"
      confirmLoading={publishing}
      width="80vw"
      centered
      styles={{
        body: { padding: '16px 0' }
      }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : (
        <>
          {/* 版本信息 */}
          <div style={{ marginBottom: 12, padding: '0 24px' }}>
            <Typography.Text type="secondary">
              v{currentVersion || '无'} → v{currentVersion + 1}
            </Typography.Text>
          </div>

          {/* Diff 对比 - 占据主要空间 */}
          <div style={{
            marginBottom: 12,
            borderRadius: 4,
            overflow: 'hidden',
            margin: '0 24px'
          }}>
            <DiffViewer
              oldCode={lastPublishedCode}
              newCode={currentCode}
              oldTitle={currentVersion ? `v${currentVersion} (已发布)` : '(空)'}
              newTitle={`v${currentVersion + 1} (待发布)`}
              height={diffHeight}
            />
          </div>

          {/* 变更日志 - 紧凑显示 */}
          <div style={{ padding: '0 24px' }}>
            <Input.TextArea
              value={changelog}
              onChange={e => setChangelog(e.target.value)}
              placeholder="变更日志（可选）"
              rows={2}
              style={{ resize: 'none' }}
            />
          </div>
        </>
      )}
    </Modal>
  )
}
