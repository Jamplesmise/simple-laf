import { Router, type IRouter } from 'express'
import { ObjectId } from 'mongodb'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import * as siteService from '../services/site.js'

const router: IRouter = Router()

// 所有路由需要认证
router.use(authMiddleware)

/**
 * GET /api/site
 * 获取站点配置
 */
router.get('/', async (req, res) => {
  try {
    const authReq = req as AuthRequest
    const userId = new ObjectId(authReq.user!.userId)

    const site = await siteService.getOrCreate(userId)

    // 脱敏密码
    const result = {
      ...site,
      accessControl: {
        ...site.accessControl,
        password: site.accessControl.password ? '******' : undefined
      }
    }

    res.json({ success: true, data: result })
  } catch (error) {
    const err = error as Error
    res.status(500).json({ success: false, error: { code: 'SITE_GET_ERROR', message: err.message } })
  }
})

/**
 * PUT /api/site
 * 更新站点配置
 */
router.put('/', async (req, res) => {
  try {
    const authReq = req as AuthRequest
    const userId = new ObjectId(authReq.user!.userId)
    const updates = req.body

    // 验证 accessControl.type
    if (updates.accessControl?.type) {
      const validTypes = ['public', 'login', 'password']
      if (!validTypes.includes(updates.accessControl.type)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ACCESS_TYPE', message: '无效的访问控制类型' }
        })
      }
    }

    const site = await siteService.update(userId, updates)

    // 脱敏密码
    const result = {
      ...site,
      accessControl: {
        ...site.accessControl,
        password: site.accessControl.password ? '******' : undefined
      }
    }

    res.json({ success: true, data: result })
  } catch (error) {
    const err = error as Error
    res.status(500).json({ success: false, error: { code: 'SITE_UPDATE_ERROR', message: err.message } })
  }
})

/**
 * GET /api/site/stats
 * 获取站点统计
 */
router.get('/stats', async (req, res) => {
  try {
    const authReq = req as AuthRequest
    const userId = new ObjectId(authReq.user!.userId)

    const stats = await siteService.getStats(userId)

    res.json({ success: true, data: stats })
  } catch (error) {
    const err = error as Error
    res.status(500).json({ success: false, error: { code: 'SITE_STATS_ERROR', message: err.message } })
  }
})

export default router
