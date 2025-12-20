import { create } from 'zustand'
import { siteApi, siteFileApi, Site, SiteFile, SiteStats } from '../api/site'

interface SiteState {
  // 站点配置
  site: Site | null
  stats: SiteStats | null
  loading: boolean

  // 文件管理
  files: SiteFile[]
  currentFile: SiteFile | null
  fileContent: string
  openFiles: SiteFile[]
  filesLoading: boolean

  // 预览
  previewUrl: string | null
  previewDevice: 'desktop' | 'tablet' | 'mobile'
  autoRefresh: boolean

  // 操作
  fetchSite: () => Promise<void>
  updateSite: (updates: Partial<Site>) => Promise<void>
  fetchStats: () => Promise<void>
  fetchFiles: () => Promise<void>
  selectFile: (file: SiteFile) => Promise<void>
  fetchContent: (path: string) => Promise<void>
  setFileContent: (content: string) => void
  saveFile: () => Promise<void>
  createFile: (path: string, content?: string) => Promise<void>
  createFolder: (path: string) => Promise<void>
  deleteFile: (path: string) => Promise<void>
  renameFile: (from: string, to: string) => Promise<void>
  uploadFiles: (path: string, files: FileList | File[]) => Promise<void>
  closeFile: (path: string) => void
  refreshPreview: () => void
  setPreviewDevice: (device: 'desktop' | 'tablet' | 'mobile') => void
  setAutoRefresh: (value: boolean) => void
}

export const useSiteStore = create<SiteState>((set, get) => ({
  // 初始状态
  site: null,
  stats: null,
  loading: false,
  files: [],
  currentFile: null,
  fileContent: '',
  openFiles: [],
  filesLoading: false,
  previewUrl: null,
  previewDevice: 'desktop',
  autoRefresh: true,

  // 获取站点配置
  fetchSite: async () => {
    set({ loading: true })
    try {
      const res = await siteApi.get()
      set({ site: res.data.data })
    } finally {
      set({ loading: false })
    }
  },

  // 更新站点配置
  updateSite: async (updates) => {
    const res = await siteApi.update(updates)
    set({ site: res.data.data })
  },

  // 获取统计
  fetchStats: async () => {
    const res = await siteApi.getStats()
    set({ stats: res.data.data })
  },

  // 获取文件列表
  fetchFiles: async () => {
    set({ filesLoading: true })
    try {
      const res = await siteFileApi.list('/', true)
      set({ files: res.data.data || [] })
    } finally {
      set({ filesLoading: false })
    }
  },

  // 选择文件
  selectFile: async (file) => {
    if (file.isDirectory) return

    set({ filesLoading: true })
    try {
      const res = await siteFileApi.getContent(file.path)
      const data = res.data.data

      set({
        currentFile: data.file,
        fileContent: data.content || '',
      })

      // 添加到打开的文件列表
      const { openFiles } = get()
      if (!openFiles.find((f) => f.path === file.path)) {
        set({ openFiles: [...openFiles, data.file] })
      }
    } finally {
      set({ filesLoading: false })
    }
  },

  // 获取文件内容 (用于刷新)
  fetchContent: async (path) => {
    try {
      const res = await siteFileApi.getContent(path)
      const data = res.data.data
      set({
        currentFile: data.file,
        fileContent: data.content || '',
      })
    } catch {
      // 静默失败
    }
  },

  // 设置文件内容
  setFileContent: (content) => {
    set({ fileContent: content })
  },

  // 保存文件
  saveFile: async () => {
    const { currentFile, fileContent, autoRefresh, refreshPreview, fetchStats } = get()
    if (!currentFile) return

    await siteFileApi.save(currentFile.path, fileContent)

    // 更新打开的文件列表中的内容
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === currentFile.path ? { ...f, updatedAt: new Date().toISOString() } : f
      ),
    }))

    // 刷新统计
    fetchStats()

    // 自动刷新预览
    if (autoRefresh) {
      refreshPreview()
    }
  },

  // 创建文件
  createFile: async (path, content = '') => {
    await siteFileApi.save(path, content)
    await get().fetchFiles()
    await get().fetchStats()
  },

  // 创建文件夹
  createFolder: async (path) => {
    await siteFileApi.createDirectory(path)
    await get().fetchFiles()
  },

  // 删除文件
  deleteFile: async (path) => {
    await siteFileApi.delete(path)
    await get().fetchFiles()
    await get().fetchStats()

    // 如果删除的是当前文件，清空编辑器
    const { currentFile, openFiles } = get()
    if (currentFile?.path === path) {
      const newOpenFiles = openFiles.filter((f) => f.path !== path)
      const newCurrent = newOpenFiles[newOpenFiles.length - 1] || null
      set({
        openFiles: newOpenFiles,
        currentFile: newCurrent,
        fileContent: '',
      })
      if (newCurrent) {
        get().selectFile(newCurrent)
      }
    } else {
      set({ openFiles: openFiles.filter((f) => f.path !== path) })
    }
  },

  // 重命名文件
  renameFile: async (from, to) => {
    await siteFileApi.move(from, to)
    await get().fetchFiles()

    // 更新打开的文件
    const { currentFile, openFiles } = get()
    if (currentFile?.path === from) {
      const res = await siteFileApi.getContent(to)
      set({
        currentFile: res.data.data.file,
        fileContent: res.data.data.content || '',
        openFiles: openFiles.map((f) =>
          f.path === from ? res.data.data.file : f
        ),
      })
    }
  },

  // 上传文件
  uploadFiles: async (path, files) => {
    await siteFileApi.upload(path, files)
    await get().fetchFiles()
    await get().fetchStats()
  },

  // 关闭文件
  closeFile: (path) => {
    const { openFiles, currentFile } = get()
    const newOpenFiles = openFiles.filter((f) => f.path !== path)

    if (currentFile?.path === path) {
      const newCurrent = newOpenFiles[newOpenFiles.length - 1] || null
      set({
        openFiles: newOpenFiles,
        currentFile: newCurrent,
        fileContent: '',
      })
      if (newCurrent) {
        get().selectFile(newCurrent)
      }
    } else {
      set({ openFiles: newOpenFiles })
    }
  },

  // 刷新预览
  refreshPreview: () => {
    const { site } = get()
    if (site) {
      set({ previewUrl: `/site/${site.userId}/?t=${Date.now()}` })
    }
  },

  // 设置预览设备
  setPreviewDevice: (device) => {
    set({ previewDevice: device })
  },

  // 设置自动刷新
  setAutoRefresh: (value) => {
    set({ autoRefresh: value })
  },
}))
