import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express'
import { ObjectId } from 'mongodb'
import * as siteService from '../services/site.js'
import * as siteFileService from '../services/siteFile.js'
import * as storageService from '../services/storage.js'
import { verifyToken } from '../middleware/auth.js'
import { config } from '../config.js'

const router: IRouter = Router()

/**
 * 获取默认存储桶
 */
function getBucket(): string {
  if (!config.s3.bucket) {
    throw new Error('未配置 S3 存储桶')
  }
  return config.s3.bucket
}

/**
 * 站点访问控制中间件
 */
async function siteAccessControl(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params

    if (!ObjectId.isValid(userId)) {
      return res.status(404).send(get404Page('站点不存在'))
    }

    const userObjectId = new ObjectId(userId)
    const site = await siteService.getOrCreate(userObjectId)

    if (!site.enabled) {
      return res.status(503).send(get404Page('站点已禁用'))
    }

    // 将站点信息附加到请求
    (req as Request & { site?: typeof site; userObjectId?: ObjectId }).site = site
    ;(req as Request & { userObjectId?: ObjectId }).userObjectId = userObjectId

    const reqPath = '/' + (req.params[0] || '')

    // 公开访问
    if (site.accessControl.type === 'public') {
      return next()
    }

    // 检查是否在保护路径中
    const protectedPaths = site.accessControl.protectedPaths || []
    const isProtected = protectedPaths.length === 0 ||
      protectedPaths.some(p => reqPath.startsWith(p))

    if (!isProtected) {
      return next()
    }

    // 需要登录
    if (site.accessControl.type === 'login') {
      const authHeader = req.headers.authorization
      if (!authHeader) {
        return res.status(401).json({ error: '需要登录访问' })
      }
      try {
        await verifyToken(authHeader.replace('Bearer ', ''))
        return next()
      } catch {
        return res.status(401).json({ error: '登录已过期' })
      }
    }

    // 密码保护
    if (site.accessControl.type === 'password') {
      const inputPassword = req.headers['x-site-password'] || req.query.password
      if (inputPassword === site.accessControl.password) {
        return next()
      }
      return res.status(401).json({ error: '需要密码访问' })
    }

    next()
  } catch (error) {
    console.error('Site access control error:', error)
    res.status(500).send(get404Page('服务器错误'))
  }
}

/**
 * 默认 404 页面
 */
function get404Page(message: string = '请求的页面不存在'): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 Not Found</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .container {
      text-align: center;
      padding: 40px;
    }
    h1 {
      font-size: 72px;
      margin: 0;
      color: #333;
    }
    p {
      color: #666;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>404</h1>
    <p>${message}</p>
  </div>
</body>
</html>`
}

/**
 * GET /site/:userId/*
 * 静态文件服务
 */
router.get('/:userId/*', siteAccessControl, async (req: Request, res: Response) => {
  try {
    const extReq = req as Request & { site?: ReturnType<typeof siteService.getOrCreate> extends Promise<infer T> ? T : never; userObjectId?: ObjectId }
    const userId = extReq.userObjectId!
    const site = extReq.site!
    let reqPath = '/' + (req.params[0] || '')

    // 尝试获取文件
    let file = await siteFileService.get(userId, reqPath)

    // 如果是根路径或目录，尝试获取默认文件
    if (!file && reqPath === '/') {
      // 根路径没有目录记录，直接尝试获取默认文件
      file = await siteFileService.get(userId, `/${site.defaultFile}`)
    } else if (file?.isDirectory) {
      const defaultPath = reqPath === '/' ? `/${site.defaultFile}` : `${reqPath}/${site.defaultFile}`
      file = await siteFileService.get(userId, defaultPath)
    }

    // 文件不存在
    if (!file || file.isDirectory) {
      // SPA 模式: 返回 index.html
      if (site.spaMode) {
        const indexFile = await siteFileService.get(userId, '/' + site.defaultFile)
        if (indexFile && !indexFile.isDirectory) {
          file = indexFile
        }
      }

      // 自定义 404 页面
      if (!file && site.notFoundPage) {
        const notFoundFile = await siteFileService.get(userId, site.notFoundPage)
        if (notFoundFile && !notFoundFile.isDirectory) {
          res.status(404)
          file = notFoundFile
        }
      }

      // 默认 404
      if (!file) {
        return res.status(404).send(get404Page())
      }
    }

    // 设置响应头
    res.set('Content-Type', file.mimeType || 'application/octet-stream')

    // 缓存控制 (HTML 不缓存，其他资源缓存)
    if (file.mimeType?.startsWith('text/html')) {
      res.set('Cache-Control', 'no-cache')
    } else {
      res.set('Cache-Control', 'public, max-age=86400') // 1 天

      if (file.hash) {
        res.set('ETag', `"${file.hash}"`)

        // 检查 ETag
        if (req.headers['if-none-match'] === `"${file.hash}"`) {
          return res.status(304).end()
        }
      }
    }

    // 获取文件内容
    if (!file.s3Key) {
      return res.status(500).send(get404Page('文件存储信息丢失'))
    }

    const bucket = getBucket()
    try {
      const { body } = await storageService.downloadObject(bucket, file.s3Key)
      res.send(body)
    } catch (s3Error) {
      const err = s3Error as Error & { Code?: string }
      // S3 文件不存在 - 可能是数据不一致，清理孤立记录
      if (err.Code === 'NoSuchKey') {
        console.warn(`S3 file not found, cleaning up orphan record: ${file.s3Key}`)
        // 删除孤立的数据库记录
        try {
          await siteFileService.removeOrphan(userId, file.path)
        } catch {
          // 忽略清理错误
        }
        return res.status(404).send(get404Page('文件不存在'))
      }
      throw s3Error
    }
  } catch (error) {
    console.error('Site serve error:', error)
    res.status(500).send(get404Page('服务器错误'))
  }
})

/**
 * GET /site/:userId
 * 重定向到带斜杠的路径
 */
router.get('/:userId', (req: Request, res: Response) => {
  res.redirect(301, `/site/${req.params.userId}/`)
})

export default router
