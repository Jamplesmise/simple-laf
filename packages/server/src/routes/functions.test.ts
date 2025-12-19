import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { ObjectId } from 'mongodb'
import { connectTestDB, closeTestDB, clearTestDB } from '../test/setup.js'
import { setDB } from '../db.js'
import { config } from '../config.js'
import functionsRouter from './functions.js'

describe('functions routes - publish/versions', () => {
  const app = express()
  app.use(express.json())
  app.use('/api/functions', functionsRouter)

  const testUserId = new ObjectId()
  const otherUserId = new ObjectId()
  const token = jwt.sign(
    { userId: testUserId.toString(), username: 'testuser' },
    config.jwtSecret
  )
  const otherToken = jwt.sign(
    { userId: otherUserId.toString(), username: 'other' },
    config.jwtSecret
  )

  beforeAll(async () => {
    const db = await connectTestDB()
    setDB(db)
    await db.collection('functions').createIndex(
      { userId: 1, name: 1 },
      { unique: true }
    )
  })

  afterAll(async () => {
    await closeTestDB()
  })

  beforeEach(async () => {
    await clearTestDB()
  })

  async function createTestFunction(name: string, code?: string) {
    const db = (await connectTestDB())
    const doc = {
      name,
      code: code || `export default async function() { return "${name}" }`,
      userId: testUserId,
      published: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    const result = await db.collection('functions').insertOne(doc)
    return { _id: result.insertedId, ...doc }
  }

  describe('POST /:id/publish', () => {
    it('should publish function and create version', async () => {
      const func = await createTestFunction('hello')

      const res = await request(app)
        .post(`/api/functions/${func._id}/publish`)
        .set('Authorization', `Bearer ${token}`)
        .send({ changelog: 'Initial version' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.version).toBeDefined()
      expect(res.body.data.url).toBe('/hello')
      expect(res.body.data.publishedAt).toBeDefined()
    })

    it('should handle compile and create version successfully', async () => {
      const func = await createTestFunction('validcode', 'export default async function() { return "test" }')

      const res = await request(app)
        .post(`/api/functions/${func._id}/publish`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.version).toBe(1)
    })

    it('should return 404 for non-existent function', async () => {
      const fakeId = new ObjectId()

      const res = await request(app)
        .post(`/api/functions/${fakeId}/publish`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
    })

    it('should return 404 for function belonging to another user', async () => {
      const func = await createTestFunction('private')

      const res = await request(app)
        .post(`/api/functions/${func._id}/publish`)
        .set('Authorization', `Bearer ${otherToken}`)

      expect(res.status).toBe(404)
    })

    it('should require authentication', async () => {
      const func = await createTestFunction('noauth')

      const res = await request(app)
        .post(`/api/functions/${func._id}/publish`)

      expect(res.status).toBe(401)
    })
  })

  describe('GET /:id/versions', () => {
    it('should return empty array when no versions exist', async () => {
      const func = await createTestFunction('noversions')

      const res = await request(app)
        .get(`/api/functions/${func._id}/versions`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toEqual([])
    })

    it('should return versions after publishing', async () => {
      const func = await createTestFunction('withversions')

      // Publish first
      await request(app)
        .post(`/api/functions/${func._id}/publish`)
        .set('Authorization', `Bearer ${token}`)
        .send({ changelog: 'v1' })

      const res = await request(app)
        .get(`/api/functions/${func._id}/versions`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data.length).toBe(1)
      expect(res.body.data[0].version).toBe(1)
      expect(res.body.data[0].changelog).toBe('v1')
    })

    it('should return 404 for non-existent function', async () => {
      const fakeId = new ObjectId()

      const res = await request(app)
        .get(`/api/functions/${fakeId}/versions`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(404)
    })

    it('should require authentication', async () => {
      const func = await createTestFunction('private')

      const res = await request(app)
        .get(`/api/functions/${func._id}/versions`)

      expect(res.status).toBe(401)
    })
  })

  describe('POST /:id/rollback', () => {
    it('should rollback to previous version', async () => {
      const func = await createTestFunction('rollbacktest')

      // Publish v1
      await request(app)
        .post(`/api/functions/${func._id}/publish`)
        .set('Authorization', `Bearer ${token}`)
        .send({ changelog: 'v1' })

      // Update code
      await request(app)
        .put(`/api/functions/${func._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'export default async function() { return "v2" }' })

      // Publish v2
      await request(app)
        .post(`/api/functions/${func._id}/publish`)
        .set('Authorization', `Bearer ${token}`)
        .send({ changelog: 'v2' })

      // Rollback to v1
      const res = await request(app)
        .post(`/api/functions/${func._id}/rollback`)
        .set('Authorization', `Bearer ${token}`)
        .send({ version: 1 })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.message).toContain('v1')
    })

    it('should return 400 for invalid version', async () => {
      const func = await createTestFunction('invalidrollback')

      const res = await request(app)
        .post(`/api/functions/${func._id}/rollback`)
        .set('Authorization', `Bearer ${token}`)
        .send({ version: 'invalid' })

      expect(res.status).toBe(400)
    })

    it('should return 404 for non-existent function', async () => {
      const fakeId = new ObjectId()

      const res = await request(app)
        .post(`/api/functions/${fakeId}/rollback`)
        .set('Authorization', `Bearer ${token}`)
        .send({ version: 1 })

      expect(res.status).toBe(404)
    })
  })
})
