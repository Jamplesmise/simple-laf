import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { ObjectId } from 'mongodb'
import { connectTestDB, closeTestDB, clearTestDB } from '../test/setup.js'
import { setDB } from '../db.js'
import { config } from '../config.js'
import envRouter from './env.js'

describe('env routes', () => {
  const app = express()
  app.use(express.json())
  app.use('/api/env', envRouter)

  const testUserId = new ObjectId()
  const token = jwt.sign(
    { userId: testUserId.toString(), username: 'testuser' },
    config.jwtSecret
  )

  beforeAll(async () => {
    const db = await connectTestDB()
    setDB(db)
  })

  afterAll(async () => {
    await closeTestDB()
  })

  beforeEach(async () => {
    await clearTestDB()
  })

  describe('GET /api/env', () => {
    it('should return empty array when no env vars', async () => {
      const res = await request(app)
        .get('/api/env')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toEqual([])
    })

    it('should return env vars with decrypted values', async () => {
      // 先创建一个环境变量
      await request(app)
        .put('/api/env/API_KEY')
        .set('Authorization', `Bearer ${token}`)
        .send({ value: 'secret123', description: 'API Key' })

      const res = await request(app)
        .get('/api/env')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].key).toBe('API_KEY')
      expect(res.body.data[0].value).toBe('secret123')
      expect(res.body.data[0].description).toBe('API Key')
    })

    it('should require authentication', async () => {
      const res = await request(app).get('/api/env')

      expect(res.status).toBe(401)
    })
  })

  describe('PUT /api/env/:key', () => {
    it('should create new env variable', async () => {
      const res = await request(app)
        .put('/api/env/DB_HOST')
        .set('Authorization', `Bearer ${token}`)
        .send({ value: 'localhost', description: 'Database host' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })

    it('should update existing env variable', async () => {
      await request(app)
        .put('/api/env/PORT')
        .set('Authorization', `Bearer ${token}`)
        .send({ value: '3000' })

      const res = await request(app)
        .put('/api/env/PORT')
        .set('Authorization', `Bearer ${token}`)
        .send({ value: '8080', description: 'Updated port' })

      expect(res.status).toBe(200)

      const listRes = await request(app)
        .get('/api/env')
        .set('Authorization', `Bearer ${token}`)

      expect(listRes.body.data).toHaveLength(1)
      expect(listRes.body.data[0].value).toBe('8080')
    })

    it('should return 400 for empty value', async () => {
      const res = await request(app)
        .put('/api/env/EMPTY')
        .set('Authorization', `Bearer ${token}`)
        .send({ value: '' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('INVALID_INPUT')
    })

    it('should return 400 for invalid key format', async () => {
      const res = await request(app)
        .put('/api/env/invalid-key')
        .set('Authorization', `Bearer ${token}`)
        .send({ value: 'test' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('INVALID_KEY')
    })

    it('should accept valid key formats', async () => {
      const validKeys = ['API_KEY', 'DB_HOST_1', '_PRIVATE', 'A']

      for (const key of validKeys) {
        const res = await request(app)
          .put(`/api/env/${key}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ value: 'test' })

        expect(res.status).toBe(200)
      }
    })
  })

  describe('DELETE /api/env/:key', () => {
    it('should delete existing env variable', async () => {
      await request(app)
        .put('/api/env/TO_DELETE')
        .set('Authorization', `Bearer ${token}`)
        .send({ value: 'temp' })

      const res = await request(app)
        .delete('/api/env/TO_DELETE')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      const listRes = await request(app)
        .get('/api/env')
        .set('Authorization', `Bearer ${token}`)

      expect(listRes.body.data).toHaveLength(0)
    })

    it('should return 404 for non-existent key', async () => {
      const res = await request(app)
        .delete('/api/env/NON_EXISTENT')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
    })
  })

  describe('POST /api/env/bulk', () => {
    it('should bulk update env variables', async () => {
      // 先创建一些变量
      await request(app)
        .put('/api/env/OLD_KEY')
        .set('Authorization', `Bearer ${token}`)
        .send({ value: 'old' })

      // 批量更新
      const res = await request(app)
        .post('/api/env/bulk')
        .set('Authorization', `Bearer ${token}`)
        .send({
          variables: [
            { key: 'NEW_KEY_1', value: 'value1' },
            { key: 'NEW_KEY_2', value: 'value2' }
          ]
        })

      expect(res.status).toBe(200)

      const listRes = await request(app)
        .get('/api/env')
        .set('Authorization', `Bearer ${token}`)

      expect(listRes.body.data).toHaveLength(2)
      expect(listRes.body.data.find((e: { key: string }) => e.key === 'OLD_KEY')).toBeUndefined()
    })

    it('should return 400 for invalid data format', async () => {
      const res = await request(app)
        .post('/api/env/bulk')
        .set('Authorization', `Bearer ${token}`)
        .send({ variables: 'invalid' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('INVALID_INPUT')
    })

    it('should return 400 for invalid key in bulk update', async () => {
      const res = await request(app)
        .post('/api/env/bulk')
        .set('Authorization', `Bearer ${token}`)
        .send({
          variables: [
            { key: 'VALID_KEY', value: 'test' },
            { key: 'invalid-key', value: 'test' }
          ]
        })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('INVALID_KEY')
    })

    it('should handle empty variables array', async () => {
      await request(app)
        .put('/api/env/EXISTING')
        .set('Authorization', `Bearer ${token}`)
        .send({ value: 'value' })

      const res = await request(app)
        .post('/api/env/bulk')
        .set('Authorization', `Bearer ${token}`)
        .send({ variables: [] })

      expect(res.status).toBe(200)

      const listRes = await request(app)
        .get('/api/env')
        .set('Authorization', `Bearer ${token}`)

      expect(listRes.body.data).toHaveLength(0)
    })
  })
})
