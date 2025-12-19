import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Input, message, Switch, Popconfirm, Spin } from 'antd'
import { Plus, Trash2, Pencil, X, Globe, FileText, Key, GitBranch, Bot, MessageSquare } from 'lucide-react'
import { envApi, type EnvVariable } from '../api/env'
import { useThemeStore } from '../stores/theme'
import AIProviderManager from './AIProviderManager'
import SystemPromptManager from './SystemPromptManager'
import CustomDomainManager from './CustomDomainManager'
import ApiTokenManager from './ApiTokenManager'
import GitPanel from './GitPanel'

const { TextArea } = Input

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  defaultTab?: 'env' | 'ai' | 'prompt' | 'domain' | 'token' | 'git'
}

type TabKey = 'env' | 'ai' | 'prompt' | 'domain' | 'token' | 'git'

const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'env', label: '环境变量', icon: <FileText size={16} /> },
  { key: 'ai', label: 'AI 模型', icon: <Bot size={16} /> },
  { key: 'prompt', label: '系统提示词', icon: <MessageSquare size={16} /> },
  { key: 'domain', label: '自定义域名', icon: <Globe size={16} /> },
  { key: 'token', label: 'API Token', icon: <Key size={16} /> },
  { key: 'git', label: 'Git 同步', icon: <GitBranch size={16} /> },
]

