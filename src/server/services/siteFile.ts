import { ObjectId } from 'mongodb'
import { createHash } from 'crypto'
import path from 'path'
import { getDB } from '../db.js'
import * as storageService from './storage.js'
import { config } from '../config.js'
import type { Site, SiteFile } from './site.js'

// ==================== MIME 类型工具 ====================

const MIME_TYPES: Record<string, string> = {
  // 文本
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'application/javascript',
  mjs: 'application/javascript',
  json: 'application/json',
  xml: 'application/xml',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  // 图片
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  webp: 'image/webp',
  // 字体
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  eot: 'application/vnd.ms-fontobject',
  // 其他
  pdf: 'application/pdf',
  zip: 'application/zip',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  webm: 'video/webm',
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return MIME_TYPES[ext] || 'application/octet-stream'
}

function isTextFile(mimeType: string): boolean {
  const textTypes = ['text/', 'application/json', 'application/javascript', 'application/xml', 'image/svg+xml']
  return textTypes.some(t => mimeType.startsWith(t))
}

// ==================== 文件服务 ====================

function getCollection() {
  return getDB().collection<SiteFile>('site_files')
}

/**
 * 规范化路径
 */
function normalizePath(p: string): string {
  // 确保以 / 开头，不以 / 结尾 (除非是根目录)
  let normalized = path.posix.normalize('/' + p.replace(/^\/+/, ''))
  if (normalized !== '/' && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }
  return normalized
}

/**
 * 获取 S3 键
 */
function getS3Key(userId: ObjectId, filePath: string): string {
  return `sites/${userId.toHexString()}${filePath}`
}

/**
 * 获取默认存储桶
 */
function getBucket(): string {
  if (!config.s3.bucket) {
    throw new Error('未配置 S3 存储桶')
  }
  return config.s3.bucket
}

/**
 * 获取文件列表
 */
export async function list(
  userId: ObjectId,
  dirPath: string = '/',
  recursive: boolean = true
): Promise<SiteFile[]> {
  const normalized = normalizePath(dirPath)
  const collection = getCollection()

  interface Query {
    userId: ObjectId
    path?: { $regex: string } | { $eq: string }
    $or?: Array<{ path: string | { $regex: string } }>
  }

  const query: Query = { userId }

  if (recursive) {
    if (normalized !== '/') {
      query.path = { $regex: `^${normalized}(/|$)` }
    }
  } else {
    query.$or = [
      { path: normalized },
      { path: { $regex: `^${normalized}/[^/]+$` } }
    ]
  }

  return collection.find(query).sort({ isDirectory: -1, name: 1 }).toArray()
}

/**
 * 获取单个文件
 */
export async function get(userId: ObjectId, filePath: string): Promise<SiteFile | null> {
  const normalized = normalizePath(filePath)
  return getCollection().findOne({ userId, path: normalized })
}

/**
 * 读取文件内容
 */
export async function readContent(
  userId: ObjectId,
  filePath: string
): Promise<{ file: SiteFile; content?: string; url?: string }> {
  const file = await get(userId, filePath)

  if (!file) {
    throw new Error('文件不存在')
  }

  if (file.isDirectory) {
    throw new Error('不能读取目录内容')
  }

  if (!file.s3Key) {
    throw new Error('文件存储信息丢失')
  }

  const bucket = getBucket()

  if (isTextFile(file.mimeType || '')) {
    const { body } = await storageService.downloadObject(bucket, file.s3Key)
    return { file, content: body.toString('utf-8') }
  } else {
    const url = await storageService.getPresignedUrl(bucket, file.s3Key, 3600)
    return { file, url }
  }
}

/**
 * 确保目录存在 (递归创建)
 */
async function ensureDirectory(userId: ObjectId, dirPath: string): Promise<void> {
  if (dirPath === '/' || dirPath === '.') return

  const parts = dirPath.split('/').filter(Boolean)
  let current = ''

  for (const part of parts) {
    current += '/' + part
    const existing = await get(userId, current)

    if (!existing) {
      await createDirectory(userId, current)
    } else if (!existing.isDirectory) {
      throw new Error(`路径冲突: ${current} 是文件而非目录`)
    }
  }
}

/**
 * 创建目录
 */
