/**
 * AI 对话弹窗
 *
 * ChatGPT 风格的 AI 对话界面
 * 支持多对话管理、流式输出、@ 引用函数、/ 斜杠命令
 */

import { useState, useEffect, useCallback } from 'react'
import { Modal } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import type { CloudFunction } from '@/stores/function'
import { functionApi } from '@/api/functions'
import { folderApi, type TreeNode } from '@/api/folders'
import type { AIConversation } from '@/api/aiConversation'

// Hooks
import {
  useConversations,
  useAIModels,
  useSystemPrompts,
  useMessages,
} from './hooks'

// 子组件
import { ConversationSidebar } from './ConversationSidebar'
import { MessagePanel } from './MessagePanel'
import { InputArea } from './InputArea'
import { HeaderControls } from './HeaderControls'
import { ContextManager } from '../AI/ContextManager'
import { CanvasLayout } from '../AI/Canvas'
import { ExportDialog } from '../AI/Export'

// 样式
import styles from './styles.module.css'

// AI 助手模式
export type AIAssistantMode = 'function' | 'site'

// 站点文件信息
export interface SiteFile {
  path: string
  mimeType?: string
  isDirectory?: boolean
}

export interface AIConversationDialogProps {
  open: boolean
  onClose: () => void
  // 场景模式：function(云函数) 或 site(站点)
  mode?: AIAssistantMode
  // 站点上下文（mode='site' 时使用）
  siteContext?: {
    files: SiteFile[]
    onContentChange?: () => void
  }
  initialContext?: {
    selectedCode?: string
    functionId?: string
  }
}

