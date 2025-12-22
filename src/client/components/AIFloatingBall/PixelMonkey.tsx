import React, { useState, useEffect, useRef } from 'react'
import styles from './styles.module.css'
import { MonkeySprite, BananaTree, ZzzIcon, EmoteIcon } from './PixelArtAssets'

// 接收外部传入的 onClick
interface PixelMonkeyProps {
  onClick?: () => void
}

type MonkeyState = 'SLEEPING' | 'WAKING' | 'MOVING_TO_TREE' | 'EATING' | 'RETURNING'

export const PixelMonkey: React.FC<PixelMonkeyProps> = ({ onClick }) => {
  const [state, setState] = useState<MonkeyState>('SLEEPING')
  const [position, setPosition] = useState(0)
  const [facing, setFacing] = useState<'left' | 'right'>('left')
  
  // 30分钟 = 30 * 60 * 1000 毫秒
  const WAKE_UP_INTERVAL = 30 * 60 * 1000

  // 自动唤醒定时器
  useEffect(() => {
    let timer: NodeJS.Timeout
    
    if (state === 'SLEEPING') {
      timer = setTimeout(() => {
        startRoutine()
      }, WAKE_UP_INTERVAL)
    }

    return () => clearTimeout(timer)
  }, [state])

  // 开始进食循环
  const startRoutine = () => {
    if (state !== 'SLEEPING') return
    setState('WAKING')
    
    // 醒来 1.5秒后开始去觅食
    setTimeout(() => {
      setFacing('left')
      setState('MOVING_TO_TREE')
    }, 1500)
  }

  // 点击处理：既要打开 AI 窗口，也可以顺便叫醒猴子给个反馈
  const handleInteraction = () => {
    // 1. 优先触发原本的 AI 助手逻辑
    if (onClick) {
      onClick()
    }
    
    // 2. 只有在睡觉时点击，才会触发惊醒动画，但不进入吃香蕉流程（避免干扰工作）
    // 只是抬头看一眼，然后继续睡，增加一点电子宠物的互动感
    if (state === 'SLEEPING') {
      setState('WAKING')
      setTimeout(() => {
        setState('SLEEPING')
      }, 2000) // 醒来 2 秒后继续睡
    }
  }

  // 运动逻辑循环 (保持不变)
  useEffect(() => {
    let moveInterval: NodeJS.Timeout

    if (state === 'MOVING_TO_TREE') {
      moveInterval = setInterval(() => {
        setPosition(prev => {
          if (prev <= -180) { 
            clearInterval(moveInterval)
            setState('EATING')
            return prev
          }
          return prev - 2
        })
      }, 20)
    } else if (state === 'EATING') {
      // 吃 8 秒 (既然周期变长了，吃的时间也可以久一点)
      setTimeout(() => {
        setFacing('right')
        setState('RETURNING')
      }, 8000)
    } else if (state === 'RETURNING') {
      moveInterval = setInterval(() => {
        setPosition(prev => {
          if (prev >= 0) {
            clearInterval(moveInterval)
            setFacing('left')
            setState('SLEEPING')
            return 0
          }
          return prev + 2
        })
      }, 20)
    }

    return () => clearInterval(moveInterval)
  }, [state])

  return (
    <div className={styles.sceneContainer}>
      <div className={`${styles.treeContainer} ${state !== 'SLEEPING' ? styles.treeVisible : ''}`}>
        <BananaTree hasBananas={state !== 'RETURNING'} />
      </div>

      <div 
        className={styles.monkeyWrapper}
        style={{ transform: `translateX(${position}px)` }}
        onClick={handleInteraction} 
        role="button"
        title="点击打开 AI 助手"
      >
        <div className={styles.emoteArea}>
          {state === 'SLEEPING' && <ZzzIcon />}
          {state === 'WAKING' && <EmoteIcon type="alert" />}
          {state === 'EATING' && <EmoteIcon type="heart" />}
        </div>

        <div className={`${styles.spriteBox} ${facing === 'right' ? styles.flip : ''}`}>
           <MonkeySprite state={state} />
        </div>
      </div>
    </div>
  )
}