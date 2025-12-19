import { useState, useRef, useEffect } from 'react'
import { Input, Button, message, Spin, Empty } from 'antd'
import { SendOutlined, ClearOutlined, RobotOutlined, CodeOutlined, BugOutlined, SplitCellsOutlined, SettingOutlined } from '@ant-design/icons'
import { useThemeStore } from '../stores/theme'
import { useAIStore } from '../stores/ai'
import { useFunctionStore } from '../stores/function'
import SettingsModal from './SettingsModal'

const { TextArea } = Input

type AIAction = 'generate' | 'refactor' | 'diagnose'

export default function AIPanel() {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  const { current } = useFunctionStore()
  const {
    config,
    isGenerating,
    currentOutput,
    generateError,
    generateFunction,
    refactorFunction,
    diagnoseError,
    clearOutput,
    loadConfig,
  } = useAIStore()

  const [prompt, setPrompt] = useState('')
  const [action, setAction] = useState<AIAction>('generate')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)

  // 加载配置
  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  // 自动滚动到底部
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [currentOutput])

  const handleSend = async () => {
    if (!prompt.trim() && action === 'generate') {
      message.warning('请输入描述')
      return
    }

    if (!config) {
      message.warning('请先配置 AI 设置')
      setSettingsOpen(true)
      return
    }

    clearOutput()

    switch (action) {
      case 'generate':
        await generateFunction(prompt)
        break
      case 'refactor':
        if (!current?.code) {
          message.warning('请先选择一个函数')
          return
        }
        await refactorFunction(current.code, current.name)
        break
      case 'diagnose':
        if (!current?.code) {
          message.warning('请先选择一个函数')
          return
        }
        if (!prompt.trim()) {
          message.warning('请输入错误信息')
          return
        }
        await diagnoseError(current.code, prompt)
        break
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const actionButtons = [
    { key: 'generate', icon: <CodeOutlined />, label: '生成函数', placeholder: '描述你想要的函数功能...' },
    { key: 'refactor', icon: <SplitCellsOutlined />, label: '解耦分析', placeholder: '分析当前函数并给出拆分建议' },
    { key: 'diagnose', icon: <BugOutlined />, label: '错误诊断', placeholder: '输入错误信息，AI 将分析原因...' },
  ]

  const currentAction = actionButtons.find(a => a.key === action)!

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: isDark ? '#141414' : '#fff',
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
            AI 助手
          </span>
          {config && (
            <span style={{ fontSize: 11, color: isDark ? '#666' : '#999', marginLeft: 4 }}>
              {config.model}
            </span>
          )}
        </div>
        <Button
          type="text"
          size="small"
          icon={<SettingOutlined />}
          onClick={() => setSettingsOpen(true)}
          style={{ color: isDark ? '#888' : '#666' }}
        />
      </div>

      {/* 快捷操作 */}
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
        display: 'flex',
        gap: 8,
      }}>
        {actionButtons.map(btn => (
          <Button
            key={btn.key}
            type={action === btn.key ? 'primary' : 'default'}
            size="small"
            icon={btn.icon}
            onClick={() => { setAction(btn.key as AIAction); clearOutput(); }}
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
        {!config ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ color: isDark ? '#666' : '#999' }}>
                请先配置 AI 设置
              </span>
            }
          >
            <Button type="primary" size="small" onClick={() => setSettingsOpen(true)} style={{ background: '#00a9a6', borderColor: '#00a9a6' }}>
              前往设置
            </Button>
          </Empty>
        ) : !currentOutput && !isGenerating && !generateError ? (
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
            {isGenerating && !currentOutput && (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Spin />
                <div style={{ marginTop: 8, color: isDark ? '#666' : '#999', fontSize: 12 }}>
                  AI 正在思考...
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

            {generateError && (
              <div style={{
                padding: 12,
                background: isDark ? '#2a1215' : '#fff2f0',
                border: `1px solid ${isDark ? '#58181c' : '#ffccc7'}`,
                borderRadius: 8,
                color: isDark ? '#ff7875' : '#ff4d4f',
                fontSize: 13,
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
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={isGenerating || (action === 'refactor')}
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
              disabled={!config}
              style={{
                borderRadius: 8,
                background: '#00a9a6',
                borderColor: '#00a9a6',
              }}
            />
            {currentOutput && (
              <Button
                type="text"
                icon={<ClearOutlined />}
                onClick={clearOutput}
                size="small"
                style={{ color: isDark ? '#666' : '#999' }}
              />
            )}
          </div>
        </div>
        {action === 'refactor' && (
          <div style={{ marginTop: 8, fontSize: 11, color: isDark ? '#666' : '#999' }}>
            将分析当前函数 {current?.name ? `"${current.name}"` : '(请先选择函数)'}
          </div>
        )}
      </div>

      {/* 设置弹窗 */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        defaultTab="ai"
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
