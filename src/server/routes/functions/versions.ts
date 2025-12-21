import { Router, type IRouter } from 'express'
import { ObjectId } from 'mongodb'
import * as functionService from '../../services/function.js'
import * as versionService from '../../services/version.js'
import type { AuthRequest } from '../../middleware/auth.js'
import { logUserAction } from '../../services/functionAudit.js'
import { sendSuccess, sendError, handleError } from './utils.js'

const router: IRouter = Router()

// 获取版本列表
router.get('/:id/versions', async (req: AuthRequest, res) => {
  try {
    const func = await functionService.findById(req.params.id, req.user!.userId)
    if (!func) {
      sendError(res, 404, 'NOT_FOUND', '函数不存在')
      return
    }

    const versions = await versionService.getVersions(new ObjectId(req.params.id))

    sendSuccess(res, versions.map(v => ({
      version: v.version,
      changelog: v.changelog,
      createdAt: v.createdAt
    })))
  } catch (err) {
    handleError(res, err, '获取版本列表失败')
  }
})

// 版本对比 (注意：此路由必须在 /:id/versions/:version 之前)
router.get('/:id/versions/diff', async (req: AuthRequest, res) => {
  try {
    const { from, to } = req.query
    const func = await functionService.findById(req.params.id, req.user!.userId)
    if (!func) {
      sendError(res, 404, 'NOT_FOUND', '函数不存在')
      return
    }

    if (!from || !to) {
      sendError(res, 400, 'INVALID_INPUT', '请提供 from 和 to 版本号')
      return
    }

    const fromVersion = await versionService.getVersion(
      new ObjectId(req.params.id),
      parseInt(from as string)
    )
    const toVersion = await versionService.getVersion(
      new ObjectId(req.params.id),
      parseInt(to as string)
    )

    if (!fromVersion || !toVersion) {
      sendError(res, 404, 'VERSION_NOT_FOUND', '版本不存在')
      return
    }

    sendSuccess(res, {
      from: {
        version: fromVersion.version,
        code: fromVersion.code,
        changelog: fromVersion.changelog
      },
      to: {
        version: toVersion.version,
        code: toVersion.code,
        changelog: toVersion.changelog
      }
    })
  } catch (err) {
    handleError(res, err, '获取对比失败')
  }
})

// 获取指定版本详情
router.get('/:id/versions/:version', async (req: AuthRequest, res) => {
  try {
    const func = await functionService.findById(req.params.id, req.user!.userId)
    if (!func) {
      sendError(res, 404, 'NOT_FOUND', '函数不存在')
      return
    }

    const version = await versionService.getVersion(
      new ObjectId(req.params.id),
      parseInt(req.params.version)
    )

    if (!version) {
      sendError(res, 404, 'VERSION_NOT_FOUND', '版本不存在')
      return
    }

    sendSuccess(res, {
      version: version.version,
      code: version.code,
      changelog: version.changelog,
      createdAt: version.createdAt
    })
  } catch (err) {
    handleError(res, err, '获取版本失败')
  }
})

// 回滚到指定版本
router.post('/:id/rollback', async (req: AuthRequest, res) => {
  try {
    const { version } = req.body
    const func = await functionService.findById(req.params.id, req.user!.userId)
    if (!func) {
      sendError(res, 404, 'NOT_FOUND', '函数不存在')
      return
    }

    if (!version || typeof version !== 'number') {
      sendError(res, 400, 'INVALID_INPUT', '请提供有效的版本号')
      return
    }

    // 获取目标版本的代码
    const targetVersion = await versionService.getVersion(
      new ObjectId(req.params.id),
      version
    )

    const newVersion = await versionService.rollbackToVersion(
      new ObjectId(req.params.id),
      version,
      new ObjectId(req.user!.userId)
    )

    // 记录审计日志
    await logUserAction({
      functionId: req.params.id,
      functionName: func.name,
      userId: req.user!.userId,
      username: req.user!.username,
      action: 'rollback',
      changes: {
        before: func.code,
        after: targetVersion?.code,
        description: `回滚到版本 v${version}`,
      },
      metadata: {
        fromVersion: 'current',
        toVersion: version,
        newVersion: newVersion.version,
      },
    })

    sendSuccess(res, {
      version: newVersion.version,
      message: `已回滚到 v${version}`
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '回滚失败'
    sendError(res, 400, 'ROLLBACK_ERROR', message)
  }
})

export default router
