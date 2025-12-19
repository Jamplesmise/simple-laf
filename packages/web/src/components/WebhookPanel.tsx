import { useState, useEffect } from 'react'
import { Modal, Button, Table, Switch, Space, Tag, message, Tooltip, Select, Popconfirm, Input, Empty } from 'antd'
import {
  ApiOutlined, CopyOutlined, ReloadOutlined, DeleteOutlined,
  KeyOutlined, LinkOutlined, CheckOutlined,
} from '@ant-design/icons'
import { useThemeStore } from '../stores/theme'
import { useFunctionStore } from '../stores/function'
import { webhookApi, getWebhookUrl, type Webhook } from '../api/webhook'

interface WebhookPanelProps {
  open: boolean
  onClose: () => void
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

export default function WebhookPanel({ open, onClose }: WebhookPanelProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'
  const { functions, refreshList } = useFunctionStore()

  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedFunctionId, setSelectedFunctionId] = useState<string>('')
  const [selectedMethods, setSelectedMethods] = useState<string[]>(['POST'])
  const [generateSecret, setGenerateSecret] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // 代码字体
  const codeFont = '"JetBrains Mono", "SF Mono", Monaco, Menlo, Consolas, monospace'

  // 加载 webhooks
  const loadWebhooks = async () => {
    setLoading(true)
    try {
      const res = await webhookApi.list()
      setWebhooks(res.data.data || [])
    } catch {
      message.error('加载 Webhook 列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadWebhooks()
      // 如果函数列表为空，主动加载
      if (functions.length === 0) {
        refreshList()
      }
    }
  }, [open, functions.length, refreshList])

