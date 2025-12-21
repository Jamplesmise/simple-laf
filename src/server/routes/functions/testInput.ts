/**
 * 函数测试输入路由
 *
 * 处理测试输入的保存和读取
 * Sprint 19: 测试基础
 */

import { Router, type IRouter } from 'express'
import { ObjectId } from 'mongodb'
import type { AuthRequest } from '../../middleware/auth.js'
import { getDB } from '../../db.js'
import { sendSuccess, sendError, handleError } from './utils.js'

const router: IRouter = Router()

/**
 * 获取函数的测试输入
 * GET /api/functions/:id/test-input
 */
router.get('/:id/test-input', async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const func = await db.collection('functions').findOne(
      {
        _id: new ObjectId(req.params.id),
        userId: new ObjectId(req.user!.userId),
      },
      { projection: { testInput: 1 } }
    )

    if (!func) {
      sendError(res, 404, 'NOT_FOUND', '函数不存在')
      return
    }

    sendSuccess(res, func.testInput || null)
  } catch (err) {
    handleError(res, err, '获取测试输入失败')
  }
})

/**
 * 保存函数的测试输入
 * PUT /api/functions/:id/test-input
 */
router.put('/:id/test-input', async (req: AuthRequest, res) => {
  try {
    const { method, body, query, headers } = req.body

    const testInput = {
      method: method || 'POST',
      body: body || '{}',
      query: query || '',
      headers: headers || '{}',
      updatedAt: new Date(),
    }

    const db = getDB()
    const result = await db.collection('functions').updateOne(
      {
        _id: new ObjectId(req.params.id),
        userId: new ObjectId(req.user!.userId),
      },
      { $set: { testInput } }
    )

    if (result.matchedCount === 0) {
      sendError(res, 404, 'NOT_FOUND', '函数不存在')
      return
    }

    sendSuccess(res, { saved: true })
  } catch (err) {
    handleError(res, err, '保存测试输入失败')
  }
})

export default router
