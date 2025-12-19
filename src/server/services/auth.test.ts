import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { connectTestDB, closeTestDB, clearTestDB, getTestDB } from '../test/setup.js'
import { setDB } from '../db.js'
import { register, login, getUser } from './auth.js'

describe('auth service', () => {
  beforeAll(async () => {
    const db = await connectTestDB()
    setDB(db)
    // 创建索引
    await db.collection('users').createIndex({ username: 1 }, { unique: true })
  })

  afterAll(async () => {
    await closeTestDB()
  })

  beforeEach(async () => {
    await clearTestDB()
  })

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const result = await register('testuser', 'password123')

      expect(result).toBeDefined()
      expect(result.token).toBeDefined()
      expect(result.user.username).toBe('testuser')
      expect(result.user.id).toBeDefined()
    })

    it('should throw error for duplicate username', async () => {
      await register('duplicate', 'password123')

      await expect(register('duplicate', 'password456')).rejects.toThrow('用户名已存在')
    })

    it('should hash password correctly', async () => {
      await register('hashtest', 'mypassword')

      const db = getTestDB()
      const user = await db.collection('users').findOne({ username: 'hashtest' })

      expect(user).toBeDefined()
      expect(user!.password).not.toBe('mypassword')
      expect(user!.password.startsWith('$2')).toBe(true) // bcrypt hash
    })
  })

  describe('login', () => {
    it('should login with correct credentials', async () => {
      await register('loginuser1', 'correctpassword')
      const result = await login('loginuser1', 'correctpassword')

      expect(result).toBeDefined()
      expect(result.token).toBeDefined()
      expect(result.user.username).toBe('loginuser1')
    })

    it('should throw error for non-existent user', async () => {
      await expect(login('nonexistent', 'password')).rejects.toThrow('用户不存在')
    })

    it('should throw error for wrong password', async () => {
      await register('loginuser2', 'correctpassword')
      await expect(login('loginuser2', 'wrongpassword')).rejects.toThrow('密码错误')
    })
  })

  describe('getUser', () => {
    it('should get user by id', async () => {
      const registered = await register('getuser', 'password123')
      const user = await getUser(registered.user.id)

      expect(user).toBeDefined()
      expect(user!.username).toBe('getuser')
    })

    it('should return null for non-existent user id', async () => {
      const user = await getUser('507f1f77bcf86cd799439011') // valid but non-existent ObjectId

      expect(user).toBeNull()
    })
  })
})
