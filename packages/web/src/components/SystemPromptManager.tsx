import { useState, useEffect, useCallback } from 'react'
import { Modal, Input, message, Spin, Tag, Tooltip, Popconfirm, Timeline } from 'antd'
import {
  Plus, Pencil, Trash2, Star, History, RotateCcw, MessageSquare
} from 'lucide-react'
import { useThemeStore } from '../stores/theme'
import {
  aiSystemPromptApi,
  type AISystemPrompt,
  type AIPromptVersion
} from '../api/aiSystemPrompt'

const { TextArea } = Input

interface SystemPromptManagerProps {
  onSelect?: (prompt: AISystemPrompt | null) => void
  selectedId?: string
  selectable?: boolean
}

export default function SystemPromptManager({
  onSelect,
  selectedId,
  selectable = false
}: SystemPromptManagerProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  // 提示词列表
  const [prompts, setPrompts] = useState<AISystemPrompt[]>([])
  const [loading, setLoading] = useState(true)

  // 编辑弹窗
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<AISystemPrompt | null>(null)
  const [formName, setFormName] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formChangeNote, setFormChangeNote] = useState('')
  const [saving, setSaving] = useState(false)

  // 版本历史弹窗
  const [versionModalOpen, setVersionModalOpen] = useState(false)
  const [versionPrompt, setVersionPrompt] = useState<AISystemPrompt | null>(null)
  const [versions, setVersions] = useState<AIPromptVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)

  // 加载提示词列表
  const loadPrompts = useCallback(async () => {
    try {
      const res = await aiSystemPromptApi.list()
      setPrompts(res.data.data)
    } catch {
      message.error('加载提示词失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPrompts()
  }, [loadPrompts])

  // 打开创建/编辑弹窗
  const openEditModal = (prompt?: AISystemPrompt) => {
    if (prompt) {
      setEditingPrompt(prompt)
      setFormName(prompt.name)
      setFormContent(prompt.content)
    } else {
      setEditingPrompt(null)
      setFormName('')
      setFormContent('')
    }
    setFormChangeNote('')
    setEditModalOpen(true)
  }

  // 保存提示词
  const handleSave = async () => {
    if (!formName.trim()) {
      message.error('请输入提示词名称')
      return
    }
    if (!formContent.trim()) {
      message.error('请输入提示词内容')
      return
    }

    setSaving(true)
    try {
      if (editingPrompt) {
        // 更新
        await aiSystemPromptApi.update(editingPrompt._id, {
          name: formName.trim(),
          content: formContent.trim(),
          changeNote: formChangeNote.trim() || undefined
        })
        message.success('更新成功')
      } else {
        // 创建
        await aiSystemPromptApi.create({
          name: formName.trim(),
          content: formContent.trim()
        })
        message.success('创建成功')
      }
      setEditModalOpen(false)
      loadPrompts()
    } catch {
      message.error(editingPrompt ? '更新失败' : '创建失败')
    } finally {
      setSaving(false)
    }
  }

  // 删除提示词
  const handleDelete = async (prompt: AISystemPrompt) => {
    try {
      await aiSystemPromptApi.delete(prompt._id)
      message.success('已删除')
      loadPrompts()
    } catch {
      message.error('删除失败')
    }
  }

  // 设为默认
  const handleSetDefault = async (prompt: AISystemPrompt) => {
    try {
      await aiSystemPromptApi.update(prompt._id, { isDefault: true })
      message.success('已设为默认')
      loadPrompts()
    } catch {
      message.error('设置失败')
    }
  }

  // 查看版本历史
  const openVersionHistory = async (prompt: AISystemPrompt) => {
    setVersionPrompt(prompt)
    setVersionModalOpen(true)
    setLoadingVersions(true)
    try {
      const res = await aiSystemPromptApi.getVersions(prompt._id)
      setVersions(res.data.data)
    } catch {
      message.error('获取版本历史失败')
    } finally {
      setLoadingVersions(false)
    }
  }

  // 回滚到指定版本
  const handleRollback = async (version: number) => {
    if (!versionPrompt) return
    try {
      await aiSystemPromptApi.rollback(versionPrompt._id, version)
      message.success(`已回滚到版本 ${version}`)
      setVersionModalOpen(false)
      loadPrompts()
    } catch {
      message.error('回滚失败')
    }
  }

  // 选择提示词
  const handleSelect = (prompt: AISystemPrompt) => {
    if (selectable && onSelect) {
      onSelect(prompt)
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 16,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: isDark ? '#e5e7eb' : '#374151' }}>
          系统提示词
        </span>
        <button
          onClick={() => openEditModal()}
          style={{
            padding: '6px 12px',
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
          新建
        </button>
      </div>

      {/* 列表 */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {loading ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spin />
          </div>
        ) : prompts.length === 0 ? (
          <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 48,
          }}>
            {/* 大尺寸图标 */}
            <div style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              background: isDark ? '#1f2937' : '#ecfdf5',
            }}>
              <MessageSquare size={36} color={isDark ? '#4b5563' : '#10b981'} />
            </div>
            {/* 主标题 */}
            <div style={{
              fontSize: 17,
              fontWeight: 500,
              marginBottom: 8,
              color: isDark ? '#e5e7eb' : '#374151',
            }}>
              暂无系统提示词
            </div>
            {/* 副标题 */}
            <div style={{
              fontSize: 13,
              textAlign: 'center',
              maxWidth: 280,
              marginBottom: 20,
              color: isDark ? '#6b7280' : '#9ca3af',
            }}>
              系统提示词可以定义 AI 的行为方式和角色设定，帮助获得更精准的回答
            </div>
            {/* CTA 按钮 */}
            <button
              onClick={() => openEditModal()}
              style={{
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 500,
                color: '#fff',
                background: '#10b981',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Plus size={18} />
              创建提示词
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {prompts.map((prompt) => (
              <div
                key={prompt._id}
                onClick={() => handleSelect(prompt)}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  cursor: selectable ? 'pointer' : 'default',
                  border: selectedId === prompt._id
                    ? '2px solid #10b981'
                    : `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                  background: isDark ? '#1f2937' : '#f9fafb',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  {/* 左侧内容 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: isDark ? '#e5e7eb' : '#1f2937',
                      }}>
                        {prompt.name}
                      </span>
                      {prompt.isDefault && (
                        <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>默认</Tag>
                      )}
                      <span style={{
                        fontSize: 11,
                        fontFamily: 'monospace',
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: isDark ? '#374151' : '#e5e7eb',
                        color: isDark ? '#9ca3af' : '#6b7280',
                      }}>
                        v{prompt.currentVersion}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 12,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: isDark ? '#6b7280' : '#9ca3af',
                    }}>
                      {prompt.content.substring(0, 100)}...
                    </div>
                  </div>

                  {/* 右侧操作 */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 12, flexShrink: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!prompt.isDefault ? (
                      <Tooltip title="设为默认">
                        <button
                          onClick={() => handleSetDefault(prompt)}
                          style={{
                            padding: 6,
                            borderRadius: 4,
                            border: 'none',
                            cursor: 'pointer',
                            background: 'transparent',
                            color: isDark ? '#6b7280' : '#9ca3af',
                          }}
                        >
                          <Star size={14} />
                        </button>
                      </Tooltip>
                    ) : (
                      <Tooltip title="当前默认">
                        <button style={{
                          padding: 6,
                          borderRadius: 4,
                          border: 'none',
                          background: 'transparent',
                          color: '#f59e0b',
                          cursor: 'default',
                        }}>
                          <Star size={14} fill="currentColor" />
                        </button>
                      </Tooltip>
                    )}
                    <Tooltip title="版本历史">
                      <button
                        onClick={() => openVersionHistory(prompt)}
                        style={{
                          padding: 6,
                          borderRadius: 4,
                          border: 'none',
                          cursor: 'pointer',
                          background: 'transparent',
                          color: isDark ? '#6b7280' : '#9ca3af',
                        }}
                      >
                        <History size={14} />
                      </button>
                    </Tooltip>
                    <Tooltip title="编辑">
                      <button
                        onClick={() => openEditModal(prompt)}
                        style={{
                          padding: 6,
                          borderRadius: 4,
                          border: 'none',
                          cursor: 'pointer',
                          background: 'transparent',
                          color: isDark ? '#6b7280' : '#9ca3af',
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                    </Tooltip>
                    <Popconfirm
                      title="确定删除？"
                      onConfirm={() => handleDelete(prompt)}
                      okText="删除"
                      cancelText="取消"
                      zIndex={1100}
                    >
                      <Tooltip title="删除">
                        <button style={{
                          padding: 6,
                          borderRadius: 4,
                          border: 'none',
                          cursor: 'pointer',
                          background: 'transparent',
                          color: isDark ? '#6b7280' : '#9ca3af',
                        }}>
                          <Trash2 size={14} />
                        </button>
                      </Tooltip>
                    </Popconfirm>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 编辑弹窗 */}
      <Modal
        title={editingPrompt ? '编辑提示词' : '新建提示词'}
        open={editModalOpen}
        onOk={handleSave}
        onCancel={() => setEditModalOpen(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        width={600}
        zIndex={1100}
        okButtonProps={{ style: { background: '#10b981' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: isDark ? '#d1d5db' : '#4b5563' }}>
              名称
            </label>
            <Input
              placeholder="提示词名称"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: isDark ? '#d1d5db' : '#4b5563' }}>
              内容
            </label>
            <TextArea
              placeholder="系统提示词内容"
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              rows={10}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </div>
          {editingPrompt && (
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: isDark ? '#d1d5db' : '#4b5563' }}>
                变更说明（可选）
              </label>
              <Input
                placeholder="本次修改说明"
                value={formChangeNote}
                onChange={(e) => setFormChangeNote(e.target.value)}
              />
            </div>
          )}
        </div>
      </Modal>

      {/* 版本历史弹窗 */}
      <Modal
        title={`版本历史 - ${versionPrompt?.name || ''}`}
        open={versionModalOpen}
        onCancel={() => setVersionModalOpen(false)}
        footer={null}
        width={600}
        zIndex={1100}
      >
        {loadingVersions ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : versions.length === 0 ? (
          <div style={{ padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <History size={32} color="#9ca3af" style={{ marginBottom: 12 }} />
            <span style={{ color: '#6b7280' }}>暂无版本历史</span>
          </div>
        ) : (
          <Timeline
            style={{ marginTop: 16, maxHeight: 400, overflow: 'auto', paddingRight: 8 }}
            items={versions.map((v) => ({
              color: v.version === versionPrompt?.currentVersion ? 'green' : 'gray',
              children: (
                <div style={{
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 8,
                  background: isDark ? '#1f2937' : '#f9fafb',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Tag color={v.version === versionPrompt?.currentVersion ? 'green' : 'default'}>
                        v{v.version}
                      </Tag>
                      {v.version === versionPrompt?.currentVersion && (
                        <Tag color="blue">当前</Tag>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: isDark ? '#6b7280' : '#9ca3af' }}>
                      {new Date(v.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {v.changeNote && (
                    <div style={{ fontSize: 12, marginBottom: 8, color: isDark ? '#9ca3af' : '#6b7280' }}>
                      {v.changeNote}
                    </div>
                  )}
                  <div style={{
                    fontSize: 12,
                    padding: 8,
                    borderRadius: 4,
                    fontFamily: 'monospace',
                    overflow: 'auto',
                    maxHeight: 100,
                    background: isDark ? '#111827' : '#fff',
                    color: isDark ? '#9ca3af' : '#6b7280',
                    border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                  }}>
                    {v.content.substring(0, 200)}
                    {v.content.length > 200 && '...'}
                  </div>
                  {v.version !== versionPrompt?.currentVersion && (
                    <div style={{ marginTop: 8, textAlign: 'right' }}>
                      <Popconfirm
                        title={`确定回滚到版本 ${v.version}？`}
                        onConfirm={() => handleRollback(v.version)}
                        okText="确定"
                        cancelText="取消"
                        zIndex={1200}
                      >
                        <button style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          marginLeft: 'auto',
                          padding: '4px 8px',
                          fontSize: 12,
                          color: '#10b981',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                        }}>
                          <RotateCcw size={12} />
                          回滚到此版本
                        </button>
                      </Popconfirm>
                    </div>
                  )}
                </div>
              )
            }))}
          />
        )}
      </Modal>
    </div>
  )
}
