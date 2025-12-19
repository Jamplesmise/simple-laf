/**
 * Debug 状态管理 Hook
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { message } from 'antd'
import { debugStream, applyDebugFix, type DebugStreamMessage, type DebugTestCase, type DebugTestResult, type DebugFix } from '@/api/ai'
import { aiProviderApi, aiModelApi, type AIProvider, type AIModel } from '@/api/aiProvider'
import type { DebugPhase } from '../utils'

interface UseDebugOptions {
  functionId: string
  onCodeUpdated?: () => void
  onClose: () => void
}

export function useDebug({ functionId, onCodeUpdated, onClose }: UseDebugOptions) {
  // 调试状态
  const [phase, setPhase] = useState<DebugPhase>('selecting')
  const [statusMessage, setStatusMessage] = useState('')
  const [testCases, setTestCases] = useState<DebugTestCase[]>([])
  const [testResults, setTestResults] = useState<DebugTestResult[]>([])
  const [fix, setFix] = useState<DebugFix | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isApplying, setIsApplying] = useState(false)

  // 模型选择状态
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [models, setModels] = useState<AIModel[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [loadingModels, setLoadingModels] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)

  // 加载供应商列表
  const loadProviders = useCallback(async () => {
    try {
      const res = await aiProviderApi.list()
      if (res.data.success) {
        setProviders(res.data.data)
        const defaultProvider = res.data.data.find(p => p.isDefault) || res.data.data[0]
        if (defaultProvider) {
          setSelectedProviderId(defaultProvider._id)
        }
      }
    } catch {
      // 忽略错误
    }
  }, [])

  // 加载模型列表
  const loadModels = useCallback(async (providerId: string) => {
    setLoadingModels(true)
    try {
      const res = await aiModelApi.list(providerId)
      if (res.data.success) {
        setModels(res.data.data)
        const defaultModel = res.data.data.find(m => m.isDefault) || res.data.data[0]
        if (defaultModel) {
          setSelectedModelId(defaultModel._id)
        } else {
          setSelectedModelId(null)
        }
      }
    } catch {
      setModels([])
      setSelectedModelId(null)
    } finally {
      setLoadingModels(false)
    }
  }, [])

  // 供应商变化时加载模型
  useEffect(() => {
    if (selectedProviderId) {
      loadModels(selectedProviderId)
    } else {
      setModels([])
      setSelectedModelId(null)
    }
  }, [selectedProviderId, loadModels])

  // 重置状态
  const resetState = useCallback(() => {
    setPhase('selecting')
    setStatusMessage('')
    setTestCases([])
    setTestResults([])
    setFix(null)
    setError(null)
    setIsApplying(false)
  }, [])

  // 处理流式消息
  const handleMessage = useCallback((msg: DebugStreamMessage) => {
    switch (msg.status) {
      case 'analyzing':
        setPhase('analyzing')
        setStatusMessage(msg.message || '正在分析函数代码...')
        break
      case 'generating_tests':
        setPhase('generating')
        setStatusMessage(msg.message || '正在生成测试用例...')
        break
      case 'tests_generated':
        if (msg.testCases) setTestCases(msg.testCases)
        setStatusMessage(msg.message || `已生成 ${msg.testCases?.length || 0} 个测试用例`)
        break
      case 'running_tests':
        setPhase('running')
        setStatusMessage(msg.message || '正在运行测试...')
        break
      case 'test_result':
        if (msg.testResult) setTestResults(prev => [...prev, msg.testResult!])
        break
      case 'all_tests_passed':
        setPhase('done')
        setStatusMessage('所有测试通过！')
        if (msg.testResults) setTestResults(msg.testResults)
        break
      case 'diagnosing':
        setPhase('diagnosing')
        setStatusMessage(msg.message || '正在分析问题...')
        if (msg.testResults) setTestResults(msg.testResults)
        break
      case 'fix_proposed':
        setPhase('fix_ready')
        setStatusMessage('已生成修复建议')
        if (msg.fix) setFix(msg.fix)
        if (msg.testResults) setTestResults(msg.testResults)
        break
      case 'done':
        setPhase(prev => prev !== 'fix_ready' ? 'done' : prev)
        setStatusMessage(msg.message || '调试完成')
        break
      case 'error':
        setPhase('error')
        setError(msg.error || '未知错误')
        break
    }
  }, [])

  // 开始调试
  const startDebug = useCallback(async () => {
    if (!selectedModelId) {
      message.error('请先选择一个 AI 模型')
      return
    }

    setPhase('analyzing')
    setStatusMessage('正在分析函数代码...')
    setTestCases([])
    setTestResults([])
    setFix(null)
    setError(null)
    setIsApplying(false)

    try {
      for await (const msg of debugStream(functionId, undefined, selectedModelId)) {
        handleMessage(msg)
      }
    } catch (err) {
      setPhase('error')
      setError(err instanceof Error ? err.message : '调试失败')
    }
  }, [functionId, selectedModelId, handleMessage])

  // 应用修复
  const applyFix = useCallback(async () => {
    if (!fix) return

    setIsApplying(true)
    try {
      const result = await applyDebugFix(functionId, fix.fixedCode)
      if (result.success) {
        message.success('修复已应用')
        onCodeUpdated?.()
        onClose()
      } else {
        message.error(result.error || '应用修复失败')
      }
    } catch {
      message.error('应用修复失败')
    } finally {
      setIsApplying(false)
    }
  }, [functionId, fix, onCodeUpdated, onClose])

  // 取消
  const cancel = useCallback(() => {
    abortControllerRef.current?.abort()
    onClose()
  }, [onClose])

  // 返回选择阶段
  const backToSelection = useCallback(() => {
    setPhase('selecting')
    setError(null)
  }, [])

  return {
    // 状态
    phase,
    statusMessage,
    testCases,
    testResults,
    fix,
    error,
    isApplying,
    providers,
    models,
    selectedProviderId,
    selectedModelId,
    loadingModels,
    // 操作
    loadProviders,
    setSelectedProviderId,
    setSelectedModelId,
    resetState,
    startDebug,
    applyFix,
    cancel,
    backToSelection,
  }
}
