import { Router, type IRouter } from 'express'
import { ObjectId } from 'mongodb'
import multer from 'multer'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import * as siteService from '../services/site.js'
import * as siteFileService from '../services/siteFile.js'
import * as siteVersionService from '../services/siteVersion.js'

const router: IRouter = Router()
const upload = multer({ storage: multer.memoryStorage() })

// 所有路由需要认证
router.use(authMiddleware)

/**
 * GET /api/site/files
 * 获取文件列表
 */
router.get('/', async (req, res) => {
  try {
    const authReq = req as AuthRequest
    const userId = new ObjectId(authReq.user!.userId)
    const dirPath = (req.query.path as string) || '/'
    const recursive = req.query.recursive !== 'false'

    const files = await siteFileService.list(userId, dirPath, recursive)

    res.json({ success: true, data: files })
  } catch (error) {
    const err = error as Error
    res.status(500).json({ success: false, error: { code: 'FILES_LIST_ERROR', message: err.message } })
  }
})

/**
 * GET /api/site/files/content
 * 读取文件内容
 */
router.get('/content', async (req, res) => {
  try {
    const authReq = req as AuthRequest
    const userId = new ObjectId(authReq.user!.userId)
    const filePath = req.query.path as string

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PATH', message: '缺少文件路径' }
      })
    }

    const result = await siteFileService.readContent(userId, filePath)

    res.json({ success: true, data: result })
  } catch (error) {
    const err = error as Error
    const status = err.message.includes('不存在') ? 404 : 500
    res.status(status).json({ success: false, error: { code: 'FILE_READ_ERROR', message: err.message } })
  }
})

/**
 * POST /api/site/files
 * 创建/更新文件或创建目录
 */
router.post('/', async (req, res) => {
  try {
    const authReq = req as AuthRequest
    const userId = new ObjectId(authReq.user!.userId)
    const { path: filePath, content, isDirectory, versionName } = req.body

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PATH', message: '缺少文件路径' }
      })
    }

    let file

    if (isDirectory) {
      file = await siteFileService.createDirectory(userId, filePath)
    } else {
      const site = await siteService.getOrCreate(userId)
      file = await siteFileService.save(userId, filePath, content || '', site)

      // 为文本文件自动创建版本
      if (typeof content === 'string' && file._id) {
        await siteVersionService.createVersion(
          userId,
          file._id,
          filePath,
          content,
          versionName
        )
      }

      await siteService.updateStats(userId)
    }

    res.json({ success: true, data: file })
  } catch (error) {
    const err = error as Error
    res.status(500).json({ success: false, error: { code: 'FILE_SAVE_ERROR', message: err.message } })
  }
})

/**
 * POST /api/site/files/upload
 * 上传文件
 */
router.post('/upload', upload.array('files', 20), async (req, res) => {
  try {
    const authReq = req as AuthRequest
    const userId = new ObjectId(authReq.user!.userId)
    const targetPath = (req.body.path as string) || '/'
    const files = req.files as Express.Multer.File[]

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILES', message: '没有上传的文件' }
      })
    }

    const site = await siteService.getOrCreate(userId)
    const uploaded: typeof files[0][] = []
    const failed: { name: string; error: string }[] = []

    for (const file of files) {
      try {
        const filePath = targetPath === '/' ? `/${file.originalname}` : `${targetPath}/${file.originalname}`
        await siteFileService.save(userId, filePath, file.buffer, site)
        uploaded.push(file)
      } catch (error) {
        const err = error as Error
        failed.push({ name: file.originalname, error: err.message })
      }
    }

    await siteService.updateStats(userId)

    res.json({
      success: true,
      data: {
        uploaded: uploaded.map(f => f.originalname),
        failed
      }
    })
  } catch (error) {
    const err = error as Error
    res.status(500).json({ success: false, error: { code: 'UPLOAD_ERROR', message: err.message } })
  }
})

/**
 * DELETE /api/site/files
 * 删除文件/目录
 */
router.delete('/', async (req, res) => {
  try {
    const authReq = req as AuthRequest
    const userId = new ObjectId(authReq.user!.userId)
    const filePath = req.query.path as string
    const recursive = req.query.recursive !== 'false'

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PATH', message: '缺少文件路径' }
      })
    }

    await siteFileService.remove(userId, filePath, recursive)
    await siteService.updateStats(userId)

    res.json({ success: true })
  } catch (error) {
    const err = error as Error
    const status = err.message.includes('不存在') ? 404 : 500
    res.status(status).json({ success: false, error: { code: 'FILE_DELETE_ERROR', message: err.message } })
  }
})

