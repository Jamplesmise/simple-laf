/**
 * AI 路由模块入口
 *
 * 合并所有 AI 相关路由：
 * - config: 配置管理
 * - generate: 代码生成
 * - execute: 操作执行
 * - conversations: 对话管理
 * - prompts: 系统提示词
 * - providers: 供应商和模型
 * - debug: 调试和日志
 * - context: 上下文管理 + 精准更新
 * - canvas: Canvas 模式（快照/Diff）
 * - plan: Plan 模式（计划生成/执行）
 */

import { Router, type Router as RouterType } from 'express'
import { authMiddleware } from '../../middleware/auth.js'

// 子路由模块
import configRouter from './config.js'
import generateRouter from './generate.js'
import executeRouter from './execute.js'
import conversationsRouter from './conversations.js'
import promptsRouter from './prompts.js'
import providersRouter from './providers.js'
import debugRouter from './debug.js'
import contextRouter from './context.js'
import canvasRouter from './canvas.js'
import planRouter from './plan.js'

const router: RouterType = Router()

// 所有路由都需要认证
router.use(authMiddleware)

// 挂载子路由
router.use(configRouter)      // /config, /models
router.use(generateRouter)    // /generate, /refactor, /merge, /diagnose, /history
router.use(executeRouter)     // /execute, /preview
router.use(conversationsRouter) // /conversations/*, /messages/*
router.use(promptsRouter)     // /prompts/*
router.use(providersRouter)   // /providers/*, /models/*, /all-models, /default-model
router.use(debugRouter)       // /debug, /log-summary
router.use(contextRouter)     // /conversations/:id/context, /functions/:id/precise-*
router.use(canvasRouter)      // /canvas/* (快照/Diff/应用)
router.use(planRouter)        // /plan/*, /plans (Sprint 16.2)

export default router
