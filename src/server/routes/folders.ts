import { Router, type IRouter } from 'express'
import { ObjectId } from 'mongodb'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import * as folderService from '../services/folder.js'

const router: IRouter = Router()

// 所有路由都需要认证
router.use(authMiddleware)

// 获取文件夹树
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tree = await folderService.getFolderTree(new ObjectId(req.user!.userId))
    res.json({ success: true, data: tree })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取文件夹树失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 创建文件夹
router.post('/', async (req: AuthRequest, res) => {
  const { name, parentId } = req.body

  if (!name) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: '文件夹名不能为空' }
    })
    return
  }

  try {
    const folder = await folderService.createFolder(
      name,
      parentId ? new ObjectId(parentId) : null,
      new ObjectId(req.user!.userId)
    )
    res.json({ success: true, data: folder })
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建文件夹失败'
    res.status(400).json({
      success: false,
      error: { code: 'CREATE_FAILED', message }
    })
  }
})

// 重命名文件夹
router.patch('/:id', async (req: AuthRequest, res) => {
  const { name } = req.body

  if (!name) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: '新名称不能为空' }
    })
    return
  }

  try {
    await folderService.renameFolder(
      new ObjectId(req.params.id),
      name,
      new ObjectId(req.user!.userId)
    )
    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '重命名失败'
    res.status(400).json({
      success: false,
      error: { code: 'RENAME_FAILED', message }
    })
  }
})

// 删除文件夹
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await folderService.deleteFolder(
      new ObjectId(req.params.id),
      new ObjectId(req.user!.userId)
    )
    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除失败'
    res.status(400).json({
      success: false,
      error: { code: 'DELETE_FAILED', message }
    })
  }
})

// 移动文件夹
router.post('/:id/move', async (req: AuthRequest, res) => {
  const { parentId } = req.body

  try {
    const newPath = await folderService.moveFolder(
      new ObjectId(req.params.id),
      parentId ? new ObjectId(parentId) : null,
      new ObjectId(req.user!.userId)
    )
    res.json({ success: true, data: { newPath } })
  } catch (err) {
    const message = err instanceof Error ? err.message : '移动失败'
    res.status(400).json({
      success: false,
      error: { code: 'MOVE_FAILED', message }
    })
  }
})

export default router
