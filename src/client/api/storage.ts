import client from './client'

// ==================== 类型定义 ====================

export interface S3ConfigStatus {
  configured: boolean
  endpoint?: string
  bucket?: string
  region?: string
}

export interface BucketInfo {
  name: string
  creationDate?: string
}

export interface ObjectInfo {
  key: string
  size: number
  lastModified: string
  isFolder: boolean
  etag?: string
}

export interface ListObjectsResult {
  objects: ObjectInfo[]
  prefixes: string[]
  isTruncated: boolean
  nextContinuationToken?: string
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

export const storageApi = {
  // ========== 配置状态 ==========

  /** 获取 S3 配置状态 (只读) */
  getConfigStatus: () =>
    client.get<ApiResponse<S3ConfigStatus>>('/api/storage/config'),

  /** 测试 S3 连接 */
  testConnection: () =>
    client.post<ApiResponse<{ message: string }>>('/api/storage/config/test'),

  // ========== 存储桶操作 ==========

  /** 获取存储桶列表 */
  listBuckets: () =>
    client.get<ApiResponse<BucketInfo[]>>('/api/storage/buckets'),

  /** 创建存储桶 */
  createBucket: (name: string) =>
    client.post<ApiResponse<void>>('/api/storage/buckets', { name }),

  /** 删除存储桶 */
  deleteBucket: (name: string) =>
    client.delete<ApiResponse<void>>(`/api/storage/buckets/${encodeURIComponent(name)}`),

  // ========== 对象操作 ==========

  /** 列出对象 */
  listObjects: (bucket: string, prefix?: string, continuationToken?: string, maxKeys?: number) => {
    const params = new URLSearchParams()
    params.set('bucket', bucket)
    if (prefix) params.set('prefix', prefix)
    if (continuationToken) params.set('continuationToken', continuationToken)
    if (maxKeys) params.set('maxKeys', String(maxKeys))
    return client.get<ApiResponse<ListObjectsResult>>(`/api/storage/objects?${params.toString()}`)
  },

  /** 上传文件 */
  uploadFile: (bucket: string, key: string, file: File, onProgress?: (percent: number) => void) => {
    const formData = new FormData()
    formData.append('bucket', bucket)
    formData.append('key', key)
    formData.append('file', file)

    return client.post<ApiResponse<void>>('/api/storage/objects/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percent)
        }
      },
    })
  },

  /** 下载文件 (返回 blob URL) */
  downloadFile: async (bucket: string, key: string): Promise<string> => {
    const params = new URLSearchParams()
    params.set('bucket', bucket)
    params.set('key', key)
    const response = await client.get(`/api/storage/objects/download?${params.toString()}`, {
      responseType: 'blob',
    })
    return URL.createObjectURL(response.data)
  },

  /** 删除对象 */
  deleteObjects: (bucket: string, keys: string[]) =>
    client.post<ApiResponse<void>>('/api/storage/objects/delete', { bucket, keys }),

  /** 创建文件夹 */
  createFolder: (bucket: string, prefix: string) =>
    client.post<ApiResponse<void>>('/api/storage/objects/folder', { bucket, prefix }),

  /** 获取预签名下载 URL */
  getPresignedUrl: (bucket: string, key: string, expiresIn?: number) => {
    const params = new URLSearchParams()
    params.set('bucket', bucket)
    params.set('key', key)
    if (expiresIn) params.set('expiresIn', String(expiresIn))
    return client.get<ApiResponse<{ url: string }>>(`/api/storage/objects/presigned?${params.toString()}`)
  },
}
