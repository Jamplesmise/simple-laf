import { useState, useCallback, useRef, useEffect } from 'react'

interface Position {
  x: number
  y: number
}

const STORAGE_KEY = 'ai-floating-ball-position'
const BALL_WIDTH = 80
const BALL_HEIGHT = 70

function getDefaultPosition(): Position {
  return {
    x: window.innerWidth - BALL_WIDTH - 24,
    y: window.innerHeight - BALL_HEIGHT - 24,
  }
}

function clampPosition(x: number, y: number): Position {
  return {
    x: Math.max(8, Math.min(window.innerWidth - BALL_WIDTH - 8, x)),
    y: Math.max(8, Math.min(window.innerHeight - BALL_HEIGHT - 8, y)),
  }
}

export function usePosition() {
  const [position, setPosition] = useState<Position>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return clampPosition(parsed.x, parsed.y)
      }
    } catch {
      // ignore
    }
    return getDefaultPosition()
  })

  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 })
  const hasMoved = useRef(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    hasMoved.current = false
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    }
  }, [position])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return

    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasMoved.current = true
    }

    const newPos = clampPosition(
      dragStartRef.current.posX + dx,
      dragStartRef.current.posY + dy
    )
    setPosition(newPos)
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(position))
    }
  }, [isDragging, position])

  // 窗口大小变化时重新调整位置
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => clampPosition(prev.x, prev.y))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 拖拽事件监听
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  return {
    position,
    isDragging,
    hasMoved,
    handleMouseDown,
  }
}
