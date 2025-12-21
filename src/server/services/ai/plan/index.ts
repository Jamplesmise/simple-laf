/**
 * Plan 模式服务 (Sprint 16.2)
 *
 * 功能：
 * 1. 计划生成 - 分析请求，生成执行计划
 * 2. 计划执行 - 按步骤执行，支持选择性执行
 * 3. 状态管理 - 暂停/恢复/停止
 *
 * 状态机：
 * off → planning → reviewing → executing → completed
 *                      ↑           │
 *                      └─ paused ──┘
 */

import { ObjectId } from 'mongodb'
import { getDB } from '../../../db.js'
import { determineChangeType } from '../context/preciseUpdate.js'

// ==================== 类型定义 ====================

// Plan 模式状态
export type PlanModeState =
  | 'off'           // 未启用
  | 'planning'      // 生成计划中
  | 'reviewing'     // 等待用户审核
  | 'executing'     // 执行中
  | 'paused'        // 已暂停
  | 'completed'     // 已完成
  | 'failed'        // 执行失败

// 步骤类型
export type StepType = 'create' | 'update' | 'delete' | 'test' | 'analyze' | 'refactor'

// 步骤状态
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

// 计划步骤
export interface PlanStep {
  id: string
  order: number
  title: string
  description?: string
  type: StepType
  status: StepStatus
  selected: boolean
  targetFile?: string       // 目标文件/函数
  estimatedTokens?: number  // 预估 Token 消耗
  result?: {
    success: boolean
    message?: string
    error?: string
    duration?: number
  }
}

// 影响分析
export interface ImpactAnalysis {
  newFiles: string[]
  modifiedFiles: string[]
  deletedFiles: string[]
  riskLevel: 'low' | 'medium' | 'high'
  riskFactors: string[]
}

// 执行计划
export interface ExecutionPlan {
  id: string
  conversationId: string
  userId: string
  title: string
  originalRequest: string
  analysis: {
    currentState: string
    issues: string[]
    goals: string[]
  }
  steps: PlanStep[]
  impact: ImpactAnalysis
  state: PlanModeState
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}

// 步骤执行结果
export interface StepResult {
  stepId: string
  status: StepStatus
  message?: string
  error?: string
  duration?: number
  output?: unknown
}

// Plan 触发关键词
const PLAN_TRIGGER_KEYWORDS = [
  '重构', '重写', '重新设计',
  '拆分', '合并', '提取',
  '迁移', '移动',
  '批量', '全部',
  '架构', '设计模式',
  '完全重写', '从头开始',
  '多个函数', '多个文件',
]

// 影响阈值
const IMPACT_THRESHOLDS = {
  filesAffected: 3,      // 影响超过 3 个文件
  linesChanged: 100,     // 修改超过 100 行
}

// 活跃的 Plan 状态缓存
const activePlans: Map<string, {
  plan: ExecutionPlan
  abortController?: AbortController
  isPaused: boolean
}> = new Map()

// ==================== 核心服务函数 ====================

/**
 * 检查是否应该触发 Plan 模式
 */
export function shouldTriggerPlanMode(request: string): {
  shouldTrigger: boolean
  reason?: string
} {
  const normalizedRequest = request.toLowerCase()

  // 检查关键词
  for (const keyword of PLAN_TRIGGER_KEYWORDS) {
    if (normalizedRequest.includes(keyword.toLowerCase())) {
      return {
        shouldTrigger: true,
        reason: `检测到关键词: "${keyword}"`,
      }
    }
  }

  // 检查修改类型
  const changeType = determineChangeType(request)
  if (changeType === 'refactor') {
    return {
      shouldTrigger: true,
      reason: '识别为重构类型任务',
    }
  }

  return { shouldTrigger: false }
}

/**
 * 生成执行计划
 *
 * 分析用户请求，生成详细的执行步骤
 */
