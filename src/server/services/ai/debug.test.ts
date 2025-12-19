import { describe, it, expect } from 'vitest'
import { parseTestCases, parseDebugFix } from './debug.js'

describe('parseTestCases', () => {
  it('should parse valid JSON with testCases array', () => {
    const response = `\`\`\`json
{
  "testCases": [
    {
      "id": "test-1",
      "name": "基础测试",
      "input": { "body": { "name": "test" } },
      "expectedBehavior": "应该返回成功"
    }
  ]
}
\`\`\``

    const result = parseTestCases(response)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('test-1')
    expect(result[0].name).toBe('基础测试')
    expect(result[0].input.body).toEqual({ name: 'test' })
  })

  it('should handle missing fields with defaults', () => {
    const response = `{ "testCases": [{ "input": {} }] }`

    const result = parseTestCases(response)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('test-1')
    expect(result[0].name).toBe('测试 1')
    expect(result[0].expectedBehavior).toBe('')
  })

  it('should return empty array for invalid JSON', () => {
    const result = parseTestCases('not json')
    expect(result).toEqual([])
  })

  it('should return empty array for non-array testCases', () => {
    const result = parseTestCases('{ "testCases": "invalid" }')
    expect(result).toEqual([])
  })
})

describe('parseDebugFix', () => {
  it('should parse valid fix response', () => {
    const response = `\`\`\`json
{
  "issue": "变量未定义",
  "reason": "需要先声明变量",
  "fixedCode": "const x = 1;"
}
\`\`\``

    const result = parseDebugFix(response, 'const x;')
    expect(result).not.toBeNull()
    expect(result!.issue).toBe('变量未定义')
    expect(result!.reason).toBe('需要先声明变量')
    expect(result!.fixedCode).toBe('const x = 1;')
    expect(result!.originalCode).toBe('const x;')
  })

  it('should return null for missing required fields', () => {
    const response = `{ "issue": "问题", "reason": "原因" }`
    const result = parseDebugFix(response, '')
    expect(result).toBeNull()
  })

  it('should return null for invalid JSON', () => {
    const result = parseDebugFix('invalid', '')
    expect(result).toBeNull()
  })

  it('should handle empty reason', () => {
    const response = `{ "issue": "问题", "fixedCode": "code" }`
    const result = parseDebugFix(response, 'old')
    expect(result).not.toBeNull()
    expect(result!.reason).toBe('')
  })
})
