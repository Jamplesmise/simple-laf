import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { ObjectId } from 'mongodb'
import { connectTestDB, closeTestDB, clearTestDB, getTestDB } from '../test/setup.js'
import { setDB } from '../db.js'
import { list, create, findById, update, remove } from './function.js'

describe('function service', () => {
  const testUserId = new ObjectId().toString()
  const otherUserId = new ObjectId().toString()

  beforeAll(async () => {
    const db = await connectTestDB()
    setDB(db)
    // 创建索引
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

  describe('create', () => {
    it('should create a new function', async () => {
      const func = await create(testUserId, 'hello', 'export default async function() { return "Hello" }')

      expect(func).toBeDefined()
      expect(func.name).toBe('hello')
      expect(func.code).toContain('Hello')
      expect(func._id).toBeDefined()
    })

    it('should create function with published=true by default', async () => {
      const func = await create(testUserId, 'published', 'code')

      // 根据实际实现，新创建的函数默认是 published=true
      expect(func.published).toBe(true)
    })

    it('should throw error for duplicate function name for same user', async () => {
      await create(testUserId, 'duplicate', 'code1')

      await expect(create(testUserId, 'duplicate', 'code2')).rejects.toThrow()
    })

    it('should allow same function name for different users', async () => {
      await create(testUserId, 'samename', 'code1')
      const func2 = await create(otherUserId, 'samename', 'code2')

      expect(func2.name).toBe('samename')
    })
  })

  describe('list', () => {
    it('should return empty array for user with no functions', async () => {
      const functions = await list(testUserId)

      expect(functions).toEqual([])
    })

    it('should return all functions for a user', async () => {
      await create(testUserId, 'func1', 'code1')
      await create(testUserId, 'func2', 'code2')
      await create(otherUserId, 'func3', 'code3') // other user

      const functions = await list(testUserId)

      expect(functions).toHaveLength(2)
      expect(functions.map(f => f.name).sort()).toEqual(['func1', 'func2'])
    })

    it('should sort by updatedAt descending', async () => {
      const f1 = await create(testUserId, 'first', 'code1')
      await new Promise(resolve => setTimeout(resolve, 10))
      await create(testUserId, 'second', 'code2')

      const functions = await list(testUserId)

      expect(functions[0].name).toBe('second')
      expect(functions[1].name).toBe('first')
    })
  })

  describe('findById', () => {
    it('should find function by id', async () => {
      const created = await create(testUserId, 'findme', 'code')

      // 验证创建成功
      expect(created._id).toBeDefined()
      expect(created.name).toBe('findme')

      const found = await findById(created._id.toString(), testUserId)

      expect(found).not.toBeNull()
      expect(found?.name).toBe('findme')
      expect(found?.code).toBe('code')
    })

    it('should return null for non-existent function', async () => {
      const found = await findById(new ObjectId().toString(), testUserId)

      expect(found).toBeNull()
    })

    it('should not find function belonging to another user', async () => {
      const created = await create(testUserId, 'private', 'code')
      const found = await findById(created._id.toString(), otherUserId)

      expect(found).toBeNull()
    })
  })

  describe('update', () => {
    it('should update function code', async () => {
      const created = await create(testUserId, 'updateme', 'old code')
      const updated = await update(created._id.toString(), testUserId, { code: 'new code' })

      expect(updated).toBe(true)

      const found = await findById(created._id.toString(), testUserId)
      expect(found!.code).toBe('new code')
    })

    it('should return false for non-existent function', async () => {
      const updated = await update(new ObjectId().toString(), testUserId, { code: 'code' })

      expect(updated).toBe(false)
    })

    it('should not update function belonging to another user', async () => {
      const created = await create(testUserId, 'notmine', 'code')
      const updated = await update(created._id.toString(), otherUserId, { code: 'hacked' })

      expect(updated).toBe(false)

      const found = await findById(created._id.toString(), testUserId)
      expect(found!.code).toBe('code')
    })

    it('should update updatedAt timestamp', async () => {
      const created = await create(testUserId, 'timestamp', 'code')
      const originalUpdatedAt = created.updatedAt

      await new Promise(resolve => setTimeout(resolve, 10))
      await update(created._id.toString(), testUserId, { code: 'new' })

      const found = await findById(created._id.toString(), testUserId)
      expect(found!.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    it('should update published status', async () => {
      const created = await create(testUserId, 'topublish', 'code')
      // 默认是 published=true
      expect(created.published).toBe(true)

      // 先取消发布
      await update(created._id.toString(), testUserId, {
        published: false,
        publishedAt: null
      })

      // 然后重新发布
      const publishedAt = new Date()
      await update(created._id.toString(), testUserId, {
        published: true,
        publishedAt
      })

      const found = await findById(created._id.toString(), testUserId)
      expect(found!.published).toBe(true)
      expect(found!.publishedAt).toBeDefined()
    })

    it('should clear publishedAt when unpublishing', async () => {
      const created = await create(testUserId, 'tounpublish', 'code')
      await update(created._id.toString(), testUserId, {
        published: true,
        publishedAt: new Date()
      })

      await update(created._id.toString(), testUserId, {
        published: false,
        publishedAt: null
      })

      const found = await findById(created._id.toString(), testUserId)
      expect(found!.published).toBe(false)
      expect(found!.publishedAt).toBeNull()
    })
  })

  describe('remove', () => {
    it('should delete function', async () => {
      const created = await create(testUserId, 'deleteme', 'code')
      const deleted = await remove(created._id.toString(), testUserId)

      expect(deleted).toBe(true)

      const found = await findById(created._id.toString(), testUserId)
      expect(found).toBeNull()
    })

    it('should return false for non-existent function', async () => {
      const deleted = await remove(new ObjectId().toString(), testUserId)

      expect(deleted).toBe(false)
    })

    it('should not delete function belonging to another user', async () => {
      const created = await create(testUserId, 'protected', 'code')
      const deleted = await remove(created._id.toString(), otherUserId)

      expect(deleted).toBe(false)

      const found = await findById(created._id.toString(), testUserId)
      expect(found).toBeDefined()
    })
  })
})
