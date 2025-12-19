import { Request, Response, NextFunction } from 'express'

interface RateLimitEntry {
  count: number
  resetTime: number
}

const store = new Map<string, RateLimitEntry>()

// 清理过期条目
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetTime < now) {
      store.delete(key)
    }
  }
}, 60000) // 每分钟清理一次

export interface RateLimitOptions {
  windowMs?: number  // 时间窗口 (毫秒)
  max?: number       // 最大请求数
  keyGenerator?: (req: Request) => string
  message?: string
}

export function rateLimit(options: RateLimitOptions = {}) {
  const {
    windowMs = 60000,  // 默认 1 分钟
    max = 100,         // 默认 100 次请求
    keyGenerator = (req) => req.ip || 'unknown',
    message = '请求过于频繁，请稍后再试',
  } = options

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req)
    const now = Date.now()

    let entry = store.get(key)

    if (!entry || entry.resetTime < now) {
      entry = { count: 1, resetTime: now + windowMs }
      store.set(key, entry)
    } else {
      entry.count++
    }

    // 设置响应头
    const remaining = Math.max(0, max - entry.count)
    res.setHeader('X-RateLimit-Limit', max)
    res.setHeader('X-RateLimit-Remaining', remaining)
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000))

    if (entry.count > max) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
        },
      })
      return
    }

    next()
  }
}

// 预定义的速率限制配置
export const apiLimiter = rateLimit({
  windowMs: 60000,  // 1 分钟
  max: 100,         // 100 次请求
})

export const authLimiter = rateLimit({
  windowMs: 300000, // 5 分钟
  max: 10,          // 10 次登录尝试
  message: '登录尝试过于频繁，请 5 分钟后再试',
})

export const invokeLimiter = rateLimit({
  windowMs: 1000,   // 1 秒
  max: 50,          // 50 次调用
  message: '函数调用过于频繁',
})
