import { Router, type IRouter } from 'express'
import type { Response } from 'express'
import zlib from 'node:zlib'
import { ObjectId } from 'mongodb'
import { getDB } from '../db.js'
import { executeFunction } from '../engine/executor.js'
import { createCloudWithEnv } from '../cloud/index.js'
import { authOrDevelopMiddleware, type AuthRequest } from '../middleware/auth.js'
import * as executionLogService from '../services/executionLog.js'
import { invokeLimiter } from '../middleware/rateLimit.js'
import { emitExecutionEvent } from '../middleware/monitor.js'

const router: IRouter = Router()

/**
 * POST/GET /:path(*) - 调用云函数
 * 支持多级路径，如 /api/user/login
 */
router.all('/*', invokeLimiter, authOrDevelopMiddleware, async (req: AuthRequest, res: Response) => {
  // 获取完整路径（去掉开头的斜杠）
  const path = req.params[0] || req.path.slice(1)
  const db = getDB()

  try {
    // 构建查询条件 - 按 path 查询，兼容旧数据按 name 查询
    const baseQuery: Record<string, unknown> = {}
    if (req.user?.userId) {
      baseQuery.userId = new ObjectId(req.user.userId)
    }

    // 先按 path 查询
    let func = await db.collection('functions').findOne({ ...baseQuery, path })

    // 如果找不到，尝试按 name 查询（兼容旧数据）
    if (!func) {
      func = await db.collection('functions').findOne({ ...baseQuery, name: path })
    }

    if (!func) {
      res.status(404).json({
        success: false,
        error: { code: 'FUNCTION_NOT_FOUND', message: `函数 "${path}" 不存在` },
      })
      return
    }

    if (!func.compiled) {
      res.status(400).json({
        success: false,
        error: { code: 'NOT_COMPILED', message: '函数未编译，请先编译' },
      })
      return
    }

    // 创建 Cloud SDK (带用户环境变量)
    const cloud = req.user?.userId
      ? await createCloudWithEnv(req.user.userId)
      : await createCloudWithEnv(func.userId?.toString() || '')

    // 获取用户ID（用于函数间导入）
    const userId = req.user?.userId || func.userId?.toString() || ''

    // 创建函数上下文
    const ctx = {
      body: req.body,
      query: req.query as Record<string, string>,
      headers: req.headers as Record<string, string>,
      cloud,
      userId,
    }

    // 执行函数 - 使用 path 作为函数标识
    const funcPath = (func.path as string) || (func.name as string)
    const result = await executeFunction(
      funcPath,
      func.compiled as string,
      (func.hash as string) || '',
      ctx
    )

    // 压缩日志并放入响应头
    if (result.logs.length > 0) {
      const logsJson = JSON.stringify(result.logs)
      const logsCompressed = zlib.gzipSync(logsJson).toString('base64')
      res.set('x-function-logs', logsCompressed)
    }

    // 执行时间
    res.set('x-execution-time', String(result.time))

    // 记录执行日志
    const functionId = func._id.toString()
    executionLogService.create({
      userId,
      functionId,
      functionName: funcPath,
      trigger: 'manual',
      request: {
        method: req.method,
        body: req.body,
        query: req.query as Record<string, string>,
      },
      success: !result.error,
      data: result.data,
      error: result.error,
      logs: result.logs.map(log => ({
        level: 'log',
        args: [log],
        timestamp: Date.now(),
      })),
      duration: result.time,
    }).catch(err => console.error('记录执行日志失败:', err))

    // 广播执行事件到监控 WebSocket
    emitExecutionEvent({
      userId,
      functionId,
      functionName: funcPath,
      trigger: 'manual',
      success: !result.error,
      duration: result.time,
      error: result.error,
    })

    // 返回结果
    if (result.error) {
      res.status(500).json({
        success: false,
        error: { code: 'EXECUTION_ERROR', message: result.error },
      })
      return
    }

    res.json({ success: true, data: result.data })
  } catch (err) {
    const message = err instanceof Error ? err.message : '执行失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message },
    })
  }
})

export default router
