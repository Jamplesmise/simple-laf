/**
 * Git 工具模块
 *
 * 提供 Git 状态查看、Diff 查看、提交、同步和分支管理功能
 * Sprint 17: Git 操作增强
 */

import { exec as execCallback } from 'child_process'
import { promisify } from 'util'
import { getProjectRoot } from './projectFile.js'

const exec = promisify(execCallback)

// ==================== Git 状态 ====================

/**
 * Git 状态结果
 */
export interface GitStatusResult {
  branch: string
  ahead: number
  behind: number
  staged: string[]
  modified: string[]
  untracked: string[]
  deleted: string[]
  renamed: Array<{ from: string; to: string }>
}

/**
 * 解析 git status --porcelain -b 输出
 */
function parseGitStatus(stdout: string): GitStatusResult {
  const lines = stdout.trim().split('\n').filter(Boolean)
  const result: GitStatusResult = {
    branch: 'unknown',
    ahead: 0,
    behind: 0,
    staged: [],
    modified: [],
    untracked: [],
    deleted: [],
    renamed: [],
  }

  for (const line of lines) {
    // 分支信息行: ## main...origin/main [ahead 1, behind 2]
    if (line.startsWith('##')) {
      const branchMatch = line.match(/^## (\S+?)(?:\.\.\.(\S+))?/)
      if (branchMatch) {
        result.branch = branchMatch[1]
      }
      const aheadMatch = line.match(/ahead (\d+)/)
      const behindMatch = line.match(/behind (\d+)/)
      if (aheadMatch) result.ahead = parseInt(aheadMatch[1], 10)
      if (behindMatch) result.behind = parseInt(behindMatch[1], 10)
      continue
    }

    // 文件状态: XY filename
    const indexStatus = line[0]
    const workTreeStatus = line[1]
    const filePath = line.slice(3).trim()

    // 重命名处理: R  old -> new
    if (indexStatus === 'R' || workTreeStatus === 'R') {
      const renameParts = filePath.split(' -> ')
      if (renameParts.length === 2) {
        result.renamed.push({ from: renameParts[0], to: renameParts[1] })
      }
      continue
    }

    // 暂存区状态
    if (indexStatus === 'A' || indexStatus === 'M') {
      result.staged.push(filePath)
    }

    // 工作区修改
    if (workTreeStatus === 'M') {
      result.modified.push(filePath)
    }

    // 未跟踪
    if (indexStatus === '?' && workTreeStatus === '?') {
      result.untracked.push(filePath)
    }

    // 删除
    if (indexStatus === 'D' || workTreeStatus === 'D') {
      result.deleted.push(filePath)
    }
  }

  return result
}

/**
 * 获取 Git 状态
 */
export async function gitStatus(): Promise<GitStatusResult> {
  const cwd = getProjectRoot()

  try {
    const { stdout } = await exec('git status --porcelain -b', { cwd })
    return parseGitStatus(stdout)
  } catch (err) {
    throw new Error(`获取 Git 状态失败: ${(err as Error).message}`)
  }
}

// ==================== Git Diff ====================

/**
 * 文件变更信息
 */
export interface FileChange {
  path: string
  additions: number
  deletions: number
}

/**
 * Git Diff 参数
 */
export interface GitDiffParams {
  ref?: string    // 参考点，默认 HEAD
  path?: string   // 指定文件路径
  staged?: boolean // 是否查看暂存区
}

/**
 * Git Diff 结果
 */
export interface GitDiffResult {
  files: FileChange[]
  diff: string
  summary: {
    filesChanged: number
    insertions: number
    deletions: number
  }
}

/**
 * 解析 git diff --stat 输出
 */
function parseDiffStat(stdout: string): FileChange[] {
  const files: FileChange[] = []
  const lines = stdout.trim().split('\n')

  for (const line of lines) {
    // 格式: filename | count ++++----
    const match = line.match(/^\s*(.+?)\s*\|\s*(\d+)\s*([+-]*)$/)
    if (match) {
      const [, path, , changes] = match
      const additions = (changes.match(/\+/g) || []).length
      const deletions = (changes.match(/-/g) || []).length
      files.push({
        path: path.trim(),
        additions,
        deletions,
      })
    }
  }

  return files
}

/**
 * 获取 Git Diff
 */
export async function gitDiff(params: GitDiffParams = {}): Promise<GitDiffResult> {
  const cwd = getProjectRoot()
  const ref = params.ref || 'HEAD'
  const pathArg = params.path ? `-- ${params.path}` : ''
  const stagedArg = params.staged ? '--staged' : ''

  try {
    // 获取详细 diff
    const diffCmd = `git diff ${stagedArg} ${ref} ${pathArg}`.trim().replace(/\s+/g, ' ')
    const { stdout: diffOutput } = await exec(diffCmd, { cwd, maxBuffer: 10 * 1024 * 1024 })

    // 获取统计信息
    const statCmd = `git diff ${stagedArg} ${ref} --stat ${pathArg}`.trim().replace(/\s+/g, ' ')
    const { stdout: statOutput } = await exec(statCmd, { cwd })

    const files = parseDiffStat(statOutput)

    // 解析汇总行
    const summaryMatch = statOutput.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/)
    const summary = {
      filesChanged: summaryMatch ? parseInt(summaryMatch[1], 10) : files.length,
      insertions: summaryMatch && summaryMatch[2] ? parseInt(summaryMatch[2], 10) : 0,
      deletions: summaryMatch && summaryMatch[3] ? parseInt(summaryMatch[3], 10) : 0,
    }

    return {
      files,
      diff: diffOutput,
      summary,
    }
  } catch (err) {
    throw new Error(`获取 Git Diff 失败: ${(err as Error).message}`)
  }
}

