import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { ObjectId } from 'mongodb'
import { connectTestDB, closeTestDB, clearTestDB, getTestDB } from '../test/setup.js'
import { setDB } from '../db.js'
import {
  list,
  findByFunction,
  findByToken,
  create,
  update,
  remove,
  verifySignature
} from './webhook.js'

describe('webhook service', () => {
  let testUserId: string
  let testFunctionId: string

  beforeAll(async () => {
    const db = await connectTestDB()
    setDB(db)
  })

  afterAll(async () => {
    await closeTestDB()
  })

  beforeEach(async () => {
    await clearTestDB()
    testUserId = new ObjectId().toString()
    testFunctionId = new ObjectId().toString()

    // 创建测试函数
    const db = getTestDB()
    await db.collection('functions').insertOne({
      _id: new ObjectId(testFunctionId),
      name: 'testFunction',
      code: 'code',
      compiled: 'compiled code',
      userId: new ObjectId(testUserId),
      createdAt: new Date(),
      updatedAt: new Date()
    })
  })

  describe('create', () => {
    it('should create webhook with default options', async () => {
      const webhook = await create(testUserId, testFunctionId)

      expect(webhook).toBeDefined()
      expect(webhook._id).toBeDefined()
      expect(webhook.token).toBeDefined()
      expect(webhook.token.length).toBe(32) // 16 bytes hex = 32 chars
      expect(webhook.secret).toBeUndefined()
      expect(webhook.enabled).toBe(true)
      expect(webhook.methods).toEqual(['POST'])
      expect(webhook.callCount).toBe(0)
    })

    it('should create webhook with custom methods', async () => {
      const webhook = await create(testUserId, testFunctionId, {
        methods: ['GET', 'POST', 'PUT']
      })

      expect(webhook.methods).toEqual(['GET', 'POST', 'PUT'])
    })

    it('should create webhook with secret', async () => {
      const webhook = await create(testUserId, testFunctionId, {
        generateSecret: true
      })

      expect(webhook.secret).toBeDefined()
      expect(webhook.secret!.length).toBe(64) // 32 bytes hex = 64 chars
    })

    it('should throw error for non-existent function', async () => {
      const fakeId = new ObjectId().toString()

      await expect(create(testUserId, fakeId))
        .rejects.toThrow('函数不存在')
    })

    it('should throw error for duplicate webhook', async () => {
      await create(testUserId, testFunctionId)

      await expect(create(testUserId, testFunctionId))
        .rejects.toThrow('该函数已有 Webhook')
    })
  })

  describe('list', () => {
    it('should return empty array for user with no webhooks', async () => {
      const webhooks = await list(testUserId)
      expect(webhooks).toEqual([])
    })

    it('should return all webhooks for user', async () => {
      // 创建多个函数和webhook
      const db = getTestDB()
      const func2Id = new ObjectId().toString()
      await db.collection('functions').insertOne({
        _id: new ObjectId(func2Id),
        name: 'func2',
        code: 'code',
        userId: new ObjectId(testUserId),
        createdAt: new Date()
      })

      await create(testUserId, testFunctionId)
      await create(testUserId, func2Id)

      const webhooks = await list(testUserId)

      expect(webhooks).toHaveLength(2)
    })

    it('should sort by createdAt desc', async () => {
      const db = getTestDB()
      const func2Id = new ObjectId().toString()
      await db.collection('functions').insertOne({
        _id: new ObjectId(func2Id),
        name: 'func2',
        code: 'code',
        userId: new ObjectId(testUserId),
        createdAt: new Date()
      })

      await create(testUserId, testFunctionId)
      await new Promise(r => setTimeout(r, 10))
      await create(testUserId, func2Id)

      const webhooks = await list(testUserId)

      expect(webhooks[0].functionName).toBe('func2')
    })
  })

  describe('findByFunction', () => {
    it('should find webhook by function id', async () => {
      await create(testUserId, testFunctionId)

      const webhook = await findByFunction(testFunctionId, testUserId)

      expect(webhook).toBeDefined()
      expect(webhook!.functionId).toBe(testFunctionId)
    })

    it('should return null for function without webhook', async () => {
      const webhook = await findByFunction(testFunctionId, testUserId)
      expect(webhook).toBeNull()
    })
  })

  describe('findByToken', () => {
    it('should find webhook by token', async () => {
      const created = await create(testUserId, testFunctionId)

      const webhook = await findByToken(created.token)

      expect(webhook).toBeDefined()
      expect(webhook!._id!.toString()).toBe(created._id!.toString())
    })

    it('should return null for non-existent token', async () => {
      const webhook = await findByToken('nonexistent-token')
      expect(webhook).toBeNull()
    })
  })

  describe('update', () => {
    it('should update enabled status', async () => {
      const webhook = await create(testUserId, testFunctionId)

      const updated = await update(webhook._id!.toString(), testUserId, {
        enabled: false
      })

      expect(updated).toBeDefined()
      expect(updated!.enabled).toBe(false)
    })

    it('should update methods', async () => {
      const webhook = await create(testUserId, testFunctionId)

      const updated = await update(webhook._id!.toString(), testUserId, {
        methods: ['GET', 'DELETE']
      })

      expect(updated!.methods).toEqual(['GET', 'DELETE'])
    })

    it('should regenerate token', async () => {
      const webhook = await create(testUserId, testFunctionId)
      const originalToken = webhook.token

      const updated = await update(webhook._id!.toString(), testUserId, {
        regenerateToken: true
      })

      expect(updated!.token).not.toBe(originalToken)
      expect(updated!.token.length).toBe(32)
    })

    it('should regenerate secret', async () => {
      const webhook = await create(testUserId, testFunctionId, { generateSecret: true })
      const originalSecret = webhook.secret

      const updated = await update(webhook._id!.toString(), testUserId, {
        regenerateSecret: true
      })

      expect(updated!.secret).not.toBe(originalSecret)
      expect(updated!.secret!.length).toBe(64)
    })

    it('should return null for non-existent webhook', async () => {
      const fakeId = new ObjectId().toString()

      const updated = await update(fakeId, testUserId, { enabled: false })
      expect(updated).toBeNull()
    })
  })

  describe('remove', () => {
    it('should delete webhook', async () => {
      const webhook = await create(testUserId, testFunctionId)

      const deleted = await remove(webhook._id!.toString(), testUserId)

      expect(deleted).toBe(true)

      const found = await findByFunction(testFunctionId, testUserId)
      expect(found).toBeNull()
    })

    it('should return false for non-existent webhook', async () => {
      const fakeId = new ObjectId().toString()

      const deleted = await remove(fakeId, testUserId)
      expect(deleted).toBe(false)
    })

    it('should not delete webhook of different user', async () => {
      const webhook = await create(testUserId, testFunctionId)
      const otherUserId = new ObjectId().toString()

      const deleted = await remove(webhook._id!.toString(), otherUserId)
      expect(deleted).toBe(false)

      const found = await findByFunction(testFunctionId, testUserId)
      expect(found).toBeDefined()
    })
  })

  describe('verifySignature', () => {
    it('should verify valid signature', () => {
      const payload = '{"data": "test"}'
      const secret = 'mysecret'

      // 计算正确的签名
      const crypto = require('crypto')
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex')

      const isValid = verifySignature(payload, expectedSignature, secret)
      expect(isValid).toBe(true)
    })

    it('should reject invalid signature', () => {
      const payload = '{"data": "test"}'
      const secret = 'mysecret'
      const wrongSignature = 'invalidsignature1234567890abcdef1234567890abcdef1234567890abcdef'

      const isValid = verifySignature(payload, wrongSignature, secret)
      expect(isValid).toBe(false)
    })

    it('should reject signature with wrong payload', () => {
      const payload = '{"data": "test"}'
      const secret = 'mysecret'

      const crypto = require('crypto')
      const signatureForDifferentPayload = crypto
        .createHmac('sha256', secret)
        .update('{"data": "different"}')
        .digest('hex')

      const isValid = verifySignature(payload, signatureForDifferentPayload, secret)
      expect(isValid).toBe(false)
    })
  })
})
