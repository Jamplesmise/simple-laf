import type { ReactNode } from 'react'
import {
  CloudServerOutlined, ApiOutlined, SettingOutlined
} from '@ant-design/icons'
import type { ProviderType } from './types'

export const getProviderIcon = (type: ProviderType): ReactNode => {
  switch (type) {
    case 'openai':
    case 'anthropic':
      return <CloudServerOutlined />
    case 'ollama':
      return <SettingOutlined />
    default:
      return <ApiOutlined />
  }
}

export const formatPrice = (price?: number, currency?: string) => {
  if (price === undefined || price === 0) return '-'
  const symbol = currency === 'CNY' ? '¥' : '$'
  return `${symbol}${price.toFixed(2)}/M`
}
