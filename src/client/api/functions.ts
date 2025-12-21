import client from './client'
import type { CloudFunction } from '../stores/function'

interface ListResponse {
  success: boolean
  data: CloudFunction[]
}

interface SingleResponse {
  success: boolean
  data: CloudFunction
}

export interface FunctionVersion {
  version: number
  changelog: string
  createdAt: string
  code?: string
}

interface VersionListResponse {
  success: boolean
  data: FunctionVersion[]
}

interface VersionDetailResponse {
  success: boolean
  data: FunctionVersion
}

interface VersionDiffResponse {
  success: boolean
  data: {
    from: { version: number; code: string; changelog: string }
    to: { version: number; code: string; changelog: string }
  }
}

// 测试输入类型 (Sprint 19)
export interface TestInput {
  method: string
  body: string
  query: string
  headers: string
  updatedAt?: string
}

interface TestInputResponse {
  success: boolean
  data: TestInput | null
}

interface PublishResponse {
  success: boolean
  data: {
    version: number
    url: string
    publishedAt: string
  }
}

export const functionApi = {
  list: () => client.get<ListResponse>('/api/functions'),

  get: (id: string) => client.get<SingleResponse>(`/api/functions/${id}`),

  create: (name: string, code: string, folderId?: string) =>
    client.post<SingleResponse>('/api/functions', { name, code, folderId }),

  update: (id: string, code: string) =>
    client.put<{ success: boolean }>(`/api/functions/${id}`, { code }),

  remove: (id: string) =>
    client.delete<{ success: boolean }>(`/api/functions/${id}`),

  compile: (id: string) =>
    client.post<{ success: boolean; data: { compiled: string } }>(
      `/api/functions/${id}/compile`
    ),

  publish: (id: string, changelog?: string) =>
    client.post<PublishResponse>(
      `/api/functions/${id}/publish`,
      { changelog }
    ),

  // 版本相关 API
  getVersions: (id: string) =>
    client.get<VersionListResponse>(`/api/functions/${id}/versions`),

  getVersion: (id: string, version: number) =>
    client.get<VersionDetailResponse>(`/api/functions/${id}/versions/${version}`),

  getVersionDiff: (id: string, from: number, to: number) =>
    client.get<VersionDiffResponse>(
      `/api/functions/${id}/versions/diff?from=${from}&to=${to}`
    ),

  rollback: (id: string, version: number) =>
    client.post<{ success: boolean; data: { version: number; message: string } }>(
      `/api/functions/${id}/rollback`,
      { version }
    ),

  rename: (id: string, name: string) =>
    client.post<{ success: boolean; data: { newName: string; newPath: string; newUrl: string } }>(
      `/api/functions/${id}/rename`,
      { name }
    ),

  // 测试输入 API (Sprint 19)
  getTestInput: (id: string) =>
    client.get<TestInputResponse>(`/api/functions/${id}/test-input`),

  saveTestInput: (id: string, input: Omit<TestInput, 'updatedAt'>) =>
    client.put<{ success: boolean }>(`/api/functions/${id}/test-input`, input),
}
