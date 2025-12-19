import { useState, useCallback, useEffect } from 'react'
import { Tooltip, Modal } from 'antd'
import { Code, Database, Activity, Link, HardDrive } from 'lucide-react'
import Header from '../components/Header'
import FunctionTree from '../components/FunctionTree'
import DependencyPanel from '../components/DependencyPanel'
import Editor from '../components/Editor'
import EditorTabs from '../components/EditorTabs'
import RightPanel from '../components/RightPanel'
import ResultPanel from '../components/ResultPanel'
import ConsolePanel from '../components/ConsolePanel'
import { AIConversationDialog } from '../components/AIConversationDialog'
import GlobalSearch from '../components/GlobalSearch'
import DatabasePanel from '../components/DatabasePanel'
import StoragePanel from '../components/StoragePanel'
import StatisticsPanel from '../components/StatisticsPanel'
import WebhookPanel from '../components/WebhookPanel'
import { useThemeStore } from '../stores/theme'
import { useAIStore } from '../stores/ai'
import { useViewStore, type ViewType } from '../stores/view'
import type { InvokeResult } from '../api/invoke'

export default function IDE() {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  // 当前视图
  const currentView = useViewStore((state) => state.currentView)
  const setView = useViewStore((state) => state.setView)
  const statisticsOpen = useViewStore((state) => state.statisticsOpen)
  const webhooksOpen = useViewStore((state) => state.webhooksOpen)
  const setStatisticsOpen = useViewStore((state) => state.setStatisticsOpen)
  const setWebhooksOpen = useViewStore((state) => state.setWebhooksOpen)

  // Emerald Green 主题色
  const emerald = {
    primary: '#10B981',
    light: '#34D399',
    lighter: '#ECFDF5',
    dark: '#059669',
    surface: 'rgba(16, 185, 129, 0.1)',
  }

  // 主导航项 - 视图切换
  const navItems: { key: ViewType; icon: React.ReactNode; label: string }[] = [
    { key: 'functions', icon: <Code size={20} strokeWidth={2} />, label: '云函数' },
    { key: 'database', icon: <Database size={20} strokeWidth={2} />, label: '集合' },
    { key: 'storage', icon: <HardDrive size={20} strokeWidth={2} />, label: '存储' },
  ]

  // 工具导航项 - 弹窗面板
  const toolItems: { key: string; icon: React.ReactNode; label: string; onClick: () => void }[] = [
    { key: 'statistics', icon: <Activity size={20} strokeWidth={2} />, label: '统计', onClick: () => setStatisticsOpen(true) },
    { key: 'webhooks', icon: <Link size={20} strokeWidth={2} />, label: 'Webhooks', onClick: () => setWebhooksOpen(true) },
  ]

  // AI 对话窗口状态
  const { conversationDialogOpen, conversationContext, closeConversationDialog } = useAIStore()

  // 可调整大小的状态
  const [leftWidth, setLeftWidth] = useState(240)
  const [rightWidth, setRightWidth] = useState(360)
  const [bottomHeight, setBottomHeight] = useState(() => Math.floor((window.innerHeight - 48) / 3))
  const [leftBottomHeight, setLeftBottomHeight] = useState(() => Math.floor((window.innerHeight - 48) / 3))
  // 运行结果面板默认占 1/3 高度
  const [rightBottomHeight, setRightBottomHeight] = useState(() => Math.floor((window.innerHeight - 48) / 3))
  const [isResizing, setIsResizing] = useState<string | null>(null)

  // 折叠状态
  const [bottomCollapsed, setBottomCollapsed] = useState(false)
  const [leftBottomCollapsed, setLeftBottomCollapsed] = useState(false)
  const [rightBottomCollapsed, setRightBottomCollapsed] = useState(false)

  // 保存折叠前的高度
  const [prevBottomHeight, setPrevBottomHeight] = useState(() => Math.floor((window.innerHeight - 48) / 3))
  const [prevLeftBottomHeight, setPrevLeftBottomHeight] = useState(() => Math.floor((window.innerHeight - 48) / 3))
  const [prevRightBottomHeight, setPrevRightBottomHeight] = useState(() => Math.floor((window.innerHeight - 48) / 3))

  // 执行结果状态
  const [result, setResult] = useState<InvokeResult | null>(null)
  const [logs, setLogs] = useState<string[]>([])

  // 全局搜索状态
  const [searchOpen, setSearchOpen] = useState(false)

  // 键盘快捷键: Cmd/Ctrl + K 打开搜索
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleResult = (res: InvokeResult) => {
    setResult(res)
    setLogs(res.logs || [])
  }

  const clearLogs = () => {
    setLogs([])
  }

  // 拖拽调整大小
  const handleMouseDown = useCallback((type: string) => {
    setIsResizing(type)
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isResizing) return

      const mainAreaHeight = window.innerHeight - 48 // 减去顶部栏高度

      if (isResizing === 'left') {
        const newWidth = e.clientX
        setLeftWidth(Math.max(180, Math.min(500, newWidth)))
      } else if (isResizing === 'right') {
        const newWidth = window.innerWidth - e.clientX
        setRightWidth(Math.max(280, Math.min(600, newWidth)))
      } else if (isResizing === 'bottom') {
        const newHeight = window.innerHeight - e.clientY - 48
        // 最小 40px，最大占 80% 主区域高度
        const height = Math.max(40, Math.min(mainAreaHeight * 0.8, newHeight))
        setBottomHeight(height)
        setPrevBottomHeight(height)
        setBottomCollapsed(false)
      } else if (isResizing === 'left-bottom') {
        // 左侧依赖面板高度 (从底部算)
        const leftPanel = document.getElementById('left-panel')
        if (leftPanel) {
          const rect = leftPanel.getBoundingClientRect()
          const newHeight = rect.bottom - e.clientY
          // 最小 40px，最大占 80% 左侧面板高度
          const height = Math.max(40, Math.min(rect.height * 0.8, newHeight))
          setLeftBottomHeight(height)
          setPrevLeftBottomHeight(height)
          setLeftBottomCollapsed(false)
        }
      } else if (isResizing === 'right-middle') {
        // 右侧运行结果面板高度 (从底部算)
        const rightPanel = document.getElementById('right-panel')
        if (rightPanel) {
          const rect = rightPanel.getBoundingClientRect()
          const newHeight = rect.bottom - e.clientY
          // 最小 40px，最大占 80% 右侧面板高度
          const height = Math.max(40, Math.min(rect.height * 0.8, newHeight))
          setRightBottomHeight(height)
          setPrevRightBottomHeight(height)
          setRightBottomCollapsed(false)
        }
      }
    },
    [isResizing]
  )

  // 折叠/展开处理
  const toggleBottomCollapse = useCallback(() => {
    if (bottomCollapsed) {
      setBottomHeight(prevBottomHeight)
    } else {
      setBottomHeight(32) // 折叠后只显示标题栏
    }
    setBottomCollapsed(!bottomCollapsed)
  }, [bottomCollapsed, prevBottomHeight])

  const toggleLeftBottomCollapse = useCallback(() => {
    if (leftBottomCollapsed) {
      setLeftBottomHeight(prevLeftBottomHeight)
    } else {
      setLeftBottomHeight(32)
    }
    setLeftBottomCollapsed(!leftBottomCollapsed)
  }, [leftBottomCollapsed, prevLeftBottomHeight])

  const toggleRightBottomCollapse = useCallback(() => {
    if (rightBottomCollapsed) {
      setRightBottomHeight(prevRightBottomHeight)
    } else {
      setRightBottomHeight(32)
    }
    setRightBottomCollapsed(!rightBottomCollapsed)
  }, [rightBottomCollapsed, prevRightBottomHeight])

  const handleMouseUp = useCallback(() => {
    setIsResizing(null)
  }, [])

  // 拖拽手柄样式
  const resizeHandle = (direction: 'vertical' | 'horizontal', key: string) => ({
    width: direction === 'vertical' ? 4 : '100%',
    height: direction === 'horizontal' ? 4 : '100%',
    cursor: direction === 'vertical' ? 'col-resize' : 'row-resize',
    background: isResizing === key ? emerald.primary : 'transparent',
    transition: 'background 0.15s',
    flexShrink: 0,
  })

  return (
    <div
      style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 顶部栏 */}
      <div style={{ height: 48, flexShrink: 0 }}>
        <Header />
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 最左侧导航栏 */}
        <div
          style={{
            width: 52,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 12,
            background: isDark ? '#1a1a1a' : '#FFFFFF',
            borderRight: `1px solid ${isDark ? '#2d2d2d' : '#E5E7EB'}`,
          }}
        >
          {/* 主视图导航 */}
          {navItems.map((item) => {
            const isActive = currentView === item.key
            return (
              <Tooltip key={item.key} title={item.label} placement="right">
                <div
                  onClick={() => setView(item.key)}
                  style={{
                    width: 38,
                    height: 38,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    cursor: 'pointer',
                    marginBottom: 6,
                    color: isActive
                      ? emerald.primary
                      : (isDark ? '#71717A' : '#9CA3AF'),
                    background: isActive
                      ? (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)')
                      : 'transparent',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
                      e.currentTarget.style.color = isDark ? '#A1A1AA' : '#6B7280'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = isDark ? '#71717A' : '#9CA3AF'
                    }
                  }}
                >
                  {item.icon}
                </div>
              </Tooltip>
            )
          })}

          {/* 分隔线 */}
          <div style={{
            width: 24,
            height: 1,
            background: isDark ? '#2d2d2d' : '#E5E7EB',
            margin: '6px 0 12px',
          }} />

          {/* 工具面板入口 */}
          {toolItems.map((item) => (
            <Tooltip key={item.key} title={item.label} placement="right">
              <div
                onClick={item.onClick}
                style={{
                  width: 38,
                  height: 38,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  cursor: 'pointer',
                  marginBottom: 6,
                  color: isDark ? '#71717A' : '#9CA3AF',
                  background: 'transparent',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
                  e.currentTarget.style.color = isDark ? '#A1A1AA' : '#6B7280'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = isDark ? '#71717A' : '#9CA3AF'
                }}
              >
                {item.icon}
              </div>
            </Tooltip>
          ))}
        </div>

        {/* 数据库视图 */}
        {currentView === 'database' && (
          <DatabasePanel />
        )}

        {/* 存储视图 */}
        {currentView === 'storage' && (
          <StoragePanel />
        )}

        {/* 云函数视图 */}
        {currentView === 'functions' && (
          <>
        {/* 左侧边栏：函数列表 + 依赖 */}
        <div
          id="left-panel"
          style={{
            width: leftWidth,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            background: isDark ? '#1a1a1a' : '#fff',
            borderRight: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
          }}
        >
          {/* 函数树 */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <FunctionTree />
          </div>

          {/* 左侧依赖面板拖拽手柄 */}
          <div
            style={{
              ...resizeHandle('horizontal', 'left-bottom'),
            }}
            onMouseDown={() => handleMouseDown('left-bottom')}
            onMouseEnter={(e) => (e.currentTarget.style.background = emerald.primary)}
            onMouseLeave={(e) => {
              if (isResizing !== 'left-bottom') e.currentTarget.style.background = 'transparent'
            }}
          />

          {/* 依赖面板 */}
          <div
            style={{
              height: leftBottomHeight,
              flexShrink: 0,
              overflow: 'auto',
              borderTop: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
            }}
          >
            <DependencyPanel collapsed={leftBottomCollapsed} onToggle={toggleLeftBottomCollapse} />
          </div>

        </div>

        {/* 左侧拖拽手柄 */}
        <div
          style={resizeHandle('vertical', 'left')}
          onMouseDown={() => handleMouseDown('left')}
          onMouseEnter={(e) => (e.currentTarget.style.background = emerald.primary)}
          onMouseLeave={(e) => {
            if (isResizing !== 'left') e.currentTarget.style.background = 'transparent'
          }}
        />

        {/* 中间：编辑器 + Console */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* 编辑器标签页 */}
          <EditorTabs />

          {/* 编辑器 */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <Editor />
          </div>

          {/* 底部拖拽手柄 */}
          <div
            style={resizeHandle('horizontal', 'bottom')}
            onMouseDown={() => handleMouseDown('bottom')}
            onMouseEnter={(e) => (e.currentTarget.style.background = emerald.primary)}
            onMouseLeave={(e) => {
              if (isResizing !== 'bottom') e.currentTarget.style.background = 'transparent'
            }}
          />

          {/* Console */}
          <div
            style={{
              height: bottomHeight,
              flexShrink: 0,
              background: isDark ? '#1a1a1a' : '#fff',
            }}
          >
            <ConsolePanel logs={logs} onClear={clearLogs} collapsed={bottomCollapsed} onToggle={toggleBottomCollapse} />
          </div>
        </div>

        {/* 右侧拖拽手柄 */}
        <div
          style={resizeHandle('vertical', 'right')}
          onMouseDown={() => handleMouseDown('right')}
          onMouseEnter={(e) => (e.currentTarget.style.background = emerald.primary)}
          onMouseLeave={(e) => {
            if (isResizing !== 'right') e.currentTarget.style.background = 'transparent'
          }}
        />

        {/* 右侧：调试面板 + 运行结果 */}
        <div
          id="right-panel"
          style={{
            width: rightWidth,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            background: isDark ? '#1a1a1a' : '#fff',
            borderLeft: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
          }}
        >
          {/* 接口调试 / 版本历史 */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <RightPanel onResult={handleResult} />
          </div>

          {/* 右侧中间拖拽手柄 */}
          <div
            style={resizeHandle('horizontal', 'right-middle')}
            onMouseDown={() => handleMouseDown('right-middle')}
            onMouseEnter={(e) => (e.currentTarget.style.background = emerald.primary)}
            onMouseLeave={(e) => {
              if (isResizing !== 'right-middle') e.currentTarget.style.background = 'transparent'
            }}
          />

          {/* 运行结果 */}
          <div
            style={{
              height: rightBottomHeight,
              flexShrink: 0,
              overflow: 'hidden',
              borderTop: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
            }}
          >
            <ResultPanel result={result} collapsed={rightBottomCollapsed} onToggle={toggleRightBottomCollapse} />
          </div>
        </div>
          </>
        )}
      </div>

      {/* AI 对话窗口 */}
      <AIConversationDialog
        open={conversationDialogOpen}
        onClose={closeConversationDialog}
        initialContext={conversationContext || undefined}
      />

      {/* 全局搜索 */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* 统计面板 */}
      <Modal
        title="执行统计"
        open={statisticsOpen}
        onCancel={() => setStatisticsOpen(false)}
        footer={null}
        width={800}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
          <StatisticsPanel />
        </div>
      </Modal>

      {/* Webhook 面板 */}
      <WebhookPanel open={webhooksOpen} onClose={() => setWebhooksOpen(false)} />
    </div>
  )
}
