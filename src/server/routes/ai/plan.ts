/**
 * Plan 模式路由 (Sprint 16.2)
 *
 * /api/ai/plan/check - 检查是否应该触发 Plan 模式
 * /api/ai/plan/generate - 生成执行计划
 * /api/ai/plan/:id - 获取计划详情
 * /api/ai/plan/:id/steps - 更新步骤选择
 * /api/ai/plan/:id/execute - 执行计划 (SSE)
 * /api/ai/plan/:id/pause - 暂停执行
 * /api/ai/plan/:id/resume - 恢复执行
 * /api/ai/plan/:id/stop - 停止执行
 * /api/ai/plans - 获取计划列表
 */

import { Router, type Router as RouterType } from 'express'
import { ObjectId } from 'mongodb'
import type { AuthRequest } from '../../middleware/auth.js'
import {
  shouldTriggerPlanMode,
  generatePlan,
  getPlan,
  updateStepSelection,
  executePlan,
  pausePlan,
  resumePlan,
  stopPlan,
  getUserPlans,
  deletePlan,
  type PlanModeState,
} from '../../services/ai/plan/index.js'

const router: RouterType = Router()

// 检查是否应该触发 Plan 模式
router.post('/plan/check', async (req: AuthRequest, res) => {
  try {
    const { request } = req.body as { request: string }

    if (!request) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请提供请求内容' },
      })
      return
    }

    const result = shouldTriggerPlanMode(request)

    res.json({
      success: true,
      data: result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '检查失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message },
    })
  }
})

// 生成执行计划
router.post('/plan/generate', async (req: AuthRequest, res) => {
  try {
    const { conversationId, request, context } = req.body as {
      conversationId: string
      request: string
      context?: {
        functionIds?: string[]
        currentCode?: string
      }
    }
    const userId = req.user!.userId

    if (!conversationId || !request) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请提供对话 ID 和请求内容' },
      })
      return
    }

    const plan = await generatePlan(conversationId, userId, request, context)

    res.json({
      success: true,
      data: plan,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '生成计划失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message },
    })
  }
})

// 获取计划详情
router.get('/plan/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const userId = req.user!.userId

    const plan = await getPlan(id)

    if (!plan) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '计划不存在' },
      })
      return
    }

    // 验证所有权
    if (plan.userId !== userId) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: '无权访问此计划' },
      })
      return
    }

    res.json({
      success: true,
      data: plan,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取计划失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message },
    })
  }
})

// 更新步骤选择
router.patch('/plan/:id/steps', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const { stepIds, selected } = req.body as {
      stepIds: string[]
      selected: boolean
    }
    const userId = req.user!.userId

    // 验证所有权
    const plan = await getPlan(id)
    if (!plan) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '计划不存在' },
      })
      return
    }

    if (plan.userId !== userId) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: '无权修改此计划' },
      })
      return
    }

    const updatedPlan = await updateStepSelection(id, stepIds, selected)

    res.json({
      success: true,
      data: updatedPlan,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新步骤失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message },
    })
  }
})

// 执行计划 (SSE)
router.post('/plan/:id/execute', async (req: AuthRequest, res) => {
  const { id } = req.params
  const { stepIds } = req.body as { stepIds?: string[] }
  const userId = req.user!.userId

  try {
    // 验证所有权
    const plan = await getPlan(id)
    if (!plan) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '计划不存在' },
      })
      return
    }

    if (plan.userId !== userId) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: '无权执行此计划' },
      })
      return
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    // 发送开始事件
    res.write(`data: ${JSON.stringify({ type: 'start', planId: id })}\n\n`)

    // 执行计划
    for await (const result of executePlan(id, stepIds)) {
      res.write(`data: ${JSON.stringify({ type: 'step', ...result })}\n\n`)
    }

    // 获取最终状态
    const finalPlan = await getPlan(id)

    // 发送完成事件
    res.write(
      `data: ${JSON.stringify({
        type: 'done',
        planId: id,
        state: finalPlan?.state,
      })}\n\n`
    )

    res.end()
  } catch (err) {
    const message = err instanceof Error ? err.message : '执行失败'
    res.write(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`)
    res.end()
  }
})

// 暂停执行
router.post('/plan/:id/pause', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const userId = req.user!.userId

    // 验证所有权
    const plan = await getPlan(id)
    if (!plan || plan.userId !== userId) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '计划不存在' },
      })
      return
    }

    const success = pausePlan(id)

    res.json({
      success,
      message: success ? '已暂停' : '暂停失败',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '暂停失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message },
    })
  }
})

// 恢复执行
router.post('/plan/:id/resume', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const userId = req.user!.userId

    // 验证所有权
    const plan = await getPlan(id)
    if (!plan || plan.userId !== userId) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '计划不存在' },
      })
      return
    }

    const success = resumePlan(id)

    res.json({
      success,
      message: success ? '已恢复' : '恢复失败',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '恢复失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message },
    })
  }
})

// 停止执行
router.post('/plan/:id/stop', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const userId = req.user!.userId

    // 验证所有权
    const plan = await getPlan(id)
    if (!plan || plan.userId !== userId) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '计划不存在' },
      })
      return
    }

    const success = await stopPlan(id)

    res.json({
      success,
      message: success ? '已停止' : '停止失败',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '停止失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message },
    })
  }
})

// 获取计划列表
router.get('/plans', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId
    const { limit, state } = req.query as {
      limit?: string
      state?: PlanModeState
    }

    const plans = await getUserPlans(userId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      state,
    })

    res.json({
      success: true,
      data: plans,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取计划列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message },
    })
  }
})

// 删除计划
router.delete('/plan/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const userId = req.user!.userId

    // 验证所有权
    const plan = await getPlan(id)
    if (!plan || plan.userId !== userId) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '计划不存在' },
      })
      return
    }

    const success = await deletePlan(id)

    res.json({
      success,
      message: success ? '已删除' : '删除失败',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message },
    })
  }
})

export default router
