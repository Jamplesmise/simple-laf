import { Router, type IRouter } from 'express'
import * as functionService from '../../services/function.js'
import type { AuthRequest } from '../../middleware/auth.js'
import { logUserAction } from '../../services/functionAudit.js'
import { sendSuccess, sendError, handleError } from './utils.js'

const router: IRouter = Router()

// 获取函数列表
router.get('/', async (req: AuthRequest, res) => {
  try {
    const functions = await functionService.list(req.user!.userId)
    sendSuccess(res, functions)
  } catch (err) {
    handleError(res, err, '获取列表失败')
  }
})

// 创建函数
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, code, folderId } = req.body

    if (!name) {
      sendError(res, 400, 'INVALID_INPUT', '函数名不能为空')
      return
    }

    const actualCode = code || 'export default async function(ctx: any) {\n  return "Hello, World!"\n}'
    const func = await functionService.create(
      req.user!.userId,
      name,
      actualCode,
      folderId
    )

    // 记录审计日志
    await logUserAction({
      functionId: func._id,
      functionName: name,
      userId: req.user!.userId,
      username: req.user!.username,
      action: 'create',
      changes: {
        after: actualCode,
        description: '创建函数',
      },
    })

    sendSuccess(res, func)
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建失败'
    const code = message.includes('duplicate') ? 'DUPLICATE_NAME' : 'CREATE_FAILED'
    sendError(res, 400, code, message)
  }
})

// 获取函数详情
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const func = await functionService.findById(req.params.id, req.user!.userId)
    if (!func) {
      sendError(res, 404, 'NOT_FOUND', '函数不存在')
      return
    }
    sendSuccess(res, func)
  } catch (err) {
    handleError(res, err, '获取详情失败')
  }
})

// 更新函数
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { code } = req.body

    // 获取更新前的函数信息
    const oldFunc = await functionService.findById(req.params.id, req.user!.userId)
    if (!oldFunc) {
      sendError(res, 404, 'NOT_FOUND', '函数不存在')
      return
    }

    const updated = await functionService.update(
      req.params.id,
      req.user!.userId,
      { code }
    )

    if (!updated) {
      sendError(res, 404, 'NOT_FOUND', '函数不存在')
      return
    }

    // 记录审计日志
    await logUserAction({
      functionId: req.params.id,
      functionName: oldFunc.name,
      userId: req.user!.userId,
      username: req.user!.username,
      action: 'update',
      changes: {
        before: oldFunc.code,
        after: code,
        description: '更新函数代码',
      },
    })

    sendSuccess(res, { updated: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新失败'
    sendError(res, 500, 'UPDATE_FAILED', message)
  }
})

// 删除函数
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    // 获取删除前的函数信息
    const func = await functionService.findById(req.params.id, req.user!.userId)
    if (!func) {
      sendError(res, 404, 'NOT_FOUND', '函数不存在')
      return
    }

    const deleted = await functionService.remove(req.params.id, req.user!.userId)
    if (!deleted) {
      sendError(res, 404, 'NOT_FOUND', '函数不存在')
      return
    }

    // 记录审计日志
    await logUserAction({
      functionId: req.params.id,
      functionName: func.name,
      userId: req.user!.userId,
      username: req.user!.username,
      action: 'delete',
      changes: {
        before: func.code,
        description: '删除函数',
      },
    })

    sendSuccess(res, { deleted: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除失败'
    sendError(res, 500, 'DELETE_FAILED', message)
  }
})

export default router
