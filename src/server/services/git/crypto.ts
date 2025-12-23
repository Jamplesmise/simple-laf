import * as crypto from 'crypto'
import { config } from '../../config.js'

// 加密
export function encrypt(text: string): string {
  const algorithm = 'aes-256-cbc'
  const key = crypto.scryptSync(config.jwtSecret, 'salt', 32)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

// 解密
export function decrypt(ciphertext: string): string {
  try {
    const algorithm = 'aes-256-cbc'
    const key = crypto.scryptSync(config.jwtSecret, 'salt', 32)
    const [ivHex, encrypted] = ciphertext.split(':')
    if (!ivHex || !encrypted) {
      throw new Error('Invalid ciphertext format')
    }
    const iv = Buffer.from(ivHex, 'hex')
    const decipher = crypto.createDecipheriv(algorithm, key, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (err) {
    console.error('[Git Crypto] 解密失败，可能是 JWT_SECRET 变更或 Token 损坏:', err)
    throw new Error('Token 解密失败，请重新配置 Git Token')
  }
}
