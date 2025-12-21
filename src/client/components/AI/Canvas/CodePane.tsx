/**
 * CodePane - Canvas 模式右侧代码编辑面板
 *
 * 显示选中函数的代码，支持实时编辑
 * Sprint 11.2: 版本历史和 Diff 对比功能
 */

import { useState, useEffect, useCallback } from 'react'
import {
  CodeOutlined,
  FileTextOutlined,
  SaveOutlined,
  DiffOutlined,
  CheckOutlined,
} from '@ant-design/icons'
import { Button, message, Tooltip } from 'antd'
import MonacoEditor from '@monaco-editor/react'
import { useThemeColors } from '@/hooks/useTheme'
import { functionApi } from '@/api/functions'
import { aiConversationApi } from '@/api/aiConversation'
import type { SnapshotListItem, DiffResult } from '@/api/aiConversation'
import { VersionHistory } from './VersionHistory'
import { DiffView } from './DiffView'
import { QuickActions } from './QuickActions'
import styles from './styles.module.css'

interface CodePaneProps {
  /** 对话 ID */
  conversationId?: string
  /** 当前选中的函数ID */
  functionId?: string
  /** 代码变更回调 */
  onCodeChange?: (code: string) => void
  /** AI 生成的代码（用于自动同步） */
  aiGeneratedCode?: string
  /** 快捷操作回调（Sprint 11.3） */
  onQuickAction?: (prompt: string) => void
  /** 是否正在发送消息 */
  sending?: boolean
}

