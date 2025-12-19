import { Router, type Router as RouterType } from 'express'
import { ObjectId } from 'mongodb'
import { getDB } from '../db.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import * as npmService from '../services/npm.js'
import logger from '../utils/logger.js'

const router: RouterType = Router()

interface Dependency {
  _id?: ObjectId
  name: string
  version: string
  status: 'pending' | 'installing' | 'installed' | 'failed'
  error?: string
  userId: ObjectId
  createdAt: Date
  installedAt?: Date
}

/**
 * GET /api/dependencies
 * 获取依赖列表
 */
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const deps = await db.collection<Dependency>('dependencies')
      .find({ userId: new ObjectId(req.user!.userId) })
      .sort({ createdAt: -1 })
      .toArray()

    res.json({ success: true, data: deps })
  } catch (error) {
    logger.error('获取依赖列表失败:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '获取依赖列表失败' }
    })
  }
})

/**
 * POST /api/dependencies
 * 添加依赖
 */
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  const { name, version } = req.body

  if (!name || typeof name !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_PARAMS', message: '包名不能为空' }
    })
  }

  try {
    const db = getDB()
    const userId = new ObjectId(req.user!.userId)

    // 检查是否已存在
    const existing = await db.collection<Dependency>('dependencies').findOne({
      name,
      userId
    })

    if (existing) {
      // 如果状态是 failed，删除旧记录重新安装
      if (existing.status === 'failed') {
        await db.collection<Dependency>('dependencies').deleteOne({ _id: existing._id })
      } else if (existing.status === 'installing') {
        return res.status(400).json({
          success: false,
          error: { code: 'DEPENDENCY_INSTALLING', message: `依赖 ${name} 正在安装中` }
        })
      } else {
        return res.status(400).json({
          success: false,
          error: { code: 'DEPENDENCY_EXISTS', message: `依赖 ${name} 已存在` }
        })
      }
    }

    // 插入记录 (状态: installing)
    const dep: Dependency = {
      name,
      version: version || 'latest',
      status: 'installing',
      userId,
      createdAt: new Date()
    }

    const result = await db.collection<Dependency>('dependencies').insertOne(dep)
    const depId = result.insertedId

    // 返回响应 (后台安装)
    res.json({
      success: true,
      data: { _id: depId, name, version: dep.version, status: 'installing' }
    })

    // 异步安装 (不阻塞响应)
    npmService.installPackage(name, version)
      .then(async () => {
        // 获取实际安装的版本
        const installedVersion = npmService.getInstalledVersion(name) || version || 'latest'
        await db.collection<Dependency>('dependencies').updateOne(
          { _id: depId },
          {
            $set: {
              status: 'installed',
              version: installedVersion,
              installedAt: new Date()
            }
          }
        )
        logger.info(`依赖 ${name}@${installedVersion} 安装成功`)
      })
      .catch(async (error: Error) => {
        await db.collection<Dependency>('dependencies').updateOne(
          { _id: depId },
          {
            $set: {
              status: 'failed',
              error: error.message
            }
          }
        )
        logger.error(`依赖 ${name} 安装失败:`, error.message)
      })

  } catch (error) {
    logger.error('添加依赖失败:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '添加依赖失败' }
    })
  }
})

/**
 * GET /api/dependencies/:name/status
 * 获取依赖安装状态
 */
router.get('/:name/status', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const dep = await db.collection<Dependency>('dependencies').findOne({
      name: req.params.name,
      userId: new ObjectId(req.user!.userId)
    })

    if (!dep) {
      return res.status(404).json({
        success: false,
        error: { code: 'DEPENDENCY_NOT_FOUND', message: '依赖不存在' }
      })
    }

    res.json({ success: true, data: dep })
  } catch (error) {
    logger.error('获取依赖状态失败:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '获取依赖状态失败' }
    })
  }
})

/**
 * DELETE /api/dependencies/:name
 * 删除依赖
 */
router.delete('/:name', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const db = getDB()
    const name = req.params.name

    // 删除数据库记录
    const result = await db.collection<Dependency>('dependencies').deleteOne({
      name,
      userId: new ObjectId(req.user!.userId)
    })

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'DEPENDENCY_NOT_FOUND', message: '依赖不存在' }
      })
    }

    // 异步卸载包 (忽略错误)
    npmService.uninstallPackage(name).catch((error) => {
      logger.warn(`卸载 ${name} 失败:`, error.message)
    })

    res.json({ success: true })
  } catch (error) {
    logger.error('删除依赖失败:', error)
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '删除依赖失败' }
    })
  }
})

/**
 * GET /api/dependencies/search
 * 搜索包 (必须在动态路由之前定义)
 */
router.get('/search', authMiddleware, async (req: AuthRequest, res) => {
  const query = req.query.q as string

  if (!query || query.length < 2) {
    return res.json({ success: true, data: [] })
  }

  try {
    const results = await npmService.searchPackages(query)
    res.json({ success: true, data: results })
  } catch {
    res.json({ success: true, data: [] })
  }
})

/**
 * GET /api/dependencies/:name/versions
 * 获取包的可用版本列表
 */
router.get('/:name/versions', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const versions = await npmService.getPackageVersions(req.params.name)
    res.json({ success: true, data: versions })
  } catch (error: unknown) {
    const err = error as Error
    res.status(400).json({
      success: false,
      error: { code: 'PACKAGE_NOT_FOUND', message: err.message }
    })
  }
})

export default router
