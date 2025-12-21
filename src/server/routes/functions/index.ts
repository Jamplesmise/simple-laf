import { Router, type IRouter } from 'express'
import { authMiddleware } from '../../middleware/auth.js'
import crudRouter from './crud.js'
import compileRouter from './compile.js'
import publishRouter from './publish.js'
import versionsRouter from './versions.js'
import organizationRouter from './organization.js'
import testInputRouter from './testInput.js'

const router: IRouter = Router()

// 所有路由都需要认证
router.use(authMiddleware)

// 批量操作和排序路由（无 :id 参数）
router.use('/', organizationRouter)

// CRUD 路由
router.use('/', crudRouter)

// 编译路由
router.use('/', compileRouter)

// 发布路由
router.use('/', publishRouter)

// 版本管理路由
router.use('/', versionsRouter)

// 测试输入路由 (Sprint 19)
router.use('/', testInputRouter)

export default router
