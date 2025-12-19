import client from './client'

export interface GitConfig {
  configured: boolean
  repoUrl?: string
  branch?: string
  functionsPath?: string
  lastSyncAt?: string
  hasToken?: boolean
}

export interface PullResult {
  added: string[]
  updated: string[]
  deleted: string[]
}

// 同步变更项
export interface SyncChange {
  name: string
  status: 'added' | 'modified' | 'deleted' | 'conflict'
  localCode?: string
  remoteCode?: string
  localUpdatedAt?: string
  remoteUpdatedAt?: string
}

// 预览结果
export interface SyncPreview {
  changes: SyncChange[]
  hasConflicts: boolean
}

interface ConfigResponse {
  success: boolean
  data: GitConfig
}

interface PullResponse {
  success: boolean
  data: PullResult
}

interface StatusResponse {
  success: boolean
  data: {
    configured: boolean
    lastSyncAt?: string
  }
}

interface PreviewResponse {
  success: boolean
  data: SyncPreview
}

export const gitApi = {
  // 获取 Git 配置
  getConfig: () => client.get<ConfigResponse>('/api/git/config'),

  // 保存 Git 配置
  saveConfig: (config: {
    repoUrl: string
    branch: string
    token?: string
    functionsPath: string
  }) => client.put<{ success: boolean }>('/api/git/config', config),

  // 预览拉取
  previewPull: () => client.get<PreviewResponse>('/api/git/preview-pull'),

  // 预览推送
  previewPush: () => client.get<PreviewResponse>('/api/git/preview-push'),

  // 从 Git 拉取 (可选择性拉取)
  pull: (functions?: string[]) =>
    client.post<PullResponse>('/api/git/pull', { functions }),

  // 推送到 Git (可选择性推送)
  push: (message?: string, functions?: string[]) =>
    client.post<{ success: boolean }>('/api/git/push', { message, functions }),

  // 获取同步状态
  getStatus: () => client.get<StatusResponse>('/api/git/status'),
}
