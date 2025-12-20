import client from './client'

// ==================== 类型定义 ====================

export interface Site {
  _id: string
  userId: string
  name: string
  enabled: boolean
  defaultFile: string
  spaMode: boolean
  notFoundPage: string | null
  accessControl: {
    type: 'public' | 'login' | 'password'
    password?: string
    protectedPaths?: string[]
  }
  totalFiles: number
  totalSize: number
  features: {
    frameworkBuild: boolean
    maxStorage: number
    maxFileSize: number
  }
  createdAt: string
  updatedAt: string
}

export interface SiteFile {
  _id: string
  userId: string
  path: string
  name: string
  isDirectory: boolean
  size: number | null
  mimeType: string | null
  hash: string | null
  s3Key: string | null
  createdAt: string
  updatedAt: string
}

export interface SiteStats {
  totalFiles: number
  totalSize: number
  maxStorage: number
  usagePercent: number
  fileTypes: Record<string, number>
}

export interface SiteFileVersion {
  _id: string
  userId: string
  fileId: string
  filePath: string
  version: number
  versionName: string
  content: string
  size: number
  hash: string
  createdAt: string
}

export interface VersionStats {
  totalVersions: number
  totalSize: number
  fileCount: number
}

interface ApiResponse<T> {
  success: boolean
  data: T
  error?: { code: string; message: string }
}

// ==================== 站点配置 API ====================

export const siteApi = {
  /**
   * 获取站点配置
   */
  get: () => client.get<ApiResponse<Site>>('/api/site'),

  /**
   * 更新站点配置
   */
  update: (data: Partial<Site>) =>
    client.put<ApiResponse<Site>>('/api/site', data),

  /**
   * 获取站点统计
   */
  getStats: () => client.get<ApiResponse<SiteStats>>('/api/site/stats'),
}

// ==================== 文件管理 API ====================

export const siteFileApi = {
  /**
   * 获取文件列表
   */
  list: (path: string = '/', recursive: boolean = true) =>
    client.get<ApiResponse<SiteFile[]>>('/api/site/files', {
      params: { path, recursive },
    }),

  /**
   * 读取文件内容
   */
  getContent: (path: string) =>
    client.get<ApiResponse<{ file: SiteFile; content?: string; url?: string }>>(
      '/api/site/files/content',
      { params: { path } }
    ),

  /**
   * 创建/更新文件
   */
  save: (path: string, content: string, versionName?: string) =>
    client.post<ApiResponse<SiteFile>>('/api/site/files', { path, content, versionName }),

  /**
   * 创建目录
   */
  createDirectory: (path: string) =>
    client.post<ApiResponse<SiteFile>>('/api/site/files', {
      path,
      isDirectory: true,
    }),

  /**
   * 上传文件
   */
  upload: (targetPath: string, files: FileList | File[]) => {
    const formData = new FormData()
    formData.append('path', targetPath)
    for (const file of files) {
      formData.append('files', file)
    }
    return client.post<
      ApiResponse<{ uploaded: string[]; failed: { name: string; error: string }[] }>
    >('/api/site/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  /**
   * 删除文件/目录
   */
  delete: (path: string, recursive: boolean = true) =>
    client.delete<ApiResponse<void>>('/api/site/files', {
      params: { path, recursive },
    }),

  /**
   * 移动/重命名
   */
  move: (from: string, to: string) =>
    client.post<ApiResponse<SiteFile>>('/api/site/files/move', { from, to }),

  /**
   * 复制文件
   */
  copy: (from: string, to: string) =>
    client.post<ApiResponse<SiteFile>>('/api/site/files/copy', { from, to }),

  /**
   * 批量操作
   */
  batch: (
    action: 'delete' | 'move' | 'copy',
    items: { from: string; to?: string }[]
  ) =>
    client.post<
      ApiResponse<{ succeeded: string[]; failed: { path: string; error: string }[] }>
    >('/api/site/files/batch', { action, items }),
}

// ==================== 版本控制 API ====================

export const siteVersionApi = {
  /**
   * 获取文件的版本列表
   */
  list: (path: string) =>
    client.get<ApiResponse<SiteFileVersion[]>>('/api/site/files/versions', {
      params: { path },
    }),

  /**
   * 获取指定版本的内容
   */
  getContent: (path: string, version: number) =>
    client.get<ApiResponse<SiteFileVersion>>('/api/site/files/versions/content', {
      params: { path, version },
    }),

  /**
   * 创建新版本 (手动保存)
   */
  create: (path: string, content: string, versionName?: string) =>
    client.post<ApiResponse<SiteFileVersion>>('/api/site/files/versions', {
      path,
      content,
      versionName,
    }),

  /**
   * 更新版本名称
   */
  updateName: (versionId: string, versionName: string) =>
    client.put<ApiResponse<SiteFileVersion>>(`/api/site/files/versions/${versionId}`, {
      versionName,
    }),

  /**
   * 回滚到指定版本
   */
  rollback: (path: string, version: number) =>
    client.post<ApiResponse<SiteFile>>('/api/site/files/versions/rollback', {
      path,
      version,
    }),

  /**
   * 获取版本统计
   */
  getStats: () =>
    client.get<ApiResponse<VersionStats>>('/api/site/files/versions/stats'),
}
