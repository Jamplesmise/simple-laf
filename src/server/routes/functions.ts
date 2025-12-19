import { Router, type IRouter } from 'express'
import { ObjectId } from 'mongodb'
import * as functionService from '../services/function.js'
import * as versionService from '../services/version.js'
import * as folderService from '../services/folder.js'
import { compileTypeScript } from '../services/compiler.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { logUserAction } from '../services/functionAudit.js'

const router: IRouter = Router()

// 所有路由都需要认证
router.use(authMiddleware)

// 获取函数列表
router.get('/', async (req: AuthRequest, res) => {
  try {
    const functions = await functionService.list(req.user!.userId)
    res.json({ success: true, data: functions })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 创建函数
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, code, folderId } = req.body

    if (!name) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '函数名不能为空' }
      })
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

    res.json({ success: true, data: func })
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建失败'
    const code = message.includes('duplicate') ? 'DUPLICATE_NAME' : 'CREATE_FAILED'
    res.status(400).json({
      success: false,
      error: { code, message }
    })
  }
})

// 获取函数详情
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const func = await functionService.findById(req.params.id, req.user!.userId)
    if (!func) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '函数不存在' }
      })
      return
    }
    res.json({ success: true, data: func })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取详情失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 更新函数
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { code } = req.body

    // 获取更新前的函数信息
    const oldFunc = await functionService.findById(req.params.id, req.user!.userId)
    if (!oldFunc) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '函数不存在' }
      })
      return
    }

    const updated = await functionService.update(
      req.params.id,
      req.user!.userId,
      { code }
    )

    if (!updated) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '函数不存在' }
      })
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

    res.json({ success: true, data: { updated: true } })
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新失败'
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message }
    })
  }
})

// 删除函数
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    // 获取删除前的函数信息
    const func = await functionService.findById(req.params.id, req.user!.userId)
    if (!func) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '函数不存在' }
      })
      return
    }

    const deleted = await functionService.remove(req.params.id, req.user!.userId)
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '函数不存在' }
      })
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

    res.json({ success: true, data: { deleted: true } })
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除失败'
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_FAILED', message }
    })
  }
})

// 编译函数
router.post('/:id/compile', async (req: AuthRequest, res) => {
  try {
    const func = await functionService.findById(req.params.id, req.user!.userId)
    if (!func) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '函数不存在' }
      })
      return
    }

    const compiled = compileTypeScript(func.code)
    await functionService.update(req.params.id, req.user!.userId, { compiled })

    res.json({ success: true, data: { compiled } })
  } catch (err) {
    const message = err instanceof Error ? err.message : '编译失败'
    res.status(400).json({
      success: false,
      error: { code: 'COMPILE_ERROR', message }
    })
  }
})