/**
 * POST /api/site/files/move
 * 移动/重命名
 */
router.post('/move', async (req, res) => {
  try {
    const authReq = req as AuthRequest
    const userId = new ObjectId(authReq.user!.userId)
    const { from, to } = req.body

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PATHS', message: '缺少源路径或目标路径' }
      })
    }

    const file = await siteFileService.move(userId, from, to)
    await siteService.updateStats(userId)

    res.json({ success: true, data: file })
  } catch (error) {
    const err = error as Error
    res.status(500).json({ success: false, error: { code: 'FILE_MOVE_ERROR', message: err.message } })
  }
})

/**
 * POST /api/site/files/copy
 * 复制文件
 */
router.post('/copy', async (req, res) => {
  try {
    const authReq = req as AuthRequest
    const userId = new ObjectId(authReq.user!.userId)
    const { from, to } = req.body

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PATHS', message: '缺少源路径或目标路径' }
      })
    }

    const site = await siteService.getOrCreate(userId)
    const file = await siteFileService.copy(userId, from, to, site)
    await siteService.updateStats(userId)

    res.json({ success: true, data: file })
  } catch (error) {
    const err = error as Error
    res.status(500).json({ success: false, error: { code: 'FILE_COPY_ERROR', message: err.message } })
  }
})

/**
 * POST /api/site/files/batch
 * 批量操作
 */
router.post('/batch', async (req, res) => {
  try {
    const authReq = req as AuthRequest
    const userId = new ObjectId(authReq.user!.userId)
    const { action, items } = req.body as {
      action: 'delete' | 'move' | 'copy'
      items: { from: string; to?: string }[]
    }

    if (!action || !items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: '无效的请求参数' }
      })
    }

    const site = await siteService.getOrCreate(userId)
    const succeeded: string[] = []
    const failed: { path: string; error: string }[] = []

    for (const item of items) {
      try {
        switch (action) {
          case 'delete':
            await siteFileService.remove(userId, item.from, true)
            break
          case 'move':
            if (!item.to) throw new Error('移动操作需要目标路径')
            await siteFileService.move(userId, item.from, item.to)
            break
          case 'copy':
            if (!item.to) throw new Error('复制操作需要目标路径')
            await siteFileService.copy(userId, item.from, item.to, site)
            break
        }
        succeeded.push(item.from)
      } catch (error) {
        const err = error as Error
        failed.push({ path: item.from, error: err.message })
      }
    }

    await siteService.updateStats(userId)

    res.json({
      success: true,
      data: { succeeded, failed }
    })
  } catch (error) {
    const err = error as Error
    res.status(500).json({ success: false, error: { code: 'BATCH_ERROR', message: err.message } })
  }
})

// ==================== 清理 ====================

/**
 * POST /api/site/files/cleanup
 * 清理孤立记录 (S3 文件不存在但数据库有记录的)
 */
router.post('/cleanup', async (req, res) => {
  try {
    const authReq = req as AuthRequest
    const userId = new ObjectId(authReq.user!.userId)

    const cleaned = await siteFileService.cleanupOrphans(userId)
    await siteService.updateStats(userId)

    res.json({
      success: true,
      data: { cleaned }
    })
  } catch (error) {
    const err = error as Error
    res.status(500).json({ success: false, error: { code: 'CLEANUP_ERROR', message: err.message } })
  }
})

// ==================== 版本控制 ====================

/**
 * GET /api/site/files/versions
 * 获取文件的版本列表
 */
router.get('/versions', async (req, res) => {
  try {
    const authReq = req as AuthRequest
    const userId = new ObjectId(authReq.user!.userId)
    const filePath = req.query.path as string

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PATH', message: '缺少文件路径' }
      })
    }

    const versions = await siteVersionService.getVersionsByPath(userId, filePath)

    res.json({ success: true, data: versions })
  } catch (error) {
    const err = error as Error
    res.status(500).json({ success: false, error: { code: 'VERSION_LIST_ERROR', message: err.message } })
  }
})

/**
 * GET /api/site/files/versions/content
 * 获取指定版本的内容
 */
