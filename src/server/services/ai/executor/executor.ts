/**
 * AI Action 执行器
 *
 * 负责解析 AI 返回的结构化操作并执行
 */

import { ObjectId, type Db } from 'mongodb'
import type {
  AIOperation,
  AIExecutionPlan,
  AIOperationResult,
  AIExecutionResponse,
} from '../types.js'
import * as functionOps from './operations/function.js'
import * as siteOps from './operations/site.js'
import * as projectOps from './operations/project.js'
import * as dependencyOps from './operations/dependency.js'
import * as envOps from './operations/env.js'
import * as gitOps from './operations/git.js'
import * as databaseOps from './operations/database.js'
import * as testOps from './operations/test.js'

/**
 * AI 执行器配置
 */
export interface AIExecutorOptions {
  username: string
  modelName?: string
}

/**
 * AI Action 执行器
 * 负责解析 AI 返回的结构化操作并执行
 */
export class AIExecutor {
  private username: string
  private modelName?: string

  constructor(
    private db: Db,
    private userId: ObjectId,
    options?: AIExecutorOptions
  ) {
    this.username = options?.username || 'unknown'
    this.modelName = options?.modelName
  }

  /**
   * 从 AI 响应中解析执行计划
   */
  parsePlan(aiResponse: string): AIExecutionPlan | null {
    try {
      // 尝试提取 JSON 块
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)```/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1].trim())
      }

      // 尝试直接解析
      const parsed = JSON.parse(aiResponse)
      if (parsed.operations && Array.isArray(parsed.operations)) {
        return parsed
      }

      return null
    } catch {
      return null
    }
  }

  /**
   * 执行整个计划
   */
  async execute(plan: AIExecutionPlan): Promise<AIExecutionResponse> {
    const results: AIOperationResult[] = []
    let allSuccess = true

    for (const operation of plan.operations) {
      const result = await this.executeOperation(operation)
      results.push(result)
      if (!result.success) {
        allSuccess = false
      }
    }

    return {
      success: allSuccess,
      plan,
      results,
      message: allSuccess
        ? `成功执行 ${results.length} 个操作`
        : `执行完成，${results.filter(r => r.success).length}/${results.length} 成功`,
    }
  }

  /**
   * 执行单个操作
   */
  private async executeOperation(operation: AIOperation): Promise<AIOperationResult> {
    const ctx = {
      db: this.db,
      userId: this.userId,
      username: this.username,
      modelName: this.modelName,
    }

    try {
      switch (operation.type) {
        // 函数操作
        case 'createFunction':
          return await functionOps.createFunction(operation, ctx)
        case 'updateFunction':
          return await functionOps.updateFunction(operation, ctx)
        case 'deleteFunction':
          return await functionOps.deleteFunction(operation, ctx)
        case 'renameFunction':
          return await functionOps.renameFunction(operation, ctx)
        case 'createFolder':
          return await functionOps.createFolder(operation, ctx)
        case 'moveFunction':
          return await functionOps.moveFunction(operation, ctx)

        // 站点文件操作
        case 'siteCreateFile':
          return await siteOps.siteCreateFile(operation, { userId: this.userId })
        case 'siteUpdateFile':
          return await siteOps.siteUpdateFile(operation, { userId: this.userId })
        case 'siteDeleteFile':
          return await siteOps.siteDeleteFile(operation, { userId: this.userId })
        case 'siteCreateFolder':
          return await siteOps.siteCreateFolder(operation, { userId: this.userId })

        // 项目文件操作
        case 'readProjectFile':
          return await projectOps.readProjectFile(operation)
        case 'writeProjectFile':
          return await projectOps.writeProjectFile(operation)
        case 'getFileTree':
          return await projectOps.getFileTree(operation)
        case 'searchCode':
          return await projectOps.searchCode(operation)

        // 依赖管理操作 (Sprint 15)
        case 'installDependency':
          return await dependencyOps.installDependency(operation)
        case 'updateDependency':
          return await dependencyOps.updateDependency(operation)
        case 'auditDependencies':
          return await dependencyOps.auditDependencies(operation)
        case 'listDependencies':
          return await dependencyOps.listDependencies(operation)

        // 环境变量操作 (Sprint 15)
        case 'setEnvVariable':
          return await envOps.setEnvVariable(operation, { userId: this.userId })
        case 'deleteEnvVariable':
          return await envOps.deleteEnvVariable(operation, { userId: this.userId })
        case 'listEnvVariables':
          return await envOps.listEnvVariables(operation, { userId: this.userId })

        // Git 操作 (Sprint 17)
        case 'gitStatus':
          return await gitOps.gitStatus(operation)
        case 'gitDiff':
          return await gitOps.gitDiff(operation)
        case 'gitCommit':
          return await gitOps.gitCommit(operation)
        case 'gitSync':
          return await gitOps.gitSync(operation)
        case 'gitBranch':
          return await gitOps.gitBranch(operation)
        case 'gitLog':
          return await gitOps.gitLog(operation)

        // 数据库操作 (Sprint 18)
        case 'analyzeCollection':
          return await databaseOps.analyzeCollection(operation)
        case 'executeQuery':
          return await databaseOps.executeQuery(operation)
        case 'suggestIndexes':
          return await databaseOps.suggestIndexes(operation)

        // 测试操作 (Sprint 19)
        case 'testFunction':
          return await testOps.testFunction(operation, ctx)
        case 'batchTestFunction':
          return await testOps.batchTestFunction(operation, ctx)
        case 'saveTestInput':
          return await testOps.saveTestInput(operation, ctx)
        case 'getTestInput':
          return await testOps.getTestInput(operation, ctx)

        default:
          return {
            operation,
            success: false,
            error: `未知操作类型: ${(operation as AIOperation).type}`,
          }
      }
    } catch (err) {
      return {
        operation,
        success: false,
        error: err instanceof Error ? err.message : '执行失败',
      }
    }
  }
}
