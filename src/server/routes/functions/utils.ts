import type { Response } from 'express'

/**
 * 发送成功响应
 */
export function sendSuccess<T>(res: Response, data: T): void {
  res.json({ success: true, data })
}

/**
 * 发送错误响应
 */
export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string
): void {
  res.status(statusCode).json({
    success: false,
    error: { code, message }
  })
}

/**
 * 处理通用错误
 */
export function handleError(res: Response, err: unknown, defaultMessage: string): void {
  const message = err instanceof Error ? err.message : defaultMessage
  sendError(res, 500, 'SERVER_ERROR', message)
}
