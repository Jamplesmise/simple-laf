import { Router, type IRouter } from 'express'
import * as authService from '../services/auth.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router: IRouter = Router()

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '用户名和密码不能为空' }
      })
      return
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '密码长度至少 6 位' }
      })
      return
    }

    const result = await authService.register(username, password)
    res.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : '注册失败'
    res.status(400).json({
      success: false,
      error: { code: 'REGISTER_FAILED', message }
    })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '用户名和密码不能为空' }
      })
      return
    }

    const result = await authService.login(username, password)
    res.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : '登录失败'
    res.status(400).json({
      success: false,
      error: { code: 'LOGIN_FAILED', message }
    })
  }
})

router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await authService.getUser(req.user!.userId)
    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: '用户不存在' }
      })
      return
    }
    res.json({ success: true, data: user })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取用户信息失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

export default router
