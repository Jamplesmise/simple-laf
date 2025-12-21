import React, { useCallback } from 'react'
import { MonkeyProgrammer, MonkeyStatus } from './MonkeyProgrammer'
import { usePosition } from './usePosition'

interface AIFloatingBallProps {
  status?: MonkeyStatus
  onClick?: () => void
}

export const AIFloatingBall: React.FC<AIFloatingBallProps> = ({
  status = 'idle',
  onClick,
}) => {
  const { position, isDragging, hasMoved, handleMouseDown } = usePosition()

  const handleClick = useCallback(() => {
    // 只有没有拖拽移动时才触发点击
    if (!hasMoved.current && onClick) {
      onClick()
    }
  }, [onClick])

  return (
    <MonkeyProgrammer
      status={status}
      isDragging={isDragging}
      style={{
        left: position.x,
        top: position.y,
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    />
  )
}

export { MonkeyProgrammer, MonkeyStatus } from './MonkeyProgrammer'
export { usePosition } from './usePosition'
