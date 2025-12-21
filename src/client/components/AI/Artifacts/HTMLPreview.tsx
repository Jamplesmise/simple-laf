/**
 * HTML 预览组件
 *
 * 使用 iframe sandbox 安全隔离执行 HTML 代码
 * 支持全屏预览和响应式展示
 */

import { useState, useRef, useCallback } from 'react'
import { Tooltip } from 'antd'
import {
  ExpandOutlined,
  CompressOutlined,
  ReloadOutlined,
  CodeOutlined
} from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import styles from './styles.module.css'

interface HTMLPreviewProps {
  /** HTML 内容 */
  html: string
  /** 标题 */
  title?: string
  /** 初始高度 */
  height?: number
}

export function HTMLPreview({ html, title, height = 300 }: HTMLPreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [key, setKey] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { isDark, t } = useThemeColors()

  // 构建完整的 HTML 文档
  const buildDocument = useCallback(() => {
    // 如果已经是完整的 HTML 文档，直接使用
    if (html.includes('<!DOCTYPE') || html.includes('<html')) {
      return html
    }

    // 否则包装成完整的 HTML 文档
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ${isDark ? 'background: #1e293b; color: #e2e8f0;' : ''}
    }
  </style>
</head>
<body>
${html}
</body>
</html>`
  }, [html, isDark])

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
          <span className={styles.previewIcon}>🌐</span>
          <span className={styles.previewLabel}>HTML 预览</span>
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
            <code>{html}</code>
          </pre>
        ) : (
          <iframe
            key={key}
            ref={iframeRef}
            className={styles.previewFrame}
            srcDoc={buildDocument()}
            sandbox="allow-scripts allow-same-origin"
            title={title || 'HTML Preview'}
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

export default HTMLPreview
