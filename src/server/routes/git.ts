import { Router, type IRouter } from 'express'
import { ObjectId } from 'mongodb'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import * as gitService from '../services/git.js'
import { logGitAction } from '../services/functionAudit.js'
import { getDB } from '../db.js'

const router: IRouter = Router()

// 所有路由都需要认证
router.use(authMiddleware)

// 获取 Git 配置
router.get('/config', async (req: AuthRequest, res) => {
  try {
    const config = await gitService.getGitConfig(new ObjectId(req.user!.userId))

    if (!config) {
      res.json({
        success: true,
        data: { configured: false }
      })
      return
    }

    res.json({
      success: true,
      data: {
        configured: true,
        repoUrl: config.repoUrl,
        branch: config.branch,
        functionsPath: config.functionsPath,
        lastSyncAt: config.lastSyncAt,
        hasToken: !!config.token
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取配置失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 保存 Git 配置
router.put('/config', async (req: AuthRequest, res) => {
  const { repoUrl, branch, token, functionsPath, clearToken } = req.body

  if (!repoUrl || !branch || !functionsPath) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: '请填写完整配置' }
    })
    return
  }

  // 验证仓库 URL 格式
  try {
    new URL(repoUrl)
  } catch {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_URL', message: '仓库地址格式不正确' }
    })
    return
  }

  try {
    await gitService.saveGitConfig(
      new ObjectId(req.user!.userId),
      repoUrl,
      branch,
      token,
      functionsPath,
      clearToken === true  // 明确要求清除 Token
    )
    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '保存配置失败'
    res.status(400).json({
      success: false,
      error: { code: 'SAVE_FAILED', message }
    })
  }
})

// 预览拉取
router.get('/preview-pull', async (req: AuthRequest, res) => {
  console.log('[Git Route] GET /preview-pull', { userId: req.user!.userId })
  try {
    const preview = await gitService.previewPull(new ObjectId(req.user!.userId))
    console.log('[Git Route] preview-pull 成功', { changesCount: preview.changes.length })
    res.json({ success: true, data: preview })
  } catch (err) {
    console.error('[Git Route] preview-pull 失败', err)
    const message = err instanceof Error ? err.message : '预览失败'
    res.status(400).json({
      success: false,
      error: { code: 'PREVIEW_FAILED', message }
    })
  }
})

// 预览推送
router.get('/preview-push', async (req: AuthRequest, res) => {
  console.log('[Git Route] GET /preview-push', { userId: req.user!.userId })
  try {
    const preview = await gitService.previewPush(new ObjectId(req.user!.userId))
    console.log('[Git Route] preview-push 成功', { changesCount: preview.changes.length })
    res.json({ success: true, data: preview })
  } catch (err) {
    console.error('[Git Route] preview-push 失败', err)
    const message = err instanceof Error ? err.message : '预览失败'
    res.status(400).json({
      success: false,
      error: { code: 'PREVIEW_FAILED', message }
    })
  }
})

// 从 Git 拉取 (支持选择性拉取)
router.post('/pull', async (req: AuthRequest, res) => {
  const { functions } = req.body

  try {
    const userId = new ObjectId(req.user!.userId)
    let result

    if (functions && Array.isArray(functions) && functions.length > 0) {
      // 选择性拉取
      result = await gitService.selectivePull(userId, functions)
    } else {
      // 全量拉取
      result = await gitService.pullFromGit(userId)
    }

    // 记录审计日志
    const db = getDB()
    const allAffected = [...result.added, ...result.updated]
    if (allAffected.length > 0) {
      // 查找受影响的函数
      const affectedFunctions = await db.collection('functions')
        .find({ userId, name: { $in: allAffected } })
        .toArray()

      for (const fn of affectedFunctions) {
        const action = result.added.includes(fn.name as string) ? 'create' : 'update'
        await logGitAction({
          functionId: fn._id,
          functionName: fn.name as string,
          userId,
          username: req.user!.username,
          action,
          gitAction: 'pull',
          changes: {
            after: fn.code as string,
            description: `Git 拉取${action === 'create' ? '新增' : '更新'}`,
          },
        }, db)
      }
    }

    res.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : '拉取失败'
    res.status(400).json({
      success: false,
      error: { code: 'PULL_FAILED', message }
    })
  }
})

// 推送到 Git (支持选择性推送)
router.post('/push', async (req: AuthRequest, res) => {
  const { message, functions } = req.body
  console.log('[Git Route] POST /push 收到请求', { message, functions, userId: req.user!.userId })

  try {
    if (functions && Array.isArray(functions) && functions.length > 0) {
      // 选择性推送
      console.log('[Git Route] 开始选择性推送', { count: functions.length })
      await gitService.selectivePush(
        new ObjectId(req.user!.userId),
        functions,
        message || 'Update functions from Simple IDE'
      )
      console.log('[Git Route] 选择性推送完成')
    } else {
      // 全量推送
      console.log('[Git Route] 开始全量推送')
      await gitService.pushToGit(
        new ObjectId(req.user!.userId),
        message || 'Update functions from Simple IDE'
      )
      console.log('[Git Route] 全量推送完成')
    }
    res.json({ success: true })
  } catch (err) {
    console.error('[Git Route] 推送失败', err)
    const errMessage = err instanceof Error ? err.message : '推送失败'
    res.status(400).json({
      success: false,
      error: { code: 'PUSH_FAILED', message: errMessage }
    })
  }
})

// 获取同步状态
router.get('/status', async (req: AuthRequest, res) => {
  try {
    const status = await gitService.getGitStatus(new ObjectId(req.user!.userId))
    res.json({ success: true, data: status })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取状态失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

export default router
