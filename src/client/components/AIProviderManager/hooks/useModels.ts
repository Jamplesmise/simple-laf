import { useState, useCallback } from 'react'
import { message } from 'antd'
import { aiModelApi } from '../../../api/aiProvider'
import type { AIModel, TestResult } from '../types'

export function useModels() {
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, AIModel[]>>({})
  const [loadingModels, setLoadingModels] = useState<Record<string, boolean>>({})
  const [testingModels, setTestingModels] = useState<Record<string, boolean>>({})
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})

  const loadModels = useCallback(async (providerId: string) => {
    setLoadingModels(prev => ({ ...prev, [providerId]: true }))
    try {
      const res = await aiModelApi.list(providerId)
      setModelsByProvider(prev => ({ ...prev, [providerId]: res.data.data || [] }))
    } catch {
      message.error('加载模型列表失败')
    } finally {
      setLoadingModels(prev => ({ ...prev, [providerId]: false }))
    }
  }, [])

  const handleDelete = async (model: AIModel) => {
    try {
      await aiModelApi.delete(model._id)
      message.success('已删除')
      loadModels(model.providerId)
    } catch {
      message.error('删除失败')
    }
  }

  const handleSetDefault = async (model: AIModel) => {
    try {
      await aiModelApi.update(model._id, { isDefault: true })
      message.success('已设为默认')
      loadModels(model.providerId)
    } catch {
      message.error('设置失败')
    }
  }

  const handleTest = async (model: AIModel) => {
    setTestingModels(prev => ({ ...prev, [model._id]: true }))
    setTestResults(prev => {
      const newResults = { ...prev }
      delete newResults[model._id]
      return newResults
    })

    try {
      const res = await aiModelApi.test(model._id)
      const result = res.data.data
      setTestResults(prev => ({ ...prev, [model._id]: result }))
      if (result.success) {
        message.success(result.message)
      } else {
        message.error(result.message)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '测试失败'
      setTestResults(prev => ({ ...prev, [model._id]: { success: false, message: errorMsg } }))
      message.error(errorMsg)
    } finally {
      setTestingModels(prev => ({ ...prev, [model._id]: false }))
    }
  }

  return {
    modelsByProvider,
    loadingModels,
    testingModels,
    testResults,
    loadModels,
    handleDelete,
    handleSetDefault,
    handleTest,
  }
}
