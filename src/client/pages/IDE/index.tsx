import { useState } from 'react'
import { Modal } from 'antd'
import Header from '../../components/Header'
import DatabasePanel from '../../components/DatabasePanel'
import StoragePanel from '../../components/StoragePanel'
import SitePanel from '../../components/SitePanel'
import StatisticsPanel from '../../components/StatisticsPanel'
import WebhookPanel from '../../components/WebhookPanel'
import { AIConversationDialog } from '../../components/AIConversationDialog'
import GlobalSearch from '../../components/GlobalSearch'
import { useAIStore } from '../../stores/ai'
import { useViewStore } from '../../stores/view'
import Sidebar from './Sidebar'
import FunctionsView from './FunctionsView'
import { useResizable } from './hooks/useResizable'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import type { InvokeResult } from '../../api/invoke'

export default function IDE() {
  const currentView = useViewStore((state) => state.currentView)
  const statisticsOpen = useViewStore((state) => state.statisticsOpen)
  const webhooksOpen = useViewStore((state) => state.webhooksOpen)
  const setStatisticsOpen = useViewStore((state) => state.setStatisticsOpen)
  const setWebhooksOpen = useViewStore((state) => state.setWebhooksOpen)

  const { conversationDialogOpen, conversationContext, closeConversationDialog } = useAIStore()

  const resizable = useResizable()

  const [result, setResult] = useState<InvokeResult | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [searchOpen, setSearchOpen] = useState(false)

  useKeyboardShortcuts(() => setSearchOpen(true))

  const handleResult = (res: InvokeResult) => {
    setResult(res)
    setLogs(res.logs || [])
  }

  const clearLogs = () => {
    setLogs([])
  }

  return (
    <div
      style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}
      onMouseMove={resizable.handleMouseMove}
      onMouseUp={resizable.handleMouseUp}
      onMouseLeave={resizable.handleMouseUp}
    >
      {/* 顶部栏 */}
      <div style={{ height: 48, flexShrink: 0 }}>
        <Header />
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 最左侧导航栏 */}
        <Sidebar
          onStatisticsOpen={() => setStatisticsOpen(true)}
          onWebhooksOpen={() => setWebhooksOpen(true)}
        />

        {/* 数据库视图 */}
        {currentView === 'database' && <DatabasePanel />}

        {/* 存储视图 */}
        {currentView === 'storage' && <StoragePanel />}

        {/* 站点视图 */}
        {currentView === 'site' && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <SitePanel />
          </div>
        )}

        {/* 云函数视图 */}
        {currentView === 'functions' && (
          <FunctionsView
            {...resizable}
            result={result}
            logs={logs}
            onResult={handleResult}
            onClearLogs={clearLogs}
          />
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
