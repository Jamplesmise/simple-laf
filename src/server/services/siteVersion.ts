import { ObjectId } from 'mongodb'
import { getDB } from '../db.js'

/**
 * 站点文件版本
 */
export interface SiteFileVersion {
  _id: ObjectId
  userId: ObjectId
  fileId: ObjectId      // 对应 site_files._id
  filePath: string      // 文件路径 (冗余存储，方便查询)
  version: number       // 版本号 (自增)
  versionName: string   // 版本名称 (可自定义)
  content: string       // 文件内容
  size: number          // 文件大小
  hash: string          // 内容哈希
  createdAt: Date
}

/**
 * 获取集合
 */
function getCollection() {
  return getDB().collection<SiteFileVersion>('site_file_versions')
}

/**
 * 创建新版本
 */
export async function createVersion(
  userId: ObjectId,
  fileId: ObjectId,
  filePath: string,
  content: string,
  versionName?: string
): Promise<SiteFileVersion> {
  const collection = getCollection()

  // 获取当前最大版本号
  const latest = await collection.findOne(
    { fileId },
    { sort: { version: -1 } }
  )

  const nextVersion = (latest?.version || 0) + 1

  // 计算哈希
  const { createHash } = await import('crypto')
  const hash = createHash('md5').update(content).digest('hex')

  // 如果内容没变，不创建新版本
  if (latest && latest.hash === hash) {
    return latest
  }

  const version: SiteFileVersion = {
    _id: new ObjectId(),
    userId,
    fileId,
    filePath,
    version: nextVersion,
    versionName: versionName || `v${nextVersion}`,
    content,
    size: Buffer.byteLength(content, 'utf8'),
    hash,
    createdAt: new Date(),
  }

  await collection.insertOne(version)
  return version
}

/**
 * 获取文件的所有版本
 */
export async function getVersions(fileId: ObjectId): Promise<SiteFileVersion[]> {
  return getCollection()
    .find({ fileId })
    .sort({ version: -1 })
    .toArray()
}

/**
 * 获取文件的所有版本 (通过路径)
 */
export async function getVersionsByPath(
  userId: ObjectId,
  filePath: string
): Promise<SiteFileVersion[]> {
  return getCollection()
    .find({ userId, filePath })
    .sort({ version: -1 })
    .toArray()
}

/**
 * 获取指定版本
 */
export async function getVersion(
  fileId: ObjectId,
  version: number
): Promise<SiteFileVersion | null> {
  return getCollection().findOne({ fileId, version })
}

/**
 * 获取最新版本
 */
export async function getLatestVersion(
  fileId: ObjectId
): Promise<SiteFileVersion | null> {
  return getCollection().findOne(
    { fileId },
    { sort: { version: -1 } }
  )
}

/**
 * 更新版本名称
 */
export async function updateVersionName(
  versionId: ObjectId,
  versionName: string
): Promise<SiteFileVersion | null> {
  const result = await getCollection().findOneAndUpdate(
    { _id: versionId },
    { $set: { versionName } },
    { returnDocument: 'after' }
  )
  return result
}

/**
 * 删除文件的所有版本
 */
export async function deleteVersions(fileId: ObjectId): Promise<number> {
  const result = await getCollection().deleteMany({ fileId })
  return result.deletedCount
}

/**
 * 删除文件的所有版本 (通过路径)
 */
export async function deleteVersionsByPath(
  userId: ObjectId,
  filePath: string
): Promise<number> {
  const result = await getCollection().deleteMany({ userId, filePath })
  return result.deletedCount
}

/**
 * 获取版本统计
 */
export async function getVersionStats(userId: ObjectId): Promise<{
  totalVersions: number
  totalSize: number
  fileCount: number
}> {
  const collection = getCollection()

  const stats = await collection.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: '$fileId',
        versionCount: { $sum: 1 },
        totalSize: { $sum: '$size' },
      }
    },
    {
      $group: {
        _id: null,
        totalVersions: { $sum: '$versionCount' },
        totalSize: { $sum: '$totalSize' },
        fileCount: { $sum: 1 },
      }
    }
  ]).toArray()

  if (stats.length === 0) {
    return { totalVersions: 0, totalSize: 0, fileCount: 0 }
  }

  return {
    totalVersions: stats[0].totalVersions,
    totalSize: stats[0].totalSize,
    fileCount: stats[0].fileCount,
  }
}
