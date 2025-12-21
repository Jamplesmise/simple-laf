import { useState, useCallback, useEffect } from 'react'
import { message } from 'antd'
import { aiProviderApi } from '../../../api/aiProvider'
import type { AIProvider } from '../types'

export function useProviders() {
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [loading, setLoading] = useState(true)

  const loadProviders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await aiProviderApi.list()
      setProviders(res.data.data || [])
    } catch {
      message.error('加载供应商列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProviders()
  }, [loadProviders])

  const handleDelete = async (id: string) => {
    try {
      await aiProviderApi.delete(id)
      message.success('已删除')
      loadProviders()
    } catch {
      message.error('删除失败')
    }
  }

  const handleSetDefault = async (provider: AIProvider) => {
    try {
      await aiProviderApi.update(provider._id, { isDefault: true })
      message.success('已设为默认')
      loadProviders()
    } catch {
      message.error('设置失败')
    }
  }

  return {
    providers,
    loading,
    loadProviders,
    handleDelete,
    handleSetDefault,
  }
}
