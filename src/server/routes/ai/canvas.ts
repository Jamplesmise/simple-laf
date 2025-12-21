/**
 * Canvas 模式路由 (Sprint 11.2)
 *
 * /api/ai/canvas/:conversationId/snapshots - 获取快照列表
 * /api/ai/canvas/:conversationId/snapshot - 创建快照
 * /api/ai/canvas/snapshot/:id - 获取/删除快照
 * /api/ai/canvas/snapshot/:id/compare - 对比快照
 * /api/ai/canvas/apply - 应用代码到函数
 */

import { Router, type Router as RouterType } from 'express'
import { ObjectId } from 'mongodb'
import type { AuthRequest } from '../../middleware/auth.js'
import { getDB } from '../../db.js'
import {
  getSnapshotList,
  getSnapshot,
  createSnapshot,
  compareSnapshots,
  applySnapshotToFunction,
  deleteSnapshot
} from '../../services/ai/canvas/index.js'
import { calculateDiff } from '../../services/ai/canvas/diff.js'
import type { CreateSnapshotRequest, ApplyCodeRequest } from '../../services/ai/canvas/types.js'

const router: RouterType = Router()

// 获取对话的快照列表
router.get('/canvas/:conversationId/snapshots', async (req: AuthRequest, res) => {
  try {
    const { conversationId } = req.params
    const { limit } = req.query
    const userId = new ObjectId(req.user!.userId)
    const db = getDB()

    // 验证对话所属
    const conversation = await db.collection('ai_conversations').findOne({
      _id: new ObjectId(conversationId),
      userId
    })

    if (!conversation) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '对话不存在' }
      })
      return
    }

    const snapshots = await getSnapshotList(conversationId, limit ? parseInt(limit as string) : 50)

    res.json({
      success: true,
      data: snapshots
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取快照列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 创建快照
router.post('/canvas/:conversationId/snapshot', async (req: AuthRequest, res) => {
  try {
    const { conversationId } = req.params
    const request = req.body as CreateSnapshotRequest
    const userId = new ObjectId(req.user!.userId)
    const db = getDB()

    // 验证对话所属
    const conversation = await db.collection('ai_conversations').findOne({
      _id: new ObjectId(conversationId),
      userId
    })

    if (!conversation) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '对话不存在' }
      })
      return
    }

    // 验证必填字段
    if (!request.code) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '代码内容不能为空' }
      })
      return
    }

    const result = await createSnapshot(conversationId, request)

    res.json({
      success: true,
      data: result
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建快照失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取快照详情
router.get('/canvas/snapshot/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const userId = new ObjectId(req.user!.userId)
    const db = getDB()

    const snapshot = await getSnapshot(id)

    if (!snapshot) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '快照不存在' }
      })
      return
    }

    // 验证对话所属
    const conversation = await db.collection('ai_conversations').findOne({
      _id: snapshot.conversationId,
      userId
    })

    if (!conversation) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: '无权访问此快照' }
      })
      return
    }

    res.json({
      success: true,
      data: {
        id: snapshot._id!.toString(),
        conversationId: snapshot.conversationId.toString(),
        messageId: snapshot.messageId?.toString(),
        functionId: snapshot.functionId?.toString(),
        version: snapshot.version,
        code: snapshot.code,
        language: snapshot.language,
        description: snapshot.description,
        createdAt: snapshot.createdAt
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取快照失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 删除快照
router.delete('/canvas/snapshot/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const userId = new ObjectId(req.user!.userId)
    const db = getDB()

    const snapshot = await getSnapshot(id)

    if (!snapshot) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '快照不存在' }
      })
      return
    }

    // 验证对话所属
    const conversation = await db.collection('ai_conversations').findOne({
      _id: snapshot.conversationId,
      userId
    })

    if (!conversation) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: '无权删除此快照' }
      })
      return
    }

    await deleteSnapshot(id)

    res.json({
      success: true,
      message: '快照已删除'
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除快照失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 对比快照
router.post('/canvas/snapshot/:id/compare', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const { baseSnapshotId } = req.body
    const userId = new ObjectId(req.user!.userId)
    const db = getDB()

    const snapshot = await getSnapshot(id)

    if (!snapshot) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '快照不存在' }
      })
      return
    }

    // 验证对话所属
    const conversation = await db.collection('ai_conversations').findOne({
      _id: snapshot.conversationId,
      userId
    })

    if (!conversation) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: '无权访问此快照' }
      })
      return
    }

    const result = await compareSnapshots(baseSnapshotId, id)

    res.json({
      success: true,
      data: result
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '对比快照失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 计算 Diff（不保存快照，直接计算）
router.post('/canvas/diff', async (req: AuthRequest, res) => {
  try {
    const { before, after } = req.body

    if (typeof before !== 'string' || typeof after !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请提供 before 和 after 代码' }
      })
      return
    }

    const diff = calculateDiff(before, after)

    res.json({
      success: true,
      data: diff
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '计算 Diff 失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 应用代码到函数
router.post('/canvas/apply', async (req: AuthRequest, res) => {
  try {
    const { snapshotId, functionId } = req.body as ApplyCodeRequest
    const userId = req.user!.userId

    if (!snapshotId || !functionId) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请提供 snapshotId 和 functionId' }
      })
      return
    }

    await applySnapshotToFunction(snapshotId, functionId, userId)

    res.json({
      success: true,
      message: '代码已应用到函数'
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '应用代码失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

export default router
