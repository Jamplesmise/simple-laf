import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { ObjectId } from 'mongodb'
import { connectTestDB, closeTestDB, clearTestDB, getTestDB } from '../test/setup.js'
import { setDB } from '../db.js'
import { searchFunctions } from './search.js'

describe('search service', () => {
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

  async function createTestFunction(name: string, code: string) {
    const db = getTestDB()
    await db.collection('functions').insertOne({
      name,
      code,
      userId: new ObjectId(testUserId),
      createdAt: new Date(),
      updatedAt: new Date()
    })
  }

  describe('searchFunctions', () => {
    it('should return empty array for short keyword', async () => {
      await createTestFunction('test', 'code')

      const results = await searchFunctions(testUserId, 'a')
      expect(results).toEqual([])
    })

    it('should return empty array for empty keyword', async () => {
      await createTestFunction('test', 'code')

      const results = await searchFunctions(testUserId, '')
      expect(results).toEqual([])
    })

    it('should search by function name', async () => {
      await createTestFunction('getUserById', 'function code')
      await createTestFunction('createOrder', 'other code')
      await createTestFunction('updateUser', 'more code')

      const results = await searchFunctions(testUserId, 'User')

      // 搜索应该找到包含 "User" 的函数名
      expect(results.length).toBeGreaterThanOrEqual(1)
      const names = results.map(r => r.name)
      // 至少应该找到一个包含 User 的
      expect(names.some(n => n.toLowerCase().includes('user'))).toBe(true)
    })

    it('should return name match type for name matches', async () => {
      await createTestFunction('apiHandler', 'code')

      const results = await searchFunctions(testUserId, 'api')

      expect(results).toHaveLength(1)
      expect(results[0].matchType).toBe('name')
      expect(results[0].highlights).toBeDefined()
      expect(results[0].highlights![0].start).toBe(0)
    })

    it('should search by code content', async () => {
      await createTestFunction('myFunction', `
        import cloud from '@/cloud-sdk'

        export default async function (ctx) {
          const result = await cloud.database().collection('users').find()
          return result
        }
      `)

      const results = await searchFunctions(testUserId, 'database')

      expect(results).toHaveLength(1)
      expect(results[0].matchType).toBe('code')
      expect(results[0].matchedLine).toContain('database')
      expect(results[0].lineNumber).toBeDefined()
    })

    it('should be case insensitive', async () => {
      await createTestFunction('TestFunction', 'CONSOLE.LOG("hello")')

      const results1 = await searchFunctions(testUserId, 'testfunction')
      const results2 = await searchFunctions(testUserId, 'console.log')

      expect(results1).toHaveLength(1)
      expect(results2).toHaveLength(1)
    })

    it('should limit code matches per function to 3', async () => {
      await createTestFunction('manyMatches', `
        const api1 = fetch('/api/1')
        const api2 = fetch('/api/2')
        const api3 = fetch('/api/3')
        const api4 = fetch('/api/4')
        const api5 = fetch('/api/5')
      `)

      const results = await searchFunctions(testUserId, 'api')

      // 只应返回最多3个代码匹配
      const codeMatches = results.filter(r => r.matchType === 'code')
      expect(codeMatches.length).toBeLessThanOrEqual(3)
    })

    it('should prioritize name match over code match', async () => {
      await createTestFunction('apiEndpoint', `
        // 这个函数名包含 api
        // 代码中也有 api
        const url = '/api/users'
      `)

      const results = await searchFunctions(testUserId, 'api')

      // 应该优先返回名称匹配，不应该重复返回代码匹配
      const nameMatches = results.filter(r => r.matchType === 'name')
      expect(nameMatches).toHaveLength(1)
      expect(nameMatches[0].name).toBe('apiEndpoint')
    })

    it('should respect limit option', async () => {
      for (let i = 0; i < 10; i++) {
        await createTestFunction(`func${i}`, 'code')
      }

      const results = await searchFunctions(testUserId, 'func', { limit: 5 })

      expect(results.length).toBeLessThanOrEqual(5)
    })

    it('should only search functions belonging to user', async () => {
      await createTestFunction('myFunc', 'my code')

      const otherUserId = new ObjectId().toString()
      const db = getTestDB()
      await db.collection('functions').insertOne({
        name: 'otherFunc',
        code: 'other code',
        userId: new ObjectId(otherUserId),
        createdAt: new Date()
      })

      const results = await searchFunctions(testUserId, 'Func')

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('myFunc')
    })

    it('should include highlight positions', async () => {
      await createTestFunction('testApi', 'code')

      const results = await searchFunctions(testUserId, 'Api')

      expect(results[0].highlights).toBeDefined()
      expect(results[0].highlights![0]).toEqual({ start: 4, end: 7 })
    })

    it('should truncate long matched lines', async () => {
      const longLine = 'const x = ' + 'a'.repeat(200) + 'searchterm' + 'b'.repeat(200)
      await createTestFunction('longCode', longLine)

      const results = await searchFunctions(testUserId, 'searchterm')

      expect(results[0].matchedLine!.length).toBeLessThanOrEqual(100)
    })
  })
})
