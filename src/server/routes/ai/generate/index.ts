/**
 * AI 生成路由主入口
 *
 * 合并所有子路由:
 * - /generate - 单函数生成
 * - /generate-multi - 多函数生成
 * - /refactor - 函数解耦/重构
 * - /refactor/confirm - 确认执行解耦计划
 * - /merge-analyze - 多函数合并分析
 * - /merge/confirm - 确认执行合并计划
 * - /diagnose - 错误诊断
 * - /history - 历史记录管理
 */

import { Router, type Router as RouterType } from 'express'
import singleGenerationRouter from './singleGeneration.js'
import multiGenerationRouter from './multiGeneration.js'
import refactorRouter from './refactor.js'
import mergeRouter from './merge.js'
import diagnoseRouter from './diagnose.js'
import historyRouter from './history.js'

const router: RouterType = Router()

// 挂载子路由
router.use(singleGenerationRouter)
router.use(multiGenerationRouter)
router.use(refactorRouter)
router.use(mergeRouter)
router.use(diagnoseRouter)
router.use(historyRouter)

export default router
