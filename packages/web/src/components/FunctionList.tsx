import { useState, useEffect, useMemo } from 'react'
import { Button, Input, Modal, message, Popconfirm, Tooltip, Select, Form, Radio, Card } from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  FileTextOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  ClockCircleOutlined,
  FileOutlined,
  SmileOutlined,
  ApiOutlined,
  CloudOutlined,
  SafetyOutlined,
  SettingOutlined,
  CalendarOutlined,
  ToolOutlined,
  BarChartOutlined,
  CodeOutlined,
} from '@ant-design/icons'
import SchedulerPanel from './SchedulerPanel'
import StatisticsPanel from './StatisticsPanel'
import WebhookPanel from './WebhookPanel'
import SnippetsPanel from './SnippetsPanel'
import { functionApi } from '../api/functions'
import { useFunctionStore } from '../stores/function'
import { useThemeStore } from '../stores/theme'
import { FUNCTION_TEMPLATES, TEMPLATE_CATEGORIES } from '../constants/templates'
import type { CloudFunction, HttpMethod } from '../stores/function'

// 图标映射
const iconMap: Record<string, React.ReactNode> = {
  FileOutlined: <FileOutlined />,
  SmileOutlined: <SmileOutlined />,
  ApiOutlined: <ApiOutlined />,
  CloudOutlined: <CloudOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  SafetyOutlined: <SafetyOutlined />,
  ClockCircleOutlined: <ClockCircleOutlined />,
  SettingOutlined: <SettingOutlined />,
  CalendarOutlined: <CalendarOutlined />,
  ToolOutlined: <ToolOutlined />,
}

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

// 构建文件夹树结构
interface FolderNode {
  name: string
  path: string
  children: FolderNode[]
  functions: CloudFunction[]
}

function buildFolderTree(functions: CloudFunction[]): FolderNode {
  const root: FolderNode = { name: '', path: '', children: [], functions: [] }

  functions.forEach((fn) => {
    const parts = fn.name.split('/')
    let current = root

    if (parts.length === 1) {
      root.functions.push(fn)
    } else {
      // 遍历路径创建文件夹节点
      for (let i = 0; i < parts.length - 1; i++) {
        const folderName = parts[i]
        const folderPath = parts.slice(0, i + 1).join('/')
        let folder = current.children.find((c) => c.name === folderName)
        if (!folder) {
          folder = { name: folderName, path: folderPath, children: [], functions: [] }
          current.children.push(folder)
        }
        current = folder
      }
      current.functions.push(fn)
    }
  })

  return root
}

