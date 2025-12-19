import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { ObjectId } from 'mongodb'
import { connectTestDB, closeTestDB, clearTestDB, getTestDB } from '../test/setup.js'
import { setDB } from '../db.js'
import {
  create,
  listByFunction,
  listByUser,
  findById,
  deleteByFunction,
  cleanupOldLogs,
  getStats,
  getOverallStats,
  getExecutionTrend
} from './executionLog.js'

describe('executionLog service', () => {
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
  })

  async function createTestLog(overrides: Partial<Parameters<typeof create>[0]> = {}) {
    return create({
      userId: testUserId,
      functionId: testFunctionId,
      functionName: 'testFunc',
      trigger: 'manual',
      request: { method: 'POST', body: { test: true } },
      success: true,
      data: { result: 'ok' },
      logs: [],
      duration: 100,
      ...overrides
    })
  }

  describe('create', () => {
    it('should create execution log', async () => {
      const log = await createTestLog()

      expect(log).toBeDefined()
      expect(log._id).toBeDefined()
      expect(log.userId).toBe(testUserId)
      expect(log.functionId).toBe(testFunctionId)
      expect(log.success).toBe(true)
      expect(log.createdAt).toBeDefined()
    })

    it('should store logs with error info', async () => {
      const log = await createTestLog({
        success: false,
        error: 'Something went wrong',
        logs: [
          { level: 'log', args: ['debug message'], timestamp: Date.now() },
          { level: 'error', args: ['error message'], timestamp: Date.now() }
        ]
      })

      expect(log.success).toBe(false)
      expect(log.error).toBe('Something went wrong')
      expect(log.logs).toHaveLength(2)
    })
  })

  describe('listByFunction', () => {
    it('should return logs for specific function', async () => {
      await createTestLog()
      await createTestLog()
      await createTestLog({ functionId: new ObjectId().toString() }) // 不同函数

      const { logs, total } = await listByFunction(testFunctionId, testUserId)

      expect(logs).toHaveLength(2)
      expect(total).toBe(2)
    })

    it('should support pagination', async () => {
      for (let i = 0; i < 10; i++) {
        await createTestLog()
      }

      const { logs, total } = await listByFunction(testFunctionId, testUserId, {
        limit: 3,
        offset: 2
      })

      expect(logs).toHaveLength(3)
      expect(total).toBe(10)
    })

    it('should sort by createdAt desc', async () => {
      await createTestLog()
      await new Promise(r => setTimeout(r, 10))
      await createTestLog()

      const { logs } = await listByFunction(testFunctionId, testUserId)

      expect(logs[0].createdAt.getTime()).toBeGreaterThan(logs[1].createdAt.getTime())
    })
  })

  describe('listByUser', () => {
    it('should return all logs for user', async () => {
      const func1 = new ObjectId().toString()
      const func2 = new ObjectId().toString()

      await createTestLog({ functionId: func1 })
      await createTestLog({ functionId: func2 })
      await createTestLog({ functionId: func1 })

      const { logs, total } = await listByUser(testUserId)

      expect(logs).toHaveLength(3)
      expect(total).toBe(3)
    })

    it('should filter by functionId', async () => {
      const func1 = new ObjectId().toString()
      const func2 = new ObjectId().toString()

      await createTestLog({ functionId: func1 })
      await createTestLog({ functionId: func2 })
      await createTestLog({ functionId: func1 })

      const { logs, total } = await listByUser(testUserId, { functionId: func1 })

      expect(logs).toHaveLength(2)
      expect(total).toBe(2)
    })
  })

  describe('findById', () => {
    it('should find log by id', async () => {
      const created = await createTestLog()

      const found = await findById(created._id!.toString(), testUserId)

      expect(found).toBeDefined()
      expect(found!._id!.toString()).toBe(created._id!.toString())
    })

    it('should return null for non-existent id', async () => {
      const fakeId = new ObjectId().toString()
      const found = await findById(fakeId, testUserId)
      expect(found).toBeNull()
    })
  })

  describe('deleteByFunction', () => {
    it('should delete all logs for function', async () => {
      await createTestLog()
      await createTestLog()
      await createTestLog()

      const count = await deleteByFunction(testFunctionId, testUserId)

      expect(count).toBe(3)

      const { logs } = await listByFunction(testFunctionId, testUserId)
      expect(logs).toHaveLength(0)
    })
  })

  describe('cleanupOldLogs', () => {
    it('should delete logs older than retention days', async () => {
      const db = getTestDB()

      // 创建旧日志
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 10)

      await db.collection('execution_logs').insertMany([
        { userId: testUserId, createdAt: oldDate, functionId: testFunctionId },
        { userId: testUserId, createdAt: oldDate, functionId: testFunctionId },
        { userId: testUserId, createdAt: new Date(), functionId: testFunctionId } // 新日志
      ])

      const count = await cleanupOldLogs(testUserId, 7)

      expect(count).toBe(2)

      const remaining = await db.collection('execution_logs')
        .find({ userId: testUserId })
        .toArray()
      expect(remaining).toHaveLength(1)
    })
  })

  describe('getStats', () => {
    it('should return stats for function', async () => {
      await createTestLog({ success: true, duration: 100 })
      await createTestLog({ success: true, duration: 200 })
      await createTestLog({ success: false, duration: 50 })

      const stats = await getStats(testFunctionId, testUserId)

      expect(stats.totalCount).toBe(3)
      expect(stats.successCount).toBe(2)
      expect(stats.failCount).toBe(1)
      expect(stats.avgDuration).toBe(117) // (100+200+50)/3 = 116.67 ≈ 117
    })

    it('should return zero stats for function with no logs', async () => {
      const stats = await getStats(testFunctionId, testUserId)

      expect(stats.totalCount).toBe(0)
      expect(stats.successCount).toBe(0)
      expect(stats.failCount).toBe(0)
      expect(stats.avgDuration).toBe(0)
    })

    it('should count last 24h executions', async () => {
      await createTestLog()
      await createTestLog()

      const stats = await getStats(testFunctionId, testUserId)

      expect(stats.last24hCount).toBe(2)
    })
  })

  describe('getOverallStats', () => {
    it('should return overall stats for user', async () => {
      const func1 = new ObjectId().toString()
      const func2 = new ObjectId().toString()

      await createTestLog({ functionId: func1, functionName: 'func1', success: true, trigger: 'manual' })
      await createTestLog({ functionId: func1, functionName: 'func1', success: true, trigger: 'manual' })
      await createTestLog({ functionId: func2, functionName: 'func2', success: false, trigger: 'scheduler' })
      await createTestLog({ functionId: func2, functionName: 'func2', success: true, trigger: 'webhook' })

      const stats = await getOverallStats(testUserId)

      expect(stats.totalExecutions).toBe(4)
      expect(stats.successCount).toBe(3)
      expect(stats.failCount).toBe(1)
      expect(stats.successRate).toBe(75)
    })

    it('should include trigger breakdown', async () => {
      await createTestLog({ trigger: 'manual' })
      await createTestLog({ trigger: 'manual' })
      await createTestLog({ trigger: 'scheduler' })
      await createTestLog({ trigger: 'webhook' })

      const stats = await getOverallStats(testUserId)

      expect(stats.triggerBreakdown).toBeDefined()
      const manualTrigger = stats.triggerBreakdown.find(t => t.trigger === 'manual')
      expect(manualTrigger?.count).toBe(2)
    })

    it('should include top functions', async () => {
      const func1 = new ObjectId().toString()
      const func2 = new ObjectId().toString()

      await createTestLog({ functionId: func1, functionName: 'mostUsed' })
      await createTestLog({ functionId: func1, functionName: 'mostUsed' })
      await createTestLog({ functionId: func1, functionName: 'mostUsed' })
      await createTestLog({ functionId: func2, functionName: 'lessUsed' })

      const stats = await getOverallStats(testUserId)

      expect(stats.topFunctions).toBeDefined()
      expect(stats.topFunctions[0].functionName).toBe('mostUsed')
      expect(stats.topFunctions[0].count).toBe(3)
    })
  })

  describe('getExecutionTrend', () => {
    it('should return daily and hourly trends', async () => {
      await createTestLog({ success: true })
      await createTestLog({ success: true })
      await createTestLog({ success: false })

      const trend = await getExecutionTrend(testUserId)

      expect(trend.daily).toBeDefined()
      expect(trend.hourly).toBeDefined()
    })

    it('should include success counts in trend data', async () => {
      await createTestLog({ success: true })
      await createTestLog({ success: false })

      const trend = await getExecutionTrend(testUserId, 1)

      if (trend.daily.length > 0) {
        expect(trend.daily[0]).toHaveProperty('count')
        expect(trend.daily[0]).toHaveProperty('successCount')
      }
    })
  })
})
