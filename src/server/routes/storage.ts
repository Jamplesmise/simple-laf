import { Router, type IRouter } from 'express'
import { ObjectId } from 'mongodb'
import multer from 'multer'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import * as storageService from '../services/storage.js'
import * as siteFileService from '../services/siteFile.js'
import * as siteService from '../services/site.js'
import logger from '../utils/logger.js'

const router: IRouter = Router()

// 文件上传配置 (内存存储，限制 100MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
})

// 扩展 AuthRequest 以支持 multer 的 file 属性
interface MulterAuthRequest extends AuthRequest {
  file?: Express.Multer.File
}

// 所有路由都需要认证
router.use(authMiddleware)

// S3 配置检查中间件
const requireS3Configured = (_req: AuthRequest, res: import('express').Response, next: import('express').NextFunction) => {
  if (!storageService.isConfigured()) {
    res.status(400).json({
      success: false,
      error: { code: 'S3_NOT_CONFIGURED', message: 'S3 存储未配置，请设置环境变量' }
    })
    return
  }
  next()
}

// ==================== 配置状态 ====================

// 获取 S3 配置状态 (只读，从环境变量)
router.get('/config', (_req: AuthRequest, res) => {
  try {
    const status = storageService.getConfigStatus()
    res.json({ success: true, data: status })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取配置失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 测试 S3 连接
router.post('/config/test', async (_req: AuthRequest, res) => {
  try {
    const result = await storageService.testConnection()
    res.json({
      success: result.success,
      data: { message: result.message }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '测试连接失败'
    res.status(400).json({
      success: false,
      error: { code: 'TEST_FAILED', message }
    })
  }
})

// ==================== 存储桶操作 ====================

// 获取存储桶列表
router.get('/buckets', requireS3Configured, async (_req: AuthRequest, res) => {
  try {
    const buckets = await storageService.listBuckets()
    res.json({ success: true, data: buckets })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取存储桶列表失败'
    res.status(400).json({
      success: false,
      error: { code: 'LIST_FAILED', message }
    })
  }
})

// 创建存储桶
router.post('/buckets', requireS3Configured, async (req: AuthRequest, res) => {
  const { name } = req.body

  if (!name) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: '请输入存储桶名称' }
    })
    return
  }

  try {
    await storageService.createBucket(name)
    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建存储桶失败'
    res.status(400).json({
      success: false,
      error: { code: 'CREATE_FAILED', message }
    })
  }
})

// 删除存储桶
router.delete('/buckets/:name', requireS3Configured, async (req: AuthRequest, res) => {
  const { name } = req.params

  try {
    await storageService.deleteBucket(name)
    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除存储桶失败'
    res.status(400).json({
      success: false,
      error: { code: 'DELETE_FAILED', message }
    })
  }
})

// ==================== 对象操作 ====================

// 列出对象
router.get('/objects', requireS3Configured, async (req: AuthRequest, res) => {
  const { bucket, prefix, continuationToken, maxKeys } = req.query

  if (!bucket || typeof bucket !== 'string') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: '请指定存储桶' }
    })
    return
  }

  try {
    const result = await storageService.listObjects(
      bucket,
      prefix as string | undefined,
      continuationToken as string | undefined,
      maxKeys ? parseInt(maxKeys as string, 10) : 100
    )
    res.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : '列出对象失败'
    res.status(400).json({
      success: false,
      error: { code: 'LIST_FAILED', message }
    })
  }
})

// 上传文件
router.post('/objects/upload', requireS3Configured, upload.single('file'), async (req: MulterAuthRequest, res) => {
  const { bucket, key } = req.body
  const file = req.file

  if (!bucket || !key) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: '请指定存储桶和文件路径' }
    })
    return
  }

  if (!file) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: '请选择要上传的文件' }
    })
    return
  }

  try {
    await storageService.uploadObject(
      bucket,
      key,
      file.buffer,
      file.mimetype
    )
    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '上传文件失败'
    res.status(400).json({
      success: false,
      error: { code: 'UPLOAD_FAILED', message }
    })
  }
})

