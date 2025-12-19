import { ObjectId } from 'mongodb'
import { getDB } from '../db.js'
import { executeFunction, type ExecuteResult } from '../engine/executor.js'
import { createCloudWithEnv } from '../cloud/index.js'
import * as functionService from './function.js'
import * as executionLogService from './executionLog.js'

export interface ScheduledTask {
  _id?: ObjectId
  userId: string
  functionId: string
  functionName: string
  enabled: boolean
  // 间隔设置（毫秒）
  interval: number
  // 间隔配置（用于显示）
  intervalConfig: {
    days: number
    hours: number
    minutes: number
    seconds: number
  }
  // 上次执行时间
  lastRunAt?: Date
  // 下次执行时间
  nextRunAt?: Date
  // 上次执行结果
  lastResult?: {
    success: boolean
    data?: unknown
    error?: string
    duration: number
  }
  // 执行次数
  runCount: number
  createdAt: Date
  updatedAt: Date
}

// 内存中的定时器 Map
const schedulerTimers = new Map<string, NodeJS.Timeout>()

/**
 * 获取用户的定时任务列表
 */
export async function list(userId: string): Promise<ScheduledTask[]> {
  const db = getDB()
  const tasks = await db.collection<ScheduledTask>('scheduled_tasks')
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray()
  return tasks
}

/**
 * 创建定时任务
 */
export async function create(
  userId: string,
  functionId: string,
  intervalConfig: { days: number; hours: number; minutes: number; seconds: number }
): Promise<ScheduledTask> {
  const db = getDB()

  // 验证函数存在
  const func = await functionService.findById(functionId, userId)
  if (!func) {
    throw new Error('函数不存在')
  }

  // 计算间隔毫秒数
  const interval = (
    intervalConfig.days * 24 * 60 * 60 * 1000 +
    intervalConfig.hours * 60 * 60 * 1000 +
    intervalConfig.minutes * 60 * 1000 +
    intervalConfig.seconds * 1000
  )

  if (interval < 1000) {
    throw new Error('间隔时间至少为 1 秒')
  }

  // 检查是否已存在相同函数的定时任务
  const existing = await db.collection<ScheduledTask>('scheduled_tasks')
    .findOne({ userId, functionId })
  if (existing) {
    throw new Error('该函数已有定时任务')
  }

  const now = new Date()
  const task: ScheduledTask = {
    userId,
    functionId,
    functionName: func.name,
    enabled: true,
    interval,
    intervalConfig,
    nextRunAt: new Date(now.getTime() + interval),
    runCount: 0,
    createdAt: now,
    updatedAt: now,
  }

  const result = await db.collection<ScheduledTask>('scheduled_tasks').insertOne(task)
  task._id = result.insertedId

  // 启动定时器
  startTimer(task)

  return task
}

/**
 * 更新定时任务
 */
export async function update(
  taskId: string,
  userId: string,
  updates: {
    enabled?: boolean
    intervalConfig?: { days: number; hours: number; minutes: number; seconds: number }
  }
): Promise<ScheduledTask | null> {
  const db = getDB()
  const task = await db.collection<ScheduledTask>('scheduled_tasks')
    .findOne({ _id: new ObjectId(taskId), userId })

  if (!task) {
    return null
  }

  const updateData: Partial<ScheduledTask> = {
    updatedAt: new Date(),
  }

  if (updates.enabled !== undefined) {
    updateData.enabled = updates.enabled
  }

  if (updates.intervalConfig) {
    const interval = (
      updates.intervalConfig.days * 24 * 60 * 60 * 1000 +
      updates.intervalConfig.hours * 60 * 60 * 1000 +
      updates.intervalConfig.minutes * 60 * 1000 +
      updates.intervalConfig.seconds * 1000
    )
    if (interval < 1000) {
      throw new Error('间隔时间至少为 1 秒')
    }
    updateData.interval = interval
    updateData.intervalConfig = updates.intervalConfig
    updateData.nextRunAt = new Date(Date.now() + interval)
  }

  await db.collection<ScheduledTask>('scheduled_tasks').updateOne(
    { _id: new ObjectId(taskId) },
    { $set: updateData }
  )

  const updated = await db.collection<ScheduledTask>('scheduled_tasks')
    .findOne({ _id: new ObjectId(taskId) })

  // 重新调度定时器
  if (updated) {
    stopTimer(taskId)
    if (updated.enabled) {
      startTimer(updated)
    }
  }

  return updated
}

/**
 * 删除定时任务
 */
export async function remove(taskId: string, userId: string): Promise<boolean> {
  const db = getDB()

  // 停止定时器
  stopTimer(taskId)

  const result = await db.collection<ScheduledTask>('scheduled_tasks')
    .deleteOne({ _id: new ObjectId(taskId), userId })

  return result.deletedCount > 0
}

/**
 * 手动执行一次
 */
