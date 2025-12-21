/**
 * 对话模块共享配置和工具函数
 */

import multer from 'multer'
import type { AuthRequest } from '../../../middleware/auth.js'

// ============ 文件上传配置 ============

/**
 * 允许的文件类型
 */
export const ALLOWED_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'application/json',
  'text/javascript',
  'text/typescript',
  'text/css',
  'text/html',
  'text/xml',
  'application/xml',
]

/**
 * 文件大小限制 (1MB)
 */
export const MAX_FILE_SIZE = 1 * 1024 * 1024

/**
 * multer 配置
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    // 检查 MIME 类型或文件扩展名
    const isAllowed = ALLOWED_MIME_TYPES.includes(file.mimetype) ||
      /\.(txt|md|json|js|ts|tsx|jsx|css|html|xml|yaml|yml)$/i.test(file.originalname)
    if (isAllowed) {
      cb(null, true)
    } else {
      cb(new Error('不支持的文件类型'))
    }
  },
})

/**
 * 扩展 AuthRequest 以支持 multer 的 file 属性
 */
export interface MulterAuthRequest extends AuthRequest {
  file?: Express.Multer.File
}

/**
 * 简单的 token 估算（基于字符数）
 */
export function estimateTokens(text: string): number {
  // 粗略估算：平均 4 个字符 = 1 个 token
  return Math.ceil(text.length / 4)
}
