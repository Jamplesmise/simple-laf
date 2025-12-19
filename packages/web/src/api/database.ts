import client from './client'

// ==================== 类型定义 ====================

export interface CollectionInfo {
  name: string
  type: string
  documentCount: number
}

export interface CollectionStats {
  name: string
  documentCount: number
  size: number
  avgDocSize: number
  indexCount: number
  totalIndexSize: number
}

export interface IndexInfo {
  name: string
  key: Record<string, number>
  unique: boolean
  sparse: boolean
  expireAfterSeconds?: number
  background?: boolean
}

export interface Document {
  _id: string
  [key: string]: unknown
}

export interface FindOptions {
  query?: Record<string, unknown>
  skip?: number
  limit?: number
  sort?: Record<string, 1 | -1>
}

export interface FindResult {
  documents: Document[]
  total: number
  skip: number
  limit: number
}

// ==================== API 响应类型 ====================

interface ApiResponse<T> {
  success: boolean
  data: T
  error?: {
    code: string
    message: string
  }
}

// ==================== API 方法 ====================

export const databaseApi = {
  // ========== 集合管理 ==========

  /** 获取集合列表 */
  listCollections: () =>
    client.get<ApiResponse<CollectionInfo[]>>('/api/database/collections'),

  /** 创建集合 */
  createCollection: (name: string) =>
    client.post<ApiResponse<void>>('/api/database/collections', { name }),

  /** 删除集合 */
  dropCollection: (name: string) =>
    client.delete<ApiResponse<void>>(`/api/database/collections/${encodeURIComponent(name)}`),

  /** 获取集合统计 */
  getCollectionStats: (name: string) =>
    client.get<ApiResponse<CollectionStats>>(`/api/database/collections/${encodeURIComponent(name)}/stats`),

  // ========== 文档管理 ==========

  /** 查询文档 */
  findDocuments: (collection: string, options: FindOptions = {}) => {
    const params = new URLSearchParams()
    if (options.query) params.set('query', JSON.stringify(options.query))
    if (options.skip !== undefined) params.set('skip', String(options.skip))
    if (options.limit !== undefined) params.set('limit', String(options.limit))
    if (options.sort) params.set('sort', JSON.stringify(options.sort))

    const queryString = params.toString()
    const url = `/api/database/collections/${encodeURIComponent(collection)}/documents${queryString ? `?${queryString}` : ''}`
    return client.get<ApiResponse<FindResult>>(url)
  },

  /** 获取单个文档 */
  findDocument: (collection: string, id: string) =>
    client.get<ApiResponse<Document>>(`/api/database/collections/${encodeURIComponent(collection)}/documents/${id}`),

  /** 插入文档 */
  insertDocument: (collection: string, doc: Record<string, unknown>) =>
    client.post<ApiResponse<Document>>(`/api/database/collections/${encodeURIComponent(collection)}/documents`, doc),

  /** 更新文档 (部分更新) */
  updateDocument: (collection: string, id: string, update: Record<string, unknown>) =>
    client.patch<ApiResponse<Document>>(`/api/database/collections/${encodeURIComponent(collection)}/documents/${id}`, update),

  /** 替换文档 (完整替换) */
  replaceDocument: (collection: string, id: string, doc: Record<string, unknown>) =>
    client.put<ApiResponse<Document>>(`/api/database/collections/${encodeURIComponent(collection)}/documents/${id}`, doc),

  /** 删除文档 */
  deleteDocument: (collection: string, id: string) =>
    client.delete<ApiResponse<void>>(`/api/database/collections/${encodeURIComponent(collection)}/documents/${id}`),

  /** 批量删除文档 */
  deleteDocuments: (collection: string, ids: string[]) =>
    client.post<ApiResponse<{ deletedCount: number }>>(`/api/database/collections/${encodeURIComponent(collection)}/documents/delete`, { ids }),

  // ========== 索引管理 ==========

  /** 获取索引列表 */
  listIndexes: (collection: string) =>
    client.get<ApiResponse<IndexInfo[]>>(`/api/database/collections/${encodeURIComponent(collection)}/indexes`),

  /** 创建索引 */
  createIndex: (
    collection: string,
    keys: Record<string, 1 | -1>,
    options?: { unique?: boolean; sparse?: boolean; expireAfterSeconds?: number; name?: string }
  ) =>
    client.post<ApiResponse<{ name: string }>>(`/api/database/collections/${encodeURIComponent(collection)}/indexes`, { keys, options }),

  /** 删除索引 */
  dropIndex: (collection: string, indexName: string) =>
    client.delete<ApiResponse<void>>(`/api/database/collections/${encodeURIComponent(collection)}/indexes/${encodeURIComponent(indexName)}`),
}