export default function SettingsModal({ open, onClose, defaultTab = 'env' }: SettingsModalProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab)

  // ============ 环境变量 State ============
  const [envs, setEnvs] = useState<EnvVariable[]>([])
  const [originalEnvs, setOriginalEnvs] = useState<EnvVariable[]>([])
  const [envLoading, setEnvLoading] = useState(true)
  const [envSaving, setEnvSaving] = useState(false)
  const [codeMode, setCodeMode] = useState(false)
  const [codeText, setCodeText] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [visibleValues, setVisibleValues] = useState<Set<number>>(new Set())

  // ============ 环境变量方法 ============
  const loadEnvs = async () => {
    setEnvLoading(true)
    try {
      const res = await envApi.list()
      const data = res.data.data || []
      setEnvs(data)
      setOriginalEnvs(JSON.parse(JSON.stringify(data)))
      setCodeText(envsToCode(data))
    } catch {
      message.error('加载环境变量失败')
    } finally {
      setEnvLoading(false)
    }
  }

  const envsToCode = (vars: EnvVariable[]): string => {
    return vars.map(v => {
      const needsQuote = /[\s"'=]/.test(v.value) || v.value === ''
      const value = needsQuote ? `"${v.value.replace(/"/g, '\\"')}"` : v.value
      return `${v.key}=${value}`
    }).join('\n')
  }

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

  const handleModeChange = (checked: boolean) => {
    if (checked) {
      setCodeText(envsToCode(envs))
    } else {
      setEnvs(codeToEnvs(codeText))
    }
    setCodeMode(checked)
    setEditingIndex(null)
  }

  const handleEnvReset = () => {
    setEnvs(JSON.parse(JSON.stringify(originalEnvs)))
    setCodeText(envsToCode(originalEnvs))
    setEditingIndex(null)
  }

  const handleEnvUpdate = async () => {
    setEnvSaving(true)
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
        setEnvSaving(false)
        return
      }

      await envApi.bulkUpdate(variables)
      message.success('环境变量更新成功')
      await loadEnvs()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      message.error(err.response?.data?.error?.message || '更新失败')
    } finally {
      setEnvSaving(false)
    }
  }

  const handleEnvAdd = () => {
    setEnvs(prev => [...prev, { key: '', value: '' }])
    setEditingIndex(envs.length)
  }

  const handleEnvDelete = (index: number) => {
    setEnvs(prev => prev.filter((_, i) => i !== index))
    if (editingIndex === index) {
      setEditingIndex(null)
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1)
    }
  }

  const handleEnvChange = (index: number, field: 'key' | 'value', value: string) => {
    setEnvs(prev => {
      const newEnvs = [...prev]
      newEnvs[index] = { ...newEnvs[index], [field]: value }
      return newEnvs
    })
  }

  const toggleValueVisibility = (index: number) => {
    setVisibleValues(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const maskValue = (value: string) => {
    if (value.length <= 4) return '••••••'
    return value.slice(0, 2) + '••••••' + value.slice(-2)
  }

  // ============ 初始化加载 ============
  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab)
      loadEnvs()
      setEditingIndex(null)
      setVisibleValues(new Set())
    }
  }, [open, defaultTab])

  // ============ 检查是否有未保存的更改 ============
  const hasEnvChanges = () => {
    if (codeMode) {
      return codeText !== envsToCode(originalEnvs)
    }
    return JSON.stringify(envs) !== JSON.stringify(originalEnvs)
  }

  // ============ 渲染环境变量 Tab ============
  const renderEnvTab = () => (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 编辑器模式切换 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
        <Switch
          checked={codeMode}
          onChange={handleModeChange}
          style={{ background: codeMode ? '#10b981' : undefined }}
        />
        <span style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#6b7280' }}>编辑器模式</span>
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {envLoading ? (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
            background: isDark ? '#111827' : '#f9fafb',
          }}>
            <Spin />
          </div>
        ) : codeMode ? (
          <TextArea
            value={codeText}
            onChange={(e) => setCodeText(e.target.value)}
            placeholder="# KEY=value&#10;DATABASE_URL=mongodb://localhost:27017"
            style={{
              height: '100%',
              resize: 'none',
              fontFamily: 'monospace',
              fontSize: 13,
              background: isDark ? '#0f172a' : '#f8fafc',
              borderColor: isDark ? '#334155' : '#e2e8f0',
              borderRadius: 8,
              color: isDark ? '#e2e8f0' : '#334155',
            }}
          />
        ) : (
          <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 8,
            border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
            overflow: 'hidden',
          }}>
            {/* 表头 */}
            <div style={{
              display: 'flex',
              padding: '10px 16px',
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              flexShrink: 0,
              background: isDark ? '#1f2937' : '#f9fafb',
              color: isDark ? '#9ca3af' : '#6b7280',
              borderBottom: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
            }}>
              <div style={{ width: 160 }}>Key</div>
              <div style={{ flex: 1 }}>Value</div>
              <div style={{ width: 72, textAlign: 'right' }}>操作</div>
            </div>

            {/* 列表内容 */}
            <div style={{ flex: 1, overflow: 'auto', background: isDark ? '#111827' : '#fff' }}>
              {envs.length === 0 ? (
                <div style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 48,
                }}>
                  <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                    background: isDark ? '#1f2937' : '#f3f4f6',
                  }}>
                    <FileText size={28} color={isDark ? '#4b5563' : '#9ca3af'} />
                  </div>
                  <div style={{
                    fontSize: 15,
                    fontWeight: 500,
                    marginBottom: 8,
                    color: isDark ? '#d1d5db' : '#4b5563',
                  }}>
                    暂无环境变量
                  </div>
                  <div style={{
                    fontSize: 13,
                    marginBottom: 16,
                    color: isDark ? '#6b7280' : '#9ca3af',
                  }}>
                    环境变量可在云函数中通过 process.env 访问
                  </div>
                  <button
                    onClick={handleEnvAdd}
                    style={{
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#fff',
                      background: '#10b981',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Plus size={16} />
                    添加环境变量
                  </button>
                </div>
              ) : (
                envs.map((env, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px 16px',
                      borderBottom: index < envs.length - 1 ? `1px solid ${isDark ? '#1f2937' : '#f3f4f6'}` : 'none',
                    }}
                  >
                    {/* KEY */}
                    <div style={{ width: 160, paddingRight: 12 }}>
                      {editingIndex === index ? (
                        <Input
                          size="small"
                          value={env.key}
                          onChange={(e) => handleEnvChange(index, 'key', e.target.value.toUpperCase())}
                          autoFocus
                          style={{ fontFamily: 'monospace', fontSize: 12 }}
                        />
                      ) : (
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          fontSize: 12,
                          fontFamily: 'monospace',
                          fontWeight: 500,
                          color: '#047857',
                          background: '#ecfdf5',
                          borderRadius: 4,
                        }}>
                          {env.key || <span style={{ color: '#9ca3af', fontStyle: 'italic', fontFamily: 'inherit' }}>未设置</span>}
                        </span>
                      )}
                    </div>

                    {/* VALUE */}
                    <div style={{ flex: 1, paddingRight: 12 }}>
                      {editingIndex === index ? (
                        <Input
                          size="small"
                          value={env.value}
                          onChange={(e) => handleEnvChange(index, 'value', e.target.value)}
                          style={{ fontSize: 13 }}
                        />
                      ) : (
                        <span
                          onClick={() => toggleValueVisibility(index)}
                          style={{
                            fontSize: 13,
                            cursor: 'pointer',
                            color: isDark ? '#d1d5db' : '#374151',
                          }}
                          title="点击显示/隐藏"
                        >
                          {env.value ? (
                            visibleValues.has(index)
                              ? (env.value.length > 50 ? env.value.slice(0, 50) + '...' : env.value)
                              : maskValue(env.value)
                          ) : (
                            <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>空</span>
                          )}
                        </span>
                      )}
                    </div>

                    {/* 操作 */}
                    <div style={{ width: 72, display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                      <button
                        onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                        style={{
                          padding: 6,
                          borderRadius: 4,
                          border: 'none',
                          cursor: 'pointer',
                          background: editingIndex === index ? '#ecfdf5' : 'transparent',
                          color: editingIndex === index ? '#10b981' : (isDark ? '#9ca3af' : '#6b7280'),
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <Popconfirm
                        title="确定删除？"
                        onConfirm={() => handleEnvDelete(index)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <button style={{
                          padding: 6,
                          borderRadius: 4,
                          border: 'none',
                          cursor: 'pointer',
                          background: 'transparent',
                          color: isDark ? '#9ca3af' : '#6b7280',
                        }}>
                          <Trash2 size={14} />
                        </button>
                      </Popconfirm>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 新增按钮 */}
            {envs.length > 0 && (
              <button
                onClick={handleEnvAdd}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 16px',
                  fontSize: 13,
                  flexShrink: 0,
                  border: 'none',
                  borderTop: `2px dashed ${isDark ? '#374151' : '#e5e7eb'}`,
                  background: isDark ? 'rgba(31, 41, 55, 0.5)' : '#f9fafb',
                  color: isDark ? '#6b7280' : '#9ca3af',
                  cursor: 'pointer',
                }}
              >
                <Plus size={16} />
                新增环境变量
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )

  // ============ 渲染内容区 ============
  const renderContent = () => {
    switch (activeTab) {
      case 'env':
        return renderEnvTab()
      case 'ai':
        return <AIProviderManager />
      case 'prompt':
        return <SystemPromptManager />
      case 'domain':
        return <CustomDomainManager />
      case 'token':
        return <ApiTokenManager />
      case 'git':
        return <GitPanel />
      default:
        return null
    }
  }

  // ============ 渲染 Footer ============
  const renderFooter = () => {
    if (activeTab === 'env') {
      return (
        <div style={{
          height: 64,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12,
          borderTop: `1px solid ${isDark ? '#374151' : '#f3f4f6'}`,
          flexShrink: 0,
          background: isDark ? 'rgba(31, 41, 55, 0.5)' : 'rgba(249, 250, 251, 0.5)',
        }}>
          <button
            onClick={handleEnvReset}
            disabled={!hasEnvChanges()}
            style={{
              padding: '8px 20px',
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 6,
              border: 'none',
              cursor: hasEnvChanges() ? 'pointer' : 'not-allowed',
              background: hasEnvChanges() ? (isDark ? '#374151' : '#e5e7eb') : (isDark ? '#1f2937' : '#f3f4f6'),
              color: hasEnvChanges() ? (isDark ? '#d1d5db' : '#374151') : '#9ca3af',
            }}
          >
            重置
          </button>
          <button
            onClick={handleEnvUpdate}
            disabled={envSaving}
            style={{
              padding: '8px 20px',
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 6,
              border: 'none',
              cursor: envSaving ? 'not-allowed' : 'pointer',
              background: envSaving ? '#6ee7b7' : '#10b981',
              color: '#fff',
            }}
          >
            {envSaving ? '保存中...' : '保存更改'}
          </button>
        </div>
      )
    }
    return null
  }

  if (!open) return null

  const modalContent = (
    <>
      {/* 遮罩层 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.3)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
        }}
        onClick={onClose}
      />

      {/* 弹窗容器 */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '60vw',
          height: '65vh',
          maxWidth: 900,
          minWidth: 600,
          maxHeight: 700,
          minHeight: 500,
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 1001,
          background: isDark ? '#111827' : '#fff',
          boxShadow: isDark
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)'
            : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* 固定头部 */}
        <div style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          flexShrink: 0,
          borderBottom: `1px solid ${isDark ? '#374151' : '#f3f4f6'}`,
        }}>
          {/* Tab 导航 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '16px 0',
                  fontSize: 13,
                  fontWeight: activeTab === tab.key ? 500 : 400,
                  color: activeTab === tab.key
                    ? (isDark ? '#f3f4f6' : '#111827')
                    : (isDark ? '#6b7280' : '#6b7280'),
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {tab.icon}
                {tab.label}
                {/* 选中指示器 */}
                {activeTab === tab.key && (
                  <span style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: '#10b981',
                    borderRadius: 1,
                  }} />
                )}
              </button>
            ))}
          </div>

          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            style={{
              padding: 8,
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              color: isDark ? '#9ca3af' : '#6b7280',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 滚动内容区 */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {renderContent()}
        </div>

        {/* 底部操作栏 */}
        {renderFooter()}
      </div>
    </>
  )

  return createPortal(modalContent, document.body)
}
