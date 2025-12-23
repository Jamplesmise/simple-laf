/**
 * AI 上下文管理路由
 *
 * /api/ai/conversations/:id/context - 上下文统计
 * /api/ai/conversations/:id/compress - 上下文压缩
 * /api/ai/functions/:functionId/precise-context - 精准上下文 (Sprint 16.1)
 * /api/ai/functions/:functionId/precise-update - 精准更新 (Sprint 16.1)
 */

import { Router, type Router as RouterType } from 'express'
import { ObjectId } from 'mongodb'
import type { AuthRequest } from '../../middleware/auth.js'
import { getDB } from '../../db.js'
import { getConversationContextStats } from '../../services/ai/context/calculator.js'
import { compressContext, deleteContextItems } from '../../services/ai/context/compressor.js'
import {
  determineChangeType,
  getMinimalContext,
  getSmartContext,
  applyPreciseDiff,
  validateDiff,
  formatPreciseUpdatePrompt,
  type PreciseUpdateRequest
} from '../../services/ai/context/preciseUpdate.js'
import type { CompressOptions, DeleteContextOptions } from '../../services/ai/context/types.js'

const router: RouterType = Router()

// 获取对话上下文统计
router.get('/conversations/:id/context', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const { model } = req.query
    const userId = new ObjectId(req.user!.userId)
    const db = getDB()

    const conversation = await db.collection('ai_conversations').findOne({
      _id: new ObjectId(id),
      userId
    })

    if (!conversation) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '对话不存在' }
      })
      return
    }

    let modelName = 'gpt-4'
    let contextLimit: number | undefined
    if (model) {
      modelName = model as string
    } else if (conversation.modelId) {
      const modelDoc = await db.collection('ai_models').findOne({
        _id: new ObjectId(conversation.modelId)
      })
      if (modelDoc) {
        modelName = modelDoc.name
        contextLimit = modelDoc.contextLimit
      }
    }

    const stats = await getConversationContextStats(id, modelName, contextLimit)

    res.json({
      success: true,
      data: stats
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取上下文统计失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 压缩对话上下文
router.post('/conversations/:id/compress', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const { mode, targetPercentage, itemIds } = req.body as CompressOptions
    const userId = new ObjectId(req.user!.userId)
    const db = getDB()

    const conversation = await db.collection('ai_conversations').findOne({
      _id: new ObjectId(id),
      userId
    })

    if (!conversation) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '对话不存在' }
      })
      return
    }

    const result = await compressContext(id, { mode, targetPercentage, itemIds })

    res.json({
      success: true,
      data: result
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '压缩上下文失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 删除指定上下文项
router.delete('/conversations/:id/context', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const { itemIds } = req.body as DeleteContextOptions
    const userId = new ObjectId(req.user!.userId)
    const db = getDB()

    const conversation = await db.collection('ai_conversations').findOne({
      _id: new ObjectId(id),
      userId
    })

    if (!conversation) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '对话不存在' }
      })
      return
    }

    if (!itemIds || itemIds.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请指定要删除的项目' }
      })
      return
    }

    const result = await deleteContextItems(id, { itemIds })

    res.json({
      success: true,
      data: result
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除上下文项失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// ==================== 精准更新 API (Sprint 16.1) ====================

// 获取智能上下文（根据请求自动判断修改类型）
router.post('/functions/:functionId/smart-context', async (req: AuthRequest, res) => {
  try {
    const { functionId } = req.params
    const { request } = req.body as { request: string }
    const userId = new ObjectId(req.user!.userId)
    const db = getDB()

    // 验证函数存在且属于当前用户
    const func = await db.collection('functions').findOne({
      _id: new ObjectId(functionId),
      userId
    })

    if (!func) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '函数不存在' }
      })
      return
    }

    if (!request) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请提供修改请求描述' }
      })
      return
    }

    const result = await getSmartContext(functionId, request)

    res.json({
      success: true,
      data: {
        changeType: result.changeType,
        useMinimalContext: result.useMinimalContext,
        context: result.context,
        prompt: result.useMinimalContext && 'contextCode' in result.context
          ? formatPreciseUpdatePrompt(result.context)
          : null
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取智能上下文失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取精准上下文（指定行号范围）
router.post('/functions/:functionId/precise-context', async (req: AuthRequest, res) => {
  try {
    const { functionId } = req.params
    const { range, contextLines = 10 } = req.body as PreciseUpdateRequest
    const userId = new ObjectId(req.user!.userId)
    const db = getDB()

    // 验证函数存在且属于当前用户
    const func = await db.collection('functions').findOne({
      _id: new ObjectId(functionId),
      userId
    })

    if (!func) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '函数不存在' }
      })
      return
    }

    if (!range || !range.startLine || !range.endLine) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请指定修改范围 (startLine, endLine)' }
      })
      return
    }

    const result = await getMinimalContext(functionId, range, contextLines)

    res.json({
      success: true,
      data: {
        ...result,
        prompt: formatPreciseUpdatePrompt(result)
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取精准上下文失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 应用精准更新
router.post('/functions/:functionId/precise-update', async (req: AuthRequest, res) => {
  try {
    const { functionId } = req.params
    const { newCode, range } = req.body as { newCode: string; range: { startLine: number; endLine: number } }
    const userId = new ObjectId(req.user!.userId)
    const db = getDB()

    // 验证函数存在且属于当前用户
    const func = await db.collection('functions').findOne({
      _id: new ObjectId(functionId),
      userId
    })

    if (!func) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '函数不存在' }
      })
      return
    }

    if (!newCode || !range) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请提供新代码和修改范围' }
      })
      return
    }

    // 应用精准更新
    const result = await applyPreciseDiff(functionId, newCode, range)

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: { code: 'UPDATE_FAILED', message: result.error || '更新失败' }
      })
      return
    }

    // 验证更新结果
    const validation = validateDiff(result.originalCode, result.updatedCode, range)

    res.json({
      success: true,
      data: {
        ...result,
        validation
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '应用精准更新失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 分析修改类型
router.post('/analyze-change-type', async (req: AuthRequest, res) => {
  try {
    const { request } = req.body as { request: string }

    if (!request) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请提供修改请求描述' }
      })
      return
    }

    const changeType = determineChangeType(request)

    res.json({
      success: true,
      data: {
        changeType,
        description: {
          minor: '小范围修改（修改变量、添加注释等）',
          moderate: '中等修改（添加功能、优化逻辑等）',
          refactor: '重构（拆分、合并、重写等）'
        }[changeType],
        suggestedContextLines: {
          minor: 10,
          moderate: 20,
          refactor: '全部代码'
        }[changeType]
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '分析修改类型失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

export default router
