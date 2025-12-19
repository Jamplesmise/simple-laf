import { Router, type IRouter } from 'express'
import { ObjectId } from 'mongodb'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import * as apiTokenService from '../services/apiToken.js'

const router: IRouter = Router()

// 所有路由需要认证
router.use(authMiddleware)

/**
 * 获取 Token 认证设置
 */
router.get('/settings', async (req: AuthRequest, res) => {
  try {
    const userId = new ObjectId(req.user!.userId)
    const settings = await apiTokenService.getTokenAuthSettings(userId)

    res.json({
      success: true,
      data: settings
    })
  } catch (error) {
    console.error('Get token auth settings error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'GET_SETTINGS_ERROR', message: '获取设置失败' }
    })
  }
})

/**
 * 更新 Token 认证设置
 */
router.put('/settings', async (req: AuthRequest, res) => {
  try {
    const userId = new ObjectId(req.user!.userId)
    const { enabled } = req.body

    if (typeof enabled !== 'boolean') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ENABLED', message: '请提供有效的 enabled 值' }
      })
      return
    }

    const settings = await apiTokenService.updateTokenAuthSettings(userId, enabled)

    res.json({
      success: true,
      data: settings
    })
  } catch (error) {
    console.error('Update token auth settings error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_SETTINGS_ERROR', message: '更新设置失败' }
    })
  }
})

/**
 * 获取 Token 列表
 */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = new ObjectId(req.user!.userId)
    const tokens = await apiTokenService.listTokens(userId)

    res.json({
      success: true,
      data: tokens
    })
  } catch (error) {
    console.error('List tokens error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'LIST_TOKENS_ERROR', message: '获取 Token 列表失败' }
    })
  }
})

/**
 * 创建 Token
 */
router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = new ObjectId(req.user!.userId)
    const { name, expireDays } = req.body

    if (!name || typeof name !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_NAME', message: '请提供 Token 名称' }
      })
      return
    }

    if (!expireDays || typeof expireDays !== 'number' || expireDays < 1) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_EXPIRE_DAYS', message: '请提供有效的过期天数' }
      })
      return
    }

    const result = await apiTokenService.createToken(userId, name.trim(), expireDays)

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Create token error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_TOKEN_ERROR', message: '创建 Token 失败' }
    })
  }
})

/**
 * 删除 Token
 */
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = new ObjectId(req.user!.userId)
    const tokenId = new ObjectId(req.params.id)

    const success = await apiTokenService.deleteToken(userId, tokenId)

    if (!success) {
      res.status(404).json({
        success: false,
        error: { code: 'TOKEN_NOT_FOUND', message: 'Token 不存在' }
      })
      return
    }

    res.json({
      success: true,
      data: null
    })
  } catch (error) {
    console.error('Delete token error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_TOKEN_ERROR', message: '删除 Token 失败' }
    })
  }
})

export default router
