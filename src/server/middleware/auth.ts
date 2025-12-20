import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { validateToken as validateApiToken } from '../services/apiToken.js'

export interface AuthPayload {
  userId: string
  username: string
}

export interface AuthRequest extends Request {
  user?: AuthPayload
}

/**
 * 标准 JWT 认证中间件
 * 支持两种认证方式:
 * 1. Bearer JWT token
 * 2. API Token (sk-xxx 格式)
 */
export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization

  if (!authHeader) {
    res.status(401).json({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: '需要登录' }
    })
    return
  }

  // 方式1: API Token (sk-xxx 格式)
  if (authHeader.startsWith('sk-')) {
    try {
      const result = await validateApiToken(authHeader)
      if (result.valid && result.userId) {
        req.user = { userId: result.userId.toString(), username: 'api' }
        next()
        return
      }
    } catch {
      // 验证失败，继续尝试其他方式
    }

    res.status(401).json({
      success: false,
      error: { code: 'INVALID_API_TOKEN', message: 'API Token 无效或已过期' }
    })
    return
  }

  // 方式2: Bearer JWT token
  const token = authHeader.replace('Bearer ', '')

  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: '需要登录' }
    })
    return
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthPayload
    req.user = payload
    next()
  } catch {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Token 无效或已过期' }
    })
  }
}

/**
 * 验证 JWT token
 */
export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, config.jwtSecret) as AuthPayload
}

/**
 * 扩展认证中间件 - 支持 JWT 和 develop token
 * 用于 invoke 等需要支持开发调试的路由
 */
export function authOrDevelopMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  // 方式1: 开发 token
  const developToken = req.headers['x-develop-token']
  if (developToken === config.developToken) {
    const userIdHeader = req.headers['x-user-id']
    if (userIdHeader && typeof userIdHeader === 'string') {
      req.user = { userId: userIdHeader, username: 'develop' }
    }
    next()
    return
  }

  // 方式2: 标准 JWT 认证
  authMiddleware(req, res, next)
}
