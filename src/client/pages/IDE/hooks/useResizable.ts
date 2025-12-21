import { useState, useCallback } from 'react'
import type { ResizableState, ResizableHandlers } from '../types'

const getInitialBottomHeight = () => Math.floor((window.innerHeight - 48) / 3)

export function useResizable(): ResizableState & ResizableHandlers {
  const [leftWidth, setLeftWidth] = useState(240)
  const [rightWidth, setRightWidth] = useState(360)
  const [bottomHeight, setBottomHeight] = useState(getInitialBottomHeight)
  const [leftBottomHeight, setLeftBottomHeight] = useState(getInitialBottomHeight)
  const [rightBottomHeight, setRightBottomHeight] = useState(getInitialBottomHeight)
  const [isResizing, setIsResizing] = useState<string | null>(null)

  const [bottomCollapsed, setBottomCollapsed] = useState(false)
  const [leftBottomCollapsed, setLeftBottomCollapsed] = useState(false)
  const [rightBottomCollapsed, setRightBottomCollapsed] = useState(false)

  const [prevBottomHeight, setPrevBottomHeight] = useState(getInitialBottomHeight)
  const [prevLeftBottomHeight, setPrevLeftBottomHeight] = useState(getInitialBottomHeight)
  const [prevRightBottomHeight, setPrevRightBottomHeight] = useState(getInitialBottomHeight)

  const handleMouseDown = useCallback((type: string) => {
    setIsResizing(type)
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isResizing) return

      const mainAreaHeight = window.innerHeight - 48 // 减去顶部栏高度

      if (isResizing === 'left') {
        const newWidth = e.clientX
        setLeftWidth(Math.max(180, Math.min(500, newWidth)))
      } else if (isResizing === 'right') {
        const newWidth = window.innerWidth - e.clientX
        setRightWidth(Math.max(280, Math.min(600, newWidth)))
      } else if (isResizing === 'bottom') {
        const newHeight = window.innerHeight - e.clientY - 48
        const height = Math.max(40, Math.min(mainAreaHeight * 0.8, newHeight))
        setBottomHeight(height)
        setPrevBottomHeight(height)
        setBottomCollapsed(false)
      } else if (isResizing === 'left-bottom') {
        const leftPanel = document.getElementById('left-panel')
        if (leftPanel) {
          const rect = leftPanel.getBoundingClientRect()
          const newHeight = rect.bottom - e.clientY
          const height = Math.max(40, Math.min(rect.height * 0.8, newHeight))
          setLeftBottomHeight(height)
          setPrevLeftBottomHeight(height)
          setLeftBottomCollapsed(false)
        }
      } else if (isResizing === 'right-middle') {
        const rightPanel = document.getElementById('right-panel')
        if (rightPanel) {
          const rect = rightPanel.getBoundingClientRect()
          const newHeight = rect.bottom - e.clientY
          const height = Math.max(40, Math.min(rect.height * 0.8, newHeight))
          setRightBottomHeight(height)
          setPrevRightBottomHeight(height)
          setRightBottomCollapsed(false)
        }
      }
    },
    [isResizing]
  )

  const toggleBottomCollapse = useCallback(() => {
    if (bottomCollapsed) {
      setBottomHeight(prevBottomHeight)
    } else {
      setBottomHeight(32)
    }
    setBottomCollapsed(!bottomCollapsed)
  }, [bottomCollapsed, prevBottomHeight])

  const toggleLeftBottomCollapse = useCallback(() => {
    if (leftBottomCollapsed) {
      setLeftBottomHeight(prevLeftBottomHeight)
    } else {
      setLeftBottomHeight(32)
    }
    setLeftBottomCollapsed(!leftBottomCollapsed)
  }, [leftBottomCollapsed, prevLeftBottomHeight])

  const toggleRightBottomCollapse = useCallback(() => {
    if (rightBottomCollapsed) {
      setRightBottomHeight(prevRightBottomHeight)
    } else {
      setRightBottomHeight(32)
    }
    setRightBottomCollapsed(!rightBottomCollapsed)
  }, [rightBottomCollapsed, prevRightBottomHeight])

  const handleMouseUp = useCallback(() => {
    setIsResizing(null)
  }, [])

  return {
    leftWidth,
    rightWidth,
    bottomHeight,
    leftBottomHeight,
    rightBottomHeight,
    isResizing,
    bottomCollapsed,
    leftBottomCollapsed,
    rightBottomCollapsed,
    prevBottomHeight,
    prevLeftBottomHeight,
    prevRightBottomHeight,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    toggleBottomCollapse,
    toggleLeftBottomCollapse,
    toggleRightBottomCollapse,
  }
}
