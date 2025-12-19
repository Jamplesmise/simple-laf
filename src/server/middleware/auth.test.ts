import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { authMiddleware, authOrDevelopMiddleware, type AuthRequest } from './auth.js'

describe('auth middleware', () => {
  let mockRequest: Partial<AuthRequest>
  let mockResponse: Partial<Response>
  let nextFunction: NextFunction

  beforeEach(() => {
    mockRequest = {
      headers: {}
    }
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    }
    nextFunction = vi.fn()
  })

  describe('authMiddleware', () => {
    it('should return 401 if no authorization header', () => {
      authMiddleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(mockResponse.status).toHaveBeenCalledWith(401)
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'AUTH_REQUIRED', message: '需要登录' }
      })
      expect(nextFunction).not.toHaveBeenCalled()
    })

    it('should return 401 for invalid token', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token'
      }

      authMiddleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(mockResponse.status).toHaveBeenCalledWith(401)
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Token 无效或已过期' }
      })
      expect(nextFunction).not.toHaveBeenCalled()
    })

    it('should call next and set user for valid token', () => {
      const token = jwt.sign(
        { userId: '123', username: 'testuser' },
        config.jwtSecret
      )
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      }

      authMiddleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalled()
      expect(mockRequest.user).toMatchObject({
        userId: '123',
        username: 'testuser'
      })
    })

    it('should return 401 for expired token', () => {
      const token = jwt.sign(
        { userId: '123', username: 'testuser' },
        config.jwtSecret,
        { expiresIn: '-1h' } // 已过期
      )
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      }

      authMiddleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(mockResponse.status).toHaveBeenCalledWith(401)
      expect(nextFunction).not.toHaveBeenCalled()
    })

    it('should handle token without Bearer prefix', () => {
      mockRequest.headers = {
        authorization: 'invalid-token'
      }

      authMiddleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      // 如果没有Bearer前缀，会尝试验证整个字符串
      expect(mockResponse.status).toHaveBeenCalledWith(401)
    })
  })

  describe('authOrDevelopMiddleware', () => {
    it('should allow develop token', () => {
      mockRequest.headers = {
        'x-develop-token': config.developToken,
        'x-user-id': 'dev-user-123'
      }

      authOrDevelopMiddleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalled()
      expect(mockRequest.user).toEqual({
        userId: 'dev-user-123',
        username: 'develop'
      })
    })

    it('should allow develop token without user id', () => {
      mockRequest.headers = {
        'x-develop-token': config.developToken
      }

      authOrDevelopMiddleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalled()
      // user 应该是 undefined
      expect(mockRequest.user).toBeUndefined()
    })

    it('should fall back to JWT auth if develop token is invalid', () => {
      mockRequest.headers = {
        'x-develop-token': 'wrong-token'
      }

      authOrDevelopMiddleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      // 应该尝试 JWT 验证，因为没有 authorization header 所以返回 401
      expect(mockResponse.status).toHaveBeenCalledWith(401)
    })

    it('should use JWT auth when no develop token', () => {
      const token = jwt.sign(
        { userId: '456', username: 'jwtuser' },
        config.jwtSecret
      )
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      }

      authOrDevelopMiddleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalled()
      expect(mockRequest.user).toMatchObject({
        userId: '456',
        username: 'jwtuser'
      })
    })

    it('should prefer develop token over JWT', () => {
      const token = jwt.sign(
        { userId: '456', username: 'jwtuser' },
        config.jwtSecret
      )
      mockRequest.headers = {
        'x-develop-token': config.developToken,
        'x-user-id': 'dev-user-789',
        authorization: `Bearer ${token}`
      }

      authOrDevelopMiddleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalled()
      // 应该使用 develop token 的用户
      expect(mockRequest.user).toEqual({
        userId: 'dev-user-789',
        username: 'develop'
      })
    })
  })
})
