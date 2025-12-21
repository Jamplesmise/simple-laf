import { useState } from 'react'
import { message } from 'antd'
import { useAIStore } from '@/stores/ai'
import { useSiteStore } from '@/stores/site'
import type { SiteAIAction, SiteAIConfigValue } from '../types'

interface UseSiteAIOptions {
  aiConfig: SiteAIConfigValue
  onConfigOpen: () => void
}

export function useSiteAI({ aiConfig, onConfigOpen }: UseSiteAIOptions) {
  const { files, fetchFiles } = useSiteStore()
  const {
    isGenerating,
    currentOutput,
    generateError,
    executeState,
    executeAction,
    clearOutput,
    clearExecuteState,
  } = useAIStore()

  const [prompt, setPrompt] = useState('')
  const [action, setAction] = useState<SiteAIAction>('create-page')

  // 构建站点文件列表描述
  const buildSiteFilesContext = () => {
    if (files.length === 0) return ''

    const fileList = files.map(f =>
      `- ${f.path} (${f.isDirectory ? '目录' : '文件'})`
    ).join('\n')

    return `\n\n当前站点文件列表：\n${fileList}`
  }

  const handleSend = async () => {
    if (!prompt.trim()) {
      message.warning('请输入描述')
      return
    }

    if (!aiConfig.providerId || !aiConfig.modelId) {
      message.warning('请先配置 AI 供应商和模型')
      onConfigOpen()
      return
    }

    clearOutput()
    clearExecuteState()

    // 根据操作类型构建提示词
    const siteFilesContext = buildSiteFilesContext()
    let fullPrompt = prompt

    switch (action) {
      case 'create-page':
        fullPrompt = `创建一个网页文件。用户需求：${prompt}\n\n请使用 siteCreateFile 操作创建 HTML 文件，如果需要的话也创建对应的 CSS 和 JS 文件。${siteFilesContext}`
        break
      case 'create-component':
        fullPrompt = `创建一个前端组件。用户需求：${prompt}\n\n请使用 siteCreateFile 操作创建相关文件（HTML/CSS/JS）。${siteFilesContext}`
        break
      case 'create-site':
        fullPrompt = `创建一个完整的静态网站。用户需求：${prompt}\n\n请使用 siteCreateFile 和 siteCreateFolder 操作创建网站结构，包括 index.html、样式文件、脚本文件等。${siteFilesContext}`
        break
    }

    const success = await executeAction(fullPrompt, {
      modelId: aiConfig.modelId,
      enableThinking: aiConfig.enableThinking,
    })

    if (success) {
      // 刷新文件列表
      await fetchFiles()
      message.success('操作完成')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleActionChange = (newAction: SiteAIAction) => {
    setAction(newAction)
    clearOutput()
    clearExecuteState()
  }

  return {
    prompt,
    setPrompt,
    action,
    handleActionChange,
    isGenerating,
    currentOutput,
    generateError,
    executeState,
    handleSend,
    handleKeyDown,
    clearOutput,
    clearExecuteState,
  }
}
