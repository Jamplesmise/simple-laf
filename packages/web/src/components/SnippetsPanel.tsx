import { useState, useEffect } from 'react'
import { Modal, Button, Input, Select, Tag, Space, message, Popconfirm, Empty, Tooltip, Spin } from 'antd'
import {
  CodeOutlined, PlusOutlined, DeleteOutlined, EditOutlined,
  CopyOutlined, CheckOutlined, SearchOutlined,
} from '@ant-design/icons'
import { useThemeStore } from '../stores/theme'
import { snippetsApi, type Snippet } from '../api/snippets'

interface SnippetsPanelProps {
  open: boolean
  onClose: () => void
  onInsert?: (code: string) => void
}

export default function SnippetsPanel({ open, onClose, onInsert }: SnippetsPanelProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // 创建/编辑弹窗
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null)
  const [snippetName, setSnippetName] = useState('')
  const [snippetDesc, setSnippetDesc] = useState('')
  const [snippetCode, setSnippetCode] = useState('')
  const [snippetTags, setSnippetTags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // 代码字体
  const codeFont = '"JetBrains Mono", "SF Mono", Monaco, Menlo, Consolas, monospace'

  // 加载数据
  const loadData = async () => {
    setLoading(true)
    try {
      const [snippetsRes, tagsRes] = await Promise.all([
        searchText
          ? snippetsApi.search(searchText)
          : snippetsApi.list(selectedTag || undefined),
        snippetsApi.getTags(),
      ])
      setSnippets(snippetsRes.data.data || [])
      setTags(tagsRes.data.data || [])
    } catch {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open, selectedTag])

  // 搜索
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      loadData()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchText])

  // 打开创建弹窗
  const openCreateModal = () => {
    setEditingSnippet(null)
    setSnippetName('')
    setSnippetDesc('')
    setSnippetCode('')
    setSnippetTags([])
    setEditModalOpen(true)
  }

  // 打开编辑弹窗
  const openEditModal = (snippet: Snippet) => {
    setEditingSnippet(snippet)
    setSnippetName(snippet.name)
    setSnippetDesc(snippet.description || '')
    setSnippetCode(snippet.code)
    setSnippetTags(snippet.tags)
    setEditModalOpen(true)
  }

  // 保存
  const handleSave = async () => {
    if (!snippetName.trim()) {
      message.warning('请输入名称')
      return
    }
    if (!snippetCode.trim()) {
      message.warning('请输入代码')
      return
    }

    setSaving(true)
    try {
      if (editingSnippet) {
        await snippetsApi.update(editingSnippet._id, {
          name: snippetName.trim(),
          description: snippetDesc.trim() || undefined,
          code: snippetCode,
          tags: snippetTags,
        })
        message.success('更新成功')
      } else {
        await snippetsApi.create({
          name: snippetName.trim(),
          description: snippetDesc.trim() || undefined,
          code: snippetCode,
          tags: snippetTags,
        })
        message.success('创建成功')
      }
      setEditModalOpen(false)
      await loadData()
    } catch {
      message.error(editingSnippet ? '更新失败' : '创建失败')
    } finally {
      setSaving(false)
    }
  }

  // 删除
  const handleDelete = async (id: string) => {
    try {
      await snippetsApi.remove(id)
      message.success('删除成功')
      await loadData()
    } catch {
      message.error('删除失败')
    }
  }

  // 复制代码
  const handleCopy = (snippet: Snippet) => {
    navigator.clipboard.writeText(snippet.code)
    setCopiedId(snippet._id)
    snippetsApi.incrementUseCount(snippet._id).catch(() => {})
    message.success('已复制到剪贴板')
    setTimeout(() => setCopiedId(null), 2000)
  }

  // 插入代码
  const handleInsert = (snippet: Snippet) => {
    if (onInsert) {
      onInsert(snippet.code)
      snippetsApi.incrementUseCount(snippet._id).catch(() => {})
      message.success('已插入到编辑器')
      onClose()
    }
  }

  return (
    <>
      <Modal
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CodeOutlined style={{ color: '#722ed1' }} />
            代码片段
          </span>
        }
        open={open}
        onCancel={onClose}
        width={800}
        footer={null}
      >
        {/* 工具栏 */}
        <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          <Input
            placeholder="搜索代码片段..."
            prefix={<SearchOutlined style={{ color: '#999' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ flex: 1 }}
          />
          <Select
            placeholder="筛选标签"
            value={selectedTag || undefined}
            onChange={setSelectedTag}
            allowClear
            style={{ width: 150 }}
            options={tags.map(t => ({ value: t, label: t }))}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
          >
            新建
          </Button>
        </div>

        {/* 片段列表 */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : snippets.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={searchText ? '未找到匹配的代码片段' : '暂无代码片段'}
            style={{ padding: 40 }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflow: 'auto' }}>
            {snippets.map((snippet) => (
              <div
                key={snippet._id}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: isDark ? '#1a1a1a' : '#fafafa',
                  border: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 500 }}>{snippet.name}</span>
                    {snippet.tags.map(tag => (
                      <Tag key={tag} style={{ fontSize: 10, margin: 0 }}>{tag}</Tag>
                    ))}
                  </div>
                  <Space size={4}>
                    <span style={{ fontSize: 11, color: isDark ? '#666' : '#999' }}>
                      使用 {snippet.useCount} 次
                    </span>
                    {onInsert && (
                      <Tooltip title="插入到编辑器">
                        <Button
                          type="text"
                          size="small"
                          icon={<CodeOutlined />}
                          onClick={() => handleInsert(snippet)}
                        />
                      </Tooltip>
                    )}
                    <Tooltip title={copiedId === snippet._id ? '已复制' : '复制代码'}>
                      <Button
                        type="text"
                        size="small"
                        icon={copiedId === snippet._id ? <CheckOutlined style={{ color: '#52c41a' }} /> : <CopyOutlined />}
                        onClick={() => handleCopy(snippet)}
                      />
                    </Tooltip>
                    <Tooltip title="编辑">
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => openEditModal(snippet)}
                      />
                    </Tooltip>
                    <Tooltip title="删除">
                      <Popconfirm
                        title="确定删除此代码片段？"
                        onConfirm={() => handleDelete(snippet._id)}
                      >
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                        />
                      </Popconfirm>
                    </Tooltip>
                  </Space>
                </div>
                {snippet.description && (
                  <div style={{ fontSize: 12, color: isDark ? '#888' : '#999', marginBottom: 8 }}>
                    {snippet.description}
                  </div>
                )}
                <pre style={{
                  fontFamily: codeFont,
                  fontSize: 11,
                  padding: 8,
                  borderRadius: 4,
                  background: isDark ? '#252525' : '#f5f5f5',
                  margin: 0,
                  overflow: 'auto',
                  maxHeight: 150,
                }}>
                  {snippet.code}
                </pre>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* 创建/编辑弹窗 */}
      <Modal
        title={editingSnippet ? '编辑代码片段' : '新建代码片段'}
        open={editModalOpen}
        onOk={handleSave}
        onCancel={() => setEditModalOpen(false)}
        confirmLoading={saving}
        width={600}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12 }}>名称 *</div>
            <Input
              placeholder="输入片段名称"
              value={snippetName}
              onChange={(e) => setSnippetName(e.target.value)}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12 }}>描述</div>
            <Input
              placeholder="简要描述（可选）"
              value={snippetDesc}
              onChange={(e) => setSnippetDesc(e.target.value)}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12 }}>标签</div>
            <Select
              mode="tags"
              style={{ width: '100%' }}
              placeholder="输入标签后回车"
              value={snippetTags}
              onChange={setSnippetTags}
              options={tags.map(t => ({ value: t, label: t }))}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12 }}>代码 *</div>
            <Input.TextArea
              placeholder="输入代码内容"
              value={snippetCode}
              onChange={(e) => setSnippetCode(e.target.value)}
              rows={10}
              style={{ fontFamily: codeFont, fontSize: 12 }}
            />
          </div>
        </div>
      </Modal>
    </>
  )
}