// ==================== Git Commit ====================

/**
 * Git Commit 参数
 */
export interface GitCommitParams {
  message: string
  files?: string[]  // 要暂存的文件，不指定则暂存所有
}

/**
 * Git Commit 结果
 */
export interface GitCommitResult {
  success: boolean
  commitHash: string
  message: string
  filesCommitted: number
}

/**
 * 从 git commit 输出中提取 commit hash
 */
function extractCommitHash(stdout: string): string {
  // 格式: [branch hash] message
  const match = stdout.match(/\[[\w/-]+\s+([a-f0-9]+)\]/)
  return match ? match[1] : ''
}

/**
 * 提交代码更改
 *
 * 注意：此操作需要用户确认
 */
export async function gitCommit(params: GitCommitParams): Promise<GitCommitResult> {
  const cwd = getProjectRoot()

  try {
    // 暂存文件
    if (params.files && params.files.length > 0) {
      // 验证文件路径，防止命令注入
      const safeFiles = params.files.map(f => f.replace(/[;&|`$()]/g, ''))
      await exec(`git add ${safeFiles.join(' ')}`, { cwd })
    } else {
      await exec('git add -A', { cwd })
    }

    // 检查是否有暂存的更改
    const { stdout: statusCheck } = await exec('git diff --cached --name-only', { cwd })
    if (!statusCheck.trim()) {
      return {
        success: false,
        commitHash: '',
        message: '没有暂存的更改可提交',
        filesCommitted: 0,
      }
    }

    // 提交
    const safeMessage = params.message.replace(/"/g, '\\"')
    const { stdout } = await exec(`git commit -m "${safeMessage}"`, { cwd })

    const hash = extractCommitHash(stdout)
    const filesCount = statusCheck.trim().split('\n').length

    return {
      success: true,
      commitHash: hash,
      message: params.message,
      filesCommitted: filesCount,
    }
  } catch (err) {
    throw new Error(`Git 提交失败: ${(err as Error).message}`)
  }
}

// ==================== Git Sync ====================

/**
 * Git Sync 参数
 */
export interface GitSyncParams {
  action: 'pull' | 'push'
  remote?: string   // 默认 origin
  branch?: string   // 默认当前分支
}

/**
 * Git Sync 结果
 */
export interface GitSyncResult {
  success: boolean
  message: string
  details?: string
}

/**
 * 同步远程仓库
 *
 * 注意：此操作需要用户确认
 * 安全限制：禁止 force push
 */
export async function gitSync(params: GitSyncParams): Promise<GitSyncResult> {
  const cwd = getProjectRoot()
  const remote = params.remote || 'origin'

  try {
    // 获取当前分支
    let branch = params.branch
    if (!branch) {
      const { stdout } = await exec('git rev-parse --abbrev-ref HEAD', { cwd })
      branch = stdout.trim()
    }

    if (params.action === 'pull') {
      const { stdout } = await exec(`git pull ${remote} ${branch}`, { cwd })
      return {
        success: true,
        message: `成功从 ${remote}/${branch} 拉取更新`,
        details: stdout.trim(),
      }
    } else {
      // 检查是否有未推送的提交
      const { stdout: statusCheck } = await exec(`git rev-list --count ${remote}/${branch}..HEAD`, { cwd })
      const unpushedCount = parseInt(statusCheck.trim(), 10)

      if (unpushedCount === 0) {
        return {
          success: true,
          message: '没有需要推送的更改',
        }
      }

      // 执行 push (不允许 force)
      const { stdout } = await exec(`git push ${remote} ${branch}`, { cwd })
      return {
        success: true,
        message: `成功推送 ${unpushedCount} 个提交到 ${remote}/${branch}`,
        details: stdout.trim(),
      }
    }
  } catch (err) {
    throw new Error(`Git 同步失败: ${(err as Error).message}`)
  }
}

// ==================== Git Branch ====================

/**
 * Git Branch 参数
 */
export interface GitBranchParams {
  action: 'list' | 'create' | 'checkout' | 'delete'
  name?: string  // 分支名（create/checkout/delete 时必填）
}

/**
 * Git Branch 结果
 */
export interface GitBranchResult {
  success: boolean
  branches?: string[]
  current?: string
  message?: string
}

/**
 * 管理 Git 分支
 */
export async function gitBranch(params: GitBranchParams): Promise<GitBranchResult> {
  const cwd = getProjectRoot()

  try {
    switch (params.action) {
      case 'list': {
        const { stdout } = await exec('git branch -a', { cwd })
        const lines = stdout.trim().split('\n')
        const branches: string[] = []
        let current = ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('*')) {
            current = trimmed.slice(2)
            branches.push(current)
          } else if (!trimmed.includes('->')) {
            // 排除 HEAD -> origin/main 这样的符号链接
            branches.push(trimmed.replace('remotes/', ''))
          }
        }

        return {
          success: true,
          branches,
          current,
        }
      }

      case 'create': {
        if (!params.name) {
          throw new Error('创建分支需要指定分支名')
        }
        // 验证分支名
        const safeName = params.name.replace(/[;&|`$()]/g, '')
        await exec(`git branch ${safeName}`, { cwd })
        return {
          success: true,
          message: `成功创建分支: ${safeName}`,
        }
      }

      case 'checkout': {
        if (!params.name) {
          throw new Error('切换分支需要指定分支名')
        }
        const safeName = params.name.replace(/[;&|`$()]/g, '')
        await exec(`git checkout ${safeName}`, { cwd })
        return {
          success: true,
          message: `成功切换到分支: ${safeName}`,
          current: safeName,
        }
      }

      case 'delete': {
        if (!params.name) {
          throw new Error('删除分支需要指定分支名')
        }
        const safeName = params.name.replace(/[;&|`$()]/g, '')
        // 使用 -d 而非 -D，防止删除未合并的分支
        await exec(`git branch -d ${safeName}`, { cwd })
        return {
          success: true,
          message: `成功删除分支: ${safeName}`,
        }
      }

      default:
        throw new Error(`未知的分支操作: ${params.action}`)
    }
  } catch (err) {
    throw new Error(`Git 分支操作失败: ${(err as Error).message}`)
  }
}

