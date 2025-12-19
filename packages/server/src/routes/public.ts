import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express'
import { ObjectId } from 'mongodb'
import { getDB } from '../db.js'
import { executeFunction } from '../engine/executor.js'
import { createCloudWithEnv } from '../cloud/index.js'
import * as executionLogService from '../services/executionLog.js'
import { isTokenAuthEnabled, validateToken } from '../services/apiToken.js'

const router: IRouter = Router()

/**
 * ALL /* - 公开调用已发布的函数 (无需认证)
 * 支持多级路径，如 /api/user/login
 * 如果函数不存在，调用 next() 让 SPA fallback 处理
 */
router.all('/*', async (req: Request, res: Response, next: NextFunction) => {
  // 获取完整路径，去除前导斜杠
  const path = req.params[0] || req.path.slice(1)

  // 跳过空路径和特殊路由
  if (!path || path.startsWith('api/') || path.startsWith('_/') || path.startsWith('invoke/')) {
    next()
    return
  }

  const db = getDB()

  try {
    // 查找已发布的函数 (优先使用 path 字段，兼容旧数据使用 name)
    let func = await db.collection('functions').findOne({
      path: path,
      published: true
    })

    // 兼容：如果 path 找不到，尝试用 name 查找 (单级路径)
    if (!func && !path.includes('/')) {
      func = await db.collection('functions').findOne({
        name: path,
        published: true
      })
    }

    // 函数不存在时，交给下一个中间件 (SPA fallback)
    if (!func) {
      next()
      return
    }

    // 检查函数所有者是否启用了 Token 认证
    const funcUserId = func.userId ? new ObjectId(func.userId) : null
    if (funcUserId) {
      const tokenAuthEnabled = await isTokenAuthEnabled(funcUserId)
      if (tokenAuthEnabled) {
        // 需要 Token 认证
        const authHeader = req.headers.authorization
        if (!authHeader || !authHeader.startsWith('sk-')) {
          res.status(401).json({
            success: false,
            error: { code: 'TOKEN_REQUIRED', message: '此函数需要 Token 认证，请在请求头设置 Authorization: sk-xxx' }
          })
          return
        }

        // 验证 Token
        const tokenResult = await validateToken(authHeader)
        if (!tokenResult.valid || !tokenResult.userId?.equals(funcUserId)) {
          res.status(401).json({
            success: false,
            error: { code: 'INVALID_TOKEN', message: 'Token 无效、已过期或不属于此函数所有者' }
          })
          return
        }
      }
    }

    // 获取用户ID（用于函数间导入）
    const userId = func.userId?.toString() || ''

    // 创建 Cloud SDK (带用户环境变量)
    const cloud = await createCloudWithEnv(userId)

    // 创建函数上下文
    const ctx = {
      body: req.body,
      query: req.query as Record<string, string>,
      headers: req.headers as Record<string, string>,
      method: req.method,
      path: path,
      cloud,
      userId,
    }

    // 执行函数
    const result = await executeFunction(
      path,
      func.compiled as string,
      (func.hash as string) || '',
      ctx
    )

    // 设置执行时间响应头
    res.set('x-execution-time', String(result.time))

    // 记录执行日志
    executionLogService.create({
      userId,
      functionId: func._id.toString(),
      functionName: func.name as string,
      trigger: 'public',
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

    // 处理错误
    if (result.error) {
      res.status(500).json({
        success: false,
        error: { message: result.error }
      })
      return
    }

    // 公开调用直接返回数据
    res.json(result.data)
  } catch (err) {
    const message = err instanceof Error ? err.message : '执行失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

export default router
