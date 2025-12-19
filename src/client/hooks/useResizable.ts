import { useState, useCallback, useEffect } from 'react'

interface UseResizableOptions {
  direction: 'horizontal' | 'vertical'
  initialSize: number
  minSize?: number
  maxSize?: number
}

export function useResizable({
  direction,
  initialSize,
  minSize = 100,
  maxSize = 800,
}: UseResizableOptions) {
  const [size, setSize] = useState(initialSize)
  const [isResizing, setIsResizing] = useState(false)

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (direction === 'horizontal') {
        const newSize = e.clientX
        setSize(Math.max(minSize, Math.min(maxSize, newSize)))
      } else {
        const newSize = window.innerHeight - e.clientY
        setSize(Math.max(minSize, Math.min(maxSize, newSize)))
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, direction, minSize, maxSize])

  return { size, isResizing, startResize }
}

// Resizable handle component styles
export const resizeHandleStyle = {
  horizontal: {
    width: 4,
    cursor: 'col-resize',
    background: 'transparent',
    transition: 'background 0.2s',
    '&:hover': {
      background: '#1890ff',
    },
  },
  vertical: {
    height: 4,
    cursor: 'row-resize',
    background: 'transparent',
    transition: 'background 0.2s',
    '&:hover': {
      background: '#1890ff',
    },
  },
}
