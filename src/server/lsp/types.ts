// 云函数全局类型定义
// 写入 LSP 工作目录，为编辑器提供智能提示

export function getTypesContent(): string {
  return `
/**
 * 云函数上下文
 */
interface FunctionContext {
  /** 请求体 (POST body) */
  body: unknown
  /** URL 查询参数 */
  query: Record<string, string>
  /** 请求头 */
  headers: Record<string, string>
  /** 请求方法 */
  method: string
  /** Cloud SDK 实例 */
  cloud: Cloud
}

/**
 * Cloud SDK
 */
interface Cloud {
  /** 获取 MongoDB 数据库实例 */
  database(): import('mongodb').Db
  /** 调用其他云函数 */
  invoke(name: string, data?: unknown): Promise<unknown>
  /** 环境变量 */
  env: Record<string, string>
}

/**
 * MongoDB 集合操作 (简化类型)
 */
interface Collection<T = unknown> {
  find(filter?: object): { toArray(): Promise<T[]> }
  findOne(filter: object): Promise<T | null>
  insertOne(doc: T): Promise<{ insertedId: unknown }>
  insertMany(docs: T[]): Promise<{ insertedIds: unknown[] }>
  updateOne(filter: object, update: object): Promise<{ modifiedCount: number }>
  updateMany(filter: object, update: object): Promise<{ modifiedCount: number }>
  deleteOne(filter: object): Promise<{ deletedCount: number }>
  deleteMany(filter: object): Promise<{ deletedCount: number }>
  countDocuments(filter?: object): Promise<number>
}

/**
 * MongoDB 数据库操作 (简化类型)
 */
interface Db {
  collection<T = unknown>(name: string): Collection<T>
}

// 全局变量声明
declare const ctx: FunctionContext
declare const cloud: Cloud
declare const console: Console
declare const exports: { main?: (ctx: FunctionContext) => Promise<unknown> | unknown }
`
}
