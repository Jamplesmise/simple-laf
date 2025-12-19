import { useState, useEffect } from 'react'
import { Modal, Button, Input, message, Switch, Popconfirm } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { envApi, type EnvVariable } from '../api/env'
import { useThemeStore } from '../stores/theme'

const { TextArea } = Input

interface EnvManagerProps {
  open: boolean
  onClose: () => void
}

export default function EnvManager({ open, onClose }: EnvManagerProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  const [envs, setEnvs] = useState<EnvVariable[]>([])
  const [originalEnvs, setOriginalEnvs] = useState<EnvVariable[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [codeMode, setCodeMode] = useState(false)
  const [codeText, setCodeText] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  // 统一内容区域高度
  const contentHeight = 400

  // 加载环境变量
  const loadEnvs = async () => {
    setLoading(true)
    try {
      const res = await envApi.list()
      const data = res.data.data || []
      setEnvs(data)
      setOriginalEnvs(JSON.parse(JSON.stringify(data)))
      setCodeText(envsToCode(data))
    } catch {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadEnvs()
      setEditingIndex(null)
    }
  }, [open])

  // 环境变量转代码格式
  const envsToCode = (vars: EnvVariable[]): string => {
    return vars.map(v => {
      const needsQuote = /[\s"'=]/.test(v.value) || v.value === ''
      const value = needsQuote ? `"${v.value.replace(/"/g, '\\"')}"` : v.value
      return `${v.key}=${value}`
    }).join('\n')
  }

  // 代码格式解析为环境变量
  const codeToEnvs = (code: string): EnvVariable[] => {
    const lines = code.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'))
    const result: EnvVariable[] = []

    for (const line of lines) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (match) {
        let value = match[2]
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1).replace(/\\"/g, '"')
        }
        result.push({ key: match[1], value })
      }
    }

    return result
  }

  // 切换模式
  const handleModeChange = (checked: boolean) => {
    if (checked) {
      setCodeText(envsToCode(envs))
    } else {
      const parsed = codeToEnvs(codeText)
      setEnvs(parsed)
    }
    setCodeMode(checked)
    setEditingIndex(null)
  }

  // 重置
  const handleReset = () => {
    setEnvs(JSON.parse(JSON.stringify(originalEnvs)))
    setCodeText(envsToCode(originalEnvs))
    setEditingIndex(null)
  }

  // 更新
  const handleUpdate = async () => {
    setSaving(true)
    try {
      let variables: Array<{ key: string; value: string }>

      if (codeMode) {
        variables = codeToEnvs(codeText)
      } else {
        variables = envs.filter(e => e.key.trim()).map(e => ({
          key: e.key.trim(),
          value: e.value
        }))
      }

      const keys = variables.map(v => v.key)
      const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index)
      if (duplicates.length > 0) {
        message.error(`存在重复的变量名: ${duplicates.join(', ')}`)
        setSaving(false)
        return
      }

      await envApi.bulkUpdate(variables)
      message.success('更新成功')
      await loadEnvs()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      message.error(err.response?.data?.error?.message || '更新失败')
    } finally {
      setSaving(false)
    }
  }

  // 添加变量
  const handleAdd = () => {
    setEnvs(prev => [...prev, { key: '', value: '' }])
    setEditingIndex(envs.length)
  }

  // 删除变量
  const handleDelete = (index: number) => {
    setEnvs(prev => prev.filter((_, i) => i !== index))
    if (editingIndex === index) {
      setEditingIndex(null)
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1)
    }
  }

  // 更新变量
  const handleEnvChange = (index: number, field: 'key' | 'value', value: string) => {
    setEnvs(prev => {
      const newEnvs = [...prev]
      newEnvs[index] = { ...newEnvs[index], [field]: value }
      return newEnvs
    })
  }

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      width="60%"
      centered
      footer={null}
      styles={{
        body: { padding: 0 },
        content: { borderRadius: 12 },
      }}
      closable={true}
      closeIcon={
        <span style={{ fontSize: 20, color: isDark ? '#888' : '#666' }}>×</span>
      }
    >
      <div style={{ padding: 24 }}>
        {/* 内容区域 */}
        <div style={{ marginBottom: 20 }}>
          {loading ? (
            <div style={{
              height: contentHeight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDark ? '#666' : '#999',
              border: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
              borderRadius: 8,
              background: isDark ? '#141414' : '#fafafa',
            }}>
              加载中...
            </div>
          ) : codeMode ? (
            /* 代码模式 */
            <TextArea
              value={codeText}
              onChange={(e) => setCodeText(e.target.value)}
              placeholder="# 每行一个环境变量，格式: KEY=value&#10;# 示例:&#10;DATABASE_URL=mongodb://localhost:27017&#10;API_KEY=&quot;your-api-key&quot;"
              style={{
                fontFamily: 'inherit',
                fontSize: 13,
                lineHeight: 1.6,
                height: contentHeight,
                resize: 'none',
                background: isDark ? '#141414' : '#fafafa',
                borderColor: isDark ? '#303030' : '#e8e8e8',
                borderRadius: 8,
                color: isDark ? '#e0e0e0' : '#333',
              }}
            />
          ) : (
            /* 表单模式 */
            <div style={{
              border: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
              borderRadius: 8,
              overflow: 'hidden',
              height: contentHeight,
              display: 'flex',
              flexDirection: 'column',
            }}>
              {/* 表头 */}
              <div style={{
                display: 'flex',
                background: isDark ? '#1a1a1a' : '#fafafa',
                borderBottom: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
                padding: '12px 16px',
                flexShrink: 0,
              }}>
                <div style={{ width: 200, fontSize: 12, fontWeight: 600, color: isDark ? '#888' : '#666', textTransform: 'uppercase' }}>
                  KEY
                </div>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: isDark ? '#888' : '#666', textTransform: 'uppercase' }}>
                  VALUE
                </div>
                <div style={{ width: 80, fontSize: 12, fontWeight: 600, color: isDark ? '#888' : '#666', textTransform: 'uppercase', textAlign: 'right' }}>
                  操作
                </div>
              </div>

              {/* 变量列表 */}
              <div style={{ flex: 1, overflow: 'auto', background: isDark ? '#141414' : '#fff' }}>
                {envs.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: isDark ? '#666' : '#999' }}>
                    暂无环境变量
                  </div>
                ) : (
                  envs.map((env, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px 16px',
                        borderBottom: index < envs.length - 1 ? `1px solid ${isDark ? '#303030' : '#f0f0f0'}` : 'none',
                      }}
                    >
                      <div style={{ width: 200, paddingRight: 12 }}>
                        {editingIndex === index ? (
                          <Input
                            size="small"
                            value={env.key}
                            onChange={(e) => handleEnvChange(index, 'key', e.target.value.toUpperCase())}
                            placeholder="变量名"
                            autoFocus
                            style={{ fontSize: 13, color: '#d48806' }}
                          />
                        ) : (
                          <span style={{ fontSize: 13, color: '#d48806', fontWeight: 500 }}>
                            {env.key || <span style={{ color: '#999', fontStyle: 'italic' }}>未设置</span>}
                          </span>
                        )}
                      </div>
                      <div style={{ flex: 1, paddingRight: 12 }}>
                        {editingIndex === index ? (
                          <Input
                            size="small"
                            value={env.value}
                            onChange={(e) => handleEnvChange(index, 'value', e.target.value)}
                            placeholder="值"
                            style={{ fontSize: 13 }}
                          />
                        ) : (
                          <span style={{ fontSize: 13, color: isDark ? '#e0e0e0' : '#333', wordBreak: 'break-all' }}>
                            {env.value ? (
                              env.value.length > 50 ? env.value.slice(0, 50) + '...' : env.value
                            ) : (
                              <span style={{ color: '#999', fontStyle: 'italic' }}>空</span>
                            )}
                          </span>
                        )}
                      </div>
                      <div style={{ width: 80, display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                          style={{ color: editingIndex === index ? '#00a9a6' : (isDark ? '#888' : '#666') }}
                        />
                        <Popconfirm
                          title="确定删除此变量？"
                          onConfirm={() => handleDelete(index)}
                          okText="确定"
                          cancelText="取消"
                        >
                          <Button
                            type="text"
                            size="small"
                            icon={<DeleteOutlined />}
                            style={{ color: isDark ? '#888' : '#666' }}
                          />
                        </Popconfirm>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 新增按钮 */}
              <div
                onClick={handleAdd}
                style={{
                  padding: '12px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  color: isDark ? '#666' : '#999',
                  borderTop: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
                  background: isDark ? '#1a1a1a' : '#fafafa',
                  transition: 'color 0.2s, background 0.2s',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#00a9a6'
                  e.currentTarget.style.background = isDark ? '#1f1f1f' : '#f5f5f5'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = isDark ? '#666' : '#999'
                  e.currentTarget.style.background = isDark ? '#1a1a1a' : '#fafafa'
                }}
              >
                <PlusOutlined style={{ marginRight: 6 }} />
                新增环境变量
              </div>
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Switch
              checked={codeMode}
              onChange={handleModeChange}
              style={{ background: codeMode ? '#00a9a6' : undefined }}
            />
            <span style={{ fontSize: 13, color: isDark ? '#888' : '#666' }}>
              使用编辑器模式
            </span>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <Button
              onClick={handleReset}
              style={{ borderRadius: 20, paddingLeft: 24, paddingRight: 24 }}
            >
              重置
            </Button>
            <Button
              type="primary"
              onClick={handleUpdate}
              loading={saving}
              style={{
                borderRadius: 20,
                paddingLeft: 24,
                paddingRight: 24,
                background: '#00a9a6',
                borderColor: '#00a9a6',
              }}
            >
              更新
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