  // 创建 webhook
  const handleCreate = async () => {
    if (!selectedFunctionId) {
      message.warning('请选择函数')
      return
    }

    setCreating(true)
    try {
      await webhookApi.create(selectedFunctionId, {
        methods: selectedMethods,
        generateSecret,
      })
      message.success('创建成功')
      setCreateModalOpen(false)
      setSelectedFunctionId('')
      setSelectedMethods(['POST'])
      setGenerateSecret(false)
      await loadWebhooks()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } }
      message.error(error.response?.data?.error?.message || '创建失败')
    } finally {
      setCreating(false)
    }
  }

  // 切换启用状态
  const handleToggle = async (webhook: Webhook) => {
    try {
      await webhookApi.update(webhook._id, { enabled: !webhook.enabled })
      message.success(webhook.enabled ? '已禁用' : '已启用')
      await loadWebhooks()
    } catch {
      message.error('操作失败')
    }
  }

  // 删除
  const handleDelete = async (id: string) => {
    try {
      await webhookApi.remove(id)
      message.success('删除成功')
      await loadWebhooks()
    } catch {
      message.error('删除失败')
    }
  }

  // 重新生成 token
  const handleRegenerateToken = async (id: string) => {
    try {
      await webhookApi.update(id, { regenerateToken: true })
      message.success('Token 已重新生成')
      await loadWebhooks()
    } catch {
      message.error('操作失败')
    }
  }

  // 复制 URL
  const copyUrl = (webhook: Webhook) => {
    const url = getWebhookUrl(webhook.token)
    navigator.clipboard.writeText(url)
    setCopiedId(webhook._id)
    message.success('URL 已复制')
    setTimeout(() => setCopiedId(null), 2000)
  }

  // 格式化时间
  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // 已有 webhook 的函数 ID 列表
  const existingFunctionIds = webhooks.map(w => w.functionId)
  const availableFunctions = functions.filter(f => !existingFunctionIds.includes(f._id))

  const columns = [
    {
      title: '函数',
      dataIndex: 'functionName',
      key: 'functionName',
      render: (name: string) => (
        <span style={{ fontFamily: codeFont, fontSize: 12 }}>{name}</span>
      ),
    },
    {
      title: '方法',
      dataIndex: 'methods',
      key: 'methods',
      width: 120,
      render: (methods: string[]) => (
        <Space size={2}>
          {methods.map(m => (
            <Tag key={m} style={{ fontSize: 10, margin: 0 }}>{m}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '调用',
      dataIndex: 'callCount',
      key: 'callCount',
      width: 60,
      render: (count: number) => (
        <span style={{ fontFamily: codeFont, fontSize: 12 }}>{count}</span>
      ),
    },
    {
      title: '最后调用',
      dataIndex: 'lastCalledAt',
      key: 'lastCalledAt',
      width: 100,
      render: (time: string) => (
        <span style={{ fontSize: 11, color: isDark ? '#888' : '#999' }}>
          {formatTime(time)}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 60,
      render: (enabled: boolean, record: Webhook) => (
        <Switch size="small" checked={enabled} onChange={() => handleToggle(record)} />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: Webhook) => (
        <Space size={4}>
          <Tooltip title={copiedId === record._id ? '已复制' : '复制 URL'}>
            <Button
              type="text"
              size="small"
              icon={copiedId === record._id ? <CheckOutlined style={{ color: '#52c41a' }} /> : <CopyOutlined />}
              onClick={() => copyUrl(record)}
            />
          </Tooltip>
          <Tooltip title="重新生成 Token">
            <Popconfirm
              title="确定重新生成 Token？旧的 URL 将失效"
              onConfirm={() => handleRegenerateToken(record._id)}
            >
              <Button type="text" size="small" icon={<ReloadOutlined />} />
            </Popconfirm>
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确定删除此 Webhook？"
              onConfirm={() => handleDelete(record._id)}
            >
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Modal
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ApiOutlined style={{ color: '#fa8c16' }} />
            Webhook 管理
          </span>
        }
        open={open}
        onCancel={onClose}
        width={800}
        footer={null}
      >
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, color: isDark ? '#888' : '#999' }}>
            Webhook 允许外部服务通过 HTTP 请求触发函数执行
          </div>
          <Button
            type="primary"
            size="small"
            icon={<ApiOutlined />}
            onClick={() => setCreateModalOpen(true)}
            disabled={availableFunctions.length === 0}
          >
            创建 Webhook
          </Button>
        </div>

        {webhooks.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无 Webhook"
            style={{ padding: 40 }}
          />
        ) : (
          <Table
            dataSource={webhooks}
            columns={columns}
            rowKey="_id"
            size="small"
            loading={loading}
            pagination={false}
            expandable={{
              expandedRowRender: (record) => (
                <div style={{ padding: '8px 0' }}>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: isDark ? '#888' : '#999', marginRight: 8 }}>
                      <LinkOutlined /> URL:
                    </span>
                    <Input
                      size="small"
                      value={getWebhookUrl(record.token)}
                      readOnly
                      style={{
                        width: 'calc(100% - 60px)',
                        fontFamily: codeFont,
                        fontSize: 11,
                      }}
                      suffix={
                        <CopyOutlined
                          style={{ cursor: 'pointer', color: '#1890ff' }}
                          onClick={() => copyUrl(record)}
                        />
                      }
                    />
                  </div>
                  {record.secret && (
                    <div>
                      <span style={{ fontSize: 11, color: isDark ? '#888' : '#999', marginRight: 8 }}>
                        <KeyOutlined /> Secret:
                      </span>
                      <Input.Password
                        size="small"
                        value={record.secret}
                        readOnly
                        style={{
                          width: 'calc(100% - 60px)',
                          fontFamily: codeFont,
                          fontSize: 11,
                        }}
                      />
                    </div>
                  )}
                </div>
              ),
            }}
          />
        )}
      </Modal>

      {/* 创建 Webhook 弹窗 */}
      <Modal
        title="创建 Webhook"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateModalOpen(false)
          setSelectedFunctionId('')
          setSelectedMethods(['POST'])
          setGenerateSecret(false)
        }}
        confirmLoading={creating}
        width={480}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12 }}>选择函数</div>
            <Select
              style={{ width: '100%' }}
              placeholder="选择要绑定的函数"
              value={selectedFunctionId || undefined}
              onChange={setSelectedFunctionId}
              options={availableFunctions.map(f => ({
                value: f._id,
                label: f.name,
              }))}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12 }}>允许的请求方法</div>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              value={selectedMethods}
              onChange={setSelectedMethods}
              options={HTTP_METHODS.map(m => ({ value: m, label: m }))}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch
              size="small"
              checked={generateSecret}
              onChange={setGenerateSecret}
            />
            <span style={{ fontSize: 12 }}>生成签名密钥 (用于验证请求来源)</span>
          </div>
        </div>
      </Modal>
    </>
  )
}
