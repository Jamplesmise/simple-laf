import { useState, useEffect } from 'react'
import { Button, Input, message, Popconfirm, Select, Modal, Typography, Table, Tag, Form, Space, Switch } from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  CopyOutlined,
  KeyOutlined,
  CheckOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { apiTokenApi, type ApiToken } from '../api/apiToken'
import { useThemeStore } from '../stores/theme'

const { Text } = Typography

export default function ApiTokenManager() {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [form] = Form.useForm()

  // Token 认证开关
  const [authEnabled, setAuthEnabled] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(true)

  // 显示新创建的 token
  const [newToken, setNewToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // 加载设置
  const loadSettings = async () => {
    setSettingsLoading(true)
    try {
      const res = await apiTokenApi.getSettings()
      setAuthEnabled(res.data.data.enabled)
    } catch {
      message.error('加载设置失败')
    } finally {
      setSettingsLoading(false)
    }
  }

  // 加载数据
  const loadData = async () => {
    setLoading(true)
    try {
      const res = await apiTokenApi.list()
      setTokens(res.data.data || [])
    } catch {
      message.error('加载 Token 列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 切换认证开关
  const handleToggleAuth = async (checked: boolean) => {
    try {
      await apiTokenApi.updateSettings(checked)
      setAuthEnabled(checked)
      message.success(checked ? 'Token 认证已启用' : 'Token 认证已关闭')
    } catch {
      message.error('更新设置失败')
    }
  }

  useEffect(() => {
    loadSettings()
    loadData()
  }, [])

  // 创建 Token
  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      setCreating(true)
      const res = await apiTokenApi.create(values.name.trim(), values.expireDays)
      setNewToken(res.data.data.token)
      setCreateModalOpen(false)
      form.resetFields()
      await loadData()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      if (err.response?.data?.error?.message) {
        message.error(err.response.data.error.message)
      }
    } finally {
      setCreating(false)
    }
  }

  // 删除 Token
  const handleDelete = async (id: string) => {
    try {
      await apiTokenApi.delete(id)
      message.success('Token 已删除')
      await loadData()
    } catch {
      message.error('删除失败')
    }
  }

  // 复制到剪贴板
  const handleCopy = async (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for non-HTTPS contexts
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-9999px'
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopied(true)
      message.success('已复制到剪贴板')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      message.error('复制失败')
    }
  }

  // 格式化日期
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN')
  }

  // 计算剩余天数
  const getRemainingDays = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  // 表格列定义
  const columns: ColumnsType<ApiToken> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: 'Token',
      dataIndex: 'tokenPrefix',
      key: 'tokenPrefix',
      width: 160,
      render: (prefix: string) => (
        <Text code style={{ fontSize: 12 }}>{prefix}</Text>
      ),
    },
    {
      title: '创建日期',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 110,
      render: (date: string) => formatDate(date),
    },
    {
      title: '失效日期',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      width: 140,
      render: (date: string) => {
        const days = getRemainingDays(date)
        if (days <= 0) {
          return <Tag color="error">已过期</Tag>
        }
        if (days <= 7) {
          return (
            <Space direction="vertical" size={0}>
              <span>{formatDate(date)}</span>
              <Tag color="warning" style={{ margin: 0 }}>{days} 天后过期</Tag>
            </Space>
          )
        }
        return formatDate(date)
      },
    },
    {
      title: '最后使用',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      width: 110,
      render: (date?: string) => date ? formatDate(date) : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <Popconfirm
          title="确定删除此 Token？"
          onConfirm={() => handleDelete(record._id)}
          okText="确定"
          cancelText="取消"
          zIndex={1100}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      {/* 认证开关 */}
      <div style={{
        marginBottom: 16,
        padding: 16,
        background: isDark ? '#1a1a1a' : '#f5f5f5',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
            启用 Token 认证
          </div>
          <div style={{ fontSize: 12, color: isDark ? '#888' : '#666' }}>
            启用后，API 请求需携带有效的 Token 才能访问
          </div>
        </div>
        <Switch
          checked={authEnabled}
          onChange={handleToggleAuth}
          loading={settingsLoading}
        />
      </div>

      {/* 说明 */}
      <div style={{
        marginBottom: 16,
        padding: 12,
        background: isDark ? '#1a1a1a' : '#f5f5f5',
        borderRadius: 8,
        fontSize: 13,
        color: isDark ? '#888' : '#666',
      }}>
        API Token 可用于程序化访问平台 API。创建后请妥善保管，Token 只会显示一次。
        <br />
        使用方式：请求头添加 <Text code>Authorization: sk-xxx...</Text>
      </div>

      {/* Token 列表 */}
      <Table
        columns={columns}
        dataSource={tokens}
        rowKey="_id"
        loading={loading}
        size="small"
        pagination={false}
        scroll={{ y: 300 }}
        locale={{ emptyText: '暂无 API Token' }}
        footer={() => (
          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            创建 API Token
          </Button>
        )}
      />

      {/* 创建弹窗 */}
      <Modal
        title="创建 API Token"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false)
          form.resetFields()
        }}
        onOk={handleCreate}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
        zIndex={1100}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ expireDays: 30 }}
        >
          <Form.Item
            name="name"
            label="Token 名称"
            rules={[{ required: true, message: '请输入 Token 名称' }]}
          >
            <Input placeholder="如 production-api" autoFocus />
          </Form.Item>
          <Form.Item
            name="expireDays"
            label="有效期"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 7, label: '7 天' },
                { value: 30, label: '30 天' },
                { value: 90, label: '90 天' },
                { value: 180, label: '180 天' },
                { value: 365, label: '365 天' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 新 Token 显示弹窗 */}
      <Modal
        title={
          <span>
            <KeyOutlined style={{ marginRight: 8, color: '#52c41a' }} />
            Token 创建成功
          </span>
        }
        open={!!newToken}
        onCancel={() => setNewToken(null)}
        footer={
          <Button type="primary" onClick={() => setNewToken(null)}>
            我已保存
          </Button>
        }
        width={560}
        zIndex={1100}
      >
        <div style={{
          padding: 16,
          background: isDark ? '#1a1a1a' : '#f5f5f5',
          borderRadius: 8,
          marginBottom: 16,
        }}>
          <div style={{ marginBottom: 8, color: isDark ? '#888' : '#666', fontSize: 12 }}>
            请立即复制并妥善保存此 Token，关闭后将无法再次查看：
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text
              code
              style={{
                flex: 1,
                fontSize: 13,
                wordBreak: 'break-all',
                background: isDark ? '#252525' : '#fff',
                padding: '8px 12px',
                borderRadius: 4,
                border: `1px solid ${isDark ? '#303030' : '#d9d9d9'}`,
              }}
            >
              {newToken}
            </Text>
            <Button
              icon={copied ? <CheckOutlined /> : <CopyOutlined />}
              onClick={() => newToken && handleCopy(newToken)}
              type={copied ? 'primary' : 'default'}
              style={copied ? { background: '#52c41a', borderColor: '#52c41a' } : {}}
            >
              {copied ? '已复制' : '复制'}
            </Button>
          </div>
        </div>
        <div style={{ color: '#ff4d4f', fontSize: 12 }}>
          此 Token 只会显示一次，请确保已妥善保存后再关闭此窗口。
        </div>
      </Modal>
    </div>
  )
}
