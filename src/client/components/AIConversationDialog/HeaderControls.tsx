/**
 * 头部控制栏
 *
 * 供应商/模型选择、深度思考开关、系统提示词选择
 * Capsule/Pill 风格的交互式下拉触发器
 */

import { useState } from 'react'
import { Dropdown } from 'antd'
import {
  CloudServerOutlined,
  ThunderboltOutlined,
  BulbOutlined,
  FileTextOutlined,
  DownOutlined,
  CheckOutlined,
  SplitCellsOutlined,
  ExportOutlined,
} from '@ant-design/icons'
import type { AIProvider, AIModel } from '@/api/aiProvider'
import type { AISystemPrompt } from '@/api/aiSystemPrompt'
import styles from './styles.module.css'

interface HeaderControlsProps {
  // 供应商
  providers: AIProvider[]
  selectedProviderId: string | null
  loadingProviders: boolean
  onProviderChange: (id: string | null) => void
  // 模型
  models: AIModel[]
  selectedModelId: string | null
  selectedModel: AIModel | undefined
  loadingModels: boolean
  onModelChange: (id: string | null) => void
  // 深度思考
  enableThinking: boolean
  onThinkingToggle: () => void
  // 系统提示词
  systemPrompts: AISystemPrompt[]
  selectedPromptId: string | null
  loadingPrompts: boolean
  onPromptChange: (id: string | null) => void
  // 关闭
  onClose: () => void
  // Canvas 模式
  canvasMode?: boolean
  onCanvasModeToggle?: () => void
  canvasDisabled?: boolean
  // 导出
  onExport?: () => void
  exportDisabled?: boolean
}

export function HeaderControls({
  providers,
  selectedProviderId,
  onProviderChange,
  models,
  selectedModelId,
  selectedModel,
  onModelChange,
  enableThinking,
  onThinkingToggle,
  systemPrompts,
  selectedPromptId,
  onPromptChange,
  canvasMode,
  onCanvasModeToggle,
  canvasDisabled,
  onExport,
  exportDisabled,
}: HeaderControlsProps) {
  const [providerOpen, setProviderOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)

  // 获取当前选中的供应商名称
  const selectedProvider = providers.find(p => p._id === selectedProviderId)
  const selectedPrompt = systemPrompts.find(p => p._id === selectedPromptId)

  // 供应商下拉菜单
  const providerMenuItems = providers.map(p => ({
    key: p._id,
    label: (
      <div className={styles.dropdownItem}>
        <span>{p.name}</span>
        {selectedProviderId === p._id && <CheckOutlined className={styles.dropdownCheck} />}
      </div>
    ),
    onClick: () => {
      onProviderChange(p._id)
      setProviderOpen(false)
    },
  }))

  // 模型下拉菜单
  const modelMenuItems = models.map(m => ({
    key: m._id,
    label: (
      <div className={styles.dropdownItem}>
        <span>{m.alias || m.name}</span>
        {selectedModelId === m._id && <CheckOutlined className={styles.dropdownCheck} />}
      </div>
    ),
    onClick: () => {
      onModelChange(m._id)
      setModelOpen(false)
    },
  }))

  // 提示词下拉菜单
  const promptMenuItems = [
    {
      key: 'default',
      label: (
        <div className={styles.dropdownItem}>
          <span>默认</span>
          {!selectedPromptId && <CheckOutlined className={styles.dropdownCheck} />}
        </div>
      ),
      onClick: () => {
        onPromptChange(null)
        setPromptOpen(false)
      },
    },
    ...systemPrompts.map(p => ({
      key: p._id,
      label: (
        <div className={styles.dropdownItem}>
          <span>{p.name}</span>
          {selectedPromptId === p._id && <CheckOutlined className={styles.dropdownCheck} />}
        </div>
      ),
      onClick: () => {
        onPromptChange(p._id)
        setPromptOpen(false)
      },
    })),
  ]

  return (
    <div className={styles.headerControls}>
      {/* 供应商选择器 */}
      <Dropdown
        menu={{ items: providerMenuItems }}
        trigger={['click']}
        open={providerOpen}
        onOpenChange={setProviderOpen}
      >
        <button className={styles.selectorPill}>
          <CloudServerOutlined className={styles.selectorPillIcon} />
          <span>{selectedProvider?.name || '供应商'}</span>
          <DownOutlined className={styles.selectorPillChevron} />
        </button>
      </Dropdown>

      {/* 模型选择器 */}
      <Dropdown
        menu={{ items: modelMenuItems }}
        trigger={['click']}
        open={modelOpen}
        onOpenChange={setModelOpen}
        disabled={!selectedProviderId}
      >
        <button className={styles.selectorPill} disabled={!selectedProviderId}>
          <ThunderboltOutlined className={styles.selectorPillIcon} />
          <span>{selectedModel?.alias || selectedModel?.name || '模型'}</span>
          <DownOutlined className={styles.selectorPillChevron} />
        </button>
      </Dropdown>

      {/* 分隔线 */}
      <div className={styles.headerDivider} />

      {/* 深度思考开关 */}
      {selectedModel?.supportsThinking && (
        <button
          className={`${styles.selectorPill} ${enableThinking ? styles.selectorPillActive : ''}`}
          onClick={onThinkingToggle}
        >
          <BulbOutlined className={styles.selectorPillIcon} />
          <span>思考</span>
        </button>
      )}

      {/* 系统提示词选择器 */}
      <Dropdown
        menu={{ items: promptMenuItems }}
        trigger={['click']}
        open={promptOpen}
        onOpenChange={setPromptOpen}
      >
        <button className={styles.selectorPill}>
          <FileTextOutlined className={styles.selectorPillIcon} />
          <span>{selectedPrompt?.name || '默认'}</span>
          <DownOutlined className={styles.selectorPillChevron} />
        </button>
      </Dropdown>

      {/* 分隔线 */}
      <div className={styles.headerDivider} />

      {/* Canvas 模式开关 */}
      <button
        className={`${styles.selectorPill} ${canvasMode ? styles.selectorPillActive : ''}`}
        onClick={onCanvasModeToggle}
        disabled={canvasDisabled}
        title={canvasDisabled ? '请先选择一个函数' : 'Canvas 分屏模式'}
      >
        <SplitCellsOutlined className={styles.selectorPillIcon} />
        <span>Canvas</span>
      </button>

      {/* 导出按钮 */}
      <button
        className={styles.selectorPill}
        onClick={onExport}
        disabled={exportDisabled}
        title={exportDisabled ? '请先选择一个对话' : '导出对话'}
      >
        <ExportOutlined className={styles.selectorPillIcon} />
        <span>导出</span>
      </button>
    </div>
  )
}
