import { FunctionConsole } from './console.js'
import { loadModule, setExecutionContext, clearExecutionContext, preloadUserFunctions } from './module.js'
import type { Cloud } from '../cloud/index.js'

/**
 * 函数上下文
 */
export interface FunctionContext {
  /** 请求体 */
  body: unknown
  /** 查询参数 */
  query: Record<string, string>
  /** 请求头 */
  headers: Record<string, string>
  /** Cloud SDK */
  cloud: Cloud
  /** 用户ID（用于函数间导入） */
  userId?: string
}

/**
 * 执行结果
 */
export interface ExecuteResult {
  /** 返回数据 */
  data: unknown
  /** 控制台日志 */
  logs: string[]
  /** 执行时间 (ms) */
  time: number
  /** 错误信息 */
  error?: string
}

/**
 * 执行云函数
 * @param name 函数名
 * @param code 编译后的 JS 代码
 * @param hash 代码哈希
 * @param ctx 函数上下文
 * @returns 执行结果
 */
export async function executeFunction(
  name: string,
  code: string,
  hash: string,
  ctx: FunctionContext
): Promise<ExecuteResult> {
  const startTime = Date.now()
  const functionConsole = new FunctionConsole()

  // 保存原始 console
  const originalConsole = global.console

  // 注入自定义 console
  global.console = functionConsole as unknown as Console

  try {
    // 设置执行上下文（支持 @/functionName 导入）
    const userId = ctx.userId || 'default'
    setExecutionContext(ctx.cloud, userId)

    // 预加载用户的所有函数（支持函数间导入）
    if (ctx.userId) {
      await preloadUserFunctions(ctx.userId)
    }

    // 加载模块
    const mod = loadModule(name, code, hash)
    const fn = mod.default

    if (typeof fn !== 'function') {
      throw new Error('函数必须导出 default function')
    }

    // 执行函数
    const result = await Promise.resolve(fn(ctx))

    return {
      data: result,
      logs: functionConsole.getLogs(),
      time: Date.now() - startTime,
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))

    return {
      data: null,
      logs: functionConsole.getLogs(),
      time: Date.now() - startTime,
      error: error.message,
    }
  } finally {
    // 清除执行上下文
    clearExecutionContext()
    // 恢复原始 console
    global.console = originalConsole
  }
}