export async function runOnce(taskId: string, userId: string): Promise<ExecuteResult | null> {
  const db = getDB()
  const task = await db.collection<ScheduledTask>('scheduled_tasks')
    .findOne({ _id: new ObjectId(taskId), userId })

  if (!task) {
    return null
  }

  return await executeTask(task)
}

/**
 * 执行定时任务
 */
async function executeTask(task: ScheduledTask): Promise<ExecuteResult> {
  const db = getDB()
  const startTime = Date.now()

  try {
    // 获取函数
    const func = await functionService.findById(task.functionId, task.userId)
    if (!func) {
      throw new Error('函数不存在')
    }

    if (!func.compiled) {
      throw new Error('函数未编译')
    }

    // 创建 Cloud SDK
    const cloud = await createCloudWithEnv(task.userId)

    // 执行函数
    const result = await executeFunction(
      func.name,
      func.compiled,
      '',
      {
        body: { _scheduler: true, taskId: task._id?.toString() },
        query: {},
        headers: {},
        cloud,
        userId: task.userId,
      }
    )

    const duration = Date.now() - startTime

    // 记录执行日志
    executionLogService.create({
      userId: task.userId,
      functionId: task.functionId,
      functionName: task.functionName,
      trigger: 'scheduler',
      request: {
        method: 'POST',
        body: { _scheduler: true, taskId: task._id?.toString() },
      },
      success: !result.error,
      data: result.data,
      error: result.error,
      logs: result.logs.map(log => ({
        level: 'log',
        args: [log],
        timestamp: Date.now(),
      })),
      duration,
    }).catch(err => console.error('记录执行日志失败:', err))

    // 更新任务状态
    await db.collection<ScheduledTask>('scheduled_tasks').updateOne(
      { _id: task._id },
      {
        $set: {
          lastRunAt: new Date(),
          nextRunAt: new Date(Date.now() + task.interval),
          lastResult: {
            success: !result.error,
            data: result.data,
            duration,
          },
          updatedAt: new Date(),
        },
        $inc: { runCount: 1 },
      }
    )

    return result
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : '执行失败'

    // 记录执行日志（失败）
    executionLogService.create({
      userId: task.userId,
      functionId: task.functionId,
      functionName: task.functionName,
      trigger: 'scheduler',
      request: {
        method: 'POST',
        body: { _scheduler: true, taskId: task._id?.toString() },
      },
      success: false,
      error: errorMessage,
      logs: [],
      duration,
    }).catch(err => console.error('记录执行日志失败:', err))

    // 更新任务状态
    await db.collection<ScheduledTask>('scheduled_tasks').updateOne(
      { _id: task._id },
      {
        $set: {
          lastRunAt: new Date(),
          nextRunAt: new Date(Date.now() + task.interval),
          lastResult: {
            success: false,
            error: errorMessage,
            duration,
          },
          updatedAt: new Date(),
        },
        $inc: { runCount: 1 },
      }
    )

    return {
      data: null,
      error: errorMessage,
      logs: [],
      time: duration,
    }
  }
}

/**
 * 启动定时器
 */
function startTimer(task: ScheduledTask): void {
  if (!task._id || !task.enabled) return

  const taskId = task._id.toString()

  // 先停止已有的定时器
  stopTimer(taskId)

  // 创建新的定时器
  const timer = setInterval(async () => {
    const db = getDB()
    const currentTask = await db.collection<ScheduledTask>('scheduled_tasks')
      .findOne({ _id: task._id })

    if (currentTask && currentTask.enabled) {
      console.log(`[Scheduler] 执行定时任务: ${currentTask.functionName}`)
      await executeTask(currentTask)
    }
  }, task.interval)

  schedulerTimers.set(taskId, timer)
  console.log(`[Scheduler] 定时器已启动: ${task.functionName}, 间隔 ${task.interval}ms`)
}

/**
 * 停止定时器
 */
function stopTimer(taskId: string): void {
  const timer = schedulerTimers.get(taskId)
  if (timer) {
    clearInterval(timer)
    schedulerTimers.delete(taskId)
    console.log(`[Scheduler] 定时器已停止: ${taskId}`)
  }
}

/**
 * 初始化所有定时任务（服务启动时调用）
 */
export async function initSchedulers(): Promise<void> {
  const db = getDB()
  const tasks = await db.collection<ScheduledTask>('scheduled_tasks')
    .find({ enabled: true })
    .toArray()

  console.log(`[Scheduler] 初始化 ${tasks.length} 个定时任务`)

  for (const task of tasks) {
    startTimer(task)
  }
}

/**
 * 停止所有定时器（服务关闭时调用）
 */
export function stopAllSchedulers(): void {
  for (const [taskId, timer] of schedulerTimers) {
    clearInterval(timer)
    console.log(`[Scheduler] 停止定时器: ${taskId}`)
  }
  schedulerTimers.clear()
}
