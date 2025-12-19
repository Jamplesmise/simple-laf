import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { ObjectId } from 'mongodb'
import { connectTestDB, closeTestDB, clearTestDB, getTestDB } from '../test/setup.js'
import { setDB } from '../db.js'
import {
  listEnvVariables,
  listEnvVariablesWithValues,
  getEnvVariables,
  setEnvVariable,
  deleteEnvVariable,
  bulkUpdateEnvVariables
} from './env.js'

describe('env service', () => {
  let testUserId: ObjectId

  beforeAll(async () => {
    const db = await connectTestDB()
    setDB(db)
  })

  afterAll(async () => {
    await closeTestDB()
  })

  beforeEach(async () => {
    await clearTestDB()
    testUserId = new ObjectId()
  })

  describe('setEnvVariable', () => {
    it('should create new environment variable', async () => {
      await setEnvVariable(testUserId, 'API_KEY', 'secret123', 'API密钥')

      const db = getTestDB()
      const env = await db.collection('env_variables').findOne({ userId: testUserId, key: 'API_KEY' })

      expect(env).toBeDefined()
      expect(env!.key).toBe('API_KEY')
      expect(env!.description).toBe('API密钥')
      // 值应该被加密
      expect(env!.value).not.toBe('secret123')
      expect(env!.value).toContain(':') // IV:encrypted format
    })

    it('should update existing environment variable', async () => {
      await setEnvVariable(testUserId, 'API_KEY', 'value1')
      await setEnvVariable(testUserId, 'API_KEY', 'value2', 'Updated')

      const db = getTestDB()
      const envs = await db.collection('env_variables').find({ userId: testUserId, key: 'API_KEY' }).toArray()

      expect(envs).toHaveLength(1)
      expect(envs[0].description).toBe('Updated')
    })
  })

  describe('listEnvVariables', () => {
    it('should return empty array for user with no env vars', async () => {
      const result = await listEnvVariables(testUserId)
      expect(result).toEqual([])
    })

    it('should return list without values', async () => {
      await setEnvVariable(testUserId, 'KEY1', 'value1', 'Desc 1')
      await setEnvVariable(testUserId, 'KEY2', 'value2', 'Desc 2')

      const result = await listEnvVariables(testUserId)

      expect(result).toHaveLength(2)
      expect(result[0].key).toBe('KEY1')
      expect(result[0].description).toBe('Desc 1')
      expect(result[0].hasValue).toBe(true)
      // 不应该包含value字段
      expect((result[0] as Record<string, unknown>).value).toBeUndefined()
    })
  })

  describe('listEnvVariablesWithValues', () => {
    it('should return list with decrypted values', async () => {
      await setEnvVariable(testUserId, 'KEY1', 'secretValue1')
      await setEnvVariable(testUserId, 'KEY2', 'secretValue2')

      const result = await listEnvVariablesWithValues(testUserId)

      expect(result).toHaveLength(2)
      expect(result.find(e => e.key === 'KEY1')?.value).toBe('secretValue1')
      expect(result.find(e => e.key === 'KEY2')?.value).toBe('secretValue2')
    })
  })

  describe('getEnvVariables', () => {
    it('should return empty object for user with no env vars', async () => {
      const result = await getEnvVariables(testUserId)
      expect(result).toEqual({})
    })

    it('should return key-value object with decrypted values', async () => {
      await setEnvVariable(testUserId, 'DB_HOST', 'localhost')
      await setEnvVariable(testUserId, 'DB_PORT', '5432')
      await setEnvVariable(testUserId, 'API_SECRET', 'my-secret-key')

      const result = await getEnvVariables(testUserId)

      expect(result).toEqual({
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        API_SECRET: 'my-secret-key'
      })
    })
  })

  describe('deleteEnvVariable', () => {
    it('should delete existing environment variable', async () => {
      await setEnvVariable(testUserId, 'TO_DELETE', 'value')

      const deleted = await deleteEnvVariable(testUserId, 'TO_DELETE')

      expect(deleted).toBe(true)

      const db = getTestDB()
      const env = await db.collection('env_variables').findOne({ userId: testUserId, key: 'TO_DELETE' })
      expect(env).toBeNull()
    })

    it('should return false for non-existent key', async () => {
      const deleted = await deleteEnvVariable(testUserId, 'NON_EXISTENT')
      expect(deleted).toBe(false)
    })
  })

  describe('bulkUpdateEnvVariables', () => {
    it('should replace all environment variables', async () => {
      // 设置一些初始变量
      await setEnvVariable(testUserId, 'OLD_KEY1', 'old1')
      await setEnvVariable(testUserId, 'OLD_KEY2', 'old2')

      // 批量更新
      await bulkUpdateEnvVariables(testUserId, [
        { key: 'NEW_KEY1', value: 'new1' },
        { key: 'NEW_KEY2', value: 'new2' },
        { key: 'NEW_KEY3', value: 'new3' }
      ])

      const result = await getEnvVariables(testUserId)

      // 旧的应该被删除
      expect(result.OLD_KEY1).toBeUndefined()
      expect(result.OLD_KEY2).toBeUndefined()

      // 新的应该存在
      expect(result.NEW_KEY1).toBe('new1')
      expect(result.NEW_KEY2).toBe('new2')
      expect(result.NEW_KEY3).toBe('new3')
    })

    it('should delete all env vars when given empty array', async () => {
      await setEnvVariable(testUserId, 'KEY1', 'value1')
      await setEnvVariable(testUserId, 'KEY2', 'value2')

      await bulkUpdateEnvVariables(testUserId, [])

      const result = await getEnvVariables(testUserId)
      expect(result).toEqual({})
    })
  })

  describe('encryption', () => {
    it('should encrypt values with different IVs', async () => {
      await setEnvVariable(testUserId, 'KEY1', 'same-value')
      await setEnvVariable(testUserId, 'KEY2', 'same-value')

      const db = getTestDB()
      const env1 = await db.collection('env_variables').findOne({ userId: testUserId, key: 'KEY1' })
      const env2 = await db.collection('env_variables').findOne({ userId: testUserId, key: 'KEY2' })

      // 即使值相同，加密后的结果也应该不同（因为IV不同）
      expect(env1!.value).not.toBe(env2!.value)
    })

    it('should correctly decrypt values', async () => {
      const testValue = '复杂的值 with special chars: !@#$%^&*()'
      await setEnvVariable(testUserId, 'COMPLEX', testValue)

      const result = await getEnvVariables(testUserId)
      expect(result.COMPLEX).toBe(testValue)
    })
  })
})
