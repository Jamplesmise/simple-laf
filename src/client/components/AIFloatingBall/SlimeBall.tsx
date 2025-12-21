import React from 'react'
import styles from './styles.module.css'

export type SlimeStatus = 'idle' | 'sending' | 'thinking'

interface SlimeBallProps {
  status?: SlimeStatus
  isDragging?: boolean
  style?: React.CSSProperties
  onMouseDown?: (e: React.MouseEvent) => void
  onClick?: () => void
}

export const SlimeBall: React.FC<SlimeBallProps> = ({
  status = 'idle',
  isDragging = false,
  style,
  onMouseDown,
  onClick,
}) => {
  const classNames = [
    styles.slimeBall,
    isDragging && styles.dragging,
    status === 'sending' && styles.sending,
    status === 'thinking' && styles.thinking,
  ].filter(Boolean).join(' ')

  return (
    <div
      className={classNames}
      style={style}
      onMouseDown={onMouseDown}
      onClick={onClick}
      title="AI 助手"
    >
      {/* 眼睛 */}
      <div className={styles.eyes}>
        <div className={styles.eye}>
          <div className={styles.pupil} />
        </div>
        <div className={styles.eye}>
          <div className={styles.pupil} />
        </div>
      </div>
      {/* 微笑 */}
      <div className={styles.smile} />
    </div>
  )
}
