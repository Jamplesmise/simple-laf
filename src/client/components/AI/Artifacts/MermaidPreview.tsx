/**
 * Mermaid 图表预览组件
 *
 * 渲染 Mermaid 语法的图表（流程图、时序图等）
 * 支持导出为图片
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Tooltip, message } from 'antd'
import {
  ExpandOutlined,
  CompressOutlined,
  ReloadOutlined,
  CodeOutlined,
  DownloadOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import styles from './styles.module.css'

interface MermaidPreviewProps {
  /** Mermaid 代码 */
  code: string
  /** 标题 */
  title?: string
  /** 初始高度 */
  height?: number
}

// Mermaid 类型声明
declare const mermaid: {
  initialize: (config: Record<string, unknown>) => void
  render: (id: string, code: string) => Promise<{ svg: string }>
}

export function MermaidPreview({ code, title, height = 300 }: MermaidPreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [svgContent, setSvgContent] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [key, setKey] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const { isDark, t } = useThemeColors()

  // 加载 Mermaid 并渲染
  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)

    const loadAndRender = async () => {
      try {
        // 动态加载 Mermaid
        if (typeof mermaid === 'undefined') {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script')
            script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js'
            script.async = true
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('无法加载 Mermaid'))
            document.head.appendChild(script)
          })
        }

        // 初始化 Mermaid
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'loose',
        })

        // 渲染图表
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`
        const { svg } = await mermaid.render(id, code)

        if (mounted) {
          setSvgContent(svg)
          setError(null)
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : '渲染错误')
          setSvgContent('')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadAndRender()

    return () => {
      mounted = false
    }
  }, [code, isDark, key])

  // 刷新预览
  const handleRefresh = () => {
    setKey(prev => prev + 1)
  }

  // 切换全屏
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  // 切换代码视图
  const toggleCode = () => {
    setShowCode(!showCode)
  }

  // 导出为 PNG
  const handleExport = useCallback(async () => {
    if (!svgContent) return

    try {
      // 创建 canvas
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('无法创建 Canvas')

      // 创建图片
      const img = new Image()
      const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('图片加载失败'))
        img.src = url
      })

      // 设置 canvas 尺寸
      canvas.width = img.width * 2
      canvas.height = img.height * 2
      ctx.scale(2, 2)
      ctx.fillStyle = isDark ? '#1e293b' : '#ffffff'
      ctx.fillRect(0, 0, img.width, img.height)
      ctx.drawImage(img, 0, 0)

      // 下载
      const link = document.createElement('a')
      link.download = `mermaid-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()

      URL.revokeObjectURL(url)
      message.success('图片已导出')
    } catch (e) {
      message.error('导出失败')
    }
  }, [svgContent, isDark])

  const containerClass = isFullscreen
    ? `${styles.previewContainer} ${styles.fullscreen}`
    : styles.previewContainer

  return (
    <div
      className={containerClass}
      style={{
        borderColor: t.border,
        '--preview-height': `${height}px`,
      } as React.CSSProperties}
    >
      {/* 头部工具栏 */}
      <div className={styles.previewHeader} style={{ background: t.bgMuted }}>
        <div className={styles.previewTitle}>
          <span className={styles.previewIcon}>📊</span>
          <span className={styles.previewLabel} style={{ color: '#ff3670' }}>Mermaid</span>
          {title && <span className={styles.previewName}>{title}</span>}
        </div>
        <div className={styles.previewActions}>
          <Tooltip title="查看代码">
            <button
              className={`${styles.previewAction} ${showCode ? styles.previewActionActive : ''}`}
              onClick={toggleCode}
            >
              <CodeOutlined />
            </button>
          </Tooltip>
          <Tooltip title="导出图片">
            <button
              className={styles.previewAction}
              onClick={handleExport}
              disabled={!svgContent}
            >
              <DownloadOutlined />
            </button>
          </Tooltip>
          <Tooltip title="刷新">
            <button className={styles.previewAction} onClick={handleRefresh}>
              <ReloadOutlined />
            </button>
          </Tooltip>
          <Tooltip title={isFullscreen ? '退出全屏' : '全屏预览'}>
            <button className={styles.previewAction} onClick={toggleFullscreen}>
              {isFullscreen ? <CompressOutlined /> : <ExpandOutlined />}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* 预览内容 */}
      <div className={styles.previewBody}>
        {showCode ? (
          <pre className={styles.previewCode} style={{ background: isDark ? '#0f172a' : '#fafafa' }}>
            <code>{code}</code>
          </pre>
        ) : error ? (
          <div className={styles.reactPreviewError}>
            <div className={styles.reactPreviewErrorTitle}>
              <WarningOutlined />
              渲染错误
            </div>
            <div className={styles.reactPreviewErrorMessage}>{error}</div>
          </div>
        ) : loading ? (
          <div className={styles.reactPreviewLoading}>
            加载中...
          </div>
        ) : (
          <div
            ref={containerRef}
            className={styles.mermaidContainer}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        )}
      </div>

      {/* 全屏遮罩层 */}
      {isFullscreen && (
        <div className={styles.fullscreenOverlay} onClick={toggleFullscreen} />
      )}
    </div>
  )
}

export default MermaidPreview