// 下载文件
router.get('/objects/download', requireS3Configured, async (req: AuthRequest, res) => {
  const { bucket, key } = req.query

  if (!bucket || !key || typeof bucket !== 'string' || typeof key !== 'string') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: '请指定存储桶和文件路径' }
    })
    return
  }

  try {
    const { body, contentType } = await storageService.downloadObject(bucket, key)

    // 设置响应头
    const filename = key.split('/').pop() || 'download'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    res.setHeader('Content-Length', body.length)

    res.send(body)
  } catch (err) {
    const message = err instanceof Error ? err.message : '下载文件失败'
    res.status(400).json({
      success: false,
      error: { code: 'DOWNLOAD_FAILED', message }
    })
  }
})

// 删除对象 (支持批量) - 使用 POST 避免 DELETE body 兼容性问题
router.post('/objects/delete', requireS3Configured, async (req: AuthRequest, res) => {
  const { bucket, keys } = req.body

  if (!bucket || !keys || !Array.isArray(keys) || keys.length === 0) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: '请指定存储桶和要删除的文件' }
    })
    return
  }

  try {
    await storageService.deleteObjects(bucket, keys)

    // 同步删除站点文件记录 (如果是站点文件)
    // 站点文件的 S3 key 格式: sites/{userId}/{filePath}
    const siteFileKeys = keys.filter((k: string) => k.startsWith('sites/'))
    if (siteFileKeys.length > 0) {
      const userIdSet = new Set<string>()
      for (const key of siteFileKeys) {
        const match = key.match(/^sites\/([a-f0-9]{24})(\/.+)$/)
        if (match) {
          const [, userIdStr, filePath] = match
          userIdSet.add(userIdStr)
          try {
            const userId = new ObjectId(userIdStr)
            await siteFileService.removeOrphan(userId, filePath)
          } catch {
            // 忽略单个文件删除失败
          }
        }
      }
      // 更新统计
      for (const userIdStr of userIdSet) {
        try {
          await siteService.updateStats(new ObjectId(userIdStr))
        } catch {
          // 忽略统计更新失败
        }
      }
    }

    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除对象失败'
    res.status(400).json({
      success: false,
      error: { code: 'DELETE_FAILED', message }
    })
  }
})

// 创建文件夹
router.post('/objects/folder', requireS3Configured, async (req: AuthRequest, res) => {
  const { bucket, prefix } = req.body

  if (!bucket || !prefix) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: '请指定存储桶和文件夹路径' }
    })
    return
  }

  try {
    await storageService.createFolder(bucket, prefix)
    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建文件夹失败'
    res.status(400).json({
      success: false,
      error: { code: 'CREATE_FAILED', message }
    })
  }
})

// 获取预签名下载 URL
router.get('/objects/presigned', requireS3Configured, async (req: AuthRequest, res) => {
  const { bucket, key, expiresIn } = req.query

  if (!bucket || !key || typeof bucket !== 'string' || typeof key !== 'string') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: '请指定存储桶和文件路径' }
    })
    return
  }

  try {
    const url = await storageService.getPresignedUrl(
      bucket,
      key,
      expiresIn ? parseInt(expiresIn as string, 10) : 3600
    )
    res.json({ success: true, data: { url } })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取预签名 URL 失败'
    res.status(400).json({
      success: false,
      error: { code: 'PRESIGN_FAILED', message }
    })
  }
})

// 获取预签名上传 URL
router.get('/objects/presigned-upload', requireS3Configured, async (req: AuthRequest, res) => {
  const { bucket, key, contentType, expiresIn } = req.query

  if (!bucket || !key || typeof bucket !== 'string' || typeof key !== 'string') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: '请指定存储桶和文件路径' }
    })
    return
  }

  try {
    const url = await storageService.getPresignedUploadUrl(
      bucket,
      key,
      (contentType as string) || 'application/octet-stream',
      expiresIn ? parseInt(expiresIn as string, 10) : 3600
    )
    res.json({ success: true, data: { url } })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取预签名上传 URL 失败'
    res.status(400).json({
      success: false,
      error: { code: 'PRESIGN_FAILED', message }
    })
  }
})

export default router
