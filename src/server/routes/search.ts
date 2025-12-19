import { Router, type IRouter } from 'express'
import * as searchService from '../services/search.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router: IRouter = Router()

// 所有路由都需要认证
router.use(authMiddleware)

// 全局搜索
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { q, limit = '50' } = req.query

    if (!q || typeof q !== 'string') {
      res.json({ success: true, data: [] })
      return
    }

    const results = await searchService.searchFunctions(req.user!.userId, q, {
      limit: parseInt(limit as string, 10),
    })

    res.json({ success: true, data: results })
  } catch (err) {
    const message = err instanceof Error ? err.message : '搜索失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

export default router
