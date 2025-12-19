/**
 * MongoDB 用户数据库管理服务
 * 操作独立的用户数据库，不影响系统数据库
 */

import { ObjectId, type Document, type IndexDescription } from 'mongodb'
import { getUserDataDB } from '../db.js'

export interface CollectionInfo {
  name: string
  type: string
  documentCount: number
}

export interface CollectionStats {
  name: string
  documentCount: number
  size: number
  avgDocSize: number
  indexCount: number
  totalIndexSize: number
}

export interface IndexInfo {
  name: string
  key: Record<string, number>
  unique: boolean
  sparse: boolean
  expireAfterSeconds?: number
  background?: boolean
}

export interface FindOptions {
  query?: Record<string, unknown>
  skip?: number
  limit?: number
  sort?: Record<string, 1 | -1>
  projection?: Record<string, 0 | 1>
}

export interface FindResult {
  documents: Document[]
  total: number
}

/**
 * 列出所有集合
 */
export async function listCollections(): Promise<CollectionInfo[]> {
  const db = getUserDataDB()
  const collections = await db.listCollections().toArray()

  const result: CollectionInfo[] = []

  for (const col of collections) {
    // 跳过系统集合 (以 system. 开头)
    if (col.name.startsWith('system.')) continue

    try {
      const count = await db.collection(col.name).countDocuments()
      result.push({
        name: col.name,
        type: col.type || 'collection',
        documentCount: count,
      })
    } catch {
      result.push({
        name: col.name,
        type: col.type || 'collection',
        documentCount: 0,
      })
    }
  }

  // 按名称排序
  result.sort((a, b) => a.name.localeCompare(b.name))

  return result
}

/**
 * 获取集合统计信息
 */
export async function getCollectionStats(name: string): Promise<CollectionStats> {
  const db = getUserDataDB()

  const [count, indexes] = await Promise.all([
    db.collection(name).countDocuments(),
    db.collection(name).indexes(),
  ])

  return {
    name,
    documentCount: count,
    size: 0,
    avgDocSize: 0,
    indexCount: indexes.length,
    totalIndexSize: 0,
  }
}

/**
 * 创建集合
 */
export async function createCollection(name: string): Promise<void> {
  if (!name || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error('集合名称格式无效')
  }

  const db = getUserDataDB()
  await db.createCollection(name)
}

/**
 * 删除集合
 */
export async function dropCollection(name: string): Promise<void> {
  const db = getUserDataDB()
  await db.collection(name).drop()
}

/**
 * 查询文档
 */
export async function findDocuments(
  collection: string,
  options: FindOptions = {}
): Promise<FindResult> {
  const db = getUserDataDB()
  const col = db.collection(collection)

  const query = options.query || {}
  const skip = options.skip || 0
  const limit = Math.min(options.limit || 20, 100) // 最大 100 条
  const sort = options.sort || { _id: -1 }

  const [documents, total] = await Promise.all([
    col.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray(),
    col.countDocuments(query),
  ])

  return { documents, total }
}

/**
 * 获取单个文档
 */
export async function findDocument(
  collection: string,
  id: string
): Promise<Document | null> {
  const db = getUserDataDB()
  return db.collection(collection).findOne({ _id: new ObjectId(id) })
}

/**
 * 插入文档
 */
export async function insertDocument(
  collection: string,
  doc: Record<string, unknown>
): Promise<Document> {
  const db = getUserDataDB()

  // 移除 _id 如果是空字符串或无效
  if (doc._id === '' || doc._id === null) {
    delete doc._id
  }

  const result = await db.collection(collection).insertOne(doc)
  return { _id: result.insertedId, ...doc }
}

/**
 * 更新文档
 */
export async function updateDocument(
  collection: string,
  id: string,
  update: Record<string, unknown>
): Promise<Document | null> {
  const db = getUserDataDB()

  // 移除 _id 字段，不允许更新
  const updateData = { ...update }
  delete updateData._id

  const result = await db.collection(collection).findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: updateData },
    { returnDocument: 'after' }
  )

  return result
}

/**
 * 替换文档 (完整替换)
 */
export async function replaceDocument(
  collection: string,
  id: string,
  doc: Record<string, unknown>
): Promise<Document | null> {
  const db = getUserDataDB()

  // 移除 _id 字段
  const docData = { ...doc }
  delete docData._id

  const result = await db.collection(collection).findOneAndReplace(
    { _id: new ObjectId(id) },
    docData,
    { returnDocument: 'after' }
  )

  return result
}

/**
 * 删除文档
 */
export async function deleteDocument(
  collection: string,
  id: string
): Promise<boolean> {
  const db = getUserDataDB()
  const result = await db.collection(collection).deleteOne({
    _id: new ObjectId(id)
  })

  return result.deletedCount > 0
}

/**
 * 批量删除文档
 */
export async function deleteDocuments(
  collection: string,
  ids: string[]
): Promise<number> {
  const db = getUserDataDB()
  const result = await db.collection(collection).deleteMany({
    _id: { $in: ids.map(id => new ObjectId(id)) }
  })

  return result.deletedCount
}

/**
 * 获取索引列表
 */
export async function listIndexes(collection: string): Promise<IndexInfo[]> {
  const db = getUserDataDB()
  const indexes = await db.collection(collection).indexes()

  return indexes.map(idx => ({
    name: idx.name || '',
    key: idx.key as Record<string, number>,
    unique: idx.unique || false,
    sparse: idx.sparse || false,
    expireAfterSeconds: idx.expireAfterSeconds,
    background: idx.background,
  }))
}

/**
 * 创建索引
 */
export async function createIndex(
  collection: string,
  keys: Record<string, 1 | -1>,
  options: {
    unique?: boolean
    sparse?: boolean
    expireAfterSeconds?: number
    name?: string
  } = {}
): Promise<string> {
  const db = getUserDataDB()

  return db.collection(collection).createIndex(keys, {
    unique: options.unique,
    sparse: options.sparse,
    expireAfterSeconds: options.expireAfterSeconds,
    name: options.name,
  })
}

/**
 * 删除索引
 */
export async function dropIndex(
  collection: string,
  indexName: string
): Promise<void> {
  if (indexName === '_id_') {
    throw new Error('不能删除 _id 索引')
  }

  const db = getUserDataDB()
  await db.collection(collection).dropIndex(indexName)
}

/**
 * 执行聚合查询
 */
export async function aggregate(
  collection: string,
  pipeline: Document[]
): Promise<Document[]> {
  const db = getUserDataDB()
  return db.collection(collection).aggregate(pipeline).toArray()
}
