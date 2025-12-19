import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { connectTestDB, closeTestDB, clearTestDB } from '../test/setup.js'
import { setDB } from '../db.js'
import authRouter from './auth.js'

describe('auth routes', () => {
  const app = express()
  app.use(express.json())
  app.use('/api/auth', authRouter)

  beforeAll(async () => {
    const db = await connectTestDB()
    setDB(db)
    await db.collection('users').createIndex({ username: 1 }, { unique: true })
  })

  afterAll(async () => {
    await closeTestDB()
  })

  beforeEach(async () => {
    await clearTestDB()
  })

  describe('POST /api/auth/register', () => {
    it('should register new user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'newuser', password: 'password123' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.token).toBeDefined()
      expect(res.body.data.user.username).toBe('newuser')
      expect(res.body.data.user.id).toBeDefined()
    })

    it('should return 400 for empty username', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: '', password: 'password123' })

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe('INVALID_INPUT')
    })

    it('should return 400 for empty password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: '' })

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('should return 400 for short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: '12345' })

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.error.message).toContain('6')
    })

    it('should return 400 for duplicate username', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ username: 'duplicate', password: 'password123' })

      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'duplicate', password: 'password456' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('REGISTER_FAILED')
    })
  })

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ username: 'loginuser', password: 'correctpass' })
    })

    it('should login with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'loginuser', password: 'correctpass' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.token).toBeDefined()
      expect(res.body.data.user.username).toBe('loginuser')
    })

    it('should return 400 for empty username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: '', password: 'password' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('INVALID_INPUT')
    })

    it('should return 400 for wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'loginuser', password: 'wrongpass' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('LOGIN_FAILED')
    })

    it('should return 400 for non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistent', password: 'password' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('LOGIN_FAILED')
    })
  })

  describe('GET /api/auth/me', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/auth/me')

      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('AUTH_REQUIRED')
    })

    it('should return 401 for invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')

      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('INVALID_TOKEN')
    })

    it('should return user info for valid token', async () => {
      // 先注册获取 token
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({ username: 'meuser', password: 'password123' })

      const token = registerRes.body.data.token

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.username).toBe('meuser')
    })
  })
})
