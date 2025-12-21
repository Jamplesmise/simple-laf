/**
 * AI 系统提示词路由
 *
 * /api/ai/prompts/* - 提示词管理
 */

import { Router, type Router as RouterType } from 'express'
import { ObjectId } from 'mongodb'
import type { AuthRequest } from '../../middleware/auth.js'
import * as systemPromptService from '../../services/ai/systemPrompt.js'
import { getDB } from '../../db.js'

const router: RouterType = Router()

// 获取默认系统提示词 (必须在 /prompts/:id 之前)
router.get('/prompts/default', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)

    const prompt = await systemPromptService.getDefaultSystemPrompt(db, userId)

    res.json({
      success: true,
      data: prompt ? {
        ...prompt,
        _id: prompt._id.toString(),
        userId: prompt.userId.toString(),
      } : null
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取默认提示词失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取系统提示词列表
router.get('/prompts', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const prompts = await systemPromptService.listSystemPrompts(db, userId)

    res.json({
      success: true,
      data: prompts.map(p => ({
        ...p,
        _id: p._id.toString(),
        userId: p.userId.toString(),
      }))
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取提示词列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 创建系统提示词
router.post('/prompts', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const { name, content, isDefault } = req.body

    if (!name?.trim() || !content?.trim()) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '名称和内容不能为空' }
      })
      return
    }

    const prompt = await systemPromptService.createSystemPrompt(db, userId, {
      name: name.trim(),
      content: content.trim(),
      isDefault
    })

    res.json({
      success: true,
      data: {
        ...prompt,
        _id: prompt._id.toString(),
        userId: prompt.userId.toString(),
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建提示词失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取单个系统提示词
router.get('/prompts/:id', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const promptId = new ObjectId(req.params.id)

    const prompt = await systemPromptService.getSystemPrompt(db, userId, promptId)

    if (!prompt) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '提示词不存在' }
      })
      return
    }

    res.json({
      success: true,
      data: {
        ...prompt,
        _id: prompt._id.toString(),
        userId: prompt.userId.toString(),
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取提示词失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 更新系统提示词
router.put('/prompts/:id', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const promptId = new ObjectId(req.params.id)
    const { name, content, isDefault, changeNote } = req.body

    const prompt = await systemPromptService.updateSystemPrompt(db, userId, promptId, {
      name,
      content,
      isDefault,
      changeNote
    })

    if (!prompt) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '提示词不存在' }
      })
      return
    }

    res.json({
      success: true,
      data: {
        ...prompt,
        _id: prompt._id.toString(),
        userId: prompt.userId.toString(),
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新提示词失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 删除系统提示词
router.delete('/prompts/:id', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const promptId = new ObjectId(req.params.id)

    const deleted = await systemPromptService.deleteSystemPrompt(db, userId, promptId)

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '提示词不存在' }
      })
      return
    }

    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除提示词失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取版本历史
router.get('/prompts/:id/versions', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const promptId = new ObjectId(req.params.id)

    const versions = await systemPromptService.listPromptVersions(db, userId, promptId)

    res.json({
      success: true,
      data: versions.map(v => ({
        ...v,
        _id: v._id.toString(),
        promptId: v.promptId.toString(),
      }))
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取版本历史失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 回滚到指定版本
router.post('/prompts/:id/rollback', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)
    const promptId = new ObjectId(req.params.id)
    const { version } = req.body

    if (typeof version !== 'number') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '版本号无效' }
      })
      return
    }

    const prompt = await systemPromptService.rollbackToVersion(db, userId, promptId, version)

    if (!prompt) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '提示词或版本不存在' }
      })
      return
    }

    res.json({
      success: true,
      data: {
        ...prompt,
        _id: prompt._id.toString(),
        userId: prompt.userId.toString(),
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '回滚失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

export default router
