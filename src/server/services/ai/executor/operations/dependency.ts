/**
 * 依赖管理操作执行器
 *
 * 处理依赖的安装、更新、审计操作
 * Sprint 15: 依赖与配置
 */

import type {
  AIOperationResult,
  InstallDependencyOperation,
  UpdateDependencyOperation,
  AuditDependenciesOperation,
  ListDependenciesOperation,
} from '../../types.js'
import * as dependencyTools from '../../tools/dependency.js'

/**
 * 安装依赖（需要用户确认）
 */
export async function installDependency(
  op: InstallDependencyOperation
): Promise<AIOperationResult> {
  try {
    const result = await dependencyTools.installDependency({
      packages: op.packages,
      dev: op.dev,
    })

    if (result.success) {
      return {
        operation: op,
        success: true,
        result: {
          name: `已安装: ${result.installed.join(', ')}`,
        },
      }
    } else {
      return {
        operation: op,
        success: false,
        error: `部分安装失败: ${result.failed.join(', ')}`,
        result: {
          name: `已安装: ${result.installed.join(', ')}`,
        },
      }
    }
  } catch (err) {
    return {
      operation: op,
      success: false,
      error: err instanceof Error ? err.message : '安装依赖失败',
    }
  }
}

/**
 * 更新依赖
 */
export async function updateDependency(
  op: UpdateDependencyOperation
): Promise<AIOperationResult> {
  try {
    const result = await dependencyTools.updateDependency({
      packages: op.packages,
      latest: op.latest,
    })

    const updates = result.updated
      .filter((u) => u.to !== 'failed')
      .map((u) => `${u.name}: ${u.from} → ${u.to}`)

    const failures = result.updated.filter((u) => u.to === 'failed').map((u) => u.name)

    if (result.success) {
      return {
        operation: op,
        success: true,
        result: {
          name: updates.join(', ') || '无更新',
        },
      }
    } else {
      return {
        operation: op,
        success: false,
        error: `更新失败: ${failures.join(', ')}`,
        result: {
          name: updates.join(', ') || '无更新',
        },
      }
    }
  } catch (err) {
    return {
      operation: op,
      success: false,
      error: err instanceof Error ? err.message : '更新依赖失败',
    }
  }
}

/**
 * 审计依赖
 */
export async function auditDependencies(
  op: AuditDependenciesOperation
): Promise<AIOperationResult> {
  try {
    const result = await dependencyTools.auditDependencies()

    return {
      operation: op,
      success: true,
      result: {
        name: result.summary,
      },
    }
  } catch (err) {
    return {
      operation: op,
      success: false,
      error: err instanceof Error ? err.message : '审计依赖失败',
    }
  }
}

/**
 * 列出依赖
 */
export async function listDependencies(
  op: ListDependenciesOperation
): Promise<AIOperationResult> {
  try {
    const deps = await dependencyTools.listDependencies()

    const prodDeps = deps.filter((d) => !d.isDevDependency)
    const devDeps = deps.filter((d) => d.isDevDependency)

    return {
      operation: op,
      success: true,
      result: {
        name: `生产依赖: ${prodDeps.length}, 开发依赖: ${devDeps.length}`,
      },
    }
  } catch (err) {
    return {
      operation: op,
      success: false,
      error: err instanceof Error ? err.message : '列出依赖失败',
    }
  }
}
