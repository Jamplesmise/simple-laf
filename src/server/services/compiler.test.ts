import { describe, it, expect } from 'vitest'
import { compileTypeScript, safeCompile } from './compiler.js'

describe('compiler service', () => {
  describe('compileTypeScript', () => {
    it('should compile simple TypeScript to JavaScript', () => {
      const tsCode = `const x: number = 1;`
      const result = compileTypeScript(tsCode)

      // ES2020 保留 const，类型注解被移除
      expect(result).toContain('const x = 1')
      expect(result).not.toContain(': number')
    })

    it('should compile async function', () => {
      const tsCode = `
        export default async function(ctx: any) {
          return "Hello"
        }
      `
      const result = compileTypeScript(tsCode)

      expect(result).toContain('async function')
      expect(result).toContain('Hello')
    })

    it('should compile interface and type annotations', () => {
      const tsCode = `
        interface User {
          name: string
          age: number
        }
        const user: User = { name: "test", age: 18 }
      `
      const result = compileTypeScript(tsCode)

      // Interface should be stripped, const preserved in ES2020
      expect(result).not.toContain('interface')
      expect(result).toContain('const user')
      expect(result).not.toContain(': User')
    })

    it('should compile arrow functions', () => {
      const tsCode = `const add = (a: number, b: number): number => a + b`
      const result = compileTypeScript(tsCode)

      // 类型注解被移除，const 保留
      expect(result).toContain('const add')
      expect(result).toContain('=> a + b')
      expect(result).not.toContain(': number')
    })

    it('should handle import statements', () => {
      const tsCode = `
        import { ObjectId } from 'mongodb'
        const id = new ObjectId()
      `
      const result = compileTypeScript(tsCode)

      expect(result).toContain('require')
      expect(result).toContain('mongodb')
    })
  })

  describe('safeCompile', () => {
    it('should return success for valid code', () => {
      const tsCode = `const x: number = 1;`
      const result = safeCompile(tsCode)

      expect(result.success).toBe(true)
      expect(result.compiled).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('should return compiled code for valid input', () => {
      const tsCode = `export default async function() { return "test" }`
      const result = safeCompile(tsCode)

      expect(result.success).toBe(true)
      expect(result.compiled).toContain('async function')
    })
  })
})
