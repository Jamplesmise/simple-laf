import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { ObjectId } from 'mongodb'
import { connectTestDB, closeTestDB, clearTestDB, getTestDB } from '../test/setup.js'
import { setDB } from '../db.js'
import {
  list,
  findById,
  create,
  update,
  remove,
  incrementUseCount,
  getTags,
  search
} from './snippet.js'

describe('snippet service', () => {
  let testUserId: string

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
  })

  describe('create', () => {
    it('should create a new snippet', async () => {
      const snippet = await create(testUserId, {
        name: 'Test Snippet',
        description: 'A test snippet',
        code: 'console.log("hello")',
        tags: ['javascript', 'logging']
      })

      expect(snippet).toBeDefined()
      expect(snippet._id).toBeDefined()
      expect(snippet.name).toBe('Test Snippet')
      expect(snippet.description).toBe('A test snippet')
      expect(snippet.code).toBe('console.log("hello")')
      expect(snippet.tags).toEqual(['javascript', 'logging'])
      expect(snippet.useCount).toBe(0)
    })

    it('should create snippet with default empty tags', async () => {
      const snippet = await create(testUserId, {
        name: 'No Tags',
        code: 'code'
      })

      expect(snippet.tags).toEqual([])
    })
  })

  describe('list', () => {
    it('should return empty array for user with no snippets', async () => {
      const snippets = await list(testUserId)
      expect(snippets).toEqual([])
    })

    it('should return all snippets for user', async () => {
      await create(testUserId, { name: 'Snippet 1', code: 'code1' })
      await create(testUserId, { name: 'Snippet 2', code: 'code2' })
      await create(testUserId, { name: 'Snippet 3', code: 'code3' })

      const snippets = await list(testUserId)

      expect(snippets).toHaveLength(3)
    })

    it('should filter by tag', async () => {
      await create(testUserId, { name: 'JS Snippet', code: 'js', tags: ['javascript'] })
      await create(testUserId, { name: 'TS Snippet', code: 'ts', tags: ['typescript'] })
      await create(testUserId, { name: 'Both', code: 'both', tags: ['javascript', 'typescript'] })

      const jsSnippets = await list(testUserId, { tag: 'javascript' })

      expect(jsSnippets).toHaveLength(2)
      expect(jsSnippets.map(s => s.name)).toContain('JS Snippet')
      expect(jsSnippets.map(s => s.name)).toContain('Both')
    })

    it('should sort by useCount desc, then updatedAt desc', async () => {
      const s1 = await create(testUserId, { name: 'Low Use', code: 'code' })
      const s2 = await create(testUserId, { name: 'High Use', code: 'code' })

      // 增加s2的使用次数
      await incrementUseCount(s2._id!.toString(), testUserId)
      await incrementUseCount(s2._id!.toString(), testUserId)

      const snippets = await list(testUserId)

      expect(snippets[0].name).toBe('High Use')
      expect(snippets[1].name).toBe('Low Use')
    })
  })

  describe('findById', () => {
    it('should return snippet by id', async () => {
      const created = await create(testUserId, { name: 'Find Me', code: 'code' })

      const found = await findById(created._id!.toString(), testUserId)

      expect(found).toBeDefined()
      expect(found!.name).toBe('Find Me')
    })

    it('should return null for non-existent id', async () => {
      const fakeId = new ObjectId().toString()
      const found = await findById(fakeId, testUserId)
      expect(found).toBeNull()
    })

    it('should return null for different user', async () => {
      const created = await create(testUserId, { name: 'Private', code: 'code' })
      const otherUserId = new ObjectId().toString()

      const found = await findById(created._id!.toString(), otherUserId)
      expect(found).toBeNull()
    })
  })

  describe('update', () => {
    it('should update snippet fields', async () => {
      const snippet = await create(testUserId, {
        name: 'Original',
        description: 'Original desc',
        code: 'original code',
        tags: ['old']
      })

      const updated = await update(snippet._id!.toString(), testUserId, {
        name: 'Updated',
        description: 'New desc',
        code: 'new code',
        tags: ['new', 'updated']
      })

      expect(updated).toBeDefined()
      expect(updated!.name).toBe('Updated')
      expect(updated!.description).toBe('New desc')
      expect(updated!.code).toBe('new code')
      expect(updated!.tags).toEqual(['new', 'updated'])
    })

    it('should only update provided fields', async () => {
      const snippet = await create(testUserId, {
        name: 'Original',
        description: 'Keep this',
        code: 'original code'
      })

      const updated = await update(snippet._id!.toString(), testUserId, {
        name: 'New Name'
      })

      expect(updated!.name).toBe('New Name')
      expect(updated!.description).toBe('Keep this')
      expect(updated!.code).toBe('original code')
    })

    it('should return null for non-existent snippet', async () => {
      const fakeId = new ObjectId().toString()
      const updated = await update(fakeId, testUserId, { name: 'New' })
      expect(updated).toBeNull()
    })
  })

  describe('remove', () => {
    it('should delete snippet', async () => {
      const snippet = await create(testUserId, { name: 'To Delete', code: 'code' })

      const deleted = await remove(snippet._id!.toString(), testUserId)

      expect(deleted).toBe(true)

      const found = await findById(snippet._id!.toString(), testUserId)
      expect(found).toBeNull()
    })

    it('should return false for non-existent snippet', async () => {
      const fakeId = new ObjectId().toString()
      const deleted = await remove(fakeId, testUserId)
      expect(deleted).toBe(false)
    })
  })

  describe('incrementUseCount', () => {
    it('should increment use count', async () => {
      const snippet = await create(testUserId, { name: 'Counter', code: 'code' })

      await incrementUseCount(snippet._id!.toString(), testUserId)
      await incrementUseCount(snippet._id!.toString(), testUserId)
      await incrementUseCount(snippet._id!.toString(), testUserId)

      const found = await findById(snippet._id!.toString(), testUserId)
      expect(found!.useCount).toBe(3)
    })
  })

  describe('getTags', () => {
    it('should return empty array for user with no snippets', async () => {
      const tags = await getTags(testUserId)
      expect(tags).toEqual([])
    })

    it('should return unique sorted tags', async () => {
      await create(testUserId, { name: 'S1', code: 'c', tags: ['c', 'a'] })
      await create(testUserId, { name: 'S2', code: 'c', tags: ['b', 'a'] })
      await create(testUserId, { name: 'S3', code: 'c', tags: ['d'] })

      const tags = await getTags(testUserId)

      expect(tags).toEqual(['a', 'b', 'c', 'd'])
    })
  })

  describe('search', () => {
    beforeEach(async () => {
      await create(testUserId, {
        name: 'API Helper',
        description: 'Fetch data from API',
        code: 'fetch(url)',
        tags: ['http', 'api']
      })
      await create(testUserId, {
        name: 'Logger',
        description: 'Log messages',
        code: 'console.log(message)',
        tags: ['debug']
      })
      await create(testUserId, {
        name: 'Database Query',
        description: 'Query MongoDB',
        code: 'db.collection.find()',
        tags: ['mongodb', 'database']
      })
    })

    it('should search by name', async () => {
      const results = await search(testUserId, 'API')
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('API Helper')
    })

    it('should search by description', async () => {
      const results = await search(testUserId, 'MongoDB')
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Database Query')
    })

    it('should search by code', async () => {
      const results = await search(testUserId, 'console.log')
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Logger')
    })

    it('should search by tag', async () => {
      const results = await search(testUserId, 'http')
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('API Helper')
    })

    it('should be case insensitive', async () => {
      const results = await search(testUserId, 'api')
      expect(results).toHaveLength(1)
    })

    it('should return multiple matches', async () => {
      const results = await search(testUserId, 'a')
      expect(results.length).toBeGreaterThan(1)
    })
  })
})