// ==================== Git Log ====================

/**
 * Git Log 参数
 */
export interface GitLogParams {
  count?: number   // 日志数量，默认 10
  path?: string    // 指定文件路径
}

/**
 * 提交记录
 */
export interface GitLogEntry {
  hash: string
  shortHash: string
  author: string
  email: string
  date: string
  message: string
}

/**
 * Git Log 结果
 */
export interface GitLogResult {
  entries: GitLogEntry[]
}

/**
 * 获取提交历史
 */
export async function gitLog(params: GitLogParams = {}): Promise<GitLogResult> {
  const cwd = getProjectRoot()
  const count = params.count || 10
  const pathArg = params.path ? `-- ${params.path}` : ''

  try {
    // 使用特定分隔符格式化输出
    const format = '%H|%h|%an|%ae|%ad|%s'
    const cmd = `git log -${count} --format="${format}" --date=short ${pathArg}`.trim()
    const { stdout } = await exec(cmd, { cwd })

    const entries: GitLogEntry[] = []
    const lines = stdout.trim().split('\n').filter(Boolean)

    for (const line of lines) {
      const [hash, shortHash, author, email, date, message] = line.split('|')
      entries.push({
        hash,
        shortHash,
        author,
        email,
        date,
        message,
      })
    }

    return { entries }
  } catch (err) {
    throw new Error(`获取 Git 日志失败: ${(err as Error).message}`)
  }
}
