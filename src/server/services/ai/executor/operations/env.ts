/**
 * 环境变量操作执行器
 *
 * 处理环境变量的设置、删除、列表操作
 * Sprint 15: 依赖与配置
 */

import type { ObjectId } from 'mongodb'
import type {
  AIOperationResult,
  SetEnvVariableOperation,
  DeleteEnvVariableOperation,
  ListEnvVariablesOperation,
} from '../../types.js'
import * as envTools from '../../tools/env.js'

/**
 * 环境变量操作上下文
 */
interface EnvOperationContext {
  userId: ObjectId
}

/**
 * 设置环境变量
 */
export async function setEnvVariable(
  op: SetEnvVariableOperation,
  ctx: EnvOperationContext
): Promise<AIOperationResult> {
  try {
    const result = await envTools.setEnvVariable(
      {
        key: op.key,
        value: op.value,
        isSecret: op.isSecret,
        description: op.description,
      },
      ctx.userId
    )

    return {
      operation: op,
      success: true,
      result: {
        name: `已设置: ${result.key}`,
      },
    }
  } catch (err) {
    return {
      operation: op,
      success: false,
      error: err instanceof Error ? err.message : '设置环境变量失败',
    }
  }
}

/**
 * 删除环境变量
 */
export async function deleteEnvVariable(
  op: DeleteEnvVariableOperation,
  ctx: EnvOperationContext
): Promise<AIOperationResult> {
  try {
    const result = await envTools.deleteEnvVariable(
      { key: op.key },
      ctx.userId
    )

    return {
      operation: op,
      success: true,
      result: {
        name: `已删除: ${result.key}`,
      },
    }
  } catch (err) {
    return {
      operation: op,
      success: false,
      error: err instanceof Error ? err.message : '删除环境变量失败',
    }
  }
}

/**
 * 列出环境变量
 */
export async function listEnvVariables(
  op: ListEnvVariablesOperation,
  ctx: EnvOperationContext
): Promise<AIOperationResult> {
  try {
    const result = await envTools.listEnvVariables(ctx.userId)

    return {
      operation: op,
      success: true,
      result: {
        name: `共 ${result.count} 个环境变量`,
      },
    }
  } catch (err) {
    return {
      operation: op,
      success: false,
      error: err instanceof Error ? err.message : '列出环境变量失败',
    }
  }
}
