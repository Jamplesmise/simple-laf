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

// 样式
import styles from './styles.module.css'

export interface AIConversationDialogProps {
  open: boolean
  onClose: () => void
  initialContext?: {
    selectedCode?: string
    functionId?: string
  }
}

export function AIConversationDialog({
  open,
  onClose,
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
      loadFoldersAndFunctions()
      reloadPrompts()
      reloadProviders()
    }
  }, [open, reloadConversations, loadFoldersAndFunctions, reloadPrompts, reloadProviders])

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

    // 清空输入
    setInputValue('')
    setSelectedFunctions([])
    setEnableLogAnalysis(false)

    await sendMessage({
      conversationId: currentId,
      content: inputValue,
      selectedFunctions: selectedFunctionObjects,
      options: {
        systemPromptId: selectedPromptId || undefined,
        modelId: selectedModelId || undefined,
        enableThinking: enableThinking && selectedModel?.supportsThinking,
        analyzeLog: shouldAnalyzeLog,
        logDays: shouldAnalyzeLog ? currentLogDays : undefined,
        initialContext,
      },
    })
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
              />
            </div>
            <button className={styles.closeButton} onClick={onClose}>
              <CloseOutlined />
            </button>
          </div>

          {/* 消息面板 */}
          <MessagePanel
            messages={messages}
            loading={loadingMessages}
            streamContent={streamContent}
            streamStatus={streamStatus}
            currentTitle={currentConversation?.title}
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
            onValueChange={setInputValue}
            onSend={handleSend}
            onFunctionSelect={handleFunctionSelect}
            onFunctionRemove={handleFunctionRemove}
            onLogAnalysisSelect={handleLogAnalysisSelect}
            onLogAnalysisRemove={handleLogAnalysisRemove}
          />
        </div>
      </div>
    </Modal>
  )
}

// 导出类型
export type { AIConversation }
