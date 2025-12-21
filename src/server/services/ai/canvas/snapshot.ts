/**
 * 代码快照服务 (Sprint 11.2.1)
 *
 * 管理 Canvas 模式下的代码快照
 */

import { ObjectId } from 'mongodb'
import { getDB } from '../../../db.js'
import type {
  CodeSnapshot,
  SnapshotListItem,
  CreateSnapshotRequest,
  CreateSnapshotResponse,
  DiffResult
} from './types.js'
import { calculateDiff } from './diff.js'

const COLLECTION_NAME = 'ai_code_snapshots'

/**
 * 获取对话的快照列表
 * @param conversationId 对话 ID
 * @param limit 返回数量限制
 * @returns 快照列表
 */
export async function getSnapshotList(
  conversationId: string,
  limit = 50
): Promise<SnapshotListItem[]> {
  const db = getDB()
  const snapshots = await db
    .collection<CodeSnapshot>(COLLECTION_NAME)
    .find({ conversationId: new ObjectId(conversationId) })
    .sort({ version: -1 })
    .limit(limit)
    .toArray()

  return snapshots.map((s) => ({
    id: s._id!.toString(),
    version: s.version,
    description: s.description,
    createdAt: s.createdAt,
    codePreview: s.code.slice(0, 100) + (s.code.length > 100 ? '...' : '')
  }))
}

/**
 * 获取快照详情
 * @param snapshotId 快照 ID
 * @returns 快照详情
 */
export async function getSnapshot(snapshotId: string): Promise<CodeSnapshot | null> {
  const db = getDB()
  return db.collection<CodeSnapshot>(COLLECTION_NAME).findOne({
    _id: new ObjectId(snapshotId)
  })
}

/**
 * 获取对话的最新快照
 * @param conversationId 对话 ID
 * @returns 最新快照
 */
export async function getLatestSnapshot(conversationId: string): Promise<CodeSnapshot | null> {
  const db = getDB()
  const snapshots = await db
    .collection<CodeSnapshot>(COLLECTION_NAME)
    .find({ conversationId: new ObjectId(conversationId) })
    .sort({ version: -1 })
    .limit(1)
    .toArray()

  return snapshots[0] || null
}

/**
 * 创建代码快照
 * @param conversationId 对话 ID
 * @param request 快照内容
 * @returns 创建结果
 */
export async function createSnapshot(
  conversationId: string,
  request: CreateSnapshotRequest
): Promise<CreateSnapshotResponse> {
  const db = getDB()
  const convId = new ObjectId(conversationId)

  // 获取下一个版本号
  const latestSnapshot = await getLatestSnapshot(conversationId)
  const nextVersion = latestSnapshot ? latestSnapshot.version + 1 : 1

  const snapshot: CodeSnapshot = {
    conversationId: convId,
    messageId: request.messageId ? new ObjectId(request.messageId) : undefined,
    functionId: request.functionId ? new ObjectId(request.functionId) : undefined,
    version: nextVersion,
    code: request.code,
    language: request.language || 'typescript',
    description: request.description,
    createdAt: new Date()
  }

  const result = await db.collection<CodeSnapshot>(COLLECTION_NAME).insertOne(snapshot)

  return {
    id: result.insertedId.toString(),
    version: nextVersion
  }
}

/**
 * 对比两个快照
 * @param baseSnapshotId 基准快照 ID（可选，为空时用空字符串）
 * @param targetSnapshotId 目标快照 ID
 * @returns 对比结果
 */
export async function compareSnapshots(
  baseSnapshotId: string | undefined,
  targetSnapshotId: string
): Promise<{ diff: DiffResult; baseCode: string; targetCode: string }> {
  const db = getDB()

  // 获取目标快照
  const targetSnapshot = await db.collection<CodeSnapshot>(COLLECTION_NAME).findOne({
    _id: new ObjectId(targetSnapshotId)
  })

  if (!targetSnapshot) {
    throw new Error('目标快照不存在')
  }

  // 获取基准代码
  let baseCode = ''
  if (baseSnapshotId) {
    const baseSnapshot = await db.collection<CodeSnapshot>(COLLECTION_NAME).findOne({
      _id: new ObjectId(baseSnapshotId)
    })
    if (baseSnapshot) {
      baseCode = baseSnapshot.code
    }
  }

  // 计算差异
  const diff = calculateDiff(baseCode, targetSnapshot.code)

  return {
    diff,
    baseCode,
    targetCode: targetSnapshot.code
  }
}

/**
 * 应用快照代码到函数
 * @param snapshotId 快照 ID
 * @param functionId 函数 ID
 * @param userId 用户 ID
 * @returns 是否成功
 */
export async function applySnapshotToFunction(
  snapshotId: string,
  functionId: string,
  userId: string
): Promise<boolean> {
  const db = getDB()

  // 获取快照
  const snapshot = await db.collection<CodeSnapshot>(COLLECTION_NAME).findOne({
    _id: new ObjectId(snapshotId)
  })

  if (!snapshot) {
    throw new Error('快照不存在')
  }

  // 获取函数
  const func = await db.collection('functions').findOne({
    _id: new ObjectId(functionId),
    userId: new ObjectId(userId)
  })

  if (!func) {
    throw new Error('函数不存在')
  }

  // 更新函数代码
  await db.collection('functions').updateOne(
    { _id: new ObjectId(functionId) },
    {
      $set: {
        code: snapshot.code,
        updatedAt: new Date()
      }
    }
  )

  // 记录审计日志
  await db.collection('function_audit_logs').insertOne({
    functionId: new ObjectId(functionId),
    functionName: func.name,
    userId: new ObjectId(userId),
    username: 'user', // TODO: 从用户获取
    action: 'update',
    operator: 'ai',
    operatorDetail: `Canvas 快照应用 (版本 ${snapshot.version})`,
    changes: {
      before: func.code,
      after: snapshot.code,
      description: snapshot.description || `应用快照版本 ${snapshot.version}`
    },
    createdAt: new Date()
  })

  return true
}

/**
 * 删除快照
 * @param snapshotId 快照 ID
 * @returns 是否成功
 */
export async function deleteSnapshot(snapshotId: string): Promise<boolean> {
  const db = getDB()
  const result = await db.collection(COLLECTION_NAME).deleteOne({
    _id: new ObjectId(snapshotId)
  })
  return result.deletedCount > 0
}

/**
 * 删除对话的所有快照
 * @param conversationId 对话 ID
 * @returns 删除数量
 */
export async function deleteConversationSnapshots(conversationId: string): Promise<number> {
  const db = getDB()
  const result = await db.collection(COLLECTION_NAME).deleteMany({
    conversationId: new ObjectId(conversationId)
  })
  return result.deletedCount
}