export async function generatePlan(
  conversationId: string,
  userId: string,
  request: string,
  context?: {
    functionIds?: string[]
    currentCode?: string
  }
): Promise<ExecutionPlan> {
  const db = getDB()
  const planId = new ObjectId().toString()

  // 分析请求，生成计划
  const analysis = analyzeRequest(request, context)
  const steps = generateSteps(request, analysis, context)
  const impact = analyzeImpact(steps, context)

  const plan: ExecutionPlan = {
    id: planId,
    conversationId,
    userId,
    title: generatePlanTitle(request),
    originalRequest: request,
    analysis,
    steps,
    impact,
    state: 'reviewing',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  // 保存到数据库
  await db.collection('ai_plans').insertOne({
    _id: new ObjectId(planId),
    ...plan,
  })

  // 缓存活跃计划
  activePlans.set(planId, {
    plan,
    isPaused: false,
  })

  return plan
}

/**
 * 获取计划详情
 */
export async function getPlan(planId: string): Promise<ExecutionPlan | null> {
  // 先检查缓存
  const cached = activePlans.get(planId)
  if (cached) {
    return cached.plan
  }

  // 从数据库获取
  const db = getDB()
  const doc = await db.collection('ai_plans').findOne({
    _id: new ObjectId(planId),
  })

  if (!doc) return null

  return {
    id: doc._id.toString(),
    conversationId: doc.conversationId,
    userId: doc.userId,
    title: doc.title,
    originalRequest: doc.originalRequest,
    analysis: doc.analysis,
    steps: doc.steps,
    impact: doc.impact,
    state: doc.state,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    completedAt: doc.completedAt,
  }
}

/**
 * 更新步骤选择状态
 */
export async function updateStepSelection(
  planId: string,
  stepIds: string[],
  selected: boolean
): Promise<ExecutionPlan | null> {
  const plan = await getPlan(planId)
  if (!plan) return null

  // 更新步骤选择状态
  plan.steps = plan.steps.map((step) => ({
    ...step,
    selected: stepIds.includes(step.id) ? selected : step.selected,
  }))
  plan.updatedAt = new Date()

  // 更新数据库
  const db = getDB()
  await db.collection('ai_plans').updateOne(
    { _id: new ObjectId(planId) },
    { $set: { steps: plan.steps, updatedAt: plan.updatedAt } }
  )

  // 更新缓存
  const cached = activePlans.get(planId)
  if (cached) {
    cached.plan = plan
  }

  return plan
}

/**
 * 执行计划（生成器函数，支持流式返回结果）
 */
export async function* executePlan(
  planId: string,
  selectedStepIds?: string[]
): AsyncGenerator<StepResult, void, unknown> {
  const db = getDB()
  let plan = await getPlan(planId)

  if (!plan) {
    throw new Error('计划不存在')
  }

  if (plan.state !== 'reviewing' && plan.state !== 'paused') {
    throw new Error(`当前状态 ${plan.state} 不允许执行`)
  }

  // 创建中止控制器
  const abortController = new AbortController()

  // 更新缓存
  activePlans.set(planId, {
    plan,
    abortController,
    isPaused: false,
  })

  // 更新状态为执行中
  await updatePlanState(planId, 'executing')

  // 获取要执行的步骤
  const stepsToExecute = plan.steps.filter((step) => {
    if (selectedStepIds && selectedStepIds.length > 0) {
      return selectedStepIds.includes(step.id) && step.status !== 'completed'
    }
    return step.selected && step.status !== 'completed'
  })

  try {
    for (const step of stepsToExecute) {
      // 检查是否被中止
      if (abortController.signal.aborted) {
        yield {
          stepId: step.id,
          status: 'skipped',
          message: '执行已停止',
        }
        continue
      }

      // 检查是否暂停
      const cached = activePlans.get(planId)
      if (cached?.isPaused) {
        await updatePlanState(planId, 'paused')
        yield {
          stepId: step.id,
          status: 'pending',
          message: '执行已暂停',
        }
        return
      }

      // 更新步骤状态为运行中
      await updateStepStatus(planId, step.id, 'running')

      yield {
        stepId: step.id,
        status: 'running',
        message: `开始执行: ${step.title}`,
      }

      // 执行步骤
      const startTime = Date.now()
      try {
        const result = await executeStep(plan, step)
        const duration = Date.now() - startTime

        // 更新步骤状态
        await updateStepStatus(planId, step.id, result.success ? 'completed' : 'failed', {
          success: result.success,
          message: result.message,
          error: result.error,
          duration,
        })

        yield {
          stepId: step.id,
          status: result.success ? 'completed' : 'failed',
          message: result.message,
          error: result.error,
          duration,
          output: result.output,
        }

        // 如果步骤失败，停止执行
        if (!result.success) {
          await updatePlanState(planId, 'failed')
          return
        }
      } catch (err) {
        const duration = Date.now() - startTime
        const errorMessage = err instanceof Error ? err.message : '执行失败'

        await updateStepStatus(planId, step.id, 'failed', {
          success: false,
          error: errorMessage,
          duration,
        })

        yield {
          stepId: step.id,
          status: 'failed',
          error: errorMessage,
          duration,
        }

        await updatePlanState(planId, 'failed')
        return
      }
    }

    // 所有步骤执行完成
    await updatePlanState(planId, 'completed')
  } finally {
    // 清理缓存
    activePlans.delete(planId)
  }
}

/**
 * 暂停执行
 */
export function pausePlan(planId: string): boolean {
  const cached = activePlans.get(planId)
  if (!cached) return false

  cached.isPaused = true
  return true
}

/**
 * 恢复执行
 */
export function resumePlan(planId: string): boolean {
  const cached = activePlans.get(planId)
  if (!cached) return false

  cached.isPaused = false
  return true
}

/**
 * 停止执行
 */
export async function stopPlan(planId: string): Promise<boolean> {
  const cached = activePlans.get(planId)
  if (cached?.abortController) {
    cached.abortController.abort()
  }

  await updatePlanState(planId, 'failed')
  activePlans.delete(planId)
  return true
}

// ==================== 辅助函数 ====================

/**
 * 分析请求
 */
function analyzeRequest(
  request: string,
  context?: { functionIds?: string[]; currentCode?: string }
): ExecutionPlan['analysis'] {
  const issues: string[] = []
  const goals: string[] = []

  // 简单的分析逻辑（实际应该调用 AI）
  if (request.includes('重构')) {
    issues.push('代码结构需要优化')
    goals.push('提高代码可维护性')
  }
  if (request.includes('拆分')) {
    issues.push('当前代码职责过多')
    goals.push('实现单一职责原则')
  }
  if (request.includes('优化')) {
    issues.push('性能或可读性有提升空间')
    goals.push('提升代码质量')
  }

  return {
    currentState: context?.currentCode
      ? `当前代码约 ${context.currentCode.split('\n').length} 行`
      : '待分析',
    issues: issues.length > 0 ? issues : ['需要进一步分析'],
    goals: goals.length > 0 ? goals : ['完成用户请求'],
  }
}

/**
 * 生成步骤
 */
function generateSteps(
  request: string,
  analysis: ExecutionPlan['analysis'],
  context?: { functionIds?: string[]; currentCode?: string }
): PlanStep[] {
  const steps: PlanStep[] = []
  let order = 1

  // 第一步：分析
  steps.push({
    id: `step-${order}`,
    order: order++,
    title: '分析现有代码结构',
    description: '理解当前代码的组织方式和依赖关系',
    type: 'analyze',
    status: 'pending',
    selected: true,
    estimatedTokens: 500,
  })

  // 根据请求类型生成后续步骤
  if (request.includes('拆分') || request.includes('重构')) {
    steps.push({
      id: `step-${order}`,
      order: order++,
      title: '创建新的模块目录',
      type: 'create',
      status: 'pending',
      selected: true,
      estimatedTokens: 100,
    })

    steps.push({
      id: `step-${order}`,
      order: order++,
      title: '提取核心逻辑到独立模块',
      type: 'refactor',
      status: 'pending',
      selected: true,
      estimatedTokens: 1000,
    })

    steps.push({
      id: `step-${order}`,
      order: order++,
      title: '更新导入语句和依赖',
      type: 'update',
      status: 'pending',
      selected: true,
      estimatedTokens: 300,
    })
  }

  if (request.includes('添加') || request.includes('新增')) {
    steps.push({
      id: `step-${order}`,
      order: order++,
      title: '实现新功能',
      type: 'create',
      status: 'pending',
      selected: true,
      estimatedTokens: 800,
    })
  }

  if (request.includes('删除') || request.includes('移除')) {
    steps.push({
      id: `step-${order}`,
      order: order++,
      title: '移除相关代码',
      type: 'delete',
      status: 'pending',
      selected: true,
      estimatedTokens: 200,
    })
  }

  // 最后一步：验证
  steps.push({
    id: `step-${order}`,
    order: order++,
    title: '验证修改结果',
    description: '确保代码正确运行',
    type: 'test',
    status: 'pending',
    selected: true,
    estimatedTokens: 300,
  })

  return steps
}

/**
 * 分析影响
 */
function analyzeImpact(
  steps: PlanStep[],
  context?: { functionIds?: string[]; currentCode?: string }
): ImpactAnalysis {
  const newFiles: string[] = []
  const modifiedFiles: string[] = []
  const deletedFiles: string[] = []
  const riskFactors: string[] = []

  for (const step of steps) {
    if (step.type === 'create') {
      newFiles.push(step.targetFile || '新文件')
    }
    if (step.type === 'update' || step.type === 'refactor') {
      modifiedFiles.push(step.targetFile || '现有文件')
    }
    if (step.type === 'delete') {
      deletedFiles.push(step.targetFile || '待删除文件')
      riskFactors.push('包含删除操作')
    }
  }

  // 计算风险等级
  let riskLevel: 'low' | 'medium' | 'high' = 'low'

  if (deletedFiles.length > 0) {
    riskLevel = 'medium'
    riskFactors.push('涉及文件删除')
  }

  if (modifiedFiles.length >= IMPACT_THRESHOLDS.filesAffected) {
    riskLevel = 'medium'
    riskFactors.push(`影响 ${modifiedFiles.length} 个文件`)
  }

  if (steps.some((s) => s.type === 'refactor')) {
    riskLevel = 'high'
    riskFactors.push('包含重构操作')
  }

  return {
    newFiles,
    modifiedFiles,
    deletedFiles,
    riskLevel,
    riskFactors,
  }
}

/**
 * 生成计划标题
 */
function generatePlanTitle(request: string): string {
  // 简单提取前 30 个字符作为标题
  const title = request.slice(0, 30).replace(/\n/g, ' ')
  return request.length > 30 ? `${title}...` : title
}

/**
 * 更新计划状态
 */
async function updatePlanState(planId: string, state: PlanModeState): Promise<void> {
  const db = getDB()
  const updateData: Record<string, unknown> = {
    state,
    updatedAt: new Date(),
  }

  if (state === 'completed' || state === 'failed') {
    updateData.completedAt = new Date()
  }

  await db.collection('ai_plans').updateOne(
    { _id: new ObjectId(planId) },
    { $set: updateData }
  )

  // 更新缓存
  const cached = activePlans.get(planId)
  if (cached) {
    cached.plan.state = state
    cached.plan.updatedAt = new Date()
  }
}

/**
 * 更新步骤状态
 */
async function updateStepStatus(
  planId: string,
  stepId: string,
  status: StepStatus,
  result?: PlanStep['result']
): Promise<void> {
  const db = getDB()

  await db.collection('ai_plans').updateOne(
    { _id: new ObjectId(planId), 'steps.id': stepId },
    {
      $set: {
        'steps.$.status': status,
        'steps.$.result': result,
        updatedAt: new Date(),
      },
    }
  )

  // 更新缓存
  const cached = activePlans.get(planId)
  if (cached) {
    const step = cached.plan.steps.find((s) => s.id === stepId)
    if (step) {
      step.status = status
      step.result = result
    }
  }
}

/**
 * 执行单个步骤
 */
async function executeStep(
  plan: ExecutionPlan,
  step: PlanStep
): Promise<{ success: boolean; message?: string; error?: string; output?: unknown }> {
  // 根据步骤类型执行不同操作
  // 这里是简化的实现，实际应该调用相应的服务

  switch (step.type) {
    case 'analyze':
      // 分析步骤：读取代码并分析
      return {
        success: true,
        message: '分析完成',
        output: { analyzed: true },
      }

    case 'create':
      // 创建步骤：创建新文件或目录
      return {
        success: true,
        message: '创建完成',
        output: { created: step.targetFile || 'new-file' },
      }

    case 'update':
      // 更新步骤：修改现有文件
      return {
        success: true,
        message: '更新完成',
        output: { updated: step.targetFile || 'existing-file' },
      }

    case 'delete':
      // 删除步骤：删除文件
      return {
        success: true,
        message: '删除完成',
        output: { deleted: step.targetFile || 'file-to-delete' },
      }

    case 'refactor':
      // 重构步骤：重构代码
      return {
        success: true,
        message: '重构完成',
        output: { refactored: true },
      }

    case 'test':
      // 测试步骤：验证修改
      return {
        success: true,
        message: '验证通过',
        output: { tested: true },
      }

    default:
      return {
        success: false,
        error: `未知的步骤类型: ${step.type}`,
      }
  }
}

/**
 * 获取用户的计划列表
 */
export async function getUserPlans(
  userId: string,
  options?: {
    limit?: number
    state?: PlanModeState
  }
): Promise<ExecutionPlan[]> {
  const db = getDB()

  const query: Record<string, unknown> = { userId }
  if (options?.state) {
    query.state = options.state
  }

  const docs = await db
    .collection('ai_plans')
    .find(query)
    .sort({ createdAt: -1 })
    .limit(options?.limit || 20)
    .toArray()

  return docs.map((doc) => ({
    id: doc._id.toString(),
    conversationId: doc.conversationId,
    userId: doc.userId,
    title: doc.title,
    originalRequest: doc.originalRequest,
    analysis: doc.analysis,
    steps: doc.steps,
    impact: doc.impact,
    state: doc.state,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    completedAt: doc.completedAt,
  }))
}

/**
 * 删除计划
 */
export async function deletePlan(planId: string): Promise<boolean> {
  const db = getDB()

  // 如果计划正在执行，先停止
  if (activePlans.has(planId)) {
    await stopPlan(planId)
  }

  const result = await db.collection('ai_plans').deleteOne({
    _id: new ObjectId(planId),
  })

  return result.deletedCount > 0
}
