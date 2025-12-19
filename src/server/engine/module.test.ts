import { describe, it, expect, beforeEach } from 'vitest'
import { loadModule, clearCache, getCacheSize } from './module.js'

describe('module loader', () => {
  beforeEach(() => {
    clearCache()
  })

  describe('loadModule', () => {
    it('should load simple function', () => {
      const code = `
        exports.default = function() {
          return 'hello'
        }
      `
      const mod = loadModule('test', code, 'hash1')

      expect(mod.default).toBeDefined()
      expect(typeof mod.default).toBe('function')
      expect(mod.default!()).toBe('hello')
    })

    it('should load async function', async () => {
      const code = `
        exports.default = async function() {
          return 'async result'
        }
      `
      const mod = loadModule('async-test', code, 'hash1')

      const result = await mod.default!()
      expect(result).toBe('async result')
    })

    it('should load function with parameters', () => {
      const code = `
        exports.default = function(ctx) {
          return ctx.body
        }
      `
      const mod = loadModule('param-test', code, 'hash1')

      const result = mod.default!({ body: { data: 123 } })
      expect(result).toEqual({ data: 123 })
    })

    it('should cache module', () => {
      const code = `exports.default = function() { return 1 }`

      loadModule('cache-test', code, 'hash1')
      expect(getCacheSize()).toBe(1)

      // 相同 hash 应该使用缓存
      loadModule('cache-test', code, 'hash1')
      expect(getCacheSize()).toBe(1)
    })

    it('should reload module when hash changes', () => {
      const code1 = `exports.default = function() { return 1 }`
      const code2 = `exports.default = function() { return 2 }`

      const mod1 = loadModule('reload-test', code1, 'hash1')
      expect(mod1.default!()).toBe(1)

      const mod2 = loadModule('reload-test', code2, 'hash2')
      expect(mod2.default!()).toBe(2)
    })
  })

  describe('clearCache', () => {
    it('should clear specific module', () => {
      const code = `exports.default = function() { return 1 }`

      loadModule('test1', code, 'hash1')
      loadModule('test2', code, 'hash2')
      expect(getCacheSize()).toBe(2)

      clearCache('test1')
      expect(getCacheSize()).toBe(1)
    })

    it('should clear all modules', () => {
      const code = `exports.default = function() { return 1 }`

      loadModule('test1', code, 'hash1')
      loadModule('test2', code, 'hash2')
      expect(getCacheSize()).toBe(2)

      clearCache()
      expect(getCacheSize()).toBe(0)
    })
  })

  describe('error handling', () => {
    it('should throw on syntax error', () => {
      const code = `exports.default = function() { return `

      expect(() => loadModule('error-test', code, 'hash1')).toThrow()
    })
  })
})
