import client from './client'

export interface Dependency {
  _id: string
  name: string
  version: string
  status: 'pending' | 'installing' | 'installed' | 'failed'
  error?: string
  createdAt: string
  installedAt?: string
}

export interface PackageVersions {
  name: string
  versions: string[]
  latest: string
}

export interface PackageInfo {
  name: string
  version: string
  description?: string
}

interface ListResponse {
  success: boolean
  data: Dependency[]
}

interface SingleResponse {
  success: boolean
  data: Dependency
}

interface VersionsResponse {
  success: boolean
  data: PackageVersions
}

interface SearchResponse {
  success: boolean
  data: PackageInfo[]
}

export const dependencyApi = {
  /**
   * 获取依赖列表
   */
  list: () => client.get<ListResponse>('/api/dependencies'),

  /**
   * 添加依赖
   */
  add: (name: string, version?: string) =>
    client.post<SingleResponse>('/api/dependencies', { name, version }),

  /**
   * 获取依赖安装状态
   */
  getStatus: (name: string) =>
    client.get<SingleResponse>(`/api/dependencies/${name}/status`),

  /**
   * 删除依赖
   */
  remove: (name: string) =>
    client.delete<{ success: boolean }>(`/api/dependencies/${name}`),

  /**
   * 获取包的可用版本列表
   */
  getVersions: (name: string) =>
    client.get<VersionsResponse>(`/api/dependencies/${name}/versions`),

  /**
   * 搜索包
   */
  search: (query: string) =>
    client.get<SearchResponse>('/api/dependencies/search', { params: { q: query } }),
}
