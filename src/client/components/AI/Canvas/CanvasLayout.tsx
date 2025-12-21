/**
 * CanvasLayout - Canvas 模式分屏布局组件
 *
 * 实现 ChatGPT Canvas 风格的左右分屏：
 * - 左侧：对话面板（MessagePanel + InputArea）
 * - 右侧：代码编辑面板（CodePane）
 *
 * 使用 react-split 实现可拖拽分屏
 * 支持拖拽范围限制（20%-80%）和响应式布局
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import Split from 'react-split'
import { CodePane } from './CodePane'
import styles from './styles.module.css'

// localStorage key for saving split sizes
const SPLIT_SIZES_KEY = 'canvas-split-sizes'

// 分屏范围限制（百分比）
const MIN_PERCENT = 20
const MAX_PERCENT = 80

// 响应式断点：小于此宽度时切换为堆叠布局
const MOBILE_BREAKPOINT = 768

interface CanvasLayoutProps {
  /** 左侧面板内容（对话面板） */
  leftPanel: React.ReactNode
  /** 对话 ID（用于版本历史） */
  conversationId?: string
  /** 当前选中的函数ID */
  functionId?: string
  /** 代码变更回调 */
  onCodeChange?: (code: string) => void
  /** AI 生成的代码（用于自动同步） */
  aiGeneratedCode?: string
  /** 快捷操作回调（Sprint 11.3） */
  onQuickAction?: (prompt: string) => void
  /** 是否正在发送消息 */
  sending?: boolean
}

export function CanvasLayout({
  leftPanel,
  conversationId,
  functionId,
  onCodeChange,
  aiGeneratedCode,
  onQuickAction,
  sending,
}: CanvasLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [activePane, setActivePane] = useState<'chat' | 'code'>('chat')

  // 从 localStorage 恢复分屏比例，默认 50:50
  // 同时确保在有效范围内（20%-80%）
  const [sizes, setSizes] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem(SPLIT_SIZES_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length === 2) {
          // 确保在有效范围内
          const left = Math.max(MIN_PERCENT, Math.min(MAX_PERCENT, parsed[0]))
          const right = 100 - left
          return [left, right]
        }
      }
    } catch {
      // ignore
    }
    return [50, 50]
  })

  // 监听容器大小变化
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      const width = container.offsetWidth
      setContainerWidth(width)
      setIsMobile(width < MOBILE_BREAKPOINT)
    }

    // 初始化
    updateSize()

    // 使用 ResizeObserver 监听大小变化
    const resizeObserver = new ResizeObserver(updateSize)
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [])

  // 计算最小/最大像素值（基于容器宽度的百分比）
  const minSize = Math.max(200, Math.floor(containerWidth * MIN_PERCENT / 100))
  const maxSize = Math.floor(containerWidth * MAX_PERCENT / 100)

  // 保存分屏比例到 localStorage，同时确保在有效范围内
  const handleDragEnd = useCallback((newSizes: number[]) => {
    // 确保在有效范围内
    let left = newSizes[0]
    if (left < MIN_PERCENT) left = MIN_PERCENT
    if (left > MAX_PERCENT) left = MAX_PERCENT
    const right = 100 - left
    const clampedSizes = [left, right]

    setSizes(clampedSizes)
    try {
      localStorage.setItem(SPLIT_SIZES_KEY, JSON.stringify(clampedSizes))
    } catch {
      // ignore
    }
  }, [])

  // 移动端：堆叠布局，通过标签切换
  if (isMobile) {
    return (
      <div ref={containerRef} className={styles.mobileContainer}>
        {/* 标签切换 */}
        <div className={styles.mobileTabs}>
          <button
            className={`${styles.mobileTab} ${activePane === 'chat' ? styles.mobileTabActive : ''}`}
            onClick={() => setActivePane('chat')}
          >
            对话
          </button>
          <button
            className={`${styles.mobileTab} ${activePane === 'code' ? styles.mobileTabActive : ''}`}
            onClick={() => setActivePane('code')}
          >
            代码
          </button>
        </div>

        {/* 内容区域 */}
        <div className={styles.mobileContent}>
          {activePane === 'chat' ? (
            <div className={styles.leftPane}>{leftPanel}</div>
          ) : (
            <div className={styles.rightPane}>
              <CodePane
                conversationId={conversationId}
                functionId={functionId}
                onCodeChange={onCodeChange}
                aiGeneratedCode={aiGeneratedCode}
                onQuickAction={onQuickAction}
                sending={sending}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  // 桌面端：分屏布局
  return (
    <div ref={containerRef} className={styles.splitWrapper}>
      <Split
        className={styles.splitContainer}
        sizes={sizes}
        minSize={[minSize, minSize]}
        maxSize={[maxSize, maxSize]}
        gutterSize={6}
        direction="horizontal"
        onDragEnd={handleDragEnd}
        snapOffset={0}
      >
        {/* 左侧：对话面板 */}
        <div className={styles.leftPane}>
          {leftPanel}
        </div>

        {/* 右侧：代码编辑面板 */}
        <div className={styles.rightPane}>
          <CodePane
            conversationId={conversationId}
            functionId={functionId}
            onCodeChange={onCodeChange}
            aiGeneratedCode={aiGeneratedCode}
            onQuickAction={onQuickAction}
            sending={sending}
          />
        </div>
      </Split>
    </div>
  )
}
