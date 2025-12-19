import { describe, it, expect, beforeEach } from 'vitest'
import { executeFunction } from './executor.js'
import { clearCache } from './module.js'
import type { Cloud } from '../cloud/index.js'

// 创建模拟的 Cloud SDK
function createMockCloud(): Cloud {
  return {
    database: () => ({} as any),
    invoke: async () => ({}),
    env: process.env,
  }
}

describe('executor', () => {
  beforeEach(() => {
    clearCache()
  })

  describe('executeFunction', () => {
    it('should execute simple function', async () => {
      const code = `exports.default = function() { return 'hello' }`

      const result = await executeFunction('test', code, 'hash1', {
        body: {},
        query: {},
        headers: {},
        cloud: createMockCloud(),
      })

      expect(result.error).toBeUndefined()
      expect(result.data).toBe('hello')
      expect(result.time).toBeGreaterThanOrEqual(0)
    })

    it('should execute async function', async () => {
      const code = `
        exports.default = async function() {
          return new Promise(resolve => setTimeout(() => resolve('async'), 10))
        }
      `

      const result = await executeFunction('async-test', code, 'hash1', {
        body: {},
        query: {},
        headers: {},
        cloud: createMockCloud(),
      })

      expect(result.error).toBeUndefined()
      expect(result.data).toBe('async')
      // setTimeout 精度不可靠，只验证时间 >= 0
      expect(result.time).toBeGreaterThanOrEqual(0)
    })

    it('should pass context to function', async () => {
      const code = `
        exports.default = function(ctx) {
          return {
            receivedBody: ctx.body,
            receivedQuery: ctx.query
          }
        }
      `

      const result = await executeFunction('ctx-test', code, 'hash1', {
        body: { name: 'test' },
        query: { page: '1' },
        headers: {},
        cloud: createMockCloud(),
      })

      expect(result.error).toBeUndefined()
      expect(result.data).toEqual({
        receivedBody: { name: 'test' },
        receivedQuery: { page: '1' },
      })
    })

    it('should capture console.log', async () => {
      const code = `
        exports.default = function() {
          console.log('hello')
          console.log('world')
          return 'done'
        }
      `

      const result = await executeFunction('log-test', code, 'hash1', {
        body: {},
        query: {},
        headers: {},
        cloud: createMockCloud(),
      })

      expect(result.error).toBeUndefined()
      expect(result.logs).toContain('hello')
      expect(result.logs).toContain('world')
    })

    it('should capture console.error', async () => {
      const code = `
        exports.default = function() {
          console.error('error message')
          return 'ok'
        }
      `

      const result = await executeFunction('error-log-test', code, 'hash1', {
        body: {},
        query: {},
        headers: {},
        cloud: createMockCloud(),
      })

      expect(result.error).toBeUndefined()
      expect(result.logs).toContain('[ERROR] error message')
    })

    it('should return error for non-function export', async () => {
      const code = `exports.default = 'not a function'`

      const result = await executeFunction('non-fn-test', code, 'hash1', {
        body: {},
        query: {},
        headers: {},
        cloud: createMockCloud(),
      })

      expect(result.error).toContain('必须导出 default function')
    })

    it('should catch and return runtime error', async () => {
      const code = `
        exports.default = function() {
          throw new Error('runtime error')
        }
      `

      const result = await executeFunction('runtime-error-test', code, 'hash1', {
        body: {},
        query: {},
        headers: {},
        cloud: createMockCloud(),
      })

      expect(result.error).toBe('runtime error')
      expect(result.data).toBeNull()
    })

    it('should catch async error', async () => {
      const code = `
        exports.default = async function() {
          throw new Error('async error')
        }
      `

      const result = await executeFunction('async-error-test', code, 'hash1', {
        body: {},
        query: {},
        headers: {},
        cloud: createMockCloud(),
      })

      expect(result.error).toBe('async error')
    })

    it('should restore original console after execution', async () => {
      const originalLog = global.console.log
      const code = `exports.default = function() { return 1 }`

      await executeFunction('restore-test', code, 'hash1', {
        body: {},
        query: {},
        headers: {},
        cloud: createMockCloud(),
      })

      expect(global.console.log).toBe(originalLog)
    })
  })
})
