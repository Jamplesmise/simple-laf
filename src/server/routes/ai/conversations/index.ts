/**
 * AI 对话路由主入口
 *
 * /api/ai/conversations/* - 对话管理
 * /api/ai/messages/* - 消息管理
 */

import { Router, type Router as RouterType } from 'express'
import crudRouter from './crud.js'
import messagesRouter from './messages.js'
import chatRouter from './chat.js'
import exportRouter from './export.js'
import filesRouter from './files.js'

const router: RouterType = Router()

// 对话 CRUD 路由 (GET/POST/PATCH/DELETE /conversations)
router.use('/conversations', crudRouter)

// 对话聊天路由 (POST /conversations/:id/chat)
router.use('/conversations', chatRouter)

// 对话导出路由 (GET /conversations/:id/export)
router.use('/conversations', exportRouter)

// 文件上传路由 (POST/GET/DELETE /conversations/:id/files)
router.use('/conversations', filesRouter)

// 消息管理路由 (PATCH /messages/:id, POST /messages/:id/branch, POST /messages/:id/feedback)
router.use('/messages', messagesRouter)

export default router
