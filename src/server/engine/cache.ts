import { ObjectId } from 'mongodb'
import { getDB } from '../db.js'

/**
 * 函数数据接口
 */
export interface FunctionData {
  _id: ObjectId
  userId: ObjectId
  name: string
  path?: string
  compiled: string | null
  hash: string | null
}

/**
 * 函数缓存
 * 按用户ID和函数名/路径缓存编译后的函数代码
 */
class FunctionCache {
  private cache = new Map<string, FunctionData>()

  /**
   * 生成缓存键
   */
  private getKey(userId: string, nameOrPath: string): string {
    return `${userId}:${nameOrPath}`
  }

  /**
   * 从数据库加载用户的所有函数
   */
  async loadUserFunctions(userId: string): Promise<void> {
    const db = getDB()
    const functions = await db.collection('functions')
      .find({ userId: new ObjectId(userId) })
      .project({ _id: 1, userId: 1, name: 1, path: 1, compiled: 1, hash: 1 })
      .toArray()

    for (const func of functions) {
      const data: FunctionData = {
        _id: func._id,
        userId: func.userId,
        name: func.name,
        path: func.path,
        compiled: func.compiled,
        hash: func.hash
      }

      // 按名称缓存
      this.cache.set(this.getKey(userId, func.name), data)

      // 如果有路径，也按路径缓存
      if (func.path && func.path !== func.name) {
        this.cache.set(this.getKey(userId, func.path), data)
      }
    }
  }

  /**
   * 获取函数数据
   * @param userId 用户ID
   * @param nameOrPath 函数名或路径
   */
  async get(userId: string, nameOrPath: string): Promise<FunctionData | null> {
    const key = this.getKey(userId, nameOrPath)

    // 先从缓存获取
    if (this.cache.has(key)) {
      return this.cache.get(key)!
    }

    // 缓存未命中，从数据库加载
    const db = getDB()
    const func = await db.collection('functions').findOne({
      userId: new ObjectId(userId),
      $or: [
        { name: nameOrPath },
        { path: nameOrPath }
      ]
    })

    if (!func) {
      return null
    }

    const data: FunctionData = {
      _id: func._id,
      userId: func.userId,
      name: func.name,
      path: func.path,
      compiled: func.compiled,
      hash: func.hash
    }

    // 缓存结果
    this.cache.set(key, data)

    return data
  }

  /**
   * 清除用户的函数缓存
   */
  clearUser(userId: string): void {
    const prefix = `${userId}:`
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * 清除特定函数的缓存
   */
  clear(userId: string, nameOrPath: string): void {
    this.cache.delete(this.getKey(userId, nameOrPath))
  }

  /**
   * 清除所有缓存
   */
  clearAll(): void {
    this.cache.clear()
  }
}

// 导出单例
export const functionCache = new FunctionCache()