export function AIConversationDialog({
  open,
  onClose,
  mode = 'function',
  siteContext,
  initialContext,
}: AIConversationDialogProps) {
  useThemeColors() // for theme consistency

  // 对话管理
  const conversations = useConversations({ autoLoad: false, loadWhen: open })
  const {
    conversations: conversationList,
    loading: loadingConversations,
    filter,
    currentId,
    editingId,
    editingTitle,
    select: selectConversation,
    setFilter,
    create: createConversation,
    remove: deleteConversation,
    toggleStar,
    archive: archiveConversation,
    startEdit,
    saveTitle,
    setEditingTitle,
    reload: reloadConversations,
  } = conversations

  // AI 模型
  const aiModels = useAIModels({ autoLoad: false, loadWhen: open })
  const {
    providers,
    models,
    selectedProviderId,
    selectedModelId,
    selectedModel,
    loadingProviders,
    loadingModels,
    enableThinking,
    selectProvider,
    selectModel,
    setEnableThinking,
    reloadProviders,
  } = aiModels

  // 系统提示词
  const systemPrompts = useSystemPrompts({ autoLoad: false, loadWhen: open })
  const {
    prompts,
    selectedId: selectedPromptId,
    loading: loadingPrompts,
    select: selectPrompt,
    reload: reloadPrompts,
  } = systemPrompts

  // 消息管理
  const {
    messages,
    loading: loadingMessages,
    sending,
    streamContent,
    streamStatus,
    // Sprint 10.1: 状态面板数据
    statusPanelData,
    loadMessages,
    sendMessage,
    clearMessages,
  } = useMessages({
    onConversationCreated: (id) => {
      selectConversation(id)
      reloadConversations()
    },
    onMessageSent: reloadConversations,
  })

  // 输入状态
  const [inputValue, setInputValue] = useState('')
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>([])

  // Canvas 模式
  const [canvasMode, setCanvasMode] = useState(false)

  // 导出对话框
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  // 日志分析模式
  const [enableLogAnalysis, setEnableLogAnalysis] = useState(false)
  const [logDays, setLogDays] = useState(7)

  // 函数和文件夹数据
  const [folders, setFolders] = useState<TreeNode[]>([])
  const [allFunctions, setAllFunctions] = useState<CloudFunction[]>([])

  
  // 加载文件夹和函数列表
  const loadFoldersAndFunctions = useCallback(async () => {
    try {
      const [foldersRes, functionsRes] = await Promise.all([
        folderApi.getTree(),
        functionApi.list(),
      ])
      setFolders(foldersRes.data.data || [])
      setAllFunctions(functionsRes.data.data || [])
    } catch {
      // 静默失败
    }
  }, [])

  // 初始化加载
  useEffect(() => {
    if (open) {
      reloadConversations()
      // 站点模式不需要加载函数列表
      if (mode !== 'site') {
        loadFoldersAndFunctions()
      }
      reloadPrompts()
      reloadProviders()
    }
  }, [open, mode, reloadConversations, loadFoldersAndFunctions, reloadPrompts, reloadProviders])

  // 处理初始上下文（如从右键菜单打开时自动选中函数）
  useEffect(() => {
    if (open && initialContext?.functionId && allFunctions.length > 0) {
      const fnExists = allFunctions.some(f => f._id === initialContext.functionId)
      if (fnExists && !selectedFunctions.includes(initialContext.functionId)) {
        setSelectedFunctions([initialContext.functionId])
      }
    }
  }, [open, initialContext?.functionId, allFunctions, selectedFunctions])

  // 切换对话时加载消息
  useEffect(() => {
    if (currentId) {
      loadMessages(currentId)
    } else {
      clearMessages()
    }
  }, [currentId, loadMessages, clearMessages])

  // 获取当前对话
  const currentConversation = conversationList.find(c => c._id === currentId)

  // 构建站点上下文字符串
  const buildSiteContextString = useCallback(() => {
    if (!siteContext?.files?.length) return ''
    const fileList = siteContext.files
      .filter(f => !f.isDirectory)
      .map(f => `- ${f.path} (${f.mimeType || 'unknown'})`)
      .join('\n')
    return `[站点模式]\n当前站点文件列表:\n${fileList || '(空)'}\n\n`
  }, [siteContext?.files])

  // 处理发送消息
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() && selectedFunctions.length === 0) return

    // 获取选中的函数对象
    const selectedFunctionObjects = selectedFunctions
      .map(id => allFunctions.find(f => f._id === id))
      .filter((f): f is CloudFunction => f !== undefined)

    // 保存日志分析状态
    const shouldAnalyzeLog = enableLogAnalysis
    const currentLogDays = logDays

    // 站点模式：添加站点上下文前缀
    const messageContent = mode === 'site'
      ? buildSiteContextString() + inputValue
      : inputValue

    // 清空输入
    setInputValue('')
    setSelectedFunctions([])
    setEnableLogAnalysis(false)

    await sendMessage({
      conversationId: currentId,
      content: messageContent,
      selectedFunctions: selectedFunctionObjects,
      options: {
        systemPromptId: selectedPromptId || undefined,
        modelId: selectedModelId || undefined,
        enableThinking: enableThinking && selectedModel?.supportsThinking,
        analyzeLog: shouldAnalyzeLog,
        logDays: shouldAnalyzeLog ? currentLogDays : undefined,
        initialContext,
        siteMode: mode === 'site',
      },
    })

    // 站点模式：操作完成后刷新预览
    if (mode === 'site' && siteContext?.onContentChange) {
      // 延迟一下让后端操作完成
      setTimeout(() => siteContext.onContentChange?.(), 1000)
    }
  }, [
    inputValue,
    selectedFunctions,
    allFunctions,
    currentId,
    selectedPromptId,
    selectedModelId,
    enableThinking,
    selectedModel,
    enableLogAnalysis,
    logDays,
    initialContext,
    sendMessage,
    mode,
    buildSiteContextString,
    siteContext,
  ])

  // 处理新建对话
  const handleNewConversation = async () => {
    const conv = await createConversation()
    if (conv) {
      selectConversation(conv._id)
      clearMessages()
    }
  }

  // 处理选择函数
  const handleFunctionSelect = useCallback((fnId: string) => {
    if (!selectedFunctions.includes(fnId)) {
      setSelectedFunctions(prev => [...prev, fnId])
    }
  }, [selectedFunctions])

  // 处理移除函数
  const handleFunctionRemove = useCallback((fnId: string) => {
    setSelectedFunctions(prev => prev.filter(id => id !== fnId))
  }, [])

  // 处理日志分析选择
  const handleLogAnalysisSelect = useCallback((days: number) => {
    setEnableLogAnalysis(true)
    setLogDays(days)
  }, [])

  // 处理日志分析移除
  const handleLogAnalysisRemove = useCallback(() => {
    setEnableLogAnalysis(false)
  }, [])

  // 处理快捷操作 (Sprint 11.3)
  const handleQuickAction = useCallback(async (prompt: string) => {
    // 获取当前选中的函数对象
    const selectedFunctionObjects = selectedFunctions
      .map(id => allFunctions.find(f => f._id === id))
      .filter((f): f is CloudFunction => f !== undefined)

    await sendMessage({
      conversationId: currentId,
      content: prompt,
      selectedFunctions: selectedFunctionObjects,
      options: {
        systemPromptId: selectedPromptId || undefined,
        modelId: selectedModelId || undefined,
        enableThinking: enableThinking && selectedModel?.supportsThinking,
        initialContext,
      },
    })
  }, [
    selectedFunctions,
    allFunctions,
    currentId,
    selectedPromptId,
    selectedModelId,
    enableThinking,
    selectedModel,
    initialContext,
    sendMessage,
  ])

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
        background: 'rgba(15, 23, 42, 0.4)',
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
      <div className={styles.container}>
        {/* 左侧对话列表 */}
        <ConversationSidebar
          conversations={conversationList}
          currentId={currentId}
          filter={filter}
          loading={loadingConversations}
          editingId={editingId}
          editingTitle={editingTitle}
          onSelect={selectConversation}
          onFilterChange={setFilter}
          onCreate={handleNewConversation}
          onDelete={deleteConversation}
          onToggleStar={toggleStar}
          onArchive={archiveConversation}
          onStartEdit={startEdit}
          onSaveTitle={saveTitle}
          onEditingTitleChange={setEditingTitle}
        />

        {/* 右侧主区域 */}
        <div className={styles.main}>
          {/* 头部工具栏 */}
          <div className={styles.headerToolbar}>
            <div className={styles.headerLeft}>
              <HeaderControls
                providers={providers}
                selectedProviderId={selectedProviderId}
                loadingProviders={loadingProviders}
                onProviderChange={selectProvider}
                models={models}
                selectedModelId={selectedModelId}
                selectedModel={selectedModel}
                loadingModels={loadingModels}
                onModelChange={selectModel}
                enableThinking={enableThinking}
                onThinkingToggle={() => setEnableThinking(!enableThinking)}
                systemPrompts={prompts}
                selectedPromptId={selectedPromptId}
                loadingPrompts={loadingPrompts}
                onPromptChange={selectPrompt}
                onClose={onClose}
                canvasMode={canvasMode}
                onCanvasModeToggle={() => setCanvasMode(!canvasMode)}
                canvasDisabled={false}
                onExport={() => setExportDialogOpen(true)}
                exportDisabled={!currentId}
              />
              {/* Sprint 10.3: 上下文管理 */}
              <ContextManager
                conversationId={currentId}
                modelName={selectedModel?.name}
                compact
              />
            </div>
            <button className={styles.closeButton} onClick={onClose}>
              <CloseOutlined />
            </button>
          </div>

          {/* 内容区域：普通模式 / Canvas 模式 */}
          {canvasMode ? (
            <CanvasLayout
              leftPanel={
                <>
                  <MessagePanel
                    messages={messages}
                    loading={loadingMessages}
                    streamContent={streamContent}
                    streamStatus={streamStatus}
                    currentTitle={currentConversation?.title}
                    statusPanelData={statusPanelData}
                  />
                  <InputArea
                    value={inputValue}
                    sending={sending}
                    selectedFunctions={selectedFunctions}
                    allFunctions={allFunctions}
                    folders={folders}
                    enableLogAnalysis={enableLogAnalysis}
                    logDays={logDays}
                    mode={mode}
                    onValueChange={setInputValue}
                    onSend={handleSend}
                    onFunctionSelect={handleFunctionSelect}
                    onFunctionRemove={handleFunctionRemove}
                    onLogAnalysisSelect={handleLogAnalysisSelect}
                    onLogAnalysisRemove={handleLogAnalysisRemove}
                  />
                </>
              }
              functionId={selectedFunctions[0]}
              conversationId={currentId || undefined}
              onQuickAction={handleQuickAction}
              sending={sending}
            />
          ) : (
            <>
              {/* 消息面板 */}
              <MessagePanel
                messages={messages}
                loading={loadingMessages}
                streamContent={streamContent}
                streamStatus={streamStatus}
                currentTitle={currentConversation?.title}
                statusPanelData={statusPanelData}
              />

              {/* 输入区域 */}
              <InputArea
                value={inputValue}
                sending={sending}
                selectedFunctions={selectedFunctions}
                allFunctions={allFunctions}
                folders={folders}
                enableLogAnalysis={enableLogAnalysis}
                logDays={logDays}
                mode={mode}
                onValueChange={setInputValue}
                onSend={handleSend}
                onFunctionSelect={handleFunctionSelect}
                onFunctionRemove={handleFunctionRemove}
                onLogAnalysisSelect={handleLogAnalysisSelect}
                onLogAnalysisRemove={handleLogAnalysisRemove}
              />
            </>
          )}
        </div>
      </div>

      {/* 导出对话框 */}
      <ExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        conversationId={currentId || ''}
        conversationTitle={currentConversation?.title}
      />
    </Modal>
  )
}

// 导出类型
export type { AIConversation }
