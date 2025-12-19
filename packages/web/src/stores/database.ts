import { create } from 'zustand'
import { databaseApi, type CollectionInfo, type Document, type IndexInfo } from '../api/database'

export type DocumentViewMode = 'list' | 'table' | 'json'

interface DatabaseState {
  // 集合
  collections: CollectionInfo[]
  currentCollection: string | null
  collectionsLoading: boolean
  collectionSearch: string

  // 文档
  documents: Document[]
  total: number
  page: number
  pageSize: number
  query: Record<string, unknown>
  documentsLoading: boolean
  viewMode: DocumentViewMode

  // 当前编辑的文档
  currentDocument: Document | null
  editingDocument: Record<string, unknown> | null

  // 索引
  indexes: IndexInfo[]
  indexesLoading: boolean

  // Actions
  setCurrentCollection: (name: string | null) => void
  setCollectionSearch: (search: string) => void
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  setQuery: (query: Record<string, unknown>) => void
  setViewMode: (mode: DocumentViewMode) => void
  setCurrentDocument: (doc: Document | null) => void
  setEditingDocument: (doc: Record<string, unknown> | null) => void

  // 集合操作
  refreshCollections: () => Promise<void>
  createCollection: (name: string) => Promise<void>
  dropCollection: (name: string) => Promise<void>

  // 文档操作
  refreshDocuments: () => Promise<void>
  insertDocument: (doc: Record<string, unknown>) => Promise<Document>
  updateDocument: (id: string, doc: Record<string, unknown>) => Promise<void>
  deleteDocument: (id: string) => Promise<void>
  deleteDocuments: (ids: string[]) => Promise<number>

  // 索引操作
  refreshIndexes: () => Promise<void>
  createIndex: (keys: Record<string, 1 | -1>, options?: { unique?: boolean; sparse?: boolean; name?: string }) => Promise<void>
  dropIndex: (indexName: string) => Promise<void>
}

export const useDatabaseStore = create<DatabaseState>((set, get) => ({
  // 初始状态
  collections: [],
  currentCollection: null,
  collectionsLoading: false,
  collectionSearch: '',

  documents: [],
  total: 0,
  page: 1,
  pageSize: 20,
  query: {},
  documentsLoading: false,
  viewMode: 'list',

  currentDocument: null,
  editingDocument: null,

  indexes: [],
  indexesLoading: false,

  // Setters
  setCurrentCollection: (name) => {
    set({ currentCollection: name, page: 1, query: {}, documents: [], total: 0, currentDocument: null })
    if (name) {
      get().refreshDocuments()
      get().refreshIndexes()
    }
  },

  setCollectionSearch: (search) => set({ collectionSearch: search }),

  setPage: (page) => {
    set({ page })
    get().refreshDocuments()
  },

  setPageSize: (pageSize) => {
    set({ pageSize, page: 1 })
    get().refreshDocuments()
  },

  setQuery: (query) => {
    set({ query, page: 1 })
    get().refreshDocuments()
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  setCurrentDocument: (doc) => set({ currentDocument: doc }),
  setEditingDocument: (doc) => set({ editingDocument: doc }),

  // 集合操作
  refreshCollections: async () => {
    set({ collectionsLoading: true })
    try {
      const res = await databaseApi.listCollections()
      if (res.data.success) {
        set({ collections: res.data.data })
      }
    } catch (err) {
      console.error('获取集合列表失败:', err)
    } finally {
      set({ collectionsLoading: false })
    }
  },

  createCollection: async (name) => {
    await databaseApi.createCollection(name)
    await get().refreshCollections()
  },

  dropCollection: async (name) => {
    await databaseApi.dropCollection(name)
    if (get().currentCollection === name) {
      set({ currentCollection: null, documents: [], total: 0 })
    }
    await get().refreshCollections()
  },

  // 文档操作
  refreshDocuments: async () => {
    const { currentCollection, page, pageSize, query } = get()
    if (!currentCollection) return

    set({ documentsLoading: true })
    try {
      const res = await databaseApi.findDocuments(currentCollection, {
        query: Object.keys(query).length > 0 ? query : undefined,
        skip: (page - 1) * pageSize,
        limit: pageSize,
      })
      if (res.data.success) {
        set({
          documents: res.data.data.documents,
          total: res.data.data.total,
        })
      }
    } catch (err) {
      console.error('获取文档失败:', err)
    } finally {
      set({ documentsLoading: false })
    }
  },

  insertDocument: async (doc) => {
    const { currentCollection } = get()
    if (!currentCollection) throw new Error('未选择集合')

    const res = await databaseApi.insertDocument(currentCollection, doc)
    if (res.data.success) {
      await get().refreshDocuments()
      await get().refreshCollections() // 更新文档数量
      return res.data.data
    }
    throw new Error(res.data.error?.message || '插入失败')
  },

  updateDocument: async (id, doc) => {
    const { currentCollection } = get()
    if (!currentCollection) throw new Error('未选择集合')

    const res = await databaseApi.replaceDocument(currentCollection, id, doc)
    if (res.data.success) {
      await get().refreshDocuments()
      set({ currentDocument: res.data.data })
    } else {
      throw new Error(res.data.error?.message || '更新失败')
    }
  },

  deleteDocument: async (id) => {
    const { currentCollection, currentDocument } = get()
    if (!currentCollection) throw new Error('未选择集合')

    await databaseApi.deleteDocument(currentCollection, id)
    if (currentDocument?._id === id) {
      set({ currentDocument: null })
    }
    await get().refreshDocuments()
    await get().refreshCollections() // 更新文档数量
  },

  deleteDocuments: async (ids) => {
    const { currentCollection, currentDocument } = get()
    if (!currentCollection) throw new Error('未选择集合')

    const res = await databaseApi.deleteDocuments(currentCollection, ids)
    if (res.data.success) {
      if (currentDocument && ids.includes(currentDocument._id)) {
        set({ currentDocument: null })
      }
      await get().refreshDocuments()
      await get().refreshCollections()
      return res.data.data.deletedCount
    }
    return 0
  },

  // 索引操作
  refreshIndexes: async () => {
    const { currentCollection } = get()
    if (!currentCollection) return

    set({ indexesLoading: true })
    try {
      const res = await databaseApi.listIndexes(currentCollection)
      if (res.data.success) {
        set({ indexes: res.data.data })
      }
    } catch (err) {
      console.error('获取索引失败:', err)
    } finally {
      set({ indexesLoading: false })
    }
  },

  createIndex: async (keys, options) => {
    const { currentCollection } = get()
    if (!currentCollection) throw new Error('未选择集合')

    await databaseApi.createIndex(currentCollection, keys, options)
    await get().refreshIndexes()
  },

  dropIndex: async (indexName) => {
    const { currentCollection } = get()
    if (!currentCollection) throw new Error('未选择集合')

    await databaseApi.dropIndex(currentCollection, indexName)
    await get().refreshIndexes()
  },
}))
