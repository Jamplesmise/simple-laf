import vm from 'node:vm'
import type { Cloud } from '../cloud/index.js'
import { functionCache, type FunctionData } from './cache.js'

/**
 * 函数模块接口
 */
export interface FunctionModule {
  default?: (...args: unknown[]) => Promise<unknown> | unknown
  [key: string]: unknown
}

/**
 * 模块缓存 - 按用户和函数名缓存
 */
const moduleCache = new Map<string, FunctionModule>()

/**
 * 当前执行上下文
 */
interface ExecutionContext {
  cloud: Cloud | null
  userId: string | null
}

let currentContext: ExecutionContext = {
  cloud: null,
  userId: null
}

/**
 * 设置当前执行上下文
 */
export function setExecutionContext(cloud: Cloud, userId: string): void {
  currentContext = { cloud, userId }
}

/**
 * 清除当前执行上下文
 */
export function clearExecutionContext(): void {
  currentContext = { cloud: null, userId: null }
}

// 兼容旧 API
export function setCurrentCloud(cloud: Cloud): void {
  currentContext.cloud = cloud
}

export function clearCurrentCloud(): void {
  currentContext.cloud = null
}

/**
 * 设置当前用户ID
 */
export function setCurrentUserId(userId: string): void {
  currentContext.userId = userId
}

/**
 * 生成模块缓存键
 */
function getModuleCacheKey(userId: string, name: string): string {
  return `${userId}:${name}`
}

/**
 * 编译并加载函数模块
 * @param name 函数名
 * @param code 编译后的 JS 代码
 * @param hash 代码哈希
 * @param fromModules 导入链（用于检测循环依赖）
 */
function compileModule(
  name: string,
  code: string,
  hash: string,
  fromModules: string[] = []
): FunctionModule {
  const userId = currentContext.userId
  if (!userId) {
    throw new Error('执行上下文未设置用户ID')
  }

  const cacheKey = getModuleCacheKey(userId, name)

  // 创建模块包装代码
  // 注入自定义 require 函数来支持 @/ 导入
  const wrapped = `
    (function(exports, require, module, __filename, __fromModules) {
      ${code}
      return module.exports;
    })
  `

  // 编译脚本
  const script = new vm.Script(wrapped, {
    filename: `${name}.js`,
  })

  // 创建模块上下文
  const moduleObj = { exports: {} as Record<string, unknown> }
  const exportsObj = moduleObj.exports

  // 自定义 require 实现
  const requireFn = (id: string): unknown => {
    return customRequire(id, [...fromModules, name])
  }

  // 执行代码
  const factory = script.runInThisContext() as (
    exports: Record<string, unknown>,
    require: (id: string) => unknown,
    module: { exports: Record<string, unknown> },
    filename: string,
    fromModules: string[]
  ) => Record<string, unknown>

  const result = factory(exportsObj, requireFn, moduleObj, name, fromModules)

  // 构建模块对象
  const mod: FunctionModule = { ...result }

  // 保存哈希用于缓存验证
  ;(mod as Record<string, unknown>).__code_hash = hash

  // 缓存模块
  moduleCache.set(cacheKey, mod)

  return mod
}

/**
 * 自定义 require 实现
 * 支持 @/functionName 导入其他云函数
 */
