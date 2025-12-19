import { Router, type IRouter } from 'express'
import { ObjectId } from 'mongodb'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import * as envService from '../services/env.js'

const router: IRouter = Router()

// 所有路由都需要认证
router.use(authMiddleware)

// 获取环境变量列表 (带解密值)
router.get('/', async (req: AuthRequest, res) => {
  try {
    const envs = await envService.listEnvVariablesWithValues(
      new ObjectId(req.user!.userId)
    )
    res.json({ success: true, data: envs })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 批量更新环境变量 (用于代码模式)
router.post('/bulk', async (req: AuthRequest, res) => {
  try {
    const { variables } = req.body as { variables: Array<{ key: string; value: string }> }

    if (!Array.isArray(variables)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '无效的数据格式' }
      })
      return
    }

    // 验证所有变量名格式
    for (const v of variables) {
      if (!v.key || !/^[A-Z_][A-Z0-9_]*$/.test(v.key)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_KEY', message: `变量名格式错误: ${v.key}` }
        })
        return
      }
    }

    await envService.bulkUpdateEnvVariables(
      new ObjectId(req.user!.userId),
      variables
    )

    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '批量更新失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 设置环境变量
router.put('/:key', async (req: AuthRequest, res) => {
  try {
    const { value, description } = req.body
    const { key } = req.params

    if (!key) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '变量名不能为空' }
      })
      return
    }

    if (!value) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '值不能为空' }
      })
      return
    }

    // 验证变量名格式 (大写字母、数字、下划线)
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_KEY', message: '变量名格式错误，请使用大写字母和下划线' }
      })
      return
    }

    await envService.setEnvVariable(
      new ObjectId(req.user!.userId),
      key,
      value,
      description
    )

    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '保存失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 删除环境变量
router.delete('/:key', async (req: AuthRequest, res) => {
  try {
    const deleted = await envService.deleteEnvVariable(
      new ObjectId(req.user!.userId),
      req.params.key
    )

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '环境变量不存在' }
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

export default router
