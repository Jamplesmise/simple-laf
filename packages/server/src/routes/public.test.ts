import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { ObjectId } from 'mongodb'
import { connectTestDB, closeTestDB, clearTestDB } from '../test/setup.js'
import { setDB } from '../db.js'
import publicRouter from './public.js'

describe('public routes', () => {
  const app = express()
  app.use(express.json())
  app.use(publicRouter)
  // 模拟 SPA fallback
  app.use((_req, res) => {
    res.status(200).send('SPA fallback')
  })

  const testUserId = new ObjectId()

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

  async function createTestFunction(
    name: string,
    compiled: string,
    published: boolean
  ) {
    const db = await connectTestDB()
    const doc = {
      name,
      code: `export default async function() { return "${name}" }`,
      compiled,
      hash: 'testhash',
      userId: testUserId,
      published,
      publishedAt: published ? new Date() : null,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    const result = await db.collection('functions').insertOne(doc)
    return { _id: result.insertedId, ...doc }
  }

  describe('ALL /:name', () => {
    it('should execute published function without authentication', async () => {
      await createTestFunction(
        'publicfunc',
        `module.exports.default = async function(ctx) { return { msg: "public" } }`,
        true
      )

      const res = await request(app)
        .get('/publicfunc')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ msg: 'public' })
    })

    it('should return function result directly without wrapper', async () => {
      await createTestFunction(
        'directresult',
        `module.exports.default = async function() { return "hello world" }`,
        true
      )

      const res = await request(app)
        .get('/directresult')

      expect(res.status).toBe(200)
      expect(res.body).toBe('hello world')
    })

    it('should fall through to SPA for unpublished function', async () => {
      await createTestFunction(
        'unpublished',
        `module.exports.default = async function() { return "secret" }`,
        false
      )

      const res = await request(app)
        .get('/unpublished')

      // 未发布的函数应该 fall through 到 SPA fallback
      expect(res.status).toBe(200)
      expect(res.text).toBe('SPA fallback')
    })

    it('should fall through to SPA for non-existent function', async () => {
      const res = await request(app)
        .get('/nonexistent')

      // 不存在的函数应该 fall through 到 SPA fallback
      expect(res.status).toBe(200)
      expect(res.text).toBe('SPA fallback')
    })

    it('should support POST requests with body', async () => {
      await createTestFunction(
        'postfunc',
        `module.exports.default = async function(ctx) { return { received: ctx.body } }`,
        true
      )

      const res = await request(app)
        .post('/postfunc')
        .send({ data: 'test' })

      expect(res.status).toBe(200)
      expect(res.body.received).toEqual({ data: 'test' })
    })

    it('should support query parameters', async () => {
      await createTestFunction(
        'queryfunc',
        `module.exports.default = async function(ctx) { return { name: ctx.query.name } }`,
        true
      )

      const res = await request(app)
        .get('/queryfunc?name=claude')

      expect(res.status).toBe(200)
      expect(res.body.name).toBe('claude')
    })

    it('should set x-execution-time header', async () => {
      await createTestFunction(
        'timefunc',
        `module.exports.default = async function() { return "ok" }`,
        true
      )

      const res = await request(app)
        .get('/timefunc')

      expect(res.status).toBe(200)
      expect(res.headers['x-execution-time']).toBeDefined()
    })

    it('should return 500 for execution errors', async () => {
      await createTestFunction(
        'errorfunc',
        `module.exports.default = async function() { throw new Error("boom") }`,
        true
      )

      const res = await request(app)
        .get('/errorfunc')

      expect(res.status).toBe(500)
      expect(res.body.success).toBe(false)
      expect(res.body.error.message).toContain('boom')
    })
  })
})
