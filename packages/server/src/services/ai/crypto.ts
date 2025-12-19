import crypto from 'node:crypto'
import { config } from '../../config.js'

// 使用专门的 AI 加密密钥 (与 JWT secret 隔离)
const AI_ENCRYPTION_KEY = crypto.scryptSync(
  process.env.AI_ENCRYPTION_KEY || config.jwtSecret + '-ai',
  'ai-salt',
  32
)
const IV_LENGTH = 16

/**
 * 加密 API Key
 */
export function encryptApiKey(plainKey: string): string {
  if (!plainKey) return ''
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-cbc', AI_ENCRYPTION_KEY, iv)
  let encrypted = cipher.update(plainKey, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

/**
 * 解密 API Key
 */
export function decryptApiKey(encryptedKey: string): string {
  if (!encryptedKey || !encryptedKey.includes(':')) return ''
  try {
    const [ivHex, encrypted] = encryptedKey.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', AI_ENCRYPTION_KEY, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    return ''
  }
}

/**
 * 脱敏 API Key (仅显示前4位和后4位)
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 12) return '****'
  return apiKey.slice(0, 4) + '****' + apiKey.slice(-4)
}
