/**
 * 云函数测试操作
 *
 * 处理 AI 触发的云函数测试执行和测试输入持久化
 * Sprint 19: 测试基础
 */

import type { AIOperation, AIOperationResult } from '../../types.js'
import * as testTools from '../../tools/test.js'
import type { Db, ObjectId } from 'mongodb'

/**
 * 测试操作上下文
 */
interface TestOperationContext {
  db: Db
  userId: ObjectId
}

/**
 * 测试云函数
 */
export async function testFunction(
  operation: AIOperation,
  ctx: TestOperationContext
): Promise<AIOperationResult> {
  const { functionId, input } = operation as AIOperation & {
    functionId: string
    input?: testTools.TestInput
  }

  const result = await testTools.testFunction(ctx.db, ctx.userId, {
    functionId,
    input,
  })

  return {
    operation,
    success: result.success,
    result: {
      data: result.data,
      error: result.error,
      logs: result.logs,
      duration: result.duration,
    },
  }
}

/**
 * 批量测试云函数
 */
export async function batchTestFunction(
  operation: AIOperation,
  ctx: TestOperationContext
): Promise<AIOperationResult> {
  const { functionId, testCases } = operation as AIOperation & {
    functionId: string
    testCases: Array<{ name: string; input: testTools.TestInput }>
  }

  const result = await testTools.batchTestFunction(
    ctx.db,
    ctx.userId,
    functionId,
    testCases
  )

  return {
    operation,
    success: true,
    result: {
      results: result.results,
      summary: result.summary,
    },
  }
}

/**
 * 保存测试输入
 */
export async function saveTestInput(
  operation: AIOperation,
  ctx: TestOperationContext
): Promise<AIOperationResult> {
  const { functionId, input } = operation as AIOperation & {
    functionId: string
    input: testTools.TestInput
  }

  const result = await testTools.saveTestInput(ctx.db, ctx.userId, {
    functionId,
    input,
  })

  return {
    operation,
    success: result.success,
    error: result.error,
  }
}

/**
 * 获取测试输入
 */
export async function getTestInput(
  operation: AIOperation,
  ctx: TestOperationContext
): Promise<AIOperationResult> {
  const { functionId } = operation as AIOperation & { functionId: string }

  const testInput = await testTools.getTestInput(ctx.db, ctx.userId, functionId)

  return {
    operation,
    success: true,
    result: {
      testInput,
    },
  }
}
