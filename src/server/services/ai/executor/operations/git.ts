/**
 * Git 操作执行器
 *
 * Sprint 17: Git 操作增强
 * 实现 Git 状态、Diff、提交、同步和分支管理操作
 */

import type {
  GitStatusOperation,
  GitDiffOperation,
  GitCommitOperation,
  GitSyncOperation,
  GitBranchOperation,
  GitLogOperation,
  AIOperationResult,
} from '../../types.js'
import {
  gitStatus as getGitStatus,
  gitDiff as getGitDiff,
  gitCommit as doGitCommit,
  gitSync as doGitSync,
  gitBranch as doGitBranch,
  gitLog as getGitLog,
} from '../../tools/git.js'

/**
 * 执行 Git 状态查询
 */
export async function gitStatus(operation: GitStatusOperation): Promise<AIOperationResult> {
  try {
    const result = await getGitStatus()

    // 格式化输出
    const summary = [
      `分支: ${result.branch}`,
      result.ahead > 0 ? `领先 ${result.ahead} 个提交` : null,
      result.behind > 0 ? `落后 ${result.behind} 个提交` : null,
      result.staged.length > 0 ? `暂存: ${result.staged.length} 个文件` : null,
      result.modified.length > 0 ? `修改: ${result.modified.length} 个文件` : null,
      result.untracked.length > 0 ? `未跟踪: ${result.untracked.length} 个文件` : null,
      result.deleted.length > 0 ? `删除: ${result.deleted.length} 个文件` : null,
    ].filter(Boolean).join('\n')

    return {
      operation,
      success: true,
      result: {
        ...result,
        summary,
      },
    }
  } catch (err) {
    return {
      operation,
      success: false,
      error: (err as Error).message,
    }
  }
}

/**
 * 执行 Git Diff 查询
 */
export async function gitDiff(operation: GitDiffOperation): Promise<AIOperationResult> {
  try {
    const result = await getGitDiff({
      ref: operation.ref,
      path: operation.path,
      staged: operation.staged,
    })

    return {
      operation,
      success: true,
      result: {
        files: result.files,
        summary: result.summary,
        // diff 内容可能很长，截断显示
        diff: result.diff.length > 5000
          ? result.diff.slice(0, 5000) + '\n... (输出已截断)'
          : result.diff,
      },
    }
  } catch (err) {
    return {
      operation,
      success: false,
      error: (err as Error).message,
    }
  }
}

/**
 * 执行 Git 提交
 *
 * 注意：此操作需要用户确认（Level 2 权限）
 */
export async function gitCommit(operation: GitCommitOperation): Promise<AIOperationResult> {
  try {
    const result = await doGitCommit({
      message: operation.message,
      files: operation.files,
    })

    if (!result.success) {
      return {
        operation,
        success: false,
        error: result.message,
      }
    }

    return {
      operation,
      success: true,
      result: {
        commitHash: result.commitHash,
        message: result.message,
        filesCommitted: result.filesCommitted,
      },
    }
  } catch (err) {
    return {
      operation,
      success: false,
      error: (err as Error).message,
    }
  }
}

/**
 * 执行 Git 同步
 *
 * 注意：此操作需要用户确认（Level 2 权限）
 * 安全限制：禁止 force push
 */
export async function gitSync(operation: GitSyncOperation): Promise<AIOperationResult> {
  try {
    const result = await doGitSync({
      action: operation.action,
      remote: operation.remote,
      branch: operation.branch,
    })

    return {
      operation,
      success: result.success,
      result: {
        message: result.message,
        details: result.details,
      },
    }
  } catch (err) {
    return {
      operation,
      success: false,
      error: (err as Error).message,
    }
  }
}

/**
 * 执行 Git 分支操作
 */
export async function gitBranch(operation: GitBranchOperation): Promise<AIOperationResult> {
  try {
    const result = await doGitBranch({
      action: operation.action,
      name: operation.name,
    })

    return {
      operation,
      success: result.success,
      result: {
        branches: result.branches,
        current: result.current,
        message: result.message,
      },
    }
  } catch (err) {
    return {
      operation,
      success: false,
      error: (err as Error).message,
    }
  }
}

/**
 * 执行 Git 日志查询
 */
export async function gitLog(operation: GitLogOperation): Promise<AIOperationResult> {
  try {
    const result = await getGitLog({
      count: operation.count,
      path: operation.path,
    })

    // 格式化日志输出
    const formattedEntries = result.entries.map(entry =>
      `${entry.shortHash} ${entry.date} ${entry.author}: ${entry.message}`
    ).join('\n')

    return {
      operation,
      success: true,
      result: {
        entries: result.entries,
        formatted: formattedEntries,
      },
    }
  } catch (err) {
    return {
      operation,
      success: false,
      error: (err as Error).message,
    }
  }
}
