/**
 * SVG 预览组件
 *
 * 安全渲染 SVG 图形
 * 支持缩放、导出功能
 */

import React, { useState, useCallback, useMemo } from 'react'
import { Tooltip, message } from 'antd'
import {
  ExpandOutlined,
  CompressOutlined,
  CodeOutlined,
  DownloadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined
} from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import styles from './styles.module.css'

interface SVGPreviewProps {
  /** SVG 代码 */
  svg: string
  /** 标题 */
  title?: string
  /** 初始高度 */
  height?: number
}

export function SVGPreview({ svg, title, height = 300 }: SVGPreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [zoom, setZoom] = useState(1)
  const { isDark, t } = useThemeColors()

  // 清理 SVG（移除可能的恶意脚本）
  const sanitizedSvg = useMemo(() => {
    // 移除 script 标签和事件处理器
    return svg
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '')
  }, [svg])

  // 切换全屏
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  // 切换代码视图
  const toggleCode = () => {
    setShowCode(!showCode)
  }

  // 放大
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3))
  }

  // 缩小
  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.25))
  }

  // 导出为 PNG
  const handleExport = useCallback(async () => {
    try {
      // 创建 canvas
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('无法创建 Canvas')

      // 创建图片
      const img = new Image()
      const svgBlob = new Blob([sanitizedSvg], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('图片加载失败'))
        img.src = url
      })

      // 设置 canvas 尺寸
      const scale = 2
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      ctx.scale(scale, scale)
      ctx.fillStyle = isDark ? '#1e293b' : '#ffffff'
      ctx.fillRect(0, 0, img.width, img.height)
      ctx.drawImage(img, 0, 0)

      // 下载
      const link = document.createElement('a')
      link.download = `svg-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()

      URL.revokeObjectURL(url)
      message.success('图片已导出')
    } catch (e) {
      message.error('导出失败')
    }
  }, [sanitizedSvg, isDark])

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
          <span className={styles.previewIcon}>🎨</span>
          <span className={styles.previewLabel} style={{ color: '#f59e0b' }}>SVG</span>
          {title && <span className={styles.previewName}>{title}</span>}
          {!showCode && (
            <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>
              {Math.round(zoom * 100)}%
            </span>
          )}
        </div>
        <div className={styles.previewActions}>
          {!showCode && (
            <>
              <Tooltip title="缩小">
                <button className={styles.previewAction} onClick={handleZoomOut}>
                  <ZoomOutOutlined />
                </button>
              </Tooltip>
              <Tooltip title="放大">
                <button className={styles.previewAction} onClick={handleZoomIn}>
                  <ZoomInOutlined />
                </button>
              </Tooltip>
            </>
          )}
          <Tooltip title="查看代码">
            <button
              className={`${styles.previewAction} ${showCode ? styles.previewActionActive : ''}`}
              onClick={toggleCode}
            >
              <CodeOutlined />
            </button>
          </Tooltip>
          <Tooltip title="导出 PNG">
            <button className={styles.previewAction} onClick={handleExport}>
              <DownloadOutlined />
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
            <code>{svg}</code>
          </pre>
        ) : (
          <div
            className={styles.svgContainer}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
            }}
            dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
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

export default SVGPreview
