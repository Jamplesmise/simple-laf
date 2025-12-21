import type http from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { config } from '../../config.js'
import type { AuthPayload } from '../../middleware/auth.js'

// 监控事件类型
export interface MonitorEvent {
  type: 'execution' | 'error'
  timestamp: Date
  userId: string
  functionId: string
  functionName: string
  trigger: 'manual' | 'scheduler' | 'webhook' | 'public'
  success: boolean
  duration: number
  error?: string
}

// 扩展 Socket 类型
interface AuthenticatedSocket extends Socket {
  user?: AuthPayload
}

// 全局 Socket.IO 服务器实例
let io: SocketIOServer | null = null

/**
 * 设置监控 WebSocket 服务器
 */
export function setupMonitorWebSocket(server: http.Server): SocketIOServer {
  io = new SocketIOServer(server, {
    path: '/_/monitor',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  })

  // 认证中间件
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token as string | undefined

    if (!token) {
      return next(new Error('Authentication required'))
    }

    try {
      // 支持 Bearer 前缀
      const cleanToken = token.replace('Bearer ', '')
      const payload = jwt.verify(cleanToken, config.jwtSecret) as AuthPayload
      socket.user = payload
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  // 连接处理
  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.user?.userId

    if (!userId) {
      socket.disconnect()
      return
    }

    console.log(`[Monitor] User ${userId} connected`)

    // 自动加入用户专属房间
    socket.join(`user:${userId}`)

    // 订阅特定函数的事件
    socket.on('subscribe:function', (functionId: string) => {
      if (typeof functionId === 'string' && functionId.length > 0) {
        socket.join(`function:${functionId}`)
        console.log(`[Monitor] User ${userId} subscribed to function ${functionId}`)
      }
    })

    // 取消订阅
    socket.on('unsubscribe:function', (functionId: string) => {
      if (typeof functionId === 'string' && functionId.length > 0) {
        socket.leave(`function:${functionId}`)
        console.log(`[Monitor] User ${userId} unsubscribed from function ${functionId}`)
      }
    })

    // 订阅所有函数事件（仅限当前用户）
    socket.on('subscribe:all', () => {
      socket.join(`user:${userId}:all`)
      console.log(`[Monitor] User ${userId} subscribed to all functions`)
    })

    // 取消订阅所有
    socket.on('unsubscribe:all', () => {
      socket.leave(`user:${userId}:all`)
    })

    // 断开连接
    socket.on('disconnect', () => {
      console.log(`[Monitor] User ${userId} disconnected`)
    })
  })

  return io
}

/**
 * 广播执行事件
 */
export function broadcastExecutionEvent(event: MonitorEvent): void {
  if (!io) {
    return
  }

  const { userId, functionId } = event

  // 发送到用户专属房间
  io.to(`user:${userId}`).emit('execution', event)

  // 发送到函数专属房间
  io.to(`function:${functionId}`).emit('execution', event)

  // 发送到订阅所有函数的用户
  io.to(`user:${userId}:all`).emit('execution', event)
}

/**
 * 广播错误事件
 */
export function broadcastErrorEvent(event: MonitorEvent): void {
  if (!io) {
    return
  }

  const { userId, functionId } = event

  // 发送到用户专属房间
  io.to(`user:${userId}`).emit('error', event)

  // 发送到函数专属房间
  io.to(`function:${functionId}`).emit('error', event)

  // 发送到订阅所有函数的用户
  io.to(`user:${userId}:all`).emit('error', event)
}

/**
 * 获取 Socket.IO 实例
 */
export function getIO(): SocketIOServer | null {
  return io
}

/**
 * 获取连接统计
 */
export function getConnectionStats(): {
  totalConnections: number
  rooms: { name: string; size: number }[]
} {
  if (!io) {
    return { totalConnections: 0, rooms: [] }
  }

  const sockets = io.sockets.sockets
  const rooms: { name: string; size: number }[] = []

  io.sockets.adapter.rooms.forEach((sockets, room) => {
    // 排除 socket id 作为房间名的情况
    if (!sockets.has(room)) {
      rooms.push({ name: room, size: sockets.size })
    }
  })

  return {
    totalConnections: sockets.size,
    rooms,
  }
}
