import { create } from 'zustand'
import { storageApi, type S3ConfigStatus, type ObjectInfo } from '../api/storage'

export interface UploadTask {
  id: string
  file: File
  key: string
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

interface StorageState {
  // 配置状态
  configStatus: S3ConfigStatus | null
  configLoading: boolean

  // 当前存储桶 (使用环境变量配置的默认桶)
  currentBucket: string | null

  // 对象
  objects: ObjectInfo[]
  currentPath: string
  objectsLoading: boolean
  selectedKeys: string[]
  continuationToken?: string
  hasMore: boolean

  // 上传
  uploadTasks: UploadTask[]
  uploaderVisible: boolean

  // 预览
  previewObject: ObjectInfo | null

  // Actions - 配置
  refreshConfigStatus: () => Promise<void>

  // Actions - 存储桶
  setCurrentBucket: (name: string | null) => void

  // Actions - 对象
  refreshObjects: () => Promise<void>
  loadMoreObjects: () => Promise<void>
  navigateTo: (path: string) => void
  navigateUp: () => void
  toggleSelectKey: (key: string) => void
  clearSelection: () => void
  deleteSelected: () => Promise<void>
  createFolder: (name: string) => Promise<void>

  // Actions - 上传
  addUploadTask: (file: File, key: string) => void
  removeUploadTask: (id: string) => void
  startUpload: (id: string) => Promise<void>
  setUploaderVisible: (visible: boolean) => void
  clearCompletedUploads: () => void

  // Actions - 预览
  setPreviewObject: (obj: ObjectInfo | null) => void
}

export const useStorageStore = create<StorageState>((set, get) => ({
  // 初始状态
  configStatus: null,
  configLoading: false,

  currentBucket: null,

  objects: [],
  currentPath: '',
  objectsLoading: false,
  selectedKeys: [],
  continuationToken: undefined,
  hasMore: false,

  uploadTasks: [],
  uploaderVisible: false,

  previewObject: null,

  // ========== 配置操作 ==========

  refreshConfigStatus: async () => {
    set({ configLoading: true })
    try {
      const res = await storageApi.getConfigStatus()
      if (res.data.success) {
        set({ configStatus: res.data.data })
      }
    } catch (err) {
      console.error('获取 S3 配置状态失败:', err)
    } finally {
      set({ configLoading: false })
    }
  },

  // ========== 存储桶操作 ==========

  setCurrentBucket: (name) => {
    set({
      currentBucket: name,
      currentPath: '',
      objects: [],
      selectedKeys: [],
      continuationToken: undefined,
      hasMore: false,
    })
    if (name) {
      get().refreshObjects()
    }
  },

  // ========== 对象操作 ==========

  refreshObjects: async () => {
    const { currentBucket, currentPath } = get()
    if (!currentBucket) return

    set({ objectsLoading: true, selectedKeys: [] })
    try {
      const res = await storageApi.listObjects(currentBucket, currentPath || undefined)
      if (res.data.success) {
        set({
          objects: res.data.data.objects,
          hasMore: res.data.data.isTruncated,
          continuationToken: res.data.data.nextContinuationToken,
        })
      }
    } catch (err) {
      console.error('获取对象列表失败:', err)
    } finally {
      set({ objectsLoading: false })
    }
  },

  loadMoreObjects: async () => {
    const { currentBucket, currentPath, continuationToken, hasMore, objects } = get()
    if (!currentBucket || !hasMore || !continuationToken) return

    set({ objectsLoading: true })
    try {
      const res = await storageApi.listObjects(currentBucket, currentPath || undefined, continuationToken)
      if (res.data.success) {
        set({
          objects: [...objects, ...res.data.data.objects],
          hasMore: res.data.data.isTruncated,
          continuationToken: res.data.data.nextContinuationToken,
        })
      }
    } catch (err) {
      console.error('加载更多对象失败:', err)
    } finally {
      set({ objectsLoading: false })
    }
  },

  navigateTo: (path) => {
    set({
      currentPath: path,
      objects: [],
      selectedKeys: [],
      continuationToken: undefined,
      hasMore: false,
    })
    get().refreshObjects()
  },

  navigateUp: () => {
    const { currentPath } = get()
    if (!currentPath) return

    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    const newPath = parts.length > 0 ? parts.join('/') + '/' : ''

    get().navigateTo(newPath)
  },

  toggleSelectKey: (key) => {
    const { selectedKeys } = get()
    if (selectedKeys.includes(key)) {
      set({ selectedKeys: selectedKeys.filter((k) => k !== key) })
    } else {
      set({ selectedKeys: [...selectedKeys, key] })
    }
  },

  clearSelection: () => set({ selectedKeys: [] }),

  deleteSelected: async () => {
    const { currentBucket, selectedKeys } = get()
    if (!currentBucket || selectedKeys.length === 0) return

    await storageApi.deleteObjects(currentBucket, selectedKeys)
    set({ selectedKeys: [] })
    await get().refreshObjects()
  },

  createFolder: async (name) => {
    const { currentBucket, currentPath } = get()
    if (!currentBucket) throw new Error('未选择存储桶')

    const prefix = currentPath + name
    await storageApi.createFolder(currentBucket, prefix)
    await get().refreshObjects()
  },

  // ========== 上传操作 ==========

  addUploadTask: (file, key) => {
    const task: UploadTask = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      key,
      progress: 0,
      status: 'pending',
    }
    set({ uploadTasks: [...get().uploadTasks, task] })
  },

  removeUploadTask: (id) => {
    set({ uploadTasks: get().uploadTasks.filter((t) => t.id !== id) })
  },

  startUpload: async (id) => {
    const { currentBucket, uploadTasks } = get()
    if (!currentBucket) return

    const task = uploadTasks.find((t) => t.id === id)
    if (!task || task.status !== 'pending') return

    set({
      uploadTasks: uploadTasks.map((t) =>
        t.id === id ? { ...t, status: 'uploading' as const } : t
      ),
    })

    try {
      await storageApi.uploadFile(currentBucket, task.key, task.file, (progress) => {
        set({
          uploadTasks: get().uploadTasks.map((t) =>
            t.id === id ? { ...t, progress } : t
          ),
        })
      })

      set({
        uploadTasks: get().uploadTasks.map((t) =>
          t.id === id ? { ...t, status: 'done' as const, progress: 100 } : t
        ),
      })

      await get().refreshObjects()
    } catch (err) {
      set({
        uploadTasks: get().uploadTasks.map((t) =>
          t.id === id
            ? { ...t, status: 'error' as const, error: err instanceof Error ? err.message : '上传失败' }
            : t
        ),
      })
    }
  },

  setUploaderVisible: (visible) => set({ uploaderVisible: visible }),

  clearCompletedUploads: () => {
    set({
      uploadTasks: get().uploadTasks.filter((t) => t.status !== 'done'),
    })
  },

  // ========== 预览操作 ==========

  setPreviewObject: (obj) => set({ previewObject: obj }),
}))
