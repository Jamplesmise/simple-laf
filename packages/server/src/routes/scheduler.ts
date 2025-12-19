import { Router, type IRouter } from 'express'
import * as schedulerService from '../services/scheduler.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router: IRouter = Router()

// 所有路由都需要认证
router.use(authMiddleware)

// 获取定时任务列表
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tasks = await schedulerService.list(req.user!.userId)
    res.json({ success: true, data: tasks })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 创建定时任务
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { functionId, intervalConfig } = req.body

    if (!functionId) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请选择函数' }
      })
      return
    }

    if (!intervalConfig) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请设置执行间隔' }
      })
      return
    }

    const task = await schedulerService.create(
      req.user!.userId,
      functionId,
      intervalConfig
    )
    res.json({ success: true, data: task })
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建失败'
    res.status(400).json({
      success: false,
      error: { code: 'CREATE_FAILED', message }
    })
  }
})

// 更新定时任务
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { enabled, intervalConfig } = req.body
    const task = await schedulerService.update(
      req.params.id,
      req.user!.userId,
      { enabled, intervalConfig }
    )

    if (!task) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '任务不存在' }
      })
      return
    }

    res.json({ success: true, data: task })
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新失败'
    res.status(400).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message }
    })
  }
})

// 删除定时任务
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const success = await schedulerService.remove(req.params.id, req.user!.userId)

    if (!success) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '任务不存在' }
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

// 手动执行一次
router.post('/:id/run', async (req: AuthRequest, res) => {
  try {
    const result = await schedulerService.runOnce(req.params.id, req.user!.userId)

    if (!result) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '任务不存在' }
      })
      return
    }

    res.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : '执行失败'
    res.status(500).json({
      success: false,
      error: { code: 'RUN_FAILED', message }
    })
  }
})

export default router
