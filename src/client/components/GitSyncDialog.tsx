import { useState } from 'react'
import { Modal, Checkbox, Tag, Empty, Spin, Button, Input } from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  WarningOutlined,
  CloudDownloadOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons'
import { useThemeStore } from '../stores/theme'
import type { SyncChange } from '../api/git'
import DiffViewer from './DiffViewer'

interface GitSyncDialogProps {
  open: boolean
  onClose: () => void
  mode: 'pull' | 'push'
  changes: SyncChange[]
  loading: boolean
  hasConflicts: boolean
  onConfirm: (selectedFunctions: string[], commitMessage?: string) => void
  confirming: boolean
}

export default function GitSyncDialog({
  open,
  onClose,
  mode,
  changes,
  loading,
  hasConflicts,
  onConfirm,
  confirming,
}: GitSyncDialogProps) {
  const isDark = useThemeStore((state) => state.mode) === 'dark'
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedDiff, setExpandedDiff] = useState<string | null>(null)
  const [commitMessage, setCommitMessage] = useState('')

  // 状态图标和颜色
  const getStatusIcon = (status: SyncChange['status']) => {
    switch (status) {
      case 'added':
        return <PlusOutlined style={{ color: '#52c41a' }} />
      case 'modified':
        return <EditOutlined style={{ color: '#1890ff' }} />
      case 'deleted':
        return <DeleteOutlined style={{ color: '#ff4d4f' }} />
      case 'conflict':
        return <WarningOutlined style={{ color: '#faad14' }} />
    }
  }

  const getStatusTag = (status: SyncChange['status']) => {
    const config = {
      added: { color: 'success', text: '新增' },
      modified: { color: 'processing', text: '修改' },
      deleted: { color: 'error', text: '删除' },
      conflict: { color: 'warning', text: '冲突' },
    }
    return <Tag color={config[status].color}>{config[status].text}</Tag>
  }

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(changes.map((c) => c.path)))
    } else {
      setSelected(new Set())
    }
  }

  // 单个选择 (使用 path 作为唯一标识)
  const handleSelect = (path: string, checked: boolean) => {
    const newSelected = new Set(selected)
    if (checked) {
      newSelected.add(path)
    } else {
      newSelected.delete(path)
    }
    setSelected(newSelected)
  }

  // 切换 diff 展开
  const toggleDiff = (path: string) => {
    setExpandedDiff(expandedDiff === path ? null : path)
  }

  // 确认同步
  const handleConfirm = () => {
    const selectedList = Array.from(selected)
    console.log('[GitSyncDialog] handleConfirm 被调用', { selectedList, mode, commitMessage })
    onConfirm(selectedList, mode === 'push' ? commitMessage : undefined)
  }

  const allSelected = changes.length > 0 && selected.size === changes.length
  const someSelected = selected.size > 0 && selected.size < changes.length

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {mode === 'pull' ? <CloudDownloadOutlined /> : <CloudUploadOutlined />}
          <span>{mode === 'pull' ? '拉取预览' : '推送预览'}</span>
          {hasConflicts && (
            <Tag color="warning" style={{ marginLeft: 8 }}>
              存在冲突
            </Tag>
          )}
        </div>
      }
      open={open}
      onCancel={onClose}
      width={800}
      zIndex={1100}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: isDark ? '#888' : '#666' }}>
            已选择 {selected.size} / {changes.length} 个函数
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={onClose}>取消</Button>
            <Button
              type="primary"
              onClick={handleConfirm}
              disabled={selected.size === 0}
              loading={confirming}
              style={{
                background: selected.size > 0 ? '#00a9a6' : undefined,
                borderColor: selected.size > 0 ? '#00a9a6' : undefined,
              }}
            >
              {mode === 'pull' ? '拉取选中' : '推送选中'}
            </Button>
          </div>
        </div>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin />
          <div style={{ marginTop: 16, color: isDark ? '#888' : '#666' }}>
            正在获取变更...
          </div>
        </div>
      ) : changes.length === 0 ? (
        <Empty
          description={mode === 'pull' ? '远程没有需要拉取的变更' : '没有需要推送的变更'}
          style={{ padding: 60 }}
        />
      ) : (
        <div>
          {/* 推送模式下的提交信息 */}
          {mode === 'push' && (
            <div style={{ marginBottom: 16 }}>
              <Input
                placeholder="提交信息 (可选)"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                style={{ borderRadius: 6 }}
              />
            </div>
          )}

          {/* 全选 */}
          <div
            style={{
              padding: '8px 12px',
              background: isDark ? '#1a1a1a' : '#fafafa',
              borderRadius: '8px 8px 0 0',
              border: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
              borderBottom: 'none',
            }}
          >
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={(e) => handleSelectAll(e.target.checked)}
            >
              <span style={{ fontSize: 13, fontWeight: 500 }}>全选</span>
            </Checkbox>
          </div>

          {/* 变更列表 */}
          <div
            style={{
              border: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
              borderRadius: '0 0 8px 8px',
              maxHeight: 400,
              overflow: 'auto',
            }}
          >
            {changes.map((change) => (
              <div key={change.path}>
                <div
                  style={{
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderBottom: `1px solid ${isDark ? '#252525' : '#f0f0f0'}`,
                    background: isDark ? '#141414' : '#fff',
                  }}
                >
                  <Checkbox
                    checked={selected.has(change.path)}
                    onChange={(e) => handleSelect(change.path, e.target.checked)}
                  />
                  {getStatusIcon(change.status)}
                  <span
                    style={{
                      flex: 1,
                      fontFamily: 'monospace',
                      fontSize: 13,
                      color: isDark ? '#e0e0e0' : '#333',
                    }}
                  >
                    {change.path}
                  </span>
                  {getStatusTag(change.status)}
                  {(change.status === 'modified' || change.status === 'conflict') && (
                    <Button
                      type="text"
                      size="small"
                      onClick={() => toggleDiff(change.path)}
                      style={{ fontSize: 12, color: '#00a9a6' }}
                    >
                      {expandedDiff === change.path ? '收起' : '查看差异'}
                    </Button>
                  )}
                </div>

                {/* Diff 展开区域 */}
                {expandedDiff === change.path && (change.localCode || change.remoteCode) && (
                  <div
                    style={{
                      padding: 12,
                      background: isDark ? '#0d0d0d' : '#f9f9f9',
                      borderBottom: `1px solid ${isDark ? '#252525' : '#f0f0f0'}`,
                    }}
                  >
                    <DiffViewer
                      oldCode={mode === 'pull' ? (change.localCode || '') : (change.remoteCode || '')}
                      newCode={mode === 'pull' ? (change.remoteCode || '') : (change.localCode || '')}
                      oldTitle={mode === 'pull' ? '本地' : '远程'}
                      newTitle={mode === 'pull' ? '远程' : '本地'}
                      height={250}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 冲突提示 */}
          {hasConflicts && (
            <div
              style={{
                marginTop: 12,
                padding: '8px 12px',
                background: isDark ? '#2a2000' : '#fffbe6',
                border: `1px solid ${isDark ? '#594300' : '#ffe58f'}`,
                borderRadius: 6,
                fontSize: 12,
                color: isDark ? '#faad14' : '#ad6800',
              }}
            >
              <WarningOutlined style={{ marginRight: 8 }} />
              存在冲突的函数，拉取后将覆盖本地修改。请仔细检查后再确认。
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
