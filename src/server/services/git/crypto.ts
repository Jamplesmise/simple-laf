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
  const algorithm = 'aes-256-cbc'
  const key = crypto.scryptSync(config.jwtSecret, 'salt', 32)
  const [ivHex, encrypted] = ciphertext.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = crypto.createDecipheriv(algorithm, key, iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
