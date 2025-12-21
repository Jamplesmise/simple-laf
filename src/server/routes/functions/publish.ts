import { Router, type IRouter } from 'express'
import { ObjectId } from 'mongodb'
import * as functionService from '../../services/function.js'
import * as versionService from '../../services/version.js'
import { compileTypeScript } from '../../services/compiler.js'
import type { AuthRequest } from '../../middleware/auth.js'
import { logUserAction } from '../../services/functionAudit.js'
import { sendSuccess, sendError, handleError } from './utils.js'

const router: IRouter = Router()

// 发布函数 (创建新版本)
router.post('/:id/publish', async (req: AuthRequest, res) => {
  try {
    const { changelog } = req.body
    const func = await functionService.findById(req.params.id, req.user!.userId)
    if (!func) {
      sendError(res, 404, 'NOT_FOUND', '函数不存在')
      return
    }

    // 编译代码
    let compiled = func.compiled
    try {
      compiled = compileTypeScript(func.code)
      await functionService.update(req.params.id, req.user!.userId, { compiled })
    } catch (compileErr) {
      const message = compileErr instanceof Error ? compileErr.message : '编译失败'
      sendError(res, 400, 'COMPILE_ERROR', message)
      return
    }

    // 创建版本
    const version = await versionService.createVersion(
      new ObjectId(req.params.id),
      func.code,
      compiled,
      changelog || '无变更日志',
      new ObjectId(req.user!.userId)
    )

    // 记录审计日志
    await logUserAction({
      functionId: req.params.id,
      functionName: func.name,
      userId: req.user!.userId,
      username: req.user!.username,
      action: 'publish',
      changes: {
        after: func.code,
        description: `发布版本 v${version.version}: ${changelog || '无变更日志'}`,
      },
      metadata: {
        version: version.version,
      },
    })

    // 使用 path（如果有）否则用 name
    const funcPath = (func as unknown as { path?: string }).path || func.name
    sendSuccess(res, {
      version: version.version,
      url: `/${funcPath}`,
      publishedAt: version.createdAt
    })
  } catch (err) {
    handleError(res, err, '发布失败')
  }
})

export default router
