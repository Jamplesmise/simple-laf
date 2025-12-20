import { ObjectId } from 'mongodb'
import { getDB } from '../db.js'

// ==================== 类型定义 ====================

export interface Site {
  _id?: ObjectId
  userId: ObjectId

  // 基础配置
  name: string
  enabled: boolean

  // 托管配置
  defaultFile: string
  spaMode: boolean
  notFoundPage: string | null

  // 访问控制
  accessControl: {
    type: 'public' | 'login' | 'password'
    password?: string
    protectedPaths?: string[]
  }

  // 统计
  totalFiles: number
  totalSize: number

  // 权限限制
  features: {
    frameworkBuild: boolean
    maxStorage: number
    maxFileSize: number
  }

  createdAt: Date
  updatedAt: Date
}

export interface SiteFile {
  _id?: ObjectId
  userId: ObjectId

  // 文件信息
  path: string
  name: string
  isDirectory: boolean

  // 文件属性 (目录时为 null)
  size: number | null
  mimeType: string | null
  hash: string | null

  // S3 存储
  s3Key: string | null

  createdAt: Date
  updatedAt: Date
}

// ==================== 默认配置 ====================

const DEFAULT_SITE: Omit<Site, '_id' | 'userId' | 'createdAt' | 'updatedAt'> = {
  name: '我的站点',
  enabled: true,
  defaultFile: 'index.html',
  spaMode: false,
  notFoundPage: null,
  accessControl: { type: 'public' },
  totalFiles: 0,
  totalSize: 0,
  features: {
    frameworkBuild: false,
    maxStorage: 100 * 1024 * 1024,    // 100MB
    maxFileSize: 10 * 1024 * 1024,    // 10MB
  }
}

// ==================== 站点服务 ====================

/**
 * 获取站点集合
 */
function getSitesCollection() {
  return getDB().collection<Site>('sites')
}

/**
 * 获取用户站点配置 (不存在则创建默认配置)
 */
export async function getOrCreate(userId: ObjectId): Promise<Site> {
  const collection = getSitesCollection()
  const existing = await collection.findOne({ userId })

  if (existing) {
    return existing
  }

  const now = new Date()
  const newSite: Site = {
    _id: new ObjectId(),
    userId,
    ...DEFAULT_SITE,
    createdAt: now,
    updatedAt: now,
  }
  await collection.insertOne(newSite)
  return newSite
}

/**
 * 更新站点配置
 */
export async function update(
  userId: ObjectId,
  updates: Partial<Pick<Site, 'name' | 'enabled' | 'defaultFile' | 'spaMode' | 'notFoundPage' | 'accessControl'>>
): Promise<Site> {
  const collection = getSitesCollection()

  // 只允许更新特定字段
  const allowedFields = ['name', 'enabled', 'defaultFile', 'spaMode', 'notFoundPage', 'accessControl']
  const filtered: Record<string, unknown> = {}

  for (const key of allowedFields) {
    if (key in updates) {
      filtered[key] = updates[key as keyof typeof updates]
    }
  }

  // 确保站点存在
  await getOrCreate(userId)

  const result = await collection.findOneAndUpdate(
    { userId },
    { $set: { ...filtered, updatedAt: new Date() } },
    { returnDocument: 'after' }
  )

  if (!result) {
    throw new Error('站点配置更新失败')
  }

  return result
}

/**
 * 更新站点统计信息
 */
export async function updateStats(userId: ObjectId): Promise<void> {
  const db = getDB()
  const files = await db.collection<SiteFile>('site_files')
    .find({ userId, isDirectory: false })
    .toArray()

  const totalFiles = files.length
  const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0)

  await getSitesCollection().updateOne(
    { userId },
    { $set: { totalFiles, totalSize, updatedAt: new Date() } }
  )
}

/**
 * 获取站点统计信息
 */
export async function getStats(userId: ObjectId): Promise<{
  totalFiles: number
  totalSize: number
  maxStorage: number
  usagePercent: number
  fileTypes: Record<string, number>
}> {
  const site = await getOrCreate(userId)
  const db = getDB()

  const files = await db.collection<SiteFile>('site_files')
    .find({ userId, isDirectory: false })
    .toArray()

  // 按文件类型统计
  const fileTypes: Record<string, number> = {}
  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'other'
    fileTypes[ext] = (fileTypes[ext] || 0) + 1
  }

  return {
    totalFiles: site.totalFiles,
    totalSize: site.totalSize,
    maxStorage: site.features.maxStorage,
    usagePercent: site.features.maxStorage > 0
      ? Math.round((site.totalSize / site.features.maxStorage) * 100)
      : 0,
    fileTypes
  }
}
