/**
 * 站点文件版本历史弹窗
 */

import { useState, useEffect, useCallback } from 'react'
import { Modal, Table, Button, Input, Tooltip, Empty, message, Space, Tag } from 'antd'
import {
  HistoryOutlined,
  RollbackOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import { siteVersionApi, type SiteFileVersion } from '@/api/site'
import { useThemeStore } from '@/stores/theme'

interface SiteVersionHistoryProps {
  open: boolean
  onClose: () => void
  filePath: string
  onRollback: (version: SiteFileVersion) => void
  onPreview: (version: SiteFileVersion) => void
}

export default function SiteVersionHistory({
  open,
  onClose,
  filePath,
  onRollback,
  onPreview,
}: SiteVersionHistoryProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  const [versions, setVersions] = useState<SiteFileVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  // 加载版本列表
  const loadVersions = useCallback(async () => {
    if (!filePath) return

    setLoading(true)
    try {
      const res = await siteVersionApi.list(filePath)
      setVersions(res.data.data || [])
    } catch {
      message.error('加载版本历史失败')
    } finally {
      setLoading(false)
    }
  }, [filePath])

  useEffect(() => {
    if (open && filePath) {
      loadVersions()
    }
  }, [open, filePath, loadVersions])

  // 开始编辑版本名称
  const handleStartEdit = (version: SiteFileVersion) => {
    setEditingId(version._id)
    setEditingName(version.versionName)
  }

  // 保存版本名称
  const handleSaveName = async (versionId: string) => {
    if (!editingName.trim()) {
      message.warning('版本名称不能为空')
      return
    }

    try {
      await siteVersionApi.updateName(versionId, editingName.trim())
      message.success('版本名称已更新')
      setEditingId(null)
      loadVersions()
    } catch {
      message.error('更新版本名称失败')
    }
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  // 回滚版本
  const handleRollback = async (version: SiteFileVersion) => {
    Modal.confirm({
      title: '确认回滚',
      content: `确定要回滚到 ${version.versionName} 吗？当前内容将被覆盖。`,
      okText: '确认回滚',
      cancelText: '取消',
      onOk: async () => {
        try {
          await siteVersionApi.rollback(filePath, version.version)
          message.success(`已回滚到 ${version.versionName}`)
          onRollback(version)
          onClose()
        } catch {
          message.error('回滚失败')
        }
      },
    })
  }

  // 格式化文件大小
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const columns = [
    {
      title: '版本',
      dataIndex: 'versionName',
      key: 'versionName',
      width: 200,
      render: (name: string, record: SiteFileVersion) => {
        if (editingId === record._id) {
          return (
            <Space size={4}>
              <Input
                size="small"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onPressEnter={() => handleSaveName(record._id)}
                style={{ width: 120 }}
                autoFocus
              />
              <Button
                type="text"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleSaveName(record._id)}
                style={{ color: '#52c41a' }}
              />
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={handleCancelEdit}
                style={{ color: '#ff4d4f' }}
              />
            </Space>
          )
        }

        return (
          <Space size={4}>
            <span>{name}</span>
            {record.version === versions[0]?.version && (
              <Tag color="green" style={{ marginLeft: 4, fontSize: 10 }}>
                最新
              </Tag>
            )}
            <Tooltip title="编辑版本名称">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleStartEdit(record)}
                style={{ opacity: 0.6 }}
              />
            </Tooltip>
          </Space>
        )
      },
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 80,
      render: (size: number) => formatSize(size),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => formatTime(date),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: SiteFileVersion) => (
        <Space size={4}>
          <Tooltip title="预览此版本">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onPreview(record)}
            />
          </Tooltip>
          <Tooltip title="回滚到此版本">
            <Button
              type="text"
              size="small"
              icon={<RollbackOutlined />}
              onClick={() => handleRollback(record)}
              disabled={record.version === versions[0]?.version}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <Modal
      title={
        <Space>
          <HistoryOutlined />
          版本历史
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      styles={{
        body: { padding: '12px 0' },
      }}
    >
      <div style={{ marginBottom: 8, padding: '0 24px', color: isDark ? '#999' : '#666', fontSize: 12 }}>
        文件: {filePath}
      </div>

      {versions.length === 0 && !loading ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无版本记录"
          style={{ padding: '40px 0' }}
        />
      ) : (
        <Table
          dataSource={versions}
          columns={columns}
          rowKey="_id"
          loading={loading}
          size="small"
          pagination={
            versions.length > 10
              ? { pageSize: 10, showSizeChanger: false }
              : false
          }
          style={{ padding: '0 12px' }}
        />
      )}
    </Modal>
  )
}
