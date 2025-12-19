import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'
import { getDB } from '../db.js'
import * as envService from '../services/env.js'

/**
 * Cloud SDK 接口
 */
export interface Cloud {
  /** 获取数据库实例 */
  database(): Db
  /** 调用其他云函数 */
  invoke(name: string, data?: unknown): Promise<unknown>
  /** 环境变量 */
  env: Record<string, string | undefined>
}

/**
 * 创建 Cloud SDK 实例
 * @param userId 当前用户 ID（用于函数隔离）
 * @param userEnv 用户环境变量（预加载）
 */
export function createCloud(userId?: string, userEnv?: Record<string, string>): Cloud {
  // 合并 process.env 和用户环境变量
  const mergedEnv: Record<string, string | undefined> = {
    ...process.env,
    ...userEnv
  }

  return {
    /**
     * 获取数据库实例
     */
    database(): Db {
      return getDB()
    },

    /**
     * 调用其他云函数
     * @param name 函数名
     * @param data 传递的数据
     */
    async invoke(name: string, data?: unknown): Promise<unknown> {
      const db = getDB()

      // 构建查询条件
      const query: Record<string, unknown> = { name }
      if (userId) {
        query.userId = new ObjectId(userId)
      }

      // 查找函数
      const func = await db.collection('functions').findOne(query)
      if (!func) {
        throw new Error(`函数 "${name}" 不存在`)
      }

      if (!func.compiled) {
        throw new Error(`函数 "${name}" 未编译`)
      }

      // 动态导入避免循环依赖
      const { executeFunction } = await import('../engine/executor.js')

      // 创建调用上下文
      const ctx = {
        body: data,
        query: {},
        headers: {},
        cloud: this,
        userId,
      }

      // 执行函数
      const result = await executeFunction(
        name,
        func.compiled as string,
        (func.hash as string) || '',
        ctx
      )

      if (result.error) {
        throw new Error(result.error)
      }

      return result.data
    },

    /**
     * 环境变量
     */
    env: mergedEnv,
  }
}

/**
 * 创建带有用户环境变量的 Cloud SDK (异步)
 * @param userId 当前用户 ID
 */
export async function createCloudWithEnv(userId: string): Promise<Cloud> {
  const userEnv = await envService.getEnvVariables(new ObjectId(userId))
  return createCloud(userId, userEnv)
}