function customRequire(id: string, fromModules: string[] = []): unknown {
  const userId = currentContext.userId

  // 1. 支持 @simple-ide/cloud 或 @/cloud-sdk
  if (id === '@simple-ide/cloud' || id === '@/cloud-sdk') {
    if (!currentContext.cloud) {
      throw new Error('Cloud SDK 未初始化')
    }
    return { default: currentContext.cloud, __esModule: true }
  }

  // 2. 支持 @/functionName 导入
  if (id.startsWith('@/')) {
    if (!userId) {
      throw new Error('无法导入函数：执行上下文未设置用户ID')
    }

    const functionName = id.slice(2) // 移除 @/ 前缀

    // 检测循环依赖
    if (fromModules.includes(functionName)) {
      const chain = [...fromModules, functionName].join(' -> ')
      throw new Error(`检测到循环依赖: ${chain}`)
    }

    // 检查模块缓存
    const cacheKey = getModuleCacheKey(userId, functionName)
    if (moduleCache.has(cacheKey)) {
      return moduleCache.get(cacheKey)
    }

    // 同步获取函数数据（这里需要使用同步方式，因为 require 是同步的）
    // 注意：这里使用 functionCache，需要确保函数已经预加载
    const funcData = getFunctionDataSync(userId, functionName)
    if (!funcData) {
      throw new Error(`函数 "${functionName}" 不存在`)
    }

    if (!funcData.compiled) {
      throw new Error(`函数 "${functionName}" 未编译`)
    }

    // 编译并返回模块
    return compileModule(functionName, funcData.compiled, funcData.hash || '', fromModules)
  }

  // 3. 允许的内置模块
  const allowedBuiltins = [
    'crypto',
    'util',
    'url',
    'querystring',
    'path',
    'buffer',
  ]
  if (allowedBuiltins.includes(id)) {
    return require(id)
  }

  // 4. 尝试加载 npm 包（已安装的依赖）
  try {
    return require(id)
  } catch {
    throw new Error(`模块 "${id}" 不允许在云函数中使用或未安装`)
  }
}

/**
 * 同步获取函数数据的缓存
 * 这是一个临时解决方案，用于在同步的 require 中获取函数数据
 */
const syncFunctionCache = new Map<string, FunctionData>()

/**
 * 预加载用户的所有函数到同步缓存
 */
export async function preloadUserFunctions(userId: string): Promise<void> {
  await functionCache.loadUserFunctions(userId)

  // 将异步缓存复制到同步缓存
  const { getDB } = await import('../db.js')
  const { ObjectId } = await import('mongodb')
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
    syncFunctionCache.set(`${userId}:${func.name}`, data)
    if (func.path && func.path !== func.name) {
      syncFunctionCache.set(`${userId}:${func.path}`, data)
    }
  }
}

/**
 * 同步获取函数数据
 */
function getFunctionDataSync(userId: string, nameOrPath: string): FunctionData | null {
  return syncFunctionCache.get(`${userId}:${nameOrPath}`) || null
}

/**
 * 加载函数模块（公开 API）
 * @param name 函数名
 * @param code 编译后的 JS 代码
 * @param hash 代码哈希（用于缓存验证）
 * @returns 函数模块
 */
export function loadModule(
  name: string,
  code: string,
  hash: string
): FunctionModule {
  const userId = currentContext.userId || 'default'
  const cacheKey = getModuleCacheKey(userId, name)

  // 检查缓存
  const cached = moduleCache.get(cacheKey)
  if (cached && (cached as Record<string, unknown>).__code_hash === hash) {
    return cached
  }

  // 编译模块
  return compileModule(name, code, hash, [])
}

/**
 * 清除模块缓存
 * @param name 函数名（不传则清除全部）
 */
export function clearCache(name?: string): void {
  if (name) {
    const userId = currentContext.userId || 'default'
    moduleCache.delete(getModuleCacheKey(userId, name))
  } else {
    moduleCache.clear()
  }
}

/**
 * 清除用户的所有模块缓存
 */
export function clearUserCache(userId: string): void {
  const prefix = `${userId}:`
  for (const key of moduleCache.keys()) {
    if (key.startsWith(prefix)) {
      moduleCache.delete(key)
    }
  }
  // 同时清除同步缓存
  for (const key of syncFunctionCache.keys()) {
    if (key.startsWith(prefix)) {
      syncFunctionCache.delete(key)
    }
  }
}

/**
 * 获取缓存大小
 */
export function getCacheSize(): number {
  return moduleCache.size
}