router.get('/versions/content', async (req, res) => {
  try {
    const authReq = req as AuthRequest
    const userId = new ObjectId(authReq.user!.userId)
    const filePath = req.query.path as string
    const versionNum = parseInt(req.query.version as string, 10)

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PATH', message: '缺少文件路径' }
      })
    }

    if (isNaN(versionNum)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_VERSION', message: '无效的版本号' }
      })
    }

    // 先获取文件记录
    const file = await siteFileService.get(userId, filePath)
    if (!file) {
      return res.status(404).json({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: '文件不存在' }
      })
    }

    const version = await siteVersionService.getVersion(file._id!, versionNum)
    if (!version) {
      return res.status(404).json({
        success: false,
        error: { code: 'VERSION_NOT_FOUND', message: '版本不存在' }
      })
    }

    res.json({ success: true, data: version })
  } catch (error) {
    const err = error as Error
    res.status(500).json({ success: false, error: { code: 'VERSION_READ_ERROR', message: err.message } })
  }
})

/**
 * POST /api/site/files/versions
 * 创建新版本 (手动保存版本)
 */
router.post('/versions', async (req, res) => {
  try {
    const authReq = req as AuthRequest
    const userId = new ObjectId(authReq.user!.userId)
    const { path: filePath, content, versionName } = req.body

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PATH', message: '缺少文件路径' }
      })
    }

    // 获取文件记录
    const file = await siteFileService.get(userId, filePath)
    if (!file) {
      return res.status(404).json({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: '文件不存在' }
      })
    }

    // 创建版本
    const version = await siteVersionService.createVersion(
      userId,
      file._id!,
      filePath,
      content,
      versionName
    )

    res.json({ success: true, data: version })
  } catch (error) {
    const err = error as Error
    res.status(500).json({ success: false, error: { code: 'VERSION_CREATE_ERROR', message: err.message } })
  }
})

/**
 * PUT /api/site/files/versions/:id
 * 更新版本名称
 */
router.put('/versions/:id', async (req, res) => {
  try {
    const versionId = new ObjectId(req.params.id)
    const { versionName } = req.body

    if (!versionName) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_NAME', message: '缺少版本名称' }
      })
    }

    const version = await siteVersionService.updateVersionName(versionId, versionName)
    if (!version) {
      return res.status(404).json({
        success: false,
        error: { code: 'VERSION_NOT_FOUND', message: '版本不存在' }
      })
    }

    res.json({ success: true, data: version })
  } catch (error) {
    const err = error as Error
    res.status(500).json({ success: false, error: { code: 'VERSION_UPDATE_ERROR', message: err.message } })
  }
})

/**
 * POST /api/site/files/versions/rollback
 * 回滚到指定版本
 */
router.post('/versions/rollback', async (req, res) => {
  try {
    const authReq = req as AuthRequest
    const userId = new ObjectId(authReq.user!.userId)
    const { path: filePath, version: versionNum } = req.body

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PATH', message: '缺少文件路径' }
      })
    }

    if (typeof versionNum !== 'number') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_VERSION', message: '无效的版本号' }
      })
    }

    // 获取文件记录
    const file = await siteFileService.get(userId, filePath)
    if (!file) {
      return res.status(404).json({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: '文件不存在' }
      })
    }

    // 获取目标版本
    const targetVersion = await siteVersionService.getVersion(file._id!, versionNum)
    if (!targetVersion) {
      return res.status(404).json({
        success: false,
        error: { code: 'VERSION_NOT_FOUND', message: '版本不存在' }
      })
    }

    // 更新文件内容
    const site = await siteService.getOrCreate(userId)
    const updatedFile = await siteFileService.save(userId, filePath, targetVersion.content, site)

    // 创建回滚版本记录
    await siteVersionService.createVersion(
      userId,
      file._id!,
      filePath,
      targetVersion.content,
      `回滚到 ${targetVersion.versionName}`
    )

    await siteService.updateStats(userId)

    res.json({ success: true, data: updatedFile })
  } catch (error) {
    const err = error as Error
    res.status(500).json({ success: false, error: { code: 'ROLLBACK_ERROR', message: err.message } })
  }
})

/**
 * GET /api/site/files/versions/stats
 * 获取版本统计
 */
router.get('/versions/stats', async (req, res) => {
  try {
    const authReq = req as AuthRequest
    const userId = new ObjectId(authReq.user!.userId)

    const stats = await siteVersionService.getVersionStats(userId)

    res.json({ success: true, data: stats })
  } catch (error) {
    const err = error as Error
    res.status(500).json({ success: false, error: { code: 'VERSION_STATS_ERROR', message: err.message } })
  }
})

export default router
