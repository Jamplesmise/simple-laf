/**
 * AI 供应商和模型路由
 *
 * /api/ai/providers/* - 供应商管理
 * /api/ai/models/* - 模型管理
 */

import { Router, type Router as RouterType } from 'express'
import { ObjectId } from 'mongodb'
import type { AuthRequest } from '../../middleware/auth.js'
import * as providerService from '../../services/ai/provider.js'
import { getDB } from '../../db.js'

const router: RouterType = Router()

// ============ 供应商管理 API ============

// 获取供应商列表
router.get('/providers', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)

    await providerService.initDefaultProviders(db, userId)

    const providers = await providerService.listProviders(db, userId)

    res.json({
      success: true,
      data: providers.map(p => ({
        ...providerService.maskApiKey(p),
        _id: p._id.toString(),
        userId: p.userId.toString(),
      }))
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取供应商列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 创建供应商
router.post('/providers', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const { name, type, baseUrl, apiKey, isDefault } = req.body

    if (!name?.trim() || !type || !baseUrl?.trim()) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '名称、类型和地址不能为空' }
      })
      return
    }

    const provider = await providerService.createProvider(db, userId, {
      name: name.trim(),
      type,
      baseUrl: baseUrl.trim(),
      apiKey,
      isDefault
    })

    res.json({
      success: true,
      data: {
        ...providerService.maskApiKey(provider),
        _id: provider._id.toString(),
        userId: provider.userId.toString(),
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建供应商失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取单个供应商
router.get('/providers/:id', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const providerId = new ObjectId(req.params.id)

    const provider = await providerService.getProvider(db, userId, providerId)

    if (!provider) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '供应商不存在' }
      })
      return
    }

    res.json({
      success: true,
      data: {
        ...providerService.maskApiKey(provider),
        _id: provider._id.toString(),
        userId: provider.userId.toString(),
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取供应商失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 更新供应商
router.put('/providers/:id', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const providerId = new ObjectId(req.params.id)
    const { name, baseUrl, apiKey, isDefault } = req.body

    const provider = await providerService.updateProvider(db, userId, providerId, {
      name,
      baseUrl,
      apiKey,
      isDefault
    })

    if (!provider) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '供应商不存在' }
      })
      return
    }

    res.json({
      success: true,
      data: {
        ...providerService.maskApiKey(provider),
        _id: provider._id.toString(),
        userId: provider.userId.toString(),
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新供应商失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 删除供应商
router.delete('/providers/:id', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const providerId = new ObjectId(req.params.id)

    const deleted = await providerService.deleteProvider(db, userId, providerId)

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '供应商不存在' }
      })
      return
    }

    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除供应商失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// ============ 模型管理 API ============

// 获取供应商的模型列表
router.get('/providers/:providerId/models', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const providerId = new ObjectId(req.params.providerId)

    const models = await providerService.listModels(db, userId, providerId)

    res.json({
      success: true,
      data: models.map(m => ({
        ...m,
        _id: m._id.toString(),
        providerId: m.providerId.toString(),
        userId: m.userId.toString(),
      }))
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取模型列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取所有模型
router.get('/all-models', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)

    const models = await providerService.listAllModels(db, userId)

    res.json({
      success: true,
      data: models.map(m => ({
        ...m,
        _id: m._id.toString(),
        providerId: m.providerId.toString(),
        userId: m.userId.toString(),
      }))
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取模型列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 创建模型
router.post('/providers/:providerId/models', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const providerId = new ObjectId(req.params.providerId)
    const { name, alias, temperature, maxTokens, pricing, supportsThinking, isDefault } = req.body

    if (!name?.trim() || !alias?.trim()) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '模型名称和别名不能为空' }
      })
      return
    }

    const model = await providerService.createModel(db, userId, providerId, {
      name: name.trim(),
      alias: alias.trim(),
      temperature,
      maxTokens,
      pricing,
      supportsThinking,
      isDefault
    })

    if (!model) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '供应商不存在' }
      })
      return
    }

    res.json({
      success: true,
      data: {
        ...model,
        _id: model._id.toString(),
        providerId: model.providerId.toString(),
        userId: model.userId.toString(),
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建模型失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取单个模型
router.get('/models/:id', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const modelId = new ObjectId(req.params.id)

    const model = await providerService.getModel(db, userId, modelId)

    if (!model) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '模型不存在' }
      })
      return
    }

    res.json({
      success: true,
      data: {
        ...model,
        _id: model._id.toString(),
        providerId: model.providerId.toString(),
        userId: model.userId.toString(),
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取模型失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 更新模型
router.put('/models/:id', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const modelId = new ObjectId(req.params.id)
    const { name, alias, temperature, maxTokens, pricing, supportsThinking, isDefault } = req.body

    const model = await providerService.updateModel(db, userId, modelId, {
      name,
      alias,
      temperature,
      maxTokens,
      pricing,
      supportsThinking,
      isDefault
    })

    if (!model) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '模型不存在' }
      })
      return
    }

    res.json({
      success: true,
      data: {
        ...model,
        _id: model._id.toString(),
        providerId: model.providerId.toString(),
        userId: model.userId.toString(),
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新模型失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 删除模型
router.delete('/models/:id', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const modelId = new ObjectId(req.params.id)

    const deleted = await providerService.deleteModel(db, userId, modelId)

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '模型不存在' }
      })
      return
    }

    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除模型失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 测试模型连接
router.post('/models/:id/test', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const modelId = new ObjectId(req.params.id)

    const result = await providerService.testModel(db, userId, modelId)

    res.json({
      success: true,
      data: result
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '测试失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取默认模型
router.get('/default-model', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)

    const model = await providerService.getDefaultModel(db, userId)

    res.json({
      success: true,
      data: model ? {
        ...model,
        _id: model._id.toString(),
        providerId: model.providerId.toString(),
        userId: model.userId.toString(),
      } : null
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取默认模型失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

export default router
