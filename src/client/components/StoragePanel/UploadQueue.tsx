/**
 * 上传队列面板
 */

import { Button, Empty, Progress, Spin } from 'antd'
import { FileOutlined, CloseOutlined, CheckOutlined } from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import { formatSize } from './utils'
import type { UploadTask } from '@/stores/storage'

interface UploadQueueProps {
  tasks: UploadTask[]
  onClose: () => void
  onStartUpload: (id: string) => void
  onStartAll: () => void
  onRemove: (id: string) => void
  onClearCompleted: () => void
}

export function UploadQueue({
  tasks,
  onClose,
  onStartUpload,
  onStartAll,
  onRemove,
  onClearCompleted,
}: UploadQueueProps) {
  const { t } = useThemeColors()

  const pendingCount = tasks.filter((t) => t.status === 'pending').length
  const completedCount = tasks.filter((t) => t.status === 'done').length

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
        <span style={{ fontWeight: 600, color: t.text, fontSize: 13 }}>
          上传队列 ({tasks.length})
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {completedCount > 0 && (
            <Button size="small" onClick={onClearCompleted}>
              清除已完成
            </Button>
          )}
          {pendingCount > 0 && (
            <Button size="small" type="primary" onClick={onStartAll} style={{ background: t.accent }}>
              全部上传
            </Button>
          )}
          <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
        </div>
      </div>

      {/* 上传列表 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tasks.length === 0 ? (
          <Empty description="暂无上传任务" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 40 }} />
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${t.borderLight}`,
                background: t.bgCard,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <FileOutlined style={{ color: t.textMuted }} />
                <span
                  style={{
                    flex: 1,
                    color: t.text,
                    fontSize: 13,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {task.file.name}
                </span>
                <span style={{ color: t.textMuted, fontSize: 11 }}>{formatSize(task.file.size)}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {task.status === 'pending' && (
                  <>
                    <Progress percent={0} size="small" style={{ flex: 1 }} />
                    <Button size="small" onClick={() => onStartUpload(task.id)}>
                      上传
                    </Button>
                    <Button size="small" type="text" icon={<CloseOutlined />} onClick={() => onRemove(task.id)} />
                  </>
                )}
                {task.status === 'uploading' && (
                  <>
                    <Progress percent={task.progress} size="small" style={{ flex: 1 }} status="active" />
                    <Spin size="small" />
                  </>
                )}
                {task.status === 'done' && (
                  <>
                    <Progress percent={100} size="small" style={{ flex: 1 }} />
                    <CheckOutlined style={{ color: t.accent }} />
                  </>
                )}
                {task.status === 'error' && (
                  <>
                    <div style={{ flex: 1, color: '#EF4444', fontSize: 12 }}>{task.error}</div>
                    <Button size="small" onClick={() => onStartUpload(task.id)}>
                      重试
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}
