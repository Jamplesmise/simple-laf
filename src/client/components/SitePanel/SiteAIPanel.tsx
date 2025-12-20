import { useState, useRef, useEffect } from 'react'
import { Input, Button, message, Spin, Empty, Tooltip } from 'antd'
import {
  SendOutlined,
  ClearOutlined,
  RobotOutlined,
  Html5Outlined,
  FileTextOutlined,
  AppstoreOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  BulbOutlined,
} from '@ant-design/icons'
import { useThemeStore } from '../../stores/theme'
import { useAIStore } from '../../stores/ai'
import { useSiteStore } from '../../stores/site'
import SiteAIConfig, { type SiteAIConfigValue } from './SiteAIConfig'
import { aiProviderApi, aiModelApi } from '@/api/aiProvider'

const { TextArea } = Input

type SiteAIAction = 'create-page' | 'create-component' | 'create-site'

interface ActionButton {
  key: SiteAIAction
  icon: React.ReactNode
  label: string
  placeholder: string
}

export default function SiteAIPanel() {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  const { files, fetchFiles } = useSiteStore()
  const {
    isGenerating,
    currentOutput,
    generateError,
    executeState,
    executeAction,
    clearOutput,
    clearExecuteState,
  } = useAIStore()

  const [prompt, setPrompt] = useState('')
  const [action, setAction] = useState<SiteAIAction>('create-page')
  const [configOpen, setConfigOpen] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)

  // AI 配置
  const [aiConfig, setAiConfig] = useState<SiteAIConfigValue>({
    providerId: null,
    modelId: null,
    enableThinking: false,
    systemPromptId: null,
  })

  // 当前选中的模型名称（用于显示）
  const [modelName, setModelName] = useState<string>('')

  // 加载默认配置
  useEffect(() => {
    const loadDefaultConfig = async () => {
      try {
        // 加载供应商
        const providerRes = await aiProviderApi.list()
        const providers = providerRes.data.data || []
        const defaultProvider = providers.find(p => p.isDefault) || providers[0]

        if (defaultProvider) {
          // 加载模型
          const modelRes = await aiModelApi.list(defaultProvider._id)
          const models = modelRes.data.data || []
          const defaultModel = models.find(m => m.isDefault) || models[0]

          setAiConfig(prev => ({
            ...prev,
            providerId: defaultProvider._id,
            modelId: defaultModel?._id || null,
          }))

          if (defaultModel) {
            setModelName(defaultModel.alias || defaultModel.name)
          }
        }
      } catch {
        // 静默失败
      }
    }

    loadDefaultConfig()
  }, [])

  // 配置变化时更新模型名称
  const handleConfigChange = async (newConfig: SiteAIConfigValue) => {
    setAiConfig(newConfig)

    if (newConfig.modelId && newConfig.providerId) {
      try {
        const res = await aiModelApi.list(newConfig.providerId)
        const models = res.data.data || []
        const model = models.find(m => m._id === newConfig.modelId)
        if (model) {
          setModelName(model.alias || model.name)
        }
      } catch {
        // 静默失败
      }
    }
  }

  // 自动滚动到底部
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [currentOutput, executeState])

  // 构建站点文件列表描述
  const buildSiteFilesContext = () => {
    if (files.length === 0) return ''

    const fileList = files.map(f =>
      `- ${f.path} (${f.isDirectory ? '目录' : '文件'})`
    ).join('\n')

    return `\n\n当前站点文件列表：\n${fileList}`
  }

  const handleSend = async () => {
    if (!prompt.trim()) {
      message.warning('请输入描述')
      return
    }

    if (!aiConfig.providerId || !aiConfig.modelId) {
      message.warning('请先配置 AI 供应商和模型')
      setConfigOpen(true)
      return
    }

    clearOutput()
    clearExecuteState()

    // 根据操作类型构建提示词
    const siteFilesContext = buildSiteFilesContext()
    let fullPrompt = prompt

    switch (action) {
      case 'create-page':
        fullPrompt = `创建一个网页文件。用户需求：${prompt}\n\n请使用 siteCreateFile 操作创建 HTML 文件，如果需要的话也创建对应的 CSS 和 JS 文件。${siteFilesContext}`
        break
      case 'create-component':
        fullPrompt = `创建一个前端组件。用户需求：${prompt}\n\n请使用 siteCreateFile 操作创建相关文件（HTML/CSS/JS）。${siteFilesContext}`
        break
      case 'create-site':
        fullPrompt = `创建一个完整的静态网站。用户需求：${prompt}\n\n请使用 siteCreateFile 和 siteCreateFolder 操作创建网站结构，包括 index.html、样式文件、脚本文件等。${siteFilesContext}`
        break
    }

    const success = await executeAction(fullPrompt, {
      modelId: aiConfig.modelId,
      enableThinking: aiConfig.enableThinking,
    })

    if (success) {
      // 刷新文件列表
      await fetchFiles()
      message.success('操作完成')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const actionButtons: ActionButton[] = [
    {
      key: 'create-page',
      icon: <Html5Outlined />,
      label: '创建页面',
      placeholder: '描述你想要的页面，如：一个登录页面，包含用户名密码输入框...',
    },
    {
      key: 'create-component',
      icon: <FileTextOutlined />,
      label: '创建组件',
      placeholder: '描述你想要的组件，如：一个轮播图组件...',
    },
    {
      key: 'create-site',
      icon: <AppstoreOutlined />,
      label: '创建网站',
      placeholder: '描述你想要的网站，如：一个产品展示网站，包含首页、关于我们、联系方式...',
    },
  ]

  const currentAction = actionButtons.find(a => a.key === action)!

  // 是否已配置
  const isConfigured = aiConfig.providerId && aiConfig.modelId

  // 渲染执行状态
  const renderExecuteState = () => {
    if (!executeState.status) return null

    return (
      <div style={{ marginTop: 12 }}>
        {/* 思考过程 */}
        {executeState.thinking && (
          <div style={{
            padding: 12,
            background: isDark ? '#1a2633' : '#e6f7ff',
            borderRadius: 8,
            marginBottom: 8,
            fontSize: 13,
            color: isDark ? '#69c0ff' : '#1890ff',
          }}>
            <strong>思考：</strong>{executeState.thinking}
          </div>
        )}

        {/* 操作列表 */}
        {executeState.operations.length > 0 && (
          <div style={{
            padding: 12,
            background: isDark ? '#1a1a1a' : '#fafafa',
            borderRadius: 8,
            marginBottom: 8,
          }}>
            <div style={{ fontWeight: 500, marginBottom: 8, color: isDark ? '#e0e0e0' : '#333' }}>
              计划执行的操作：
            </div>
            {executeState.operations.map((op, i) => (
              <div key={i} style={{
                padding: '4px 8px',
                fontSize: 12,
                color: isDark ? '#aaa' : '#666',
              }}>
                {i + 1}. [{op.type}] {op.description}
              </div>
            ))}
          </div>
        )}

        {/* 执行结果 */}
        {executeState.results.length > 0 && (
          <div style={{
            padding: 12,
            background: isDark ? '#162312' : '#f6ffed',
            borderRadius: 8,
            border: `1px solid ${isDark ? '#274916' : '#b7eb8f'}`,
          }}>
            <div style={{ fontWeight: 500, marginBottom: 8, color: isDark ? '#95de64' : '#52c41a' }}>
              执行结果：
            </div>
            {executeState.results.map((result, i) => (
              <div key={i} style={{
                padding: '4px 8px',
                fontSize: 12,
                color: result.success ? (isDark ? '#95de64' : '#52c41a') : (isDark ? '#ff7875' : '#ff4d4f'),
              }}>
                {result.success ? '✓' : '✗'} {result.type}: {result.result?.name || result.error}
              </div>
            ))}
          </div>
        )}

        {/* 摘要 */}
        {executeState.summary && executeState.status === 'done' && (
          <div style={{
            marginTop: 8,
            padding: 8,
            fontSize: 13,
            color: isDark ? '#aaa' : '#666',
            textAlign: 'center',
          }}>
            {executeState.summary}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: isDark ? '#141414' : '#fff',
      borderLeft: `1px solid ${isDark ? '#303030' : '#e5e7eb'}`,
    }}>
      {/* 标题栏 */}
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RobotOutlined style={{ fontSize: 16, color: '#00a9a6' }} />
          <span style={{ fontWeight: 500, fontSize: 14, color: isDark ? '#e0e0e0' : '#333' }}>
            AI 建站助手
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* 当前模型显示 */}
          {modelName && (
            <Tooltip title="当前模型">
              <span style={{
                fontSize: 11,
                color: isDark ? '#888' : '#666',
                background: isDark ? '#262626' : '#f5f5f5',
                padding: '2px 8px',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <ThunderboltOutlined style={{ fontSize: 10 }} />
                {modelName}
              </span>
            </Tooltip>
          )}
          {/* 思考模式指示 */}
          {aiConfig.enableThinking && (
            <Tooltip title="深度思考已启用">
              <span style={{
                fontSize: 11,
                color: '#faad14',
                background: isDark ? '#3d3012' : '#fffbe6',
                padding: '2px 8px',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <BulbOutlined style={{ fontSize: 10 }} />
                思考
              </span>
            </Tooltip>
          )}
          {/* 配置按钮 */}
          <Tooltip title="AI 配置">
            <Button
              type="text"
              size="small"
              icon={<SettingOutlined />}
              onClick={() => setConfigOpen(true)}
              style={{ color: isDark ? '#888' : '#666' }}
            />
          </Tooltip>
        </div>
      </div>

      {/* 快捷操作 */}
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
      }}>
        {actionButtons.map(btn => (
          <Button
            key={btn.key}
            type={action === btn.key ? 'primary' : 'default'}
            size="small"
            icon={btn.icon}
            onClick={() => { setAction(btn.key); clearOutput(); clearExecuteState(); }}
            style={{
              borderRadius: 16,
              background: action === btn.key ? '#00a9a6' : undefined,
              borderColor: action === btn.key ? '#00a9a6' : undefined,
            }}
          >
            {btn.label}
          </Button>
        ))}
      </div>

      {/* 输出区域 */}
      <div
        ref={outputRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 16,
          background: isDark ? '#1a1a1a' : '#fafafa',
        }}
      >
        {!isConfigured ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ color: isDark ? '#666' : '#999' }}>
                请先配置 AI 供应商和模型
              </span>
            }
          >
            <Button
              type="primary"
              size="small"
              onClick={() => setConfigOpen(true)}
              style={{ background: '#00a9a6', borderColor: '#00a9a6' }}
            >
              前往配置
            </Button>
          </Empty>
        ) : !currentOutput && !isGenerating && !generateError && !executeState.status ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ color: isDark ? '#666' : '#999' }}>
                {currentAction.placeholder}
              </span>
            }
          />
        ) : (
          <div>
            {isGenerating && !currentOutput && !executeState.status && (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Spin />
                <div style={{ marginTop: 8, color: isDark ? '#666' : '#999', fontSize: 12 }}>
                  AI 正在思考...
                </div>
              </div>
            )}

            {executeState.status && executeState.status !== 'done' && executeState.status !== 'error' && (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Spin />
                <div style={{ marginTop: 8, color: isDark ? '#666' : '#999', fontSize: 12 }}>
                  {executeState.message || 'AI 正在处理...'}
                </div>
              </div>
            )}

            {currentOutput && (
              <pre style={{
                margin: 0,
                padding: 12,
                background: isDark ? '#141414' : '#fff',
                borderRadius: 8,
                border: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
                fontSize: 13,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: isDark ? '#e0e0e0' : '#333',
                fontFamily: 'Menlo, Monaco, Consolas, monospace',
              }}>
                {currentOutput}
                {isGenerating && <span className="cursor-blink">|</span>}
              </pre>
            )}

            {renderExecuteState()}

            {generateError && (
              <div style={{
                padding: 12,
                background: isDark ? '#2a1215' : '#fff2f0',
                border: `1px solid ${isDark ? '#58181c' : '#ffccc7'}`,
                borderRadius: 8,
                color: isDark ? '#ff7875' : '#ff4d4f',
                fontSize: 13,
                marginTop: 12,
              }}>
                {generateError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div style={{
        padding: 12,
        borderTop: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
        background: isDark ? '#141414' : '#fff',
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <TextArea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentAction.placeholder}
            autoSize={{ minRows: 2, maxRows: 4 }}
            disabled={isGenerating}
            style={{
              flex: 1,
              borderRadius: 8,
              resize: 'none',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={isGenerating}
              disabled={!isConfigured}
              style={{
                borderRadius: 8,
                background: '#00a9a6',
                borderColor: '#00a9a6',
              }}
            />
            {(currentOutput || executeState.status) && (
              <Button
                type="text"
                icon={<ClearOutlined />}
                onClick={() => { clearOutput(); clearExecuteState(); }}
                size="small"
                style={{ color: isDark ? '#666' : '#999' }}
              />
            )}
          </div>
        </div>
      </div>

      {/* AI 配置弹窗 */}
      <SiteAIConfig
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        value={aiConfig}
        onChange={handleConfigChange}
      />

      {/* 光标闪烁动画 */}
      <style>{`
        .cursor-blink {
          animation: blink 1s infinite;
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
