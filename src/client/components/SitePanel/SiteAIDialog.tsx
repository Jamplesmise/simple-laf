/**
 * 站点 AI 对话弹窗
 *
 * 80% 宽高的全屏对话弹窗
 * 支持模型选择、深度思考、流式输出
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Modal, Button, Input, Select, Switch, Spin, Empty, Tooltip } from 'antd'
import {
  CloseOutlined,
  SendOutlined,
  RobotOutlined,
  CloudServerOutlined,
  ThunderboltOutlined,
  BulbOutlined,
  FileTextOutlined,
  SettingOutlined,
  CheckCircleFilled,
  LoadingOutlined,
  ExclamationCircleFilled,
  ClearOutlined,
  HistoryOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { aiProviderApi, aiModelApi, type AIProvider, type AIModel } from '@/api/aiProvider'
import { aiSystemPromptApi, type AISystemPrompt } from '@/api/aiSystemPrompt'
import { executeStream, type AIExecuteMessage } from '@/api/ai'
import { useSiteStore } from '@/stores/site'
import { useThemeStore } from '@/stores/theme'

interface SiteAIDialogProps {
  open: boolean
  onClose: () => void
  onContentChange: () => void
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  results?: AIOperationResult[]
  timestamp: Date
}

interface AIOperationResult {
  type: string
  success: boolean
  path?: string
  error?: string
  description?: string
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

// localStorage 存储键
const STORAGE_KEY = 'site-ai-conversations'

// 加载对话历史
function loadConversations(): Conversation[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (data) {
      const conversations = JSON.parse(data)
      // 恢复 Date 对象
      return conversations.map((c: Conversation) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
        messages: c.messages.map((m: Message) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })),
      }))
    }
  } catch {
    // ignore
  }
  return []
}

// 保存对话历史
function saveConversations(conversations: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations))
  } catch {
    // ignore
  }
}

// 生成对话标题
function generateTitle(firstMessage: string): string {
  const maxLen = 20
  if (firstMessage.length <= maxLen) return firstMessage
  return firstMessage.slice(0, maxLen) + '...'
}

export default function SiteAIDialog({
  open,
  onClose,
  onContentChange,
}: SiteAIDialogProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'
  const { files, fetchFiles } = useSiteStore()

  // AI 配置
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [models, setModels] = useState<AIModel[]>([])
  const [prompts, setPrompts] = useState<AISystemPrompt[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null)
  const [enableThinking, setEnableThinking] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(false)

  // 对话历史
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConvId, setCurrentConvId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  // 对话状态
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [streamContent, setStreamContent] = useState('')

  // 配置面板
  const [showConfig, setShowConfig] = useState(false)

  // 加载对话历史
  useEffect(() => {
    if (open) {
      const loaded = loadConversations()
      setConversations(loaded)
      // 如果有历史对话，加载最新的
      if (loaded.length > 0 && !currentConvId) {
        const latest = loaded[0]
        setCurrentConvId(latest.id)
        setMessages(latest.messages)
      }
    }
  }, [open, currentConvId])

  // 保存当前对话
  const saveCurrentConversation = useCallback((newMessages: Message[]) => {
    if (newMessages.length === 0) return

    setConversations(prev => {
      let updated: Conversation[]

      if (currentConvId) {
        // 更新现有对话
        updated = prev.map(c =>
          c.id === currentConvId
            ? { ...c, messages: newMessages, updatedAt: new Date() }
            : c
        )
      } else {
        // 创建新对话
        const newConv: Conversation = {
          id: Date.now().toString(),
          title: generateTitle(newMessages[0]?.content || '新对话'),
          messages: newMessages,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        setCurrentConvId(newConv.id)
        updated = [newConv, ...prev]
      }

      // 最多保留 50 个对话
      if (updated.length > 50) {
        updated = updated.slice(0, 50)
      }

      saveConversations(updated)
      return updated
    })
  }, [currentConvId])

  // 切换对话
  const switchConversation = useCallback((convId: string) => {
    const conv = conversations.find(c => c.id === convId)
    if (conv) {
      setCurrentConvId(convId)
      setMessages(conv.messages)
      setShowHistory(false)
    }
  }, [conversations])

  // 新建对话
  const createNewConversation = useCallback(() => {
    setCurrentConvId(null)
    setMessages([])
    setShowHistory(false)
  }, [])

  // 删除对话
  const deleteConversation = useCallback((convId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setConversations(prev => {
      const updated = prev.filter(c => c.id !== convId)
      saveConversations(updated)

      // 如果删除的是当前对话，切换到下一个或新建
      if (convId === currentConvId) {
        if (updated.length > 0) {
          setCurrentConvId(updated[0].id)
          setMessages(updated[0].messages)
        } else {
          setCurrentConvId(null)
          setMessages([])
        }
      }

      return updated
    })
  }, [currentConvId])

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 获取选中的模型
  const selectedModel = models.find(m => m._id === selectedModelId)

  // 加载配置
  const loadConfig = useCallback(async () => {
    setLoadingConfig(true)
    try {
      const [providersRes, promptsRes] = await Promise.all([
        aiProviderApi.list(),
        aiSystemPromptApi.list(),
      ])

      const providerList = providersRes.data.data || []
      setProviders(providerList)
      setPrompts(promptsRes.data.data || [])

      // 自动选择默认供应商
      if (providerList.length > 0 && !selectedProviderId) {
        const defaultProvider = providerList.find(p => p.isDefault) || providerList[0]
        setSelectedProviderId(defaultProvider._id)
      }
    } catch {
      // 静默失败
    } finally {
      setLoadingConfig(false)
    }
  }, [selectedProviderId])

  // 加载模型
  const loadModels = useCallback(async (providerId: string) => {
    try {
      const res = await aiModelApi.list(providerId)
      const modelList = res.data.data || []
      setModels(modelList)

      // 自动选择默认模型
      if (modelList.length > 0) {
        const defaultModel = modelList.find(m => m.isDefault) || modelList[0]
        setSelectedModelId(defaultModel._id)
        setEnableThinking(false)
      }
    } catch {
      setModels([])
    }
  }, [])

  // 打开时加载配置
  useEffect(() => {
    if (open) {
      loadConfig()
    }
  }, [open, loadConfig])

  // 供应商变化时加载模型
  useEffect(() => {
    if (selectedProviderId) {
      loadModels(selectedProviderId)
    }
  }, [selectedProviderId, loadModels])

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamContent])

  // 构建站点文件上下文
  const buildSiteContext = useCallback(() => {
    const textFiles = files
      .filter(f => !f.isDirectory)
      .map(f => `- ${f.path} (${f.mimeType || 'unknown'})`)
      .join('\n')

    return `当前站点文件列表:\n${textFiles || '(空)'}`
  }, [files])

  // 发送消息
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || sending) return

    const userMessage: Message = {
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setSending(true)
    setStreamContent('')

    try {
      // 构建完整提示
      const siteContext = buildSiteContext()
      const fullPrompt = `[站点模式]\n${siteContext}\n\n用户请求: ${inputValue}`

      // 使用流式 API
      let assistantContent = ''
      let operationResults: AIOperationResult[] = []

      // 累积生成的内容
      let generatedContent = ''

      for await (const msg of executeStream(fullPrompt, {
        modelId: selectedModelId || undefined,
        enableThinking: enableThinking && selectedModel?.supportsThinking,
      })) {
        const execMsg = msg as AIExecuteMessage

        if (execMsg.status === 'thinking') {
          // 显示思考状态
          setStreamContent('💭 正在分析需求...')
        } else if (execMsg.status === 'generating') {
          // 实时显示生成的内容
          if (execMsg.content) {
            generatedContent = execMsg.content
            setStreamContent(generatedContent)
          }
        } else if (execMsg.status === 'plan') {
          // 显示执行计划
          const plan = execMsg.plan
          if (plan) {
            const planDetails = plan.operations?.map((op: { type: string; description: string }, i: number) =>
              `${i + 1}. ${op.description}`
            ).join('\n') || ''
            setStreamContent(`📋 执行计划\n\n${planDetails}`)
            assistantContent = plan.summary || '正在执行...'
          }
        } else if (execMsg.status === 'executing') {
          // 显示执行进度
          setStreamContent(`⏳ ${execMsg.message || '正在写入文件...'}`)
        } else if (execMsg.status === 'done' && execMsg.result) {
          assistantContent = execMsg.result.message || '操作完成'
          operationResults = (execMsg.result.results || []).map(r => ({
            type: r.type,
            success: r.success,
            path: r.result?.name,
            error: r.error,
          }))

          // 如果有成功的操作，刷新文件列表和预览
          const hasSuccess = operationResults.some(r => r.success)
          if (hasSuccess) {
            await fetchFiles()
            onContentChange()
          }
        } else if (execMsg.status === 'error') {
          assistantContent = execMsg.error || '操作失败'
        }
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: assistantContent,
        results: operationResults.length > 0 ? operationResults : undefined,
        timestamp: new Date(),
      }
      setMessages(prev => {
        const newMessages = [...prev, assistantMessage]
        saveCurrentConversation(newMessages)
        return newMessages
      })
    } catch (error) {
      const err = error as Error
      const errorMessage: Message = {
        role: 'assistant',
        content: `错误: ${err.message}`,
        timestamp: new Date(),
      }
      setMessages(prev => {
        const newMessages = [...prev, errorMessage]
        saveCurrentConversation(newMessages)
        return newMessages
      })
    } finally {
      setSending(false)
      setStreamContent('')
    }
  }, [inputValue, sending, selectedModelId, enableThinking, selectedModel, buildSiteContext, fetchFiles, onContentChange, saveCurrentConversation])

  // 处理按键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 渲染操作结果
  const renderOperationResult = (result: AIOperationResult, index: number) => {
    const icon = result.success
      ? <CheckCircleFilled style={{ color: '#52c41a' }} />
      : <ExclamationCircleFilled style={{ color: '#ff4d4f' }} />

    const typeLabels: Record<string, string> = {
      siteCreateFile: '创建文件',
      siteUpdateFile: '更新文件',
      siteDeleteFile: '删除文件',
      siteCreateFolder: '创建文件夹',
    }

    return (
      <div
        key={index}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px',
          background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
          borderRadius: 4,
          fontSize: 12,
          marginTop: 4,
        }}
      >
        {icon}
        <span style={{ color: isDark ? '#999' : '#666' }}>
          {typeLabels[result.type] || result.type}
        </span>
        {result.path && (
          <code style={{ color: isDark ? '#4fc3f7' : '#1890ff' }}>
            {result.path}
          </code>
        )}
        {result.error && (
          <span style={{ color: '#ff4d4f' }}>- {result.error}</span>
        )}
      </div>
    )
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="80vw"
      centered
      destroyOnClose
      closable={false}
      maskStyle={{
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(4px)',
      }}
      styles={{
        body: { padding: 0, height: '80vh' },
        content: {
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        },
      }}
    >
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: isDark ? '#1a1a2e' : '#fff',
        }}
      >
        {/* 头部 */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: `1px solid ${isDark ? '#333' : '#e5e7eb'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: isDark ? '#16162a' : '#fafafa',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <RobotOutlined style={{ fontSize: 20, color: '#00a9a6' }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: isDark ? '#fff' : '#333' }}>
              AI 建站助手
            </span>
            {selectedModel && (
              <span
                style={{
                  fontSize: 12,
                  color: isDark ? '#888' : '#999',
                  background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  padding: '2px 8px',
                  borderRadius: 4,
                }}
              >
                {selectedModel.alias || selectedModel.name}
                {enableThinking && selectedModel.supportsThinking && ' · 深度思考'}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tooltip title="新建对话">
              <Button
                type="text"
                icon={<PlusOutlined />}
                onClick={createNewConversation}
                disabled={sending}
              />
            </Tooltip>
            <Tooltip title={`历史记录 (${conversations.length})`}>
              <Button
                type="text"
                icon={<HistoryOutlined />}
                onClick={() => setShowHistory(!showHistory)}
                style={{ color: showHistory ? '#00a9a6' : undefined }}
              />
            </Tooltip>
            {messages.length > 0 && (
              <Tooltip title="清除当前对话">
                <Button
                  type="text"
                  icon={<ClearOutlined />}
                  onClick={() => {
                    setMessages([])
                    setCurrentConvId(null)
                  }}
                  disabled={sending}
                />
              </Tooltip>
            )}
            <Tooltip title="AI 配置">
              <Button
                type="text"
                icon={<SettingOutlined />}
                onClick={() => setShowConfig(!showConfig)}
                style={{ color: showConfig ? '#00a9a6' : undefined }}
              />
            </Tooltip>
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={onClose}
            />
          </div>
        </div>

        {/* 配置面板 */}
        {showConfig && (
          <div
            style={{
              padding: '12px 20px',
              borderBottom: `1px solid ${isDark ? '#333' : '#e5e7eb'}`,
              background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              alignItems: 'center',
            }}
          >
            {loadingConfig ? (
              <Spin size="small" />
            ) : (
              <>
                {/* 供应商 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CloudServerOutlined style={{ color: isDark ? '#888' : '#666' }} />
                  <Select
                    size="small"
                    style={{ width: 140 }}
                    placeholder="供应商"
                    value={selectedProviderId}
                    onChange={setSelectedProviderId}
                    options={providers.map(p => ({ label: p.name, value: p._id }))}
                  />
                </div>

                {/* 模型 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ThunderboltOutlined style={{ color: isDark ? '#888' : '#666' }} />
                  <Select
                    size="small"
                    style={{ width: 180 }}
                    placeholder="模型"
                    value={selectedModelId}
                    onChange={setSelectedModelId}
                    options={models.map(m => ({ label: m.alias || m.name, value: m._id }))}
                  />
                </div>

                {/* 深度思考 */}
                {selectedModel?.supportsThinking && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BulbOutlined style={{ color: enableThinking ? '#faad14' : (isDark ? '#888' : '#666') }} />
                    <span style={{ fontSize: 12, color: isDark ? '#888' : '#666' }}>深度思考</span>
                    <Switch
                      size="small"
                      checked={enableThinking}
                      onChange={setEnableThinking}
                    />
                  </div>
                )}

                {/* 系统提示词 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileTextOutlined style={{ color: isDark ? '#888' : '#666' }} />
                  <Select
                    size="small"
                    style={{ width: 140 }}
                    placeholder="提示词"
                    allowClear
                    value={selectedPromptId}
                    onChange={setSelectedPromptId}
                    options={prompts.map(p => ({ label: p.name, value: p._id }))}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* 主体区域 (历史侧边栏 + 消息区域) */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* 历史侧边栏 */}
          {showHistory && (
            <div
              style={{
                width: 240,
                borderRight: `1px solid ${isDark ? '#333' : '#e5e7eb'}`,
                display: 'flex',
                flexDirection: 'column',
                background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: `1px solid ${isDark ? '#333' : '#e5e7eb'}`,
                  fontSize: 13,
                  fontWeight: 500,
                  color: isDark ? '#888' : '#666',
                }}
              >
                历史对话 ({conversations.length})
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                {conversations.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: isDark ? '#666' : '#999', fontSize: 12 }}>
                    暂无历史对话
                  </div>
                ) : (
                  conversations.map(conv => (
                    <div
                      key={conv.id}
                      onClick={() => switchConversation(conv.id)}
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        borderBottom: `1px solid ${isDark ? '#333' : '#f0f0f0'}`,
                        background: conv.id === currentConvId
                          ? (isDark ? 'rgba(0, 169, 166, 0.2)' : 'rgba(0, 169, 166, 0.1)')
                          : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        if (conv.id !== currentConvId) {
                          e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (conv.id !== currentConvId) {
                          e.currentTarget.style.background = 'transparent'
                        }
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            color: isDark ? '#e0e0e0' : '#333',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {conv.title}
                        </div>
                        <div style={{ fontSize: 11, color: isDark ? '#666' : '#999', marginTop: 2 }}>
                          {conv.messages.length} 条消息 · {new Date(conv.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={(e) => deleteConversation(conv.id, e)}
                        style={{ color: isDark ? '#666' : '#999', opacity: 0.7 }}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 消息区域 */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: 20,
            }}
          >
          {messages.length === 0 ? (
            <Empty
              image={<RobotOutlined style={{ fontSize: 48, color: '#00a9a6' }} />}
              description={
                <div style={{ color: isDark ? '#888' : '#999' }}>
                  <div style={{ fontSize: 16, marginBottom: 8 }}>AI 建站助手</div>
                  <div style={{ fontSize: 12 }}>
                    告诉我你想要什么样的网站，我来帮你创建
                  </div>
                  <div style={{ fontSize: 12, marginTop: 8, color: isDark ? '#666' : '#bbb' }}>
                    例如: "创建一个简单的个人博客首页" 或 "帮我写一个响应式导航栏"
                  </div>
                </div>
              }
              style={{ marginTop: 80 }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {messages.map((msg, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '70%',
                      padding: '12px 16px',
                      borderRadius: 12,
                      background: msg.role === 'user'
                        ? '#00a9a6'
                        : (isDark ? '#2a2a4a' : '#f5f5f5'),
                      color: msg.role === 'user'
                        ? '#fff'
                        : (isDark ? '#e0e0e0' : '#333'),
                    }}
                  >
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {msg.content}
                    </div>
                    {msg.results && msg.results.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        {msg.results.map((r, i) => renderOperationResult(r, i))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {sending && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: streamContent.length > 100 ? '100%' : '70%',
                      borderRadius: 12,
                      background: isDark ? '#1e1e3f' : '#f8f9fa',
                      border: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
                      overflow: 'hidden',
                    }}
                  >
                    {/* 头部状态栏 */}
                    <div
                      style={{
                        padding: '8px 12px',
                        background: isDark ? '#16162a' : '#f0f0f0',
                        borderBottom: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <LoadingOutlined style={{ color: '#00a9a6' }} />
                      <span style={{ color: isDark ? '#888' : '#666', fontSize: 12 }}>
                        {streamContent.startsWith('💭') ? '分析中...' :
                         streamContent.startsWith('📋') ? '规划中...' :
                         streamContent.startsWith('⏳') ? '执行中...' :
                         '生成代码中...'}
                      </span>
                    </div>
                    {/* 内容区域 */}
                    {streamContent && (
                      <div
                        style={{
                          padding: '12px 16px',
                          maxHeight: 400,
                          overflow: 'auto',
                        }}
                      >
                        <pre
                          style={{
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
                            fontSize: 13,
                            lineHeight: 1.5,
                            color: isDark ? '#e0e0e0' : '#333',
                          }}
                        >
                          {streamContent}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
          </div>
        </div>

        {/* 输入区域 */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: `1px solid ${isDark ? '#333' : '#e5e7eb'}`,
            background: isDark ? '#16162a' : '#fafafa',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-end',
            }}
          >
            <Input.TextArea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="描述你想要的网站内容..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              disabled={sending}
              style={{
                flex: 1,
                borderRadius: 8,
                resize: 'none',
              }}
            />
            <Button
              type="primary"
              icon={sending ? <LoadingOutlined /> : <SendOutlined />}
              onClick={handleSend}
              disabled={!inputValue.trim() || sending}
              style={{
                background: '#00a9a6',
                borderColor: '#00a9a6',
                height: 40,
                width: 40,
                borderRadius: 8,
              }}
            />
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: isDark ? '#666' : '#999',
            }}
          >
            按 Enter 发送，Shift + Enter 换行
          </div>
        </div>
      </div>
    </Modal>
  )
}
