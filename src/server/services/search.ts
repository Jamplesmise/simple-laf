import { ObjectId } from 'mongodb'
import { getDB } from '../db.js'
import type { CloudFunction } from './function.js'

export interface SearchResult {
  _id: string
  name: string
  type: 'function'
  // 匹配类型
  matchType: 'name' | 'code'
  // 匹配的代码行（如果是代码匹配）
  matchedLine?: string
  lineNumber?: number
  // 高亮位置
  highlights?: { start: number; end: number }[]
}

/**
 * 全局搜索函数
 */
export async function searchFunctions(
  userId: string,
  keyword: string,
  options: { limit?: number } = {}
): Promise<SearchResult[]> {
  const db = getDB()
  const { limit = 50 } = options

  if (!keyword || keyword.length < 2) {
    return []
  }

  const regex = new RegExp(keyword, 'gi')
  const results: SearchResult[] = []

  // 搜索函数
  const functions = await db.collection<CloudFunction>('functions')
    .find({
      userId: new ObjectId(userId),
      $or: [
        { name: regex },
        { code: regex },
      ],
    })
    .limit(limit)
    .toArray()

  for (const fn of functions) {
    // 检查名称匹配
    if (regex.test(fn.name)) {
      const match = fn.name.match(new RegExp(keyword, 'gi'))
      const index = fn.name.toLowerCase().indexOf(keyword.toLowerCase())

      results.push({
        _id: fn._id!.toString(),
        name: fn.name,
        type: 'function',
        matchType: 'name',
        highlights: match ? [{ start: index, end: index + keyword.length }] : [],
      })
    }

    // 检查代码匹配
    if (fn.code) {
      const lines = fn.code.split('\n')
      const codeRegex = new RegExp(keyword, 'gi')

      for (let i = 0; i < lines.length; i++) {
        if (codeRegex.test(lines[i])) {
          const index = lines[i].toLowerCase().indexOf(keyword.toLowerCase())

          // 避免重复添加（如果名称已经匹配了）
          const existingResult = results.find(
            r => r._id === fn._id!.toString() && r.matchType === 'name'
          )

          if (!existingResult) {
            results.push({
              _id: fn._id!.toString(),
              name: fn.name,
              type: 'function',
              matchType: 'code',
              matchedLine: lines[i].trim().substring(0, 100),
              lineNumber: i + 1,
              highlights: [{ start: index, end: index + keyword.length }],
            })
          }

          // 每个函数最多显示 3 个代码匹配
          const codeMatches = results.filter(
            r => r._id === fn._id!.toString() && r.matchType === 'code'
          )
          if (codeMatches.length >= 3) break
        }
      }
    }

    // 结果数量限制
    if (results.length >= limit) break
  }

  return results
}
