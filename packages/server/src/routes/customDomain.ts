import { Router, type IRouter } from 'express'
import { ObjectId } from 'mongodb'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import * as customDomainService from '../services/customDomain.js'

const router: IRouter = Router()

// 所有路由都需要认证
router.use(authMiddleware)

// 获取系统域名
router.get('/system-domain', async (_req, res) => {
  try {
    const systemDomain = customDomainService.getSystemDomain()
    res.json({ success: true, data: { systemDomain } })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取系统域名失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取自定义域名列表
router.get('/', async (req: AuthRequest, res) => {
  try {
    const domains = await customDomainService.listDomains(
      new ObjectId(req.user!.userId)
    )
    res.json({ success: true, data: domains })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 添加自定义域名
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { domain, targetPath } = req.body as { domain: string; targetPath?: string }

    if (!domain) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '域名不能为空' }
      })
      return
    }

    const result = await customDomainService.addDomain(
      new ObjectId(req.user!.userId),
      domain,
      targetPath
    )

    res.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : '添加失败'
    res.status(400).json({
      success: false,
      error: { code: 'ADD_DOMAIN_ERROR', message }
    })
  }
})

// 更新自定义域名
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const { targetPath } = req.body as { targetPath?: string }

    const updated = await customDomainService.updateDomain(
      new ObjectId(req.user!.userId),
      new ObjectId(req.params.id),
      { targetPath }
    )

    if (!updated) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '域名不存在' }
      })
      return
    }

    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 删除自定义域名
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const deleted = await customDomainService.removeDomain(
      new ObjectId(req.user!.userId),
      new ObjectId(req.params.id)
    )

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '域名不存在' }
      })
      return
    }

    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 验证 DNS
router.post('/:id/verify', async (req: AuthRequest, res) => {
  try {
    const result = await customDomainService.verifyDNS(
      new ObjectId(req.user!.userId),
      new ObjectId(req.params.id)
    )

    res.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : '验证失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

export default router
