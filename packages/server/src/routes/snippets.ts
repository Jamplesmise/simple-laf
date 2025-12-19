import { Router, type IRouter } from 'express'
import * as snippetService from '../services/snippet.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router: IRouter = Router()

// 所有路由都需要认证
router.use(authMiddleware)

// 获取代码片段列表
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { tag } = req.query
    const snippets = await snippetService.list(req.user!.userId, {
      tag: tag as string | undefined,
    })
    res.json({ success: true, data: snippets })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取所有标签
router.get('/tags', async (req: AuthRequest, res) => {
  try {
    const tags = await snippetService.getTags(req.user!.userId)
    res.json({ success: true, data: tags })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取标签失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 搜索代码片段
router.get('/search', async (req: AuthRequest, res) => {
  try {
    const { q } = req.query
    if (!q || typeof q !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: '缺少搜索关键词' }
      })
      return
    }
    const snippets = await snippetService.search(req.user!.userId, q)
    res.json({ success: true, data: snippets })
  } catch (err) {
    const message = err instanceof Error ? err.message : '搜索失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取单个代码片段
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const snippet = await snippetService.findById(req.params.id, req.user!.userId)
    if (!snippet) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '代码片段不存在' }
      })
      return
    }
    res.json({ success: true, data: snippet })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 创建代码片段
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, description, code, tags } = req.body
    if (!name || !code) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: '缺少必要参数' }
      })
      return
    }

    const snippet = await snippetService.create(req.user!.userId, {
      name,
      description,
      code,
      tags,
    })
    res.json({ success: true, data: snippet })
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建失败'
    res.status(400).json({
      success: false,
      error: { code: 'CREATE_FAILED', message }
    })
  }
})

// 更新代码片段
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const { name, description, code, tags } = req.body
    const snippet = await snippetService.update(req.params.id, req.user!.userId, {
      name,
      description,
      code,
      tags,
    })

    if (!snippet) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '代码片段不存在' }
      })
      return
    }

    res.json({ success: true, data: snippet })
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新失败'
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message }
    })
  }
})

// 删除代码片段
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const success = await snippetService.remove(req.params.id, req.user!.userId)
    if (!success) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '代码片段不存在' }
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

// 增加使用次数
router.post('/:id/use', async (req: AuthRequest, res) => {
  try {
    await snippetService.incrementUseCount(req.params.id, req.user!.userId)
    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '操作失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

export default router
