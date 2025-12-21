/**
 * AI 配置路由
 *
 * /api/ai/config - 配置管理
 * /api/ai/models - 模型列表
 */

import { Router, type Router as RouterType } from 'express'
import { ObjectId } from 'mongodb'
import type { AuthRequest } from '../../middleware/auth.js'
import * as aiService from '../../services/ai/index.js'

const router: RouterType = Router()

// 获取 AI 配置 (apiKey 脱敏)
router.get('/config', async (req: AuthRequest, res) => {
  try {
    const config = await aiService.getAIConfigMasked(new ObjectId(req.user!.userId))
    res.json({ success: true, data: config })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取配置失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 保存 AI 配置
router.put('/config', async (req: AuthRequest, res) => {
  try {
    const { provider, model, apiKey, baseUrl, params } = req.body

    if (!provider || !model) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '供应商和模型不能为空' }
      })
      return
    }

    await aiService.saveAIConfig(new ObjectId(req.user!.userId), {
      provider,
      model,
      apiKey,
      baseUrl,
      params
    })

    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '保存配置失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 测试 AI 连接
router.post('/config/test', async (req: AuthRequest, res) => {
  try {
    const result = await aiService.testAIConnection(new ObjectId(req.user!.userId))
    res.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : '测试连接失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取可用模型列表
router.get('/models', async (req: AuthRequest, res) => {
  try {
    const models = await aiService.getAvailableModels(new ObjectId(req.user!.userId))
    res.json({ success: true, data: models })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取模型列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取供应商的默认模型列表
router.get('/models/:provider', async (req: AuthRequest, res) => {
  try {
    const { provider } = req.params
    const models = aiService.getProviderDefaultModels(provider as aiService.AIConfig['provider'])
    res.json({ success: true, data: models })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取模型列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

export default router
