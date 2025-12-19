import { Router, type IRouter } from 'express'
import type { Response } from 'express'
import zlib from 'node:zlib'
import { ObjectId } from 'mongodb'
import { getDB } from '../db.js'
import { executeFunction } from '../engine/executor.js'
import { createCloudWithEnv } from '../cloud/index.js'
import { authOrDevelopMiddleware, type AuthRequest } from '../middleware/auth.js'
import * as executionLogService from '../services/executionLog.js'

const router: IRouter = Router()

/**
 * POST/GET /invoke/:name - 调用云函数
 */
router.all('/:name', authOrDevelopMiddleware, async (req: AuthRequest, res: Response) => {
  const { name } = req.params
  const db = getDB()

  try {
    // 构建查询条件
    const query: Record<string, unknown> = { name }
    if (req.user?.userId) {
      query.userId = new ObjectId(req.user.userId)
    }

    // 查找函数
    const func = await db.collection('functions').findOne(query)

    if (!func) {
      res.status(404).json({
        success: false,
        error: { code: 'FUNCTION_NOT_FOUND', message: `函数 "${name}" 不存在` },
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

    // 执行函数
    const result = await executeFunction(
      name,
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
    executionLogService.create({
      userId,
      functionId: func._id.toString(),
      functionName: name,
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
