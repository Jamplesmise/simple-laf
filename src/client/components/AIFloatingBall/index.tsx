import React, { useCallback } from 'react'
import { PixelMonkey } from './PixelMonkey'

interface AIFloatingBallProps {
  status?: string // 保持接口兼容
  onClick?: () => void
}

export const AIFloatingBall: React.FC<AIFloatingBallProps> = ({
  onClick,
}) => {
  // 把外部传进来的 onClick (打开AI助手) 传递给猴子组件
  return <PixelMonkey onClick={onClick} />
}

export * from './PixelMonkey'