// 发布函数 (创建新版本)
router.post('/:id/publish', async (req: AuthRequest, res) => {
  try {
    const { changelog } = req.body
    const func = await functionService.findById(req.params.id, req.user!.userId)
    if (!func) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '函数不存在' }
      })
      return
    }

    // 编译代码
    let compiled = func.compiled
    try {
      compiled = compileTypeScript(func.code)
      await functionService.update(req.params.id, req.user!.userId, { compiled })
    } catch (compileErr) {
      const message = compileErr instanceof Error ? compileErr.message : '编译失败'
      res.status(400).json({
        success: false,
        error: { code: 'COMPILE_ERROR', message }
      })
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
    res.json({
      success: true,
      data: {
        version: version.version,
        url: `/${funcPath}`,
        publishedAt: version.createdAt
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '发布失败'
    res.status(500).json({
      success: false,
      error: { code: 'PUBLISH_ERROR', message }
    })
  }
})

// 获取版本列表
router.get('/:id/versions', async (req: AuthRequest, res) => {
  try {
    const func = await functionService.findById(req.params.id, req.user!.userId)
    if (!func) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '函数不存在' }
      })
      return
    }

    const versions = await versionService.getVersions(new ObjectId(req.params.id))

    res.json({
      success: true,
      data: versions.map(v => ({
        version: v.version,
        changelog: v.changelog,
        createdAt: v.createdAt
      }))
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取版本列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 版本对比 (注意：此路由必须在 /:id/versions/:version 之前)
router.get('/:id/versions/diff', async (req: AuthRequest, res) => {
  try {
    const { from, to } = req.query
    const func = await functionService.findById(req.params.id, req.user!.userId)
    if (!func) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '函数不存在' }
      })
      return
    }

    if (!from || !to) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请提供 from 和 to 版本号' }
      })
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
      res.status(404).json({
        success: false,
        error: { code: 'VERSION_NOT_FOUND', message: '版本不存在' }
      })
      return
    }

    res.json({
      success: true,
      data: {
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
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取对比失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取指定版本详情
router.get('/:id/versions/:version', async (req: AuthRequest, res) => {
  try {
    const func = await functionService.findById(req.params.id, req.user!.userId)
    if (!func) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '函数不存在' }
      })
      return
    }

    const version = await versionService.getVersion(
      new ObjectId(req.params.id),
      parseInt(req.params.version)
    )

    if (!version) {
      res.status(404).json({
        success: false,
        error: { code: 'VERSION_NOT_FOUND', message: '版本不存在' }
      })
      return
    }

    res.json({
      success: true,
      data: {
        version: version.version,
        code: version.code,
        changelog: version.changelog,
        createdAt: version.createdAt
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取版本失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 回滚到指定版本
router.post('/:id/rollback', async (req: AuthRequest, res) => {
  try {
    const { version } = req.body
    const func = await functionService.findById(req.params.id, req.user!.userId)
    if (!func) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '函数不存在' }
      })
      return
    }

    if (!version || typeof version !== 'number') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请提供有效的版本号' }
      })
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

    res.json({
      success: true,
      data: {
        version: newVersion.version,
        message: `已回滚到 v${version}`
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '回滚失败'
    res.status(400).json({
      success: false,
      error: { code: 'ROLLBACK_ERROR', message }
    })
  }
})

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

    res.json({
      success: true,
      data: { newPath, newUrl: `/${newPath}` }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '移动失败'
    res.status(400).json({
      success: false,
      error: { code: 'MOVE_FAILED', message }
    })
  }
})

// 重命名函数
router.post('/:id/rename', async (req: AuthRequest, res) => {
  const { name } = req.body

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: '函数名不能为空' }
    })
    return
  }

  try {
    // 获取重命名前的函数信息
    const oldFunc = await functionService.findById(req.params.id, req.user!.userId)
    if (!oldFunc) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '函数不存在' }
      })
      return
    }

    const result = await functionService.rename(
      req.params.id,
      req.user!.userId,
      name.trim()
    )

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: { code: 'RENAME_FAILED', message: result.error || '重命名失败' }
      })
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

    res.json({
      success: true,
      data: { newName: name.trim(), newPath: result.newPath, newUrl: `/${result.newPath}` }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '重命名失败'
    res.status(400).json({
      success: false,
      error: { code: 'RENAME_FAILED', message }
    })
  }
})

// 批量移动函数
router.post('/batch-move', async (req: AuthRequest, res) => {
  const { functionIds, folderId } = req.body

  if (!functionIds || !Array.isArray(functionIds) || functionIds.length === 0) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: '请提供要移动的函数列表' }
    })
    return
  }

  try {
    await folderService.batchMoveFunctions(
      functionIds.map((id: string) => new ObjectId(id)),
      folderId ? new ObjectId(folderId) : null,
      new ObjectId(req.user!.userId)
    )
    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '批量移动失败'
    res.status(400).json({
      success: false,
      error: { code: 'BATCH_MOVE_FAILED', message }
    })
  }
})

// 调整排序
router.post('/reorder', async (req: AuthRequest, res) => {
  const { orders } = req.body // [{ id, order, isFolder }, ...]

  if (!orders || !Array.isArray(orders)) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: '请提供排序信息' }
    })
    return
  }

  try {
    await folderService.reorderItems(orders, new ObjectId(req.user!.userId))
    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '排序失败'
    res.status(400).json({
      success: false,
      error: { code: 'REORDER_FAILED', message }
    })
  }
})

export default router