export async function createDirectory(userId: ObjectId, dirPath: string): Promise<SiteFile> {
  const normalized = normalizePath(dirPath)
  const name = path.basename(normalized)
  const parentPath = path.dirname(normalized)

  // 确保父目录存在
  if (parentPath !== '/') {
    await ensureDirectory(userId, parentPath)
  }

  const existing = await get(userId, normalized)
  if (existing) {
    if (!existing.isDirectory) {
      throw new Error('该路径已存在同名文件')
    }
    return existing
  }

  const now = new Date()
  const dir: SiteFile = {
    _id: new ObjectId(),
    userId,
    path: normalized,
    name,
    isDirectory: true,
    size: null,
    mimeType: null,
    hash: null,
    s3Key: null,
    createdAt: now,
    updatedAt: now,
  }

  await getCollection().insertOne(dir)
  return dir
}

/**
 * 保存文件 (创建或更新)
 */
export async function save(
  userId: ObjectId,
  filePath: string,
  content: string | Buffer,
  site: Site
): Promise<SiteFile> {
  const normalized = normalizePath(filePath)
  const name = path.basename(normalized)
  const dirPath = path.dirname(normalized)

  // 计算文件信息
  const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content
  const size = buffer.length
  const hash = createHash('md5').update(buffer).digest('hex')
  const mimeType = getMimeType(name)

  // 检查大小限制
  if (size > site.features.maxFileSize) {
    throw new Error(`文件大小超出限制 (最大 ${Math.round(site.features.maxFileSize / 1024 / 1024)}MB)`)
  }

  // 检查总存储限制
  const currentTotal = site.totalSize
  const existing = await get(userId, normalized)
  const existingSize = existing?.size || 0
  const newTotal = currentTotal - existingSize + size

  if (newTotal > site.features.maxStorage) {
    throw new Error(`存储空间不足 (已用 ${Math.round(currentTotal / 1024 / 1024)}MB / ${Math.round(site.features.maxStorage / 1024 / 1024)}MB)`)
  }

  // 确保父目录存在
  await ensureDirectory(userId, dirPath)

  // S3 上传
  const s3Key = getS3Key(userId, normalized)
  const bucket = getBucket()
  await storageService.uploadObject(bucket, s3Key, buffer, mimeType)

  // 数据库记录
  const now = new Date()
  const collection = getCollection()

  if (existing) {
    await collection.updateOne(
      { _id: existing._id },
      { $set: { size, hash, mimeType, s3Key, updatedAt: now } }
    )
    return { ...existing, size, hash, mimeType, s3Key, updatedAt: now }
  } else {
    const file: SiteFile = {
      _id: new ObjectId(),
      userId,
      path: normalized,
      name,
      isDirectory: false,
      size,
      mimeType,
      hash,
      s3Key,
      createdAt: now,
      updatedAt: now,
    }
    await collection.insertOne(file)
    return file
  }
}

/**
 * 删除文件/目录
 */
export async function remove(
  userId: ObjectId,
  filePath: string,
  recursive: boolean = true
): Promise<void> {
  const normalized = normalizePath(filePath)
  const file = await get(userId, normalized)

  if (!file) {
    throw new Error('文件不存在')
  }

  const bucket = getBucket()
  const collection = getCollection()

  if (file.isDirectory) {
    // 获取目录下所有文件
    const children = await list(userId, normalized, true)
    const childFiles = children.filter(f => f.path !== normalized)

    if (childFiles.length > 0 && !recursive) {
      throw new Error('目录不为空，请使用递归删除')
    }

    // 删除 S3 文件
    const s3Keys: string[] = []
    for (const child of childFiles) {
      if (!child.isDirectory && child.s3Key) {
        s3Keys.push(child.s3Key)
      }
    }

    if (s3Keys.length > 0) {
      try {
        await storageService.deleteObjects(bucket, s3Keys)
      } catch (err) {
        console.error('Failed to delete S3 objects:', err)
        throw new Error(`删除 S3 文件失败: ${(err as Error).message}`)
      }
    }

    // 删除数据库记录
    await collection.deleteMany({
      userId,
      path: { $regex: `^${normalized}(/|$)` }
    })
  } else {
    // 删除单个文件
    if (file.s3Key) {
      try {
        await storageService.deleteObject(bucket, file.s3Key)
      } catch (err) {
        console.error('Failed to delete S3 object:', file.s3Key, err)
        throw new Error(`删除 S3 文件失败: ${(err as Error).message}`)
      }
    }
    await collection.deleteOne({ _id: file._id })
  }
}

/**
 * 删除孤立的数据库记录 (S3 文件已不存在)
 * 只删除数据库记录，不尝试删除 S3
 */
