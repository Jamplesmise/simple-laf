/**
 * 吉卜力风格的猴子程序员
 *
 * 可爱的猴子坐在办公桌前编程，有桌子、iMac、椅子
 */

import React from 'react'
import styles from './styles.module.css'

export type MonkeyStatus = 'idle' | 'sending' | 'thinking'

interface MonkeyProgrammerProps {
  status?: MonkeyStatus
  isDragging?: boolean
  style?: React.CSSProperties
  onMouseDown?: (e: React.MouseEvent) => void
  onClick?: () => void
}

export const MonkeyProgrammer: React.FC<MonkeyProgrammerProps> = ({
  status = 'idle',
  isDragging = false,
  style,
  onMouseDown,
  onClick,
}) => {
  const classNames = [
    styles.monkeyContainer,
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
      <svg
        viewBox="0 0 80 70"
        className={styles.monkeySvg}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 背景光晕 */}
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#fef3c7" stopOpacity="0" />
          </radialGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.2" />
          </filter>
        </defs>

        <ellipse cx="40" cy="35" rx="38" ry="32" fill="url(#glow)" />

        {/* 椅子靠背 */}
        <rect x="28" y="38" width="24" height="18" rx="3" fill="#8B5A2B" filter="url(#shadow)" />
        <rect x="30" y="40" width="20" height="14" rx="2" fill="#A0522D" />

        {/* 桌子 */}
        <rect x="8" y="48" width="64" height="4" rx="1" fill="#DEB887" filter="url(#shadow)" />
        <rect x="12" y="52" width="4" height="14" rx="1" fill="#D2691E" />
        <rect x="64" y="52" width="4" height="14" rx="1" fill="#D2691E" />

        {/* iMac 显示器 */}
        <g className={styles.imac}>
          {/* 显示器底座 */}
          <path d="M36 48 L44 48 L42 44 L38 44 Z" fill="#C0C0C0" />
          <rect x="38" y="44" width="4" height="2" fill="#A9A9A9" />

          {/* 显示器屏幕 */}
          <rect x="24" y="26" width="32" height="20" rx="2" fill="#2C3E50" filter="url(#shadow)" />
          <rect x="26" y="28" width="28" height="14" rx="1" fill="#1a1a2e" />

          {/* 屏幕内容 - 代码行 */}
          <g className={styles.codeLines}>
            <rect x="28" y="30" width="12" height="1.5" rx="0.5" fill="#10B981" />
            <rect x="28" y="33" width="18" height="1.5" rx="0.5" fill="#60A5FA" />
            <rect x="28" y="36" width="8" height="1.5" rx="0.5" fill="#F59E0B" />
            <rect x="38" y="36" width="10" height="1.5" rx="0.5" fill="#A78BFA" />
            <rect x="28" y="39" width="14" height="1.5" rx="0.5" fill="#EC4899" />
          </g>

          {/* Apple logo 位置 */}
          <circle cx="40" cy="44" r="1" fill="#A9A9A9" />
        </g>

        {/* 猴子身体 */}
        <ellipse cx="40" cy="52" rx="10" ry="6" fill="#D2691E" />

        {/* 猴子头部 */}
        <g className={styles.monkeyHead}>
          {/* 耳朵 */}
          <circle cx="26" cy="18" r="6" fill="#D2691E" />
          <circle cx="26" cy="18" r="4" fill="#FFDAB9" />
          <circle cx="54" cy="18" r="6" fill="#D2691E" />
          <circle cx="54" cy="18" r="4" fill="#FFDAB9" />

          {/* 头部主体 */}
          <ellipse cx="40" cy="22" rx="14" ry="12" fill="#D2691E" />

          {/* 脸部 */}
          <ellipse cx="40" cy="25" rx="10" ry="8" fill="#FFDAB9" />

          {/* 眼睛 */}
          <g className={styles.eyes}>
            <ellipse cx="35" cy="22" rx="3.5" ry="4" fill="white" />
            <ellipse cx="45" cy="22" rx="3.5" ry="4" fill="white" />
            <circle cx="35" cy="23" r="2" fill="#1f2937" className={styles.pupil} />
            <circle cx="45" cy="23" r="2" fill="#1f2937" className={styles.pupil} />
            {/* 眼睛高光 */}
            <circle cx="36" cy="22" r="0.8" fill="white" />
            <circle cx="46" cy="22" r="0.8" fill="white" />
          </g>

          {/* 鼻子 */}
          <ellipse cx="40" cy="27" rx="2" ry="1.5" fill="#8B4513" />

          {/* 嘴巴 */}
          <path
            d="M37 30 Q40 33 43 30"
            fill="none"
            stroke="#8B4513"
            strokeWidth="1"
            strokeLinecap="round"
            className={styles.smile}
          />

          {/* 头顶毛发 */}
          <path d="M36 12 Q40 8 44 12" fill="none" stroke="#8B4513" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* 手臂 - 在键盘上 */}
        <g className={styles.arms}>
          <ellipse cx="30" cy="48" rx="4" ry="3" fill="#D2691E" />
          <ellipse cx="50" cy="48" rx="4" ry="3" fill="#D2691E" />
          {/* 手指 */}
          <circle cx="28" cy="47" r="1.5" fill="#FFDAB9" />
          <circle cx="32" cy="47" r="1.5" fill="#FFDAB9" />
          <circle cx="48" cy="47" r="1.5" fill="#FFDAB9" />
          <circle cx="52" cy="47" r="1.5" fill="#FFDAB9" />
        </g>

        {/* 键盘 */}
        <rect x="28" y="46" width="24" height="3" rx="1" fill="#E5E7EB" filter="url(#shadow)" />
        <rect x="30" y="46.5" width="2" height="1.5" rx="0.3" fill="#D1D5DB" />
        <rect x="33" y="46.5" width="2" height="1.5" rx="0.3" fill="#D1D5DB" />
        <rect x="36" y="46.5" width="8" height="1.5" rx="0.3" fill="#D1D5DB" />
        <rect x="45" y="46.5" width="2" height="1.5" rx="0.3" fill="#D1D5DB" />
        <rect x="48" y="46.5" width="2" height="1.5" rx="0.3" fill="#D1D5DB" />
      </svg>
    </div>
  )
}
