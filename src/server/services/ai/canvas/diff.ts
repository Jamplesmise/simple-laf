/**
 * Diff 计算服务 (Sprint 11.2.2)
 *
 * 使用 diff-match-patch 库计算代码差异
 */

import DiffMatchPatch from 'diff-match-patch'
import type { DiffResult, DiffChange, DiffStats, DiffChangeType } from './types.js'

const dmp = new DiffMatchPatch()

/**
 * 计算两段代码的差异
 * @param before 修改前代码
 * @param after 修改后代码
 * @returns 差异结果
 */
export function calculateDiff(before: string, after: string): DiffResult {
  // 计算差异
  const diffs = dmp.diff_main(before, after)
  // 优化差异结果
  dmp.diff_cleanupSemantic(diffs)

  // 转换为行级别变更
  const changes: DiffChange[] = []
  const stats: DiffStats = { added: 0, removed: 0, modified: 0 }

  let beforeLine = 1
  let afterLine = 1

  for (const [op, text] of diffs) {
    const lines = text.split('\n')
    const lineCount = lines.length - 1 + (lines[lines.length - 1].length > 0 ? 1 : 0)
    const actualLineCount = text.split('\n').length - (text.endsWith('\n') ? 1 : 0)

    let type: DiffChangeType
    let lineStart: number
    let lineEnd: number

    if (op === 0) {
      // 相等
      type = 'equal'
      lineStart = afterLine
      lineEnd = afterLine + actualLineCount - 1
      beforeLine += actualLineCount
      afterLine += actualLineCount
    } else if (op === -1) {
      // 删除
      type = 'remove'
      lineStart = beforeLine
      lineEnd = beforeLine + actualLineCount - 1
      stats.removed += actualLineCount
      beforeLine += actualLineCount
    } else {
      // 添加
      type = 'add'
      lineStart = afterLine
      lineEnd = afterLine + actualLineCount - 1
      stats.added += actualLineCount
      afterLine += actualLineCount
    }

    // 合并相邻的相同类型变更
    const lastChange = changes[changes.length - 1]
    if (lastChange && lastChange.type === type && type !== 'equal') {
      lastChange.content += text
      lastChange.lineEnd = lineEnd
    } else if (text.length > 0) {
      changes.push({
        type,
        content: text,
        lineStart,
        lineEnd: Math.max(lineStart, lineEnd)
      })
    }
  }

  // 计算修改行数（删除和添加的最小值表示修改）
  stats.modified = Math.min(stats.added, stats.removed)
  stats.added -= stats.modified
  stats.removed -= stats.modified

  return { changes, stats }
}

/**
 * 生成统一格式的 diff 字符串（用于显示）
 * @param before 修改前代码
 * @param after 修改后代码
 * @returns diff 字符串
 */
export function generateUnifiedDiff(before: string, after: string): string {
  const patches = dmp.patch_make(before, after)
  return dmp.patch_toText(patches)
}

/**
 * 应用 diff 补丁
 * @param original 原始代码
 * @param patchText diff 补丁文本
 * @returns 应用后的代码
 */
export function applyPatch(original: string, patchText: string): string {
  const patches = dmp.patch_fromText(patchText)
  const [result] = dmp.patch_apply(patches, original)
  return result
}

/**
 * 计算相似度（0-1）
 * @param text1 文本1
 * @param text2 文本2
 * @returns 相似度
 */
export function calculateSimilarity(text1: string, text2: string): number {
  if (text1 === text2) return 1
  if (text1.length === 0 || text2.length === 0) return 0

  const diffs = dmp.diff_main(text1, text2)
  const levenshtein = dmp.diff_levenshtein(diffs)
  const maxLength = Math.max(text1.length, text2.length)

  return 1 - levenshtein / maxLength
}