export default function FunctionList() {
  const { functions, current, setFunctions, setCurrent, setLoading, openTab } = useFunctionStore()
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [renamingFunc, setRenamingFunc] = useState<CloudFunction | null>(null)
  const [newFunctionName, setNewFunctionName] = useState('')
  const [newFunctionMethods, setNewFunctionMethods] = useState<HttpMethod[]>(['POST'])
  const [newFunctionDesc, setNewFunctionDesc] = useState('')
  const [newFunctionTags, setNewFunctionTags] = useState<string[]>([])
  const [searchText, setSearchText] = useState('')
  const [creating, setCreating] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [schedulerOpen, setSchedulerOpen] = useState(false)
  const [statisticsOpen, setStatisticsOpen] = useState(false)
  const [webhookOpen, setWebhookOpen] = useState(false)
  const [snippetsOpen, setSnippetsOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('empty')
  const [templateCategory, setTemplateCategory] = useState<string>('all')

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

    // 获取选中模板的代码
    const template = FUNCTION_TEMPLATES.find(t => t.id === selectedTemplate)
    const code = template?.code || FUNCTION_TEMPLATES[0].code

    setCreating(true)
    try {
      const response = await functionApi.create(newFunctionName.trim(), code)
      if (response.data.success) {
        message.success('创建成功')
        setCreateModalOpen(false)
        setNewFunctionName('')
        setNewFunctionMethods(['POST'])
        setNewFunctionDesc('')
        setNewFunctionTags([])
        setSelectedTemplate('empty')
        setTemplateCategory('all')
        await loadFunctions()
        // 打开新创建的函数到标签页
        openTab(response.data.data)
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      message.error(err.response?.data?.error?.message || '创建失败')
    } finally {
      setCreating(false)
    }
  }

  // 过滤模板
  const filteredTemplates = templateCategory === 'all'
    ? FUNCTION_TEMPLATES
    : FUNCTION_TEMPLATES.filter(t => t.category === templateCategory)

  // 点击函数时打开标签页
  const handleSelectFunction = (fn: CloudFunction) => {
    openTab(fn)
  }

  // 切换文件夹展开状态
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

  // 构建文件夹树
  const folderTree = useMemo(() => buildFolderTree(functions), [functions])

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
    // TODO: 实现重命名 API
    message.info('重命名功能将在后续实现')
    setRenameModalOpen(false)
    setRenamingFunc(null)
    setNewFunctionName('')
  }

  // 过滤函数列表
  const filteredFunctions = functions.filter((fn) =>
    fn.name.toLowerCase().includes(searchText.toLowerCase())
  )

  // 渲染函数项
  const renderFunctionItem = (fn: CloudFunction, indent: number = 0) => (
    <div
      key={fn._id}
      style={{
        padding: '6px 12px',
        paddingLeft: 12 + indent * 16,
        cursor: 'pointer',
        background: current?._id === fn._id ? (isDark ? '#2a4a6d' : '#e6f7ff') : 'transparent',
        borderBottom: `1px solid ${isDark ? '#252525' : '#f5f5f5'}`,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 13,
      }}
      onClick={() => handleSelectFunction(fn)}
    >
      {fn.methods?.[0] && (
        <span
          style={{
            fontSize: 9,
            padding: '1px 4px',
            borderRadius: 2,
            background: isDark ? '#3b5998' : '#e6f7ff',
            color: isDark ? '#fff' : '#1890ff',
            fontWeight: 500,
          }}
        >
          {fn.methods[0]}
        </span>
      )}
      <FileTextOutlined style={{ color: '#4a9eff', fontSize: 12 }} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {fn.name.split('/').pop()}
      </span>
      {fn.published && (
        <Tooltip title="已发布">
          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 11 }} />
        </Tooltip>
      )}
      <Popconfirm
        title="确定删除该函数？"
        onConfirm={(e) => {
          e?.stopPropagation()
          handleDelete(fn)
        }}
        onCancel={(e) => e?.stopPropagation()}
      >
        <DeleteOutlined
          style={{ color: isDark ? '#666' : '#999', fontSize: 11, opacity: 0.6 }}
          onClick={(e) => e.stopPropagation()}
        />
      </Popconfirm>
    </div>
  )

  // 渲染文件夹
  const renderFolder = (folder: FolderNode, indent: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(folder.path)
    return (
      <div key={folder.path}>
        <div
          style={{
            padding: '6px 12px',
            paddingLeft: 12 + indent * 16,
            cursor: 'pointer',
            background: 'transparent',
            borderBottom: `1px solid ${isDark ? '#252525' : '#f5f5f5'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
          }}
          onClick={() => toggleFolder(folder.path)}
        >
          {isExpanded ? (
            <FolderOpenOutlined style={{ color: '#faad14', fontSize: 12 }} />
          ) : (
            <FolderOutlined style={{ color: '#faad14', fontSize: 12 }} />
          )}
          <span style={{ fontWeight: 500 }}>{folder.name}</span>
          <span style={{ color: '#888', fontSize: 11 }}>
            ({folder.functions.length + folder.children.reduce((acc, c) => acc + c.functions.length, 0)})
          </span>
        </div>
        {isExpanded && (
          <>
            {folder.children.map((child) => renderFolder(child, indent + 1))}
            {folder.functions.map((fn) => renderFunctionItem(fn, indent + 1))}
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: isDark ? '#e0e0e0' : '#000' }}>
      {/* 标题栏 */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          函数列表 <span style={{ color: '#888', fontWeight: 400 }}>{functions.length}</span>
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          <Tooltip title="执行统计">
            <Button
              type="text"
              size="small"
              icon={<BarChartOutlined style={{ fontSize: 12 }} />}
              onClick={() => setStatisticsOpen(true)}
            />
          </Tooltip>
          <Tooltip title="代码片段">
            <Button
              type="text"
              size="small"
              icon={<CodeOutlined style={{ fontSize: 12 }} />}
              onClick={() => setSnippetsOpen(true)}
            />
          </Tooltip>
          <Tooltip title="Webhook">
            <Button
              type="text"
              size="small"
              icon={<ApiOutlined style={{ fontSize: 12 }} />}
              onClick={() => setWebhookOpen(true)}
            />
          </Tooltip>
          <Tooltip title="定时执行器">
            <Button
              type="text"
              size="small"
              icon={<ClockCircleOutlined style={{ fontSize: 12 }} />}
              onClick={() => setSchedulerOpen(true)}
            />
          </Tooltip>
          <Tooltip title="新建函数">
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined style={{ fontSize: 12 }} />}
              onClick={() => setCreateModalOpen(true)}
            />
          </Tooltip>
        </div>
      </div>

      {/* 搜索框 */}
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

      {/* 函数列表 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {searchText ? (
          // 搜索模式：平铺显示
          filteredFunctions.length > 0 ? (
            filteredFunctions.map((fn) => renderFunctionItem(fn))
          ) : (
            <div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 12 }}>
              未找到匹配的函数
            </div>
          )
        ) : (
          // 正常模式：文件夹树
          <>
            {folderTree.children.map((folder) => renderFolder(folder))}
            {folderTree.functions.map((fn) => renderFunctionItem(fn))}
            {functions.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 12 }}>
                暂无函数，点击右上角 + 创建
              </div>
            )}
          </>
        )}
      </div>

      {/* 创建函数弹窗 */}
      <Modal
        title="新建函数"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateModalOpen(false)
          setNewFunctionName('')
          setNewFunctionMethods(['POST'])
          setNewFunctionDesc('')
          setNewFunctionTags([])
          setSelectedTemplate('empty')
          setTemplateCategory('all')
        }}
        confirmLoading={creating}
        width={600}
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label="函数名称"
            required
            help="支持路径格式，如 user/login 会自动创建 user 文件夹"
          >
            <Input
              placeholder="例如: user/login 或 hello"
              value={newFunctionName}
              onChange={(e) => setNewFunctionName(e.target.value)}
            />
          </Form.Item>

          {/* 模板选择 */}
          <Form.Item label="选择模板">
            <div style={{ marginBottom: 12 }}>
              <Radio.Group
                value={templateCategory}
                onChange={(e) => setTemplateCategory(e.target.value)}
                size="small"
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value="all">全部</Radio.Button>
                <Radio.Button value="basic">{TEMPLATE_CATEGORIES.basic.name}</Radio.Button>
                <Radio.Button value="http">{TEMPLATE_CATEGORIES.http.name}</Radio.Button>
                <Radio.Button value="data">{TEMPLATE_CATEGORIES.data.name}</Radio.Button>
                <Radio.Button value="util">{TEMPLATE_CATEGORIES.util.name}</Radio.Button>
              </Radio.Group>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              maxHeight: 240,
              overflow: 'auto',
            }}>
              {filteredTemplates.map((template) => (
                <Card
                  key={template.id}
                  size="small"
                  hoverable
                  style={{
                    cursor: 'pointer',
                    border: selectedTemplate === template.id
                      ? `2px solid ${isDark ? '#1890ff' : '#1890ff'}`
                      : `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
                    background: selectedTemplate === template.id
                      ? (isDark ? '#112a45' : '#e6f7ff')
                      : (isDark ? '#1a1a1a' : '#fff'),
                  }}
                  onClick={() => setSelectedTemplate(template.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, color: '#1890ff' }}>
                      {iconMap[template.icon] || <FileOutlined />}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {template.name}
                      </div>
                      <div style={{
                        fontSize: 10,
                        color: isDark ? '#888' : '#999',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {template.description}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Form.Item>

          <Form.Item label="请求方式">
            <Select
              mode="multiple"
              value={newFunctionMethods}
              onChange={setNewFunctionMethods}
              options={HTTP_METHODS.map((m) => ({ value: m, label: m }))}
              placeholder="选择允许的请求方式"
            />
          </Form.Item>
          <Form.Item label="函数描述">
            <Input.TextArea
              placeholder="简要描述函数功能"
              value={newFunctionDesc}
              onChange={(e) => setNewFunctionDesc(e.target.value)}
              rows={2}
            />
          </Form.Item>
          <Form.Item label="标签">
            <Select
              mode="tags"
              value={newFunctionTags}
              onChange={setNewFunctionTags}
              placeholder="输入标签后回车"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 重命名弹窗 */}
      <Modal
        title="重命名函数"
        open={renameModalOpen}
        onOk={submitRename}
        onCancel={() => {
          setRenameModalOpen(false)
          setRenamingFunc(null)
          setNewFunctionName('')
        }}
      >
        <Input
          placeholder="请输入新名称"
          value={newFunctionName}
          onChange={(e) => setNewFunctionName(e.target.value)}
          onPressEnter={submitRename}
          style={{ marginTop: 16 }}
        />
      </Modal>

      {/* 定时执行器 */}
      <SchedulerPanel open={schedulerOpen} onClose={() => setSchedulerOpen(false)} />

      {/* 执行统计 */}
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

      {/* Webhook 管理 */}
      <WebhookPanel open={webhookOpen} onClose={() => setWebhookOpen(false)} />

      {/* 代码片段 */}
      <SnippetsPanel open={snippetsOpen} onClose={() => setSnippetsOpen(false)} />
    </div>
  )
}
