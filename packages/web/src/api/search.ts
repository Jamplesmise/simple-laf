import client from './client'

const API_BASE = '/api/search'

export interface SearchResult {
  _id: string
  name: string
  type: 'function'
  matchType: 'name' | 'code'
  matchedLine?: string
  lineNumber?: number
  highlights?: { start: number; end: number }[]
}

export const searchApi = {
  // 全局搜索
  search: (q: string, limit?: number) =>
    client.get<{ success: boolean; data: SearchResult[] }>(API_BASE, {
      params: { q, limit },
    }),
}
