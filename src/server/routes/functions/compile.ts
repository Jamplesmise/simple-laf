import { Router, type IRouter } from 'express'
import * as functionService from '../../services/function.js'
import { compileTypeScript } from '../../services/compiler.js'
import type { AuthRequest } from '../../middleware/auth.js'
import { sendSuccess, sendError } from './utils.js'

const router: IRouter = Router()

// 编译函数
router.post('/:id/compile', async (req: AuthRequest, res) => {
  try {
    const func = await functionService.findById(req.params.id, req.user!.userId)
    if (!func) {
      sendError(res, 404, 'NOT_FOUND', '函数不存在')
      return
    }

    const compiled = compileTypeScript(func.code)
    await functionService.update(req.params.id, req.user!.userId, { compiled })

    sendSuccess(res, { compiled })
  } catch (err) {
    const message = err instanceof Error ? err.message : '编译失败'
    sendError(res, 400, 'COMPILE_ERROR', message)
  }
})

export default router
