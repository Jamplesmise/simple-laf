/**
 * 云函数测试工具
 *
 * 提供云函数测试执行和测试输入持久化功能
 * Sprint 19: 测试基础
 */

import { ObjectId, type Db } from 'mongodb'
import { compileTypeScript } from '../../compiler.js'
import { executeFunction } from '../../../engine/executor.js'
import { createCloud } from '../../../cloud/index.js'
import * as envService from '../../env.js'
import crypto from 'crypto'

// ==================== 类型定义 ====================

/**
 * 测试输入
 */
export interface TestInput {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: unknown
  query?: Record<string, string>
  headers?: Record<string, string>
}

/**
 * 测试云函数参数
 */
export interface TestFunctionParams {
  functionId: string
  input?: TestInput
}

/**
 * 测试云函数结果
 */
export interface TestFunctionResult {
  success: boolean
  data?: unknown
  error?: string
  logs: string[]
  duration: number
}

/**
 * 保存测试输入参数
 */
export interface SaveTestInputParams {
  functionId: string
  input: TestInput
}

/**
 * 函数测试输入数据模型（存储在 functions 集合中）
 */
export interface FunctionTestInput {
  method: string
  body: string       // JSON 字符串
  query: string      // key=value 格式
  headers: string    // JSON 字符串
  updatedAt: Date
}

// ==================== 工具实现 ====================

/**
 * 测试云函数
 *
 * 执行指定的云函数并返回结果，包括控制台日志
 */
export async function testFunction(
  db: Db,
  userId: ObjectId,
  params: TestFunctionParams
): Promise<TestFunctionResult> {
  const startTime = Date.now()

  // 获取函数信息
  const func = await db.collection('functions').findOne({
    _id: new ObjectId(params.functionId),
    userId,
  })

  if (!func) {
    return {
      success: false,
      error: '函数不存在',
      logs: [],
      duration: 0,
    }
  }

  const code = func.code as string
  const functionName = (func.path as string) || (func.name as string)

  if (!code) {
    return {
      success: false,
      error: '函数代码为空',
      logs: [],
      duration: 0,
    }
  }

  try {
    // 编译代码
    const compiled = compileTypeScript(code)
    const hash = crypto.createHash('md5').update(code).digest('hex')

    // 获取用户环境变量
    const userEnv = await envService.getEnvVariables(userId)
    const cloud = createCloud(userId.toString(), userEnv)

    // 构建上下文
    const input = params.input || {}
    const ctx = {
      body: input.body ?? {},
      query: input.query ?? {},
      headers: input.headers ?? {},
      cloud,
      userId: userId.toString(),
    }

    // 执行函数
    const result = await executeFunction(functionName, compiled, hash, ctx)

    return {
      success: !result.error,
      data: result.data,
      error: result.error,
      logs: result.logs,
      duration: Date.now() - startTime,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      logs: [],
      duration: Date.now() - startTime,
    }
  }
}

/**
 * 保存测试输入
 *
 * 将测试输入持久化到函数文档中
 */
export async function saveTestInput(
  db: Db,
  userId: ObjectId,
  params: SaveTestInputParams
): Promise<{ success: boolean; error?: string }> {
  const input = params.input

  const testInput: FunctionTestInput = {
    method: input.method || 'POST',
    body: typeof input.body === 'string' ? input.body : JSON.stringify(input.body ?? {}, null, 2),
    query: typeof input.query === 'string'
      ? input.query
      : Object.entries(input.query ?? {}).map(([k, v]) => `${k}=${v}`).join('\n'),
    headers: typeof input.headers === 'string'
      ? input.headers
      : JSON.stringify(input.headers ?? {}, null, 2),
    updatedAt: new Date(),
  }

  const result = await db.collection('functions').updateOne(
    { _id: new ObjectId(params.functionId), userId },
    { $set: { testInput } }
  )

  if (result.matchedCount === 0) {
    return { success: false, error: '函数不存在' }
  }

  return { success: true }
}

/**
 * 获取测试输入
 *
 * 从函数文档中读取保存的测试输入
 */
export async function getTestInput(
  db: Db,
  userId: ObjectId,
  functionId: string
): Promise<FunctionTestInput | null> {
  const func = await db.collection('functions').findOne(
    { _id: new ObjectId(functionId), userId },
    { projection: { testInput: 1 } }
  )

  return (func?.testInput as FunctionTestInput) || null
}

/**
 * 批量测试云函数
 *
 * 使用多个测试用例测试同一个函数
 */
export async function batchTestFunction(
  db: Db,
  userId: ObjectId,
  functionId: string,
  testCases: Array<{ name: string; input: TestInput }>
): Promise<{
  summary: { total: number; passed: number; failed: number }
  results: Array<{
    name: string
    success: boolean
    data?: unknown
    error?: string
    logs: string[]
    duration: number
  }>
}> {
  const results: Array<{
    name: string
    success: boolean
    data?: unknown
    error?: string
    logs: string[]
    duration: number
  }> = []

  for (const testCase of testCases) {
    const result = await testFunction(db, userId, {
      functionId,
      input: testCase.input,
    })

    results.push({
      name: testCase.name,
      ...result,
    })
  }

  const passed = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  return {
    summary: {
      total: testCases.length,
      passed,
      failed,
    },
    results,
  }
}
