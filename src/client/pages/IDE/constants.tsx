import { Code, Database, Activity, Link, HardDrive, Globe } from 'lucide-react'
import type { ViewType } from '../../stores/view'
import type { NavItem } from './types'

// Emerald Green 主题色
export const emerald = {
  primary: '#10B981',
  light: '#34D399',
  lighter: '#ECFDF5',
  dark: '#059669',
  surface: 'rgba(16, 185, 129, 0.1)',
}

// 主导航项 - 视图切换
export const navItems: (NavItem & { key: ViewType })[] = [
  { key: 'functions', icon: <Code size={20} strokeWidth={2} />, label: '云函数' },
  { key: 'database', icon: <Database size={20} strokeWidth={2} />, label: '集合' },
  { key: 'storage', icon: <HardDrive size={20} strokeWidth={2} />, label: '存储' },
  { key: 'site', icon: <Globe size={20} strokeWidth={2} />, label: '站点' },
]

// 工具导航项配置 (不含 onClick)
export const toolItemsConfig: Array<{ key: string; icon: React.ReactNode; label: string }> = [
  { key: 'statistics', icon: <Activity size={20} strokeWidth={2} />, label: '统计' },
  { key: 'webhooks', icon: <Link size={20} strokeWidth={2} />, label: 'Webhooks' },
]
