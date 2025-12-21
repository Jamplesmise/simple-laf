/**
 * Canvas 模式类型定义 (Sprint 11.2)
 */

import type { ObjectId } from 'mongodb'

// 代码快照
export interface CodeSnapshot {
  _id?: ObjectId
  conversationId: ObjectId     // 所属对话
  messageId?: ObjectId         // 关联消息（AI 生成时）
  functionId?: ObjectId        // 关联函数（可选）
  version: number              // 版本号
  code: string                 // 代码内容
  language?: string            // 语言类型
  description?: string         // 版本描述
  createdAt: Date
}

// 快照列表项
export interface SnapshotListItem {
  id: string
  version: number
  description?: string
  createdAt: Date
  codePreview?: string         // 代码预览（前100字符）
}

// 创建快照请求
export interface CreateSnapshotRequest {
  functionId?: string
  messageId?: string
  code: string
  language?: string
  description?: string
}

// 创建快照响应
export interface CreateSnapshotResponse {
  id: string
  version: number
}

// 应用代码请求
export interface ApplyCodeRequest {
  snapshotId: string
  functionId: string
}

// Diff 变更类型
export type DiffChangeType = 'add' | 'remove' | 'equal'

// Diff 变更项
export interface DiffChange {
  type: DiffChangeType
  content: string
  lineStart: number
  lineEnd: number
}

// Diff 统计
export interface DiffStats {
  added: number                // 新增行数
  removed: number              // 删除行数
  modified: number             // 修改行数
}

// Diff 计算结果
export interface DiffResult {
  changes: DiffChange[]
  stats: DiffStats
}

// 快照对比请求
export interface CompareSnapshotsRequest {
  baseSnapshotId?: string      // 基准版本（空则用函数当前代码）
  targetSnapshotId: string     // 目标版本
}

// 快照对比响应
export interface CompareSnapshotsResponse {
  diff: DiffResult
  baseCode: string
  targetCode: string
}
