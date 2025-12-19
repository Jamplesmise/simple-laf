import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { ObjectId } from 'mongodb'
import { connectTestDB, closeTestDB, clearTestDB, getTestDB } from '../test/setup.js'
import { setDB } from '../db.js'
import {
  createVersion,
  getVersions,
  getVersion,
  getLatestVersion,
  rollbackToVersion
} from './version.js'

describe('version service', () => {
  let testUserId: ObjectId
  let testFunctionId: ObjectId

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
    testFunctionId = new ObjectId()

    // 创建测试函数
    const db = getTestDB()
    await db.collection('functions').insertOne({
      _id: testFunctionId,
      name: 'testFunction',
      code: 'original code',
      compiled: 'original compiled',
      userId: testUserId,
      published: false,
      createdAt: new Date(),
      updatedAt: new Date()
    })
  })

  describe('createVersion', () => {
    it('should create first version with version number 1', async () => {
      const version = await createVersion(
        testFunctionId,
        'test code',
        'test compiled',
        'Initial version',
        testUserId
      )

      expect(version).toBeDefined()
      expect(version._id).toBeDefined()
      expect(version.version).toBe(1)
      expect(version.code).toBe('test code')
      expect(version.compiled).toBe('test compiled')
      expect(version.changelog).toBe('Initial version')
      expect(version.functionId.toString()).toBe(testFunctionId.toString())
      expect(version.userId.toString()).toBe(testUserId.toString())
    })

    it('should increment version number for subsequent versions', async () => {
      await createVersion(testFunctionId, 'v1 code', 'v1 compiled', 'v1', testUserId)
      const v2 = await createVersion(testFunctionId, 'v2 code', 'v2 compiled', 'v2', testUserId)
      const v3 = await createVersion(testFunctionId, 'v3 code', 'v3 compiled', 'v3', testUserId)

      expect(v2.version).toBe(2)
      expect(v3.version).toBe(3)
    })

    it('should update function with new version info', async () => {
      await createVersion(testFunctionId, 'new code', 'new compiled', 'Update', testUserId)

      const db = getTestDB()
      const func = await db.collection('functions').findOne({ _id: testFunctionId })

      expect(func).toBeDefined()
      expect(func!.currentVersion).toBe(1)
      expect(func!.publishedVersion).toBe(1)
      expect(func!.published).toBe(true)
    })
  })

  describe('getVersions', () => {
    it('should return empty array for function with no versions', async () => {
      const versions = await getVersions(testFunctionId)
      expect(versions).toEqual([])
    })

    it('should return all versions sorted by version desc', async () => {
      await createVersion(testFunctionId, 'v1', 'c1', 'v1', testUserId)
      await createVersion(testFunctionId, 'v2', 'c2', 'v2', testUserId)
      await createVersion(testFunctionId, 'v3', 'c3', 'v3', testUserId)

      const versions = await getVersions(testFunctionId)

      expect(versions).toHaveLength(3)
      expect(versions[0].version).toBe(3)
      expect(versions[1].version).toBe(2)
      expect(versions[2].version).toBe(1)
    })
  })

  describe('getVersion', () => {
    it('should return specific version', async () => {
      await createVersion(testFunctionId, 'v1', 'c1', 'v1', testUserId)
      await createVersion(testFunctionId, 'v2', 'c2', 'v2', testUserId)

      const version = await getVersion(testFunctionId, 1)

      expect(version).toBeDefined()
      expect(version!.version).toBe(1)
      expect(version!.code).toBe('v1')
    })

    it('should return null for non-existent version', async () => {
      await createVersion(testFunctionId, 'v1', 'c1', 'v1', testUserId)

      const version = await getVersion(testFunctionId, 999)
      expect(version).toBeNull()
    })
  })

  describe('getLatestVersion', () => {
    it('should return null for function with no versions', async () => {
      const version = await getLatestVersion(testFunctionId)
      expect(version).toBeNull()
    })

    it('should return latest version', async () => {
      await createVersion(testFunctionId, 'v1', 'c1', 'v1', testUserId)
      await createVersion(testFunctionId, 'v2', 'c2', 'v2', testUserId)
      await createVersion(testFunctionId, 'v3', 'c3', 'v3', testUserId)

      const version = await getLatestVersion(testFunctionId)

      expect(version).toBeDefined()
      expect(version!.version).toBe(3)
      expect(version!.code).toBe('v3')
    })
  })

  describe('rollbackToVersion', () => {
    it('should rollback to specified version', async () => {
      await createVersion(testFunctionId, 'v1 code', 'v1 compiled', 'v1', testUserId)
      await createVersion(testFunctionId, 'v2 code', 'v2 compiled', 'v2', testUserId)
      await createVersion(testFunctionId, 'v3 code', 'v3 compiled', 'v3', testUserId)

      const rollbackVersion = await rollbackToVersion(testFunctionId, 1, testUserId)

      expect(rollbackVersion).toBeDefined()
      expect(rollbackVersion.version).toBe(4) // 回滚创建新版本
      expect(rollbackVersion.code).toBe('v1 code')
      expect(rollbackVersion.compiled).toBe('v1 compiled')
      expect(rollbackVersion.changelog).toBe('回滚到 v1')
    })

    it('should update function code after rollback', async () => {
      await createVersion(testFunctionId, 'v1 code', 'v1 compiled', 'v1', testUserId)
      await createVersion(testFunctionId, 'v2 code', 'v2 compiled', 'v2', testUserId)

      await rollbackToVersion(testFunctionId, 1, testUserId)

      const db = getTestDB()
      const func = await db.collection('functions').findOne({ _id: testFunctionId })

      expect(func!.code).toBe('v1 code')
      expect(func!.compiled).toBe('v1 compiled')
    })

    it('should throw error for non-existent version', async () => {
      await createVersion(testFunctionId, 'v1', 'c1', 'v1', testUserId)

      await expect(rollbackToVersion(testFunctionId, 999, testUserId))
        .rejects.toThrow('版本不存在')
    })
  })
})