export async function removeOrphan(
  userId: ObjectId,
  filePath: string
): Promise<void> {
  const normalized = normalizePath(filePath)
  const collection = getCollection()

  await collection.deleteOne({ userId, path: normalized })
}

/**
 * 清理所有孤立记录 (S3 文件不存在但数据库有记录的)
 * 返回清理的文件数量
 */
export async function cleanupOrphans(userId: ObjectId): Promise<number> {
  const files = await list(userId, '/', true)
  const bucket = getBucket()
  const collection = getCollection()
  let cleaned = 0

  for (const file of files) {
    if (file.isDirectory || !file.s3Key) continue

    try {
      // 检查 S3 是否存在
      await storageService.headObject(bucket, file.s3Key)
    } catch (err) {
      const error = err as Error & { Code?: string }
      if (error.Code === 'NotFound' || error.Code === 'NoSuchKey') {
        // S3 不存在，删除数据库记录
        await collection.deleteOne({ _id: file._id })
        cleaned++
        console.log(`Cleaned orphan record: ${file.path}`)
      }
    }
  }

  return cleaned
}

/**
 * 移动/重命名
 */
export async function move(
  userId: ObjectId,
  fromPath: string,
  toPath: string
): Promise<SiteFile> {
  const from = normalizePath(fromPath)
  const to = normalizePath(toPath)

  const file = await get(userId, from)
  if (!file) {
    throw new Error('源文件不存在')
  }

  const existing = await get(userId, to)
  if (existing) {
    throw new Error('目标路径已存在')
  }

  // 确保目标目录存在
  const toDir = path.dirname(to)
  if (toDir !== '/') {
    await ensureDirectory(userId, toDir)
  }

  const bucket = getBucket()
  const collection = getCollection()

  if (file.isDirectory) {
    // 移动目录: 更新所有子项路径
    const children = await list(userId, from, true)

    for (const child of children) {
      const newPath = child.path.replace(from, to)
      const newS3Key = child.s3Key?.replace(from, to) || null

      // 如果有 S3 文件，需要复制后删除
      if (child.s3Key && newS3Key) {
        const { body, contentType } = await storageService.downloadObject(bucket, child.s3Key)
        await storageService.uploadObject(bucket, newS3Key, body, contentType)
        await storageService.deleteObject(bucket, child.s3Key)
      }

      await collection.updateOne(
        { _id: child._id },
        { $set: { path: newPath, name: path.basename(newPath), s3Key: newS3Key, updatedAt: new Date() } }
      )
    }
  } else {
    // 移动文件
    const newS3Key = getS3Key(userId, to)
    if (file.s3Key) {
      const { body, contentType } = await storageService.downloadObject(bucket, file.s3Key)
      await storageService.uploadObject(bucket, newS3Key, body, contentType)
      await storageService.deleteObject(bucket, file.s3Key)
    }

    await collection.updateOne(
      { _id: file._id },
      { $set: { path: to, name: path.basename(to), s3Key: newS3Key, updatedAt: new Date() } }
    )
  }

  const result = await get(userId, to)
  if (!result) {
    throw new Error('移动失败')
  }
  return result
}

/**
 * 复制文件
 */
export async function copy(
  userId: ObjectId,
  fromPath: string,
  toPath: string,
  site: Site
): Promise<SiteFile> {
  const from = normalizePath(fromPath)
  const to = normalizePath(toPath)

  const file = await get(userId, from)
  if (!file) {
    throw new Error('源文件不存在')
  }

  if (file.isDirectory) {
    throw new Error('暂不支持复制目录')
  }

  const existing = await get(userId, to)
  if (existing) {
    throw new Error('目标路径已存在')
  }

  // 读取原文件内容
  const { content, url } = await readContent(userId, from)

  if (content !== undefined) {
    return save(userId, to, content, site)
  } else if (url) {
    // 二进制文件需要从 S3 下载后重新上传
    const bucket = getBucket()
    const { body, contentType } = await storageService.downloadObject(bucket, file.s3Key!)
    const newS3Key = getS3Key(userId, to)
    await storageService.uploadObject(bucket, newS3Key, body, contentType)

    const now = new Date()
    const newFile: SiteFile = {
      _id: new ObjectId(),
      userId,
      path: to,
      name: path.basename(to),
      isDirectory: false,
      size: file.size,
      mimeType: file.mimeType,
      hash: file.hash,
      s3Key: newS3Key,
      createdAt: now,
      updatedAt: now,
    }
    await getCollection().insertOne(newFile)
    return newFile
  }

  throw new Error('复制失败')
}
