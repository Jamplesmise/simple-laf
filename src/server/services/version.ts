import { ObjectId } from 'mongodb'
import { getDB } from '../db.js'

export interface FunctionVersion {
  _id: ObjectId
  functionId: ObjectId
  version: number
  code: string
  compiled: string
  changelog: string
  userId: ObjectId
  createdAt: Date
}

/**
 * 创建新版本
 */
export async function createVersion(
  functionId: ObjectId,
  code: string,
  compiled: string,
  changelog: string,
  userId: ObjectId
): Promise<FunctionVersion> {
  const db = getDB()

  // 获取当前最大版本号
  const latest = await db.collection<FunctionVersion>('function_versions')
    .findOne(
      { functionId },
      { sort: { version: -1 } }
    )

  const nextVersion = (latest?.version || 0) + 1

  const version: Omit<FunctionVersion, '_id'> = {
    functionId,
    version: nextVersion,
    code,
    compiled,
    changelog,
    userId,
    createdAt: new Date()
  }

  const result = await db.collection('function_versions').insertOne(version)

  // 更新函数的版本信息
  await db.collection('functions').updateOne(
    { _id: functionId },
    {
      $set: {
        currentVersion: nextVersion,
        publishedVersion: nextVersion,
        published: true,
        publishedAt: new Date(),
        updatedAt: new Date()
      }
    }
  )

  return {
    _id: result.insertedId,
    ...version
  }
}

/**
 * 获取版本列表
 */
export async function getVersions(functionId: ObjectId): Promise<FunctionVersion[]> {
  const db = getDB()
  return db.collection<FunctionVersion>('function_versions')
    .find({ functionId })
    .sort({ version: -1 })
    .toArray()
}

/**
 * 获取指定版本
 */
export async function getVersion(
  functionId: ObjectId,
  version: number
): Promise<FunctionVersion | null> {
  const db = getDB()
  return db.collection<FunctionVersion>('function_versions').findOne({
    functionId,
    version
  })
}

/**
 * 获取最新版本
 */
export async function getLatestVersion(
  functionId: ObjectId
): Promise<FunctionVersion | null> {
  const db = getDB()
  return db.collection<FunctionVersion>('function_versions')
    .findOne(
      { functionId },
      { sort: { version: -1 } }
    )
}

/**
 * 回滚到指定版本
 */
export async function rollbackToVersion(
  functionId: ObjectId,
  targetVersion: number,
  userId: ObjectId
): Promise<FunctionVersion> {
  const db = getDB()

  // 获取目标版本
  const targetVersionDoc = await getVersion(functionId, targetVersion)
  if (!targetVersionDoc) {
    throw new Error('版本不存在')
  }

  // 更新函数代码
  await db.collection('functions').updateOne(
    { _id: functionId },
    {
      $set: {
        code: targetVersionDoc.code,
        compiled: targetVersionDoc.compiled,
        publishedVersion: targetVersion,
        updatedAt: new Date()
      }
    }
  )

  // 创建回滚记录 (作为新版本)
  return createVersion(
    functionId,
    targetVersionDoc.code,
    targetVersionDoc.compiled,
    `回滚到 v${targetVersion}`,
    userId
  )
}
