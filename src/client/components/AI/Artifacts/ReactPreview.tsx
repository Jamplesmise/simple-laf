/**
 * React 预览组件
 *
 * 使用 @babel/standalone 在浏览器端编译 JSX
 * 在 iframe 沙箱中安全执行 React 组件
 */

import React, { useState, useRef, useCallback } from 'react'
import { Tooltip } from 'antd'
import {
  ExpandOutlined,
  CompressOutlined,
  ReloadOutlined,
  CodeOutlined
} from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import styles from './styles.module.css'

interface ReactPreviewProps {
  /** React/JSX 代码 */
  code: string
  /** 标题 */
  title?: string
  /** 初始高度 */
  height?: number
}

export function ReactPreview({ code, title, height = 300 }: ReactPreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [key, setKey] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { isDark, t } = useThemeColors()

  // 构建完整的 HTML 文档，包含 React 和 Babel
  const buildDocument = useCallback(() => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ${isDark ? 'background: #1e293b; color: #e2e8f0;' : ''}
    }
    .error {
      padding: 16px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      color: #dc2626;
      font-family: monospace;
      font-size: 13px;
      white-space: pre-wrap;
    }
    .error-title {
      font-weight: bold;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect, useMemo, useCallback, useRef } = React;

    try {
      ${code}

      // 尝试渲染组件
      const root = ReactDOM.createRoot(document.getElementById('root'));

      // 查找可渲染的组件
      if (typeof App !== 'undefined') {
        root.render(<App />);
      } else if (typeof Component !== 'undefined') {
        root.render(<Component />);
      } else if (typeof Example !== 'undefined') {
        root.render(<Example />);
      } else if (typeof Demo !== 'undefined') {
        root.render(<Demo />);
      } else {
        // 如果没有找到命名组件，尝试执行代码本身
        root.render(<div>组件已渲染</div>);
      }
    } catch (e) {
      document.getElementById('root').innerHTML =
        '<div class="error"><div class="error-title">运行时错误</div>' +
        e.message.replace(/</g, '&lt;').replace(/>/g, '&gt;') +
        '</div>';
    }
  </script>
</body>
</html>`
  }, [code, isDark])

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
          <span className={styles.previewIcon}>⚛️</span>
          <span className={styles.previewLabel} style={{ color: '#61dafb' }}>React 预览</span>
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
            <code>{code}</code>
          </pre>
        ) : (
          <iframe
            key={key}
            ref={iframeRef}
            className={styles.previewFrame}
            srcDoc={buildDocument()}
            sandbox="allow-scripts"
            title={title || 'React Preview'}
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

export default ReactPreview
