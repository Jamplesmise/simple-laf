import { broadcastExecutionEvent, type MonitorEvent } from '../services/monitor/index.js'

// 事件批量缓存
const eventBuffer: MonitorEvent[] = []
const BATCH_INTERVAL = 100 // 批量发送间隔（毫秒）
const BATCH_SIZE = 10 // 批量发送阈值

let flushTimer: NodeJS.Timeout | null = null

/**
 * 添加事件到缓冲区并批量广播
 */
function bufferEvent(event: MonitorEvent): void {
  eventBuffer.push(event)

  // 达到阈值立即发送
  if (eventBuffer.length >= BATCH_SIZE) {
    flushEvents()
    return
  }

  // 设置定时器延迟发送
  if (!flushTimer) {
    flushTimer = setTimeout(flushEvents, BATCH_INTERVAL)
  }
}

/**
 * 刷新事件缓冲区
 */
function flushEvents(): void {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }

  if (eventBuffer.length === 0) {
    return
  }

  // 批量广播所有事件
  const events = eventBuffer.splice(0, eventBuffer.length)
  for (const event of events) {
    broadcastExecutionEvent(event)
  }
}

/**
 * 记录执行事件并广播
 */
export function emitExecutionEvent(params: {
  userId: string
  functionId: string
  functionName: string
  trigger: 'manual' | 'scheduler' | 'webhook' | 'public'
  success: boolean
  duration: number
  error?: string
}): void {
  const event: MonitorEvent = {
    type: params.success ? 'execution' : 'error',
    timestamp: new Date(),
    userId: params.userId,
    functionId: params.functionId,
    functionName: params.functionName,
    trigger: params.trigger,
    success: params.success,
    duration: params.duration,
    error: params.error,
  }

  // 使用缓冲区批量发送
  bufferEvent(event)
}

/**
 * 立即刷新所有待发送事件（用于服务关闭时）
 */
export function flushAllEvents(): void {
  flushEvents()
}
