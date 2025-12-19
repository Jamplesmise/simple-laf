/**
 * AI 自动调试弹窗
 *
 * 支持自动生成测试用例、运行测试、诊断问题、生成修复建议
 */

import { useState, useEffect, useCallback } from 'react'
import { Modal, Steps, Button, Spin, Alert } from 'antd'
import { BugOutlined, LoadingOutlined } from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import type { DebugTestCase, DebugTestResult } from '@/api/ai'
import { ModelSelector } from './ModelSelector'
import { TestResultsList } from './TestResultsList'
import { FixProposal } from './FixProposal'
import { TestDetailModal } from './TestDetailModal'
import { useDebug } from './hooks/useDebug'
import { getCurrentStep, isLoading } from './utils'

interface AIDebugModalProps {
  open: boolean
  functionId: string
  functionName: string
  onClose: () => void
  onCodeUpdated?: () => void
}

export default function AIDebugModal({
  open,
  functionId,
  functionName,
  onClose,
  onCodeUpdated
}: AIDebugModalProps) {
  const { isDark, t } = useThemeColors()

  // 调试状态
  const debug = useDebug({ functionId, onCodeUpdated, onClose })

  // 测试详情弹窗状态
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedTestCase, setSelectedTestCase] = useState<DebugTestCase | null>(null)
  const [selectedTestResult, setSelectedTestResult] = useState<DebugTestResult | null>(null)

  // 打开测试详情
  const handleViewTestDetail = useCallback((result: DebugTestResult) => {
    const testCase = debug.testCases.find(tc => tc.id === result.testCaseId)
    setSelectedTestCase(testCase || null)
    setSelectedTestResult(result)
    setDetailModalOpen(true)
  }, [debug.testCases])

  // 键盘事件处理
  useEffect(() => {
    if (!open || detailModalOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && debug.phase === 'fix_ready' && debug.fix && !debug.isApplying) {
        e.preventDefault()
        debug.applyFix()
      }
      if (e.key === 'Escape' || (e.ctrlKey && e.key === 'c')) {
        e.preventDefault()
        debug.cancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, debug.phase, debug.fix, debug.isApplying, detailModalOpen, debug])

  // 打开时加载供应商
  useEffect(() => {
    if (open) {
      debug.loadProviders()
    }
  }, [open, debug.loadProviders])

  // 关闭时重置
  useEffect(() => {
    if (!open) {
      debug.resetState()
      setDetailModalOpen(false)
      setSelectedTestCase(null)
      setSelectedTestResult(null)
    }
  }, [open, debug.resetState])

  const currentStep = getCurrentStep(debug.phase)

  return (
    <>
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BugOutlined style={{ color: t.accent }} />
            <span>AI 自动 Debug - </span>
            <span style={{ color: t.accent, fontWeight: 600 }}>{functionName}</span>
          </div>
        }
        open={open}
        onCancel={debug.cancel}
        width={900}
        centered
        footer={null}
        styles={{
          body: { padding: '16px 24px' },
          content: { borderRadius: 12 }
        }}
      >
        {/* 模型选择阶段 */}
        {debug.phase === 'selecting' && (
          <ModelSelector
            providers={debug.providers}
            models={debug.models}
            selectedProviderId={debug.selectedProviderId}
            selectedModelId={debug.selectedModelId}
            loadingModels={debug.loadingModels}
            onProviderSelect={debug.setSelectedProviderId}
            onModelSelect={debug.setSelectedModelId}
          />
        )}

        {/* 调试阶段 */}
        {debug.phase !== 'selecting' && (
          <>
            {/* 步骤条 */}
            <Steps
              current={currentStep}
              status={debug.phase === 'error' ? 'error' : undefined}
              size="small"
              style={{ marginBottom: 24 }}
              items={[
                { title: '分析', icon: debug.phase === 'analyzing' ? <LoadingOutlined /> : undefined },
                { title: '生成测试', icon: debug.phase === 'generating' ? <LoadingOutlined /> : undefined },
                { title: '运行测试', icon: debug.phase === 'running' ? <LoadingOutlined /> : undefined },
                { title: '诊断', icon: debug.phase === 'diagnosing' ? <LoadingOutlined /> : undefined },
                { title: '修复', icon: debug.phase === 'applying' ? <LoadingOutlined /> : undefined },
              ]}
            />

            {/* 状态消息 */}
            <div style={{
              padding: '8px 12px',
              marginBottom: 16,
              borderRadius: 6,
              background: isDark ? '#1a1a1a' : '#f5f5f5',
              color: t.textSecondary,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              {isLoading(debug.phase) && <Spin size="small" />}
              {debug.statusMessage}
            </div>
          </>
        )}

        {/* 错误提示 */}
        {debug.error && (
          <Alert
            type="error"
            message="调试失败"
            description={
              debug.error.includes('未配置 AI') || debug.error.includes('AI 设置') ? (
                <div>
                  <div>{debug.error}</div>
                  <div style={{ marginTop: 8 }}>
                    请前往 <strong>设置 → AI 模型</strong> 配置 AI 供应商和模型后再试。
                  </div>
                </div>
              ) : debug.error
            }
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* 测试结果列表 */}
        <TestResultsList
          results={debug.testResults}
          onViewDetail={handleViewTestDetail}
        />

        {/* 修复建议 */}
        {debug.fix && <FixProposal fix={debug.fix} />}

        {/* 底部操作区 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 16,
          paddingTop: 16,
          borderTop: `1px solid ${t.border}`
        }}>
          {/* 快捷键提示 */}
          <div style={{ fontSize: 12, color: t.textMuted }}>
            {debug.phase === 'fix_ready' && (
              <span>
                <kbd style={{
                  padding: '2px 6px',
                  borderRadius: 3,
                  background: isDark ? '#333' : '#f0f0f0',
                  border: `1px solid ${isDark ? '#444' : '#d9d9d9'}`,
                  fontSize: 11
                }}>Enter</kbd>
                {' '}应用修复 | {' '}
                <kbd style={{
                  padding: '2px 6px',
                  borderRadius: 3,
                  background: isDark ? '#333' : '#f0f0f0',
                  border: `1px solid ${isDark ? '#444' : '#d9d9d9'}`,
                  fontSize: 11
                }}>Esc</kbd>
                {' '}取消
              </span>
            )}
          </div>

          {/* 按钮 */}
          <div style={{ display: 'flex', gap: 12 }}>
            <Button onClick={debug.cancel}>取消</Button>
            {debug.phase === 'selecting' && (
              <Button
                type="primary"
                onClick={debug.startDebug}
                disabled={!debug.selectedModelId}
                style={{ background: t.accent, borderColor: t.accent }}
              >
                开始调试
              </Button>
            )}
            {debug.phase === 'fix_ready' && debug.fix && (
              <Button
                type="primary"
                onClick={debug.applyFix}
                loading={debug.isApplying}
                style={{ background: t.accent, borderColor: t.accent }}
              >
                应用修复
              </Button>
            )}
            {debug.phase === 'done' && !debug.fix && (
              <Button
                type="primary"
                onClick={onClose}
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
              >
                完成
              </Button>
            )}
            {debug.phase === 'error' && (
              <Button onClick={debug.backToSelection}>返回选择</Button>
            )}
          </div>
        </div>
      </Modal>

      {/* 测试详情弹窗 */}
      <TestDetailModal
        open={detailModalOpen}
        testCase={selectedTestCase}
        testResult={selectedTestResult}
        onClose={() => setDetailModalOpen(false)}
      />
    </>
  )
}
