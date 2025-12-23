import { ObjectId } from 'mongodb'

export interface GitConfig {
  _id: ObjectId
  repoUrl: string
  branch: string
  token?: string
  functionsPath: string
  lastSyncAt?: Date
  userId: ObjectId
  createdAt: Date
  updatedAt: Date
}

export interface PullResult {
  added: string[]
  updated: string[]
  deleted: string[]
}

// 同步变更项
export interface SyncChange {
  name: string
  path: string  // 完整路径，包含文件夹 (如 "folder/test")
  status: 'added' | 'modified' | 'deleted' | 'conflict'
  localCode?: string
  remoteCode?: string
  localUpdatedAt?: Date
  remoteUpdatedAt?: Date
}

// 预览结果
export interface SyncPreview {
  changes: SyncChange[]
  hasConflicts: boolean
}
