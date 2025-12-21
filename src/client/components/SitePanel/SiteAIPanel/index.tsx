import { useState } from 'react'
import { useThemeStore } from '@/stores/theme'
import SiteAIConfig from '../SiteAIConfig'
import HeaderBar from './HeaderBar'
import ActionButtons from './ActionButtons'
import OutputArea from './OutputArea'
import InputArea from './InputArea'
import { useAIConfig } from './hooks/useAIConfig'
import { useAutoScroll } from './hooks/useAutoScroll'
import { useSiteAI } from './hooks/useSiteAI'
import { ACTION_BUTTONS } from './constants'

export default function SiteAIPanel() {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  const [configOpen, setConfigOpen] = useState(false)

  // AI 配置
  const { aiConfig, modelName, isConfigured, handleConfigChange } = useAIConfig()

  // 站点 AI 逻辑
  const {
    prompt,
    setPrompt,
    action,
    handleActionChange,
    isGenerating,
    currentOutput,
    generateError,
    executeState,
    handleSend,
    handleKeyDown,
    clearOutput,
    clearExecuteState,
  } = useSiteAI({
    aiConfig,
    onConfigOpen: () => setConfigOpen(true),
  })

  // 自动滚动
  const outputRef = useAutoScroll([currentOutput, executeState])

  const currentAction = ACTION_BUTTONS.find(a => a.key === action)!

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: isDark ? '#141414' : '#fff',
      borderLeft: `1px solid ${isDark ? '#303030' : '#e5e7eb'}`,
    }}>
      {/* 标题栏 */}
      <HeaderBar
        isDark={isDark}
        modelName={modelName}
        enableThinking={aiConfig.enableThinking}
        onConfigOpen={() => setConfigOpen(true)}
      />

      {/* 快捷操作 */}
      <ActionButtons
        isDark={isDark}
        currentAction={action}
        onActionChange={handleActionChange}
      />

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
        <OutputArea
          isDark={isDark}
          isConfigured={isConfigured}
          currentOutput={currentOutput}
          isGenerating={isGenerating}
          generateError={generateError}
          executeState={executeState}
          placeholder={currentAction.placeholder}
          onConfigOpen={() => setConfigOpen(true)}
        />
      </div>

      {/* 输入区域 */}
      <InputArea
        isDark={isDark}
        prompt={prompt}
        placeholder={currentAction.placeholder}
        isGenerating={isGenerating}
        isConfigured={isConfigured}
        hasOutput={Boolean(currentOutput || executeState.status)}
        onPromptChange={setPrompt}
        onKeyDown={handleKeyDown}
        onSend={handleSend}
        onClear={() => {
          clearOutput()
          clearExecuteState()
        }}
      />

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
