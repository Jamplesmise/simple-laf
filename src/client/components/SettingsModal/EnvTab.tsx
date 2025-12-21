import { useState, useEffect } from 'react'
import { Input, message, Switch, Popconfirm, Spin } from 'antd'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { envApi, type EnvVariable } from '../../api/env'
import { useThemeStore } from '../../stores/theme'
import { envsToCode, codeToEnvs, maskValue } from './utils'
import EnvTabEmpty from './EnvTabEmpty'
import EnvTabFooter from './EnvTabFooter'

const { TextArea } = Input

export default function EnvTab() {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  const [envs, setEnvs] = useState<EnvVariable[]>([])
  const [originalEnvs, setOriginalEnvs] = useState<EnvVariable[]>([])
  const [envLoading, setEnvLoading] = useState(true)
  const [envSaving, setEnvSaving] = useState(false)
  const [codeMode, setCodeMode] = useState(false)
  const [codeText, setCodeText] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [visibleValues, setVisibleValues] = useState<Set<number>>(new Set())

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

  const hasEnvChanges = () => {
    if (codeMode) {
      return codeText !== envsToCode(originalEnvs)
    }
    return JSON.stringify(envs) !== JSON.stringify(originalEnvs)
  }

  useEffect(() => {
    loadEnvs()
    setEditingIndex(null)
    setVisibleValues(new Set())
  }, [])

  return (
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
                <EnvTabEmpty onAdd={handleEnvAdd} />
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

      {/* Footer */}
      <EnvTabFooter
        hasChanges={hasEnvChanges()}
        isSaving={envSaving}
        onReset={handleEnvReset}
        onSave={handleEnvUpdate}
      />
    </div>
  )
}
