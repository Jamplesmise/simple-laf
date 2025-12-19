import { Router, type IRouter, type Request, type Response } from 'express'
import * as webhookService from '../services/webhook.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router: IRouter = Router()

// ============ 需要认证的管理接口 ============

// 获取 webhook 列表
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const webhooks = await webhookService.list(req.user!.userId)
    res.json({ success: true, data: webhooks })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取函数的 webhook
router.get('/function/:functionId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const webhook = await webhookService.findByFunction(req.params.functionId, req.user!.userId)
    res.json({ success: true, data: webhook })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 创建 webhook
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { functionId, methods, generateSecret } = req.body
    if (!functionId) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: '缺少 functionId' }
      })
      return
    }

    const webhook = await webhookService.create(req.user!.userId, functionId, {
      methods,
      generateSecret,
    })
    res.json({ success: true, data: webhook })
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建失败'
    res.status(400).json({
      success: false,
      error: { code: 'CREATE_FAILED', message }
    })
  }
})

// 更新 webhook
router.patch('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { enabled, methods, regenerateToken, regenerateSecret } = req.body
    const webhook = await webhookService.update(req.params.id, req.user!.userId, {
      enabled,
      methods,
      regenerateToken,
      regenerateSecret,
    })

    if (!webhook) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Webhook 不存在' }
      })
      return
    }

    res.json({ success: true, data: webhook })
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新失败'
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message }
    })
  }
})

// 删除 webhook
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const success = await webhookService.remove(req.params.id, req.user!.userId)
    if (!success) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Webhook 不存在' }
      })
      return
    }
    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除失败'
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_FAILED', message }
    })
  }
})

// ============ Webhook 调用接口 (无需认证) ============

// 调用 webhook
router.all('/call/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const webhook = await webhookService.findByToken(token)

    if (!webhook) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Webhook 不存在' }
      })
      return
    }

    // 验证签名 (如果配置了 secret)
    if (webhook.secret) {
      const signature = req.headers['x-webhook-signature'] as string
      if (!signature) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '缺少签名' }
        })
        return
      }

      const payload = JSON.stringify(req.body)
      if (!webhookService.verifySignature(payload, signature, webhook.secret)) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '签名验证失败' }
        })
        return
      }
    }

    // 执行 webhook
    const result = await webhookService.execute(webhook, {
      method: req.method,
      body: req.body,
      query: req.query as Record<string, string>,
      headers: req.headers as Record<string, string>,
    })

    if (result.error) {
      res.status(500).json({
        success: false,
        error: { code: 'EXECUTION_FAILED', message: result.error }
      })
      return
    }

    res.json({ success: true, data: result.data })
  } catch (err) {
    const message = err instanceof Error ? err.message : '执行失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

export default router
