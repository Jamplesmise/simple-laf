import { Router, type IRouter } from 'express'
import { ObjectId } from 'mongodb'
import * as functionService from '../../services/function.js'
import * as folderService from '../../services/folder.js'
import type { AuthRequest } from '../../middleware/auth.js'
import { logUserAction } from '../../services/functionAudit.js'
import { sendSuccess, sendError } from './utils.js'

const router: IRouter = Router()

// 移动函数到文件夹
router.post('/:id/move', async (req: AuthRequest, res) => {
  const { folderId } = req.body

  try {
    // 获取移动前的函数信息
    const func = await functionService.findById(req.params.id, req.user!.userId)

    const newPath = await folderService.moveFunction(
      new ObjectId(req.params.id),
      folderId ? new ObjectId(folderId) : null,
      new ObjectId(req.user!.userId)
    )

    // 记录审计日志
    if (func) {
      await logUserAction({
        functionId: req.params.id,
        functionName: func.name,
        userId: req.user!.userId,
        username: req.user!.username,
        action: 'move',
        changes: {
          description: `移动到 ${newPath}`,
        },
        metadata: {
          newPath,
          folderId: folderId || null,
        },
      })
    }

    sendSuccess(res, { newPath, newUrl: `/${newPath}` })
  } catch (err) {
    const message = err instanceof Error ? err.message : '移动失败'
    sendError(res, 400, 'MOVE_FAILED', message)
  }
})

// 重命名函数
router.post('/:id/rename', async (req: AuthRequest, res) => {
  const { name } = req.body

  if (!name || typeof name !== 'string' || !name.trim()) {
    sendError(res, 400, 'INVALID_INPUT', '函数名不能为空')
    return
  }

  try {
    // 获取重命名前的函数信息
    const oldFunc = await functionService.findById(req.params.id, req.user!.userId)
    if (!oldFunc) {
      sendError(res, 404, 'NOT_FOUND', '函数不存在')
      return
    }

    const result = await functionService.rename(
      req.params.id,
      req.user!.userId,
      name.trim()
    )

    if (!result.success) {
      sendError(res, 400, 'RENAME_FAILED', result.error || '重命名失败')
      return
    }

    // 记录审计日志
    await logUserAction({
      functionId: req.params.id,
      functionName: name.trim(),
      userId: req.user!.userId,
      username: req.user!.username,
      action: 'rename',
      changes: {
        description: `从 "${oldFunc.name}" 重命名为 "${name.trim()}"`,
      },
      metadata: {
        oldName: oldFunc.name,
        newName: name.trim(),
        newPath: result.newPath,
      },
    })

    sendSuccess(res, {
      newName: name.trim(),
      newPath: result.newPath,
      newUrl: `/${result.newPath}`
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '重命名失败'
    sendError(res, 400, 'RENAME_FAILED', message)
  }
})

// 批量移动函数
router.post('/batch-move', async (req: AuthRequest, res) => {
  const { functionIds, folderId } = req.body

  if (!functionIds || !Array.isArray(functionIds) || functionIds.length === 0) {
    sendError(res, 400, 'INVALID_INPUT', '请提供要移动的函数列表')
    return
  }

  try {
    await folderService.batchMoveFunctions(
      functionIds.map((id: string) => new ObjectId(id)),
      folderId ? new ObjectId(folderId) : null,
      new ObjectId(req.user!.userId)
    )
    sendSuccess(res, {})
  } catch (err) {
    const message = err instanceof Error ? err.message : '批量移动失败'
    sendError(res, 400, 'BATCH_MOVE_FAILED', message)
  }
})

// 调整排序
router.post('/reorder', async (req: AuthRequest, res) => {
  const { orders } = req.body // [{ id, order, isFolder }, ...]

  if (!orders || !Array.isArray(orders)) {
    sendError(res, 400, 'INVALID_INPUT', '请提供排序信息')
    return
  }

  try {
    await folderService.reorderItems(orders, new ObjectId(req.user!.userId))
    sendSuccess(res, {})
  } catch (err) {
    const message = err instanceof Error ? err.message : '排序失败'
    sendError(res, 400, 'REORDER_FAILED', message)
  }
})

export default router
