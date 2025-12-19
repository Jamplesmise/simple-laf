/**
 * DatabasePanel 工具函数
 */

import type { Document } from '@/api/database'
import type { Theme } from '@/styles/tokens'

/**
 * 获取文档摘要 (第一个非 _id 的 key-value)
 */
export function getDocumentSummary(doc: Document): { key: string; value: string } | null {
  const keys = Object.keys(doc).filter(k => k !== '_id')
  if (keys.length === 0) return null

  const key = keys[0]
  const value = doc[key]
  const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value)

  return {
    key,
    value: valueStr.length > 30 ? valueStr.slice(0, 30) + '...' : valueStr,
  }
}

/**
 * 动态生成文档列 (用于表格视图)
 */
export function getDocumentColumns(documents: Document[], t: Theme) {
  if (documents.length === 0) return []

  const firstDoc = documents[0]
  const fields = Object.keys(firstDoc).filter(k => k !== '_id').slice(0, 3)

  return fields.map(field => ({
    title: field,
    dataIndex: field,
    key: field,
    width: 140,
    ellipsis: true,
    render: (value: unknown) => {
      if (value === null) {
        return { props: { style: { color: t.textMuted } }, children: 'null' }
      }
      if (value === undefined) {
        return { props: { style: { color: t.textMuted } }, children: '-' }
      }
      if (typeof value === 'object') {
        return {
          props: { style: { fontFamily: 'monospace', fontSize: 11, color: t.textSecondary } },
          children: JSON.stringify(value).slice(0, 20) + '...',
        }
      }
      return { props: { style: { color: t.text } }, children: String(value) }
    },
  }))
}

/**
 * 代码字体
 */
export const codeFont = 'JetBrains Mono, Menlo, Monaco, Consolas, monospace'
