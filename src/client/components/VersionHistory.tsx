import { useState, useEffect } from 'react'
import { Drawer, List, Button, Tag, Modal, message, Spin, Select, Space } from 'antd'
import {
  HistoryOutlined,
  EyeOutlined,
  RollbackOutlined
} from '@ant-design/icons'
import DiffViewer from './DiffViewer'
import { functionApi, type FunctionVersion } from '../api/functions'

interface VersionHistoryProps {
  functionId: string
  publishedVersion?: number
  onRollback: () => void
}

export default function VersionHistory({
  functionId,
  publishedVersion,
  onRollback
}: VersionHistoryProps) {
  const [open, setOpen] = useState(false)
  const [versions, setVersions] = useState<FunctionVersion[]>([])
  const [loading, setLoading] = useState(false)

  // 查看版本
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [viewingVersion, setViewingVersion] = useState<FunctionVersion | null>(null)
  const [loadingVersion, setLoadingVersion] = useState(false)

  // 对比版本
  const [diffModalOpen, setDiffModalOpen] = useState(false)
  const [diffFrom, setDiffFrom] = useState<number | null>(null)
  const [diffTo, setDiffTo] = useState<number | null>(null)
  const [diffData, setDiffData] = useState<{
    from: { code: string; version: number }
    to: { code: string; version: number }
  } | null>(null)
  const [loadingDiff, setLoadingDiff] = useState(false)

  const loadVersions = async () => {
    setLoading(true)
    try {
      const res = await functionApi.getVersions(functionId)
      setVersions(res.data.data)
    } catch {
      message.error('加载版本失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadVersions()
    }
  }, [open, functionId])

  // 查看版本
  const handleView = async (version: number) => {
    setLoadingVersion(true)
    try {
      const res = await functionApi.getVersion(functionId, version)
      setViewingVersion(res.data.data)
      setViewModalOpen(true)
    } catch {
      message.error('加载版本失败')
    } finally {
      setLoadingVersion(false)
    }
  }

  // 对比版本
  const handleCompare = async () => {
    if (!diffFrom || !diffTo) {
      message.warning('请选择要对比的版本')
      return
    }
    setLoadingDiff(true)
    try {
      const res = await functionApi.getVersionDiff(functionId, diffFrom, diffTo)
      setDiffData(res.data.data)
    } catch {
      message.error('加载对比失败')
    } finally {
      setLoadingDiff(false)
    }
  }

  // 回滚
  const handleRollback = (version: number) => {
    Modal.confirm({
      title: '确认回滚',
      content: `确定要回滚到 v${version} 吗？这将创建一个新版本。`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await functionApi.rollback(functionId, version)
          message.success(`已回滚到 v${version}`)
          loadVersions()
          onRollback()
        } catch {
          message.error('回滚失败')
        }
      }
    })
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <>
      <Button
        icon={<HistoryOutlined />}
        onClick={() => setOpen(true)}
      >
        版本历史
      </Button>

      <Drawer
        title="版本历史"
        open={open}
        onClose={() => setOpen(false)}
        width={400}
        extra={
          <Button type="link" onClick={() => setDiffModalOpen(true)}>
            版本对比
          </Button>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : versions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
            暂无版本记录
          </div>
        ) : (
          <List
            dataSource={versions}
            renderItem={v => (
              <List.Item
                actions={[
                  <Button
                    key="view"
                    type="text"
                    size="small"
                    icon={<EyeOutlined />}
                    loading={loadingVersion}
                    onClick={() => handleView(v.version)}
                  />,
                  <Button
                    key="rollback"
                    type="text"
                    size="small"
                    icon={<RollbackOutlined />}
                    onClick={() => handleRollback(v.version)}
                    disabled={v.version === publishedVersion}
                  />
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span>v{v.version}</span>
                      {v.version === publishedVersion && (
                        <Tag color="green">当前</Tag>
                      )}
                    </Space>
                  }
                  description={
                    <>
                      <div style={{ color: '#666', fontSize: 12 }}>
                        {formatDate(v.createdAt)}
                      </div>
                      <div style={{
                        color: '#999',
                        fontSize: 12,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 200
                      }}>
                        {v.changelog}
                      </div>
                    </>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>

      {/* 查看版本 */}
      <Modal
        title={`查看 v${viewingVersion?.version}`}
        open={viewModalOpen}
        onCancel={() => setViewModalOpen(false)}
        width={800}
        footer={null}
      >
        {viewingVersion && (
          <div>
            <div style={{ marginBottom: 12, color: '#888' }}>
              {viewingVersion.changelog}
            </div>
            <pre style={{
              backgroundColor: '#1e1e1e',
              padding: 16,
              borderRadius: 4,
              overflow: 'auto',
              maxHeight: 400,
              fontSize: 13,
              color: '#d4d4d4'
            }}>
              {viewingVersion.code}
            </pre>
          </div>
        )}
      </Modal>

      {/* 版本对比 */}
      <Modal
        title="版本对比"
        open={diffModalOpen}
        onCancel={() => {
          setDiffModalOpen(false)
          setDiffData(null)
          setDiffFrom(null)
          setDiffTo(null)
        }}
        width={1000}
        footer={null}
      >
        <Space style={{ marginBottom: 16 }}>
          <Select
            placeholder="选择旧版本"
            style={{ width: 150 }}
            value={diffFrom}
            onChange={setDiffFrom}
            options={versions.map(v => ({
              value: v.version,
              label: `v${v.version}`
            }))}
          />
          <span style={{ color: '#888' }}>&rarr;</span>
          <Select
            placeholder="选择新版本"
            style={{ width: 150 }}
            value={diffTo}
            onChange={setDiffTo}
            options={versions.map(v => ({
              value: v.version,
              label: `v${v.version}`
            }))}
          />
          <Button type="primary" onClick={handleCompare} loading={loadingDiff}>
            对比
          </Button>
        </Space>
        {diffData && (
          <DiffViewer
            oldCode={diffData.from.code}
            newCode={diffData.to.code}
            oldTitle={`v${diffData.from.version}`}
            newTitle={`v${diffData.to.version}`}
            height={450}
          />
        )}
      </Modal>
    </>
  )
}
