import { useState, useEffect, useMemo } from 'react'
import { Input, Modal, message } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import SchedulerPanel from '../SchedulerPanel'
import StatisticsPanel from '../StatisticsPanel'
import WebhookPanel from '../WebhookPanel'
import SnippetsPanel from '../SnippetsPanel'
import Header from './Header'
import FunctionItem from './FunctionItem'
import FolderTree from './FolderTree'
import CreateFunctionModal from './CreateFunctionModal'
import RenameModal from './RenameModal'
import { functionApi } from '../../api/functions'
import { useFunctionStore } from '../../stores/function'
import { useThemeStore } from '../../stores/theme'
import { FUNCTION_TEMPLATES } from '../../constants/templates'
import { buildFolderTree } from './utils'
import type { CloudFunction, HttpMethod } from '../../stores/function'

export default function FunctionList() {
  const { functions, current, setFunctions, setCurrent, setLoading, openTab } = useFunctionStore()
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [renamingFunc, setRenamingFunc] = useState<CloudFunction | null>(null)
  const [schedulerOpen, setSchedulerOpen] = useState(false)
  const [statisticsOpen, setStatisticsOpen] = useState(false)
  const [webhookOpen, setWebhookOpen] = useState(false)
  const [snippetsOpen, setSnippetsOpen] = useState(false)

  // Form states
  const [newFunctionName, setNewFunctionName] = useState('')
  const [newFunctionMethods, setNewFunctionMethods] = useState<HttpMethod[]>(['POST'])
  const [newFunctionDesc, setNewFunctionDesc] = useState('')
  const [newFunctionTags, setNewFunctionTags] = useState<string[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('empty')
  const [templateCategory, setTemplateCategory] = useState<string>('all')

  // UI states
  const [searchText, setSearchText] = useState('')
  const [creating, setCreating] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  const loadFunctions = async () => {
    setLoading(true)
    try {
      const response = await functionApi.list()
      if (response.data.success) {
        setFunctions(response.data.data)
        if (response.data.data.length > 0 && !current) {
          setCurrent(response.data.data[0])
        }
      }
    } catch {
      message.error('加载函数列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFunctions()
  }, [])

  const handleCreate = async () => {
    if (!newFunctionName.trim()) {
      message.warning('请输入函数名称')
      return
    }

    const template = FUNCTION_TEMPLATES.find((t) => t.id === selectedTemplate)
    const code = template?.code || FUNCTION_TEMPLATES[0].code

    setCreating(true)
    try {
      const response = await functionApi.create(newFunctionName.trim(), code)
      if (response.data.success) {
        message.success('创建成功')
        setCreateModalOpen(false)
        resetCreateForm()
        await loadFunctions()
        openTab(response.data.data)
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      message.error(err.response?.data?.error?.message || '创建失败')
    } finally {
      setCreating(false)
    }
  }

  const resetCreateForm = () => {
    setNewFunctionName('')
    setNewFunctionMethods(['POST'])
    setNewFunctionDesc('')
    setNewFunctionTags([])
    setSelectedTemplate('empty')
    setTemplateCategory('all')
  }

  const handleSelectFunction = (fn: CloudFunction) => {
    openTab(fn)
  }

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const handleDelete = async (fn: CloudFunction) => {
    try {
      await functionApi.remove(fn._id)
      message.success('删除成功')
      if (current?._id === fn._id) {
        setCurrent(null)
      }
      await loadFunctions()
    } catch {
      message.error('删除失败')
    }
  }

  const submitRename = async () => {
    if (!renamingFunc || !newFunctionName.trim()) return
    try {
      const res = await functionApi.rename(renamingFunc._id, newFunctionName.trim())
      if (res.data.success) {
        message.success('重命名成功')
        loadFunctions()
      } else {
        message.error('重命名失败')
      }
    } catch {
      message.error('重命名失败')
    }
    setRenameModalOpen(false)
    setRenamingFunc(null)
    setNewFunctionName('')
  }

  const folderTree = useMemo(() => buildFolderTree(functions), [functions])
  const filteredFunctions = functions.filter((fn) =>
    fn.name.toLowerCase().includes(searchText.toLowerCase())
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: isDark ? '#e0e0e0' : '#000' }}>
      <Header
        functionsCount={functions.length}
        isDark={isDark}
        onCreateFunction={() => setCreateModalOpen(true)}
        onOpenScheduler={() => setSchedulerOpen(true)}
        onOpenStatistics={() => setStatisticsOpen(true)}
        onOpenWebhook={() => setWebhookOpen(true)}
        onOpenSnippets={() => setSnippetsOpen(true)}
      />

      <div style={{ padding: '6px 8px', borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}` }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#999', fontSize: 12 }} />}
          placeholder="搜索函数..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          size="small"
        />
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {searchText ? (
          filteredFunctions.length > 0 ? (
            filteredFunctions.map((fn) => (
              <FunctionItem
                key={fn._id}
                fn={fn}
                indent={0}
                isDark={isDark}
                isActive={current?._id === fn._id}
                onSelect={handleSelectFunction}
                onDelete={handleDelete}
              />
            ))
          ) : (
            <div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 12 }}>
              未找到匹配的函数
            </div>
          )
        ) : (
          <>
            {folderTree.children.map((folder) => (
              <FolderTree
                key={folder.path}
                folder={folder}
                indent={0}
                isDark={isDark}
                expandedFolders={expandedFolders}
                currentFunctionId={current?._id}
                onToggleFolder={toggleFolder}
                onSelectFunction={handleSelectFunction}
                onDeleteFunction={handleDelete}
              />
            ))}
            {folderTree.functions.map((fn) => (
              <FunctionItem
                key={fn._id}
                fn={fn}
                indent={0}
                isDark={isDark}
                isActive={current?._id === fn._id}
                onSelect={handleSelectFunction}
                onDelete={handleDelete}
              />
            ))}
            {functions.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 12 }}>
                暂无函数，点击右上角 + 创建
              </div>
            )}
          </>
        )}
      </div>

      <CreateFunctionModal
        open={createModalOpen}
        creating={creating}
        isDark={isDark}
        newFunctionName={newFunctionName}
        newFunctionMethods={newFunctionMethods}
        newFunctionDesc={newFunctionDesc}
        newFunctionTags={newFunctionTags}
        selectedTemplate={selectedTemplate}
        templateCategory={templateCategory}
        onNameChange={setNewFunctionName}
        onMethodsChange={setNewFunctionMethods}
        onDescChange={setNewFunctionDesc}
        onTagsChange={setNewFunctionTags}
        onTemplateChange={setSelectedTemplate}
        onCategoryChange={setTemplateCategory}
        onConfirm={handleCreate}
        onCancel={() => {
          setCreateModalOpen(false)
          resetCreateForm()
        }}
      />

      <RenameModal
        open={renameModalOpen}
        newFunctionName={newFunctionName}
        onNameChange={setNewFunctionName}
        onConfirm={submitRename}
        onCancel={() => {
          setRenameModalOpen(false)
          setRenamingFunc(null)
          setNewFunctionName('')
        }}
      />

      <SchedulerPanel open={schedulerOpen} onClose={() => setSchedulerOpen(false)} />

      <Modal
        title="执行统计"
        open={statisticsOpen}
        onCancel={() => setStatisticsOpen(false)}
        width={700}
        footer={null}
        styles={{ body: { padding: 0, maxHeight: '70vh', overflow: 'auto' } }}
      >
        <StatisticsPanel />
      </Modal>

      <WebhookPanel open={webhookOpen} onClose={() => setWebhookOpen(false)} />

      <SnippetsPanel open={snippetsOpen} onClose={() => setSnippetsOpen(false)} />
    </div>
  )
}