export function CodePane({
  conversationId,
  functionId,
  onCodeChange,
  aiGeneratedCode,
  onQuickAction,
  sending,
}: CodePaneProps) {
  const { isDark } = useThemeColors()
  const [code, setCode] = useState('')
  const [originalCode, setOriginalCode] = useState('')
  const [functionName, setFunctionName] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // 版本历史状态
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | undefined>()

  // Diff 视图状态
  const [showDiff, setShowDiff] = useState(false)
  const [diffStats, setDiffStats] = useState<DiffResult['stats'] | undefined>()

  // 加载函数代码
  const loadFunctionCode = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await functionApi.get(id)
      if (res.data.success && res.data.data) {
        const funcCode = res.data.data.code || ''
        setCode(funcCode)
        setOriginalCode(funcCode)
        setFunctionName(res.data.data.name || '')
      }
    } catch {
      // 静默处理错误
    } finally {
      setLoading(false)
    }
  }, [])

  // 当 functionId 变化时加载代码
  useEffect(() => {
    if (functionId) {
      loadFunctionCode(functionId)
      setSelectedSnapshotId(undefined)
      setShowDiff(false)
    } else {
      setCode('')
      setOriginalCode('')
      setFunctionName('')
    }
  }, [functionId, loadFunctionCode])

  // 当 AI 生成代码时自动同步
  useEffect(() => {
    if (aiGeneratedCode && aiGeneratedCode !== code) {
      setCode(aiGeneratedCode)
      onCodeChange?.(aiGeneratedCode)
      // 自动计算 Diff
      if (originalCode) {
        calculateDiffStats(originalCode, aiGeneratedCode)
      }
    }
  }, [aiGeneratedCode])

  // 计算 Diff 统计
  const calculateDiffStats = useCallback(async (before: string, after: string) => {
    try {
      const res = await aiConversationApi.calculateDiff(before, after)
      if (res.data.success) {
        setDiffStats(res.data.data.stats)
      }
    } catch {
      // 静默处理
    }
  }, [])

  // 处理代码变更
  const handleCodeChange = useCallback((value: string | undefined) => {
    const newCode = value || ''
    setCode(newCode)
    onCodeChange?.(newCode)
    // 计算 Diff
    if (originalCode && newCode !== originalCode) {
      calculateDiffStats(originalCode, newCode)
    } else {
      setDiffStats(undefined)
    }
  }, [onCodeChange, originalCode, calculateDiffStats])

  // 选择快照版本
  const handleSelectSnapshot = useCallback(async (snapshot: SnapshotListItem | null) => {
    if (!snapshot) {
      // 切换回当前版本
      setSelectedSnapshotId(undefined)
      if (functionId) {
        await loadFunctionCode(functionId)
      }
      return
    }

    setSelectedSnapshotId(snapshot.id)
    try {
      const res = await aiConversationApi.getSnapshot(snapshot.id)
      if (res.data.success) {
        setCode(res.data.data.code)
      }
    } catch {
      message.error('加载版本失败')
    }
  }, [functionId, loadFunctionCode])

  // 对比快照
  const handleCompareSnapshot = useCallback(async (snapshotId: string) => {
    try {
      const res = await aiConversationApi.compareSnapshots(snapshotId)
      if (res.data.success) {
        setDiffStats(res.data.data.diff.stats)
        setShowDiff(true)
      }
    } catch {
      message.error('对比失败')
    }
  }, [])

  // 保存快照
  const handleSaveSnapshot = useCallback(async () => {
    if (!conversationId || !code) return

    setSaving(true)
    try {
      const res = await aiConversationApi.createSnapshot(conversationId, {
        functionId,
        code,
        language: 'typescript',
        description: `保存于 ${new Date().toLocaleTimeString()}`,
      })
      if (res.data.success) {
        message.success(`已保存为 v${res.data.data.version}`)
      }
    } catch {
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }, [conversationId, functionId, code])

  // 应用代码到函数
  const handleApplyCode = useCallback(async () => {
    if (!functionId || !code) return

    setSaving(true)
    try {
      await functionApi.update(functionId, code)
      setOriginalCode(code)
      setDiffStats(undefined)
      message.success('代码已保存到函数')
    } catch {
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }, [functionId, code])

  // 空状态
  if (!functionId) {
    return (
      <div className={styles.codePaneEmpty}>
        <FileTextOutlined className={styles.codePaneEmptyIcon} />
        <span className={styles.codePaneEmptyText}>
          选择一个函数开始编辑
        </span>
      </div>
    )
  }

  // 是否有未保存的更改
  const hasChanges = code !== originalCode

  return (
    <>
      {/* 头部 */}
      <div className={styles.codePaneHeader}>
        <div className={styles.codePaneTitle}>
          <CodeOutlined className={styles.codePaneIcon} />
          <span>{functionName || '加载中...'}</span>
          {hasChanges && <span className={styles.unsavedDot} />}
        </div>

        <div className={styles.codePaneActions}>
          {/* Diff 统计 */}
          {diffStats && (diffStats.added > 0 || diffStats.removed > 0) && (
            <div className={styles.diffStatsInline}>
              <span className={styles.diffStatAddedInline}>+{diffStats.added}</span>
              <span className={styles.diffStatRemovedInline}>-{diffStats.removed}</span>
            </div>
          )}

          {/* Diff 切换 */}
          <Tooltip title={showDiff ? '显示编辑器' : '显示对比'}>
            <Button
              type="text"
              size="small"
              icon={<DiffOutlined />}
              onClick={() => setShowDiff(!showDiff)}
              disabled={!hasChanges}
            />
          </Tooltip>

          {/* 保存快照 */}
          {conversationId && (
            <Tooltip title="保存版本">
              <Button
                type="text"
                size="small"
                icon={<SaveOutlined />}
                onClick={handleSaveSnapshot}
                loading={saving}
              />
            </Tooltip>
          )}

          {/* 应用代码 */}
          <Tooltip title="保存到函数">
            <Button
              type="text"
              size="small"
              icon={<CheckOutlined />}
              onClick={handleApplyCode}
              disabled={!hasChanges}
              loading={saving}
            />
          </Tooltip>

          {/* 版本历史 */}
          {conversationId && (
            <VersionHistory
              conversationId={conversationId}
              selectedSnapshotId={selectedSnapshotId}
              onSelectSnapshot={handleSelectSnapshot}
              onCompareSnapshot={handleCompareSnapshot}
            />
          )}
        </div>
      </div>

      {/* 编辑器或 Diff 视图 */}
      <div className={styles.codePaneEditor}>
        {showDiff && hasChanges ? (
          <DiffView
            originalCode={originalCode}
            modifiedCode={code}
            diffStats={diffStats}
            language="typescript"
          />
        ) : (
          <MonacoEditor
            height="100%"
            language="typescript"
            theme={isDark ? 'vs-dark' : 'light'}
            value={code}
            onChange={handleCodeChange}
            loading={loading ? '加载中...' : undefined}
            options={{
              fontSize: 14,
              fontFamily: '"JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
              lineNumbers: 'on',
              folding: true,
              renderLineHighlight: 'line',
              scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
            }}
          />
        )}
      </div>

      {/* 快捷操作栏 (Sprint 11.3) */}
      {onQuickAction && (
        <QuickActions onAction={onQuickAction} disabled={sending} />
      )}
    </>
  )
}
