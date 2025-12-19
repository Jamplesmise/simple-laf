import { ObjectId } from 'mongodb'
import { getDB } from '../db.js'

export interface Snippet {
  _id?: ObjectId
  userId: string
  name: string
  description?: string
  code: string
  // 分类标签
  tags: string[]
  // 使用次数
  useCount: number
  createdAt: Date
  updatedAt: Date
}

/**
 * 获取用户的代码片段列表
 */
export async function list(userId: string, options: { tag?: string } = {}): Promise<Snippet[]> {
  const db = getDB()
  const filter: Record<string, unknown> = { userId }

  if (options.tag) {
    filter.tags = options.tag
  }

  return db.collection<Snippet>('snippets')
    .find(filter)
    .sort({ useCount: -1, updatedAt: -1 })
    .toArray()
}

/**
 * 获取单个代码片段
 */
export async function findById(snippetId: string, userId: string): Promise<Snippet | null> {
  const db = getDB()
  return db.collection<Snippet>('snippets').findOne({
    _id: new ObjectId(snippetId),
    userId,
  })
}

/**
 * 创建代码片段
 */
export async function create(
  userId: string,
  data: { name: string; description?: string; code: string; tags?: string[] }
): Promise<Snippet> {
  const db = getDB()
  const now = new Date()

  const snippet: Snippet = {
    userId,
    name: data.name,
    description: data.description,
    code: data.code,
    tags: data.tags || [],
    useCount: 0,
    createdAt: now,
    updatedAt: now,
  }

  const result = await db.collection<Snippet>('snippets').insertOne(snippet)
  snippet._id = result.insertedId

  return snippet
}

/**
 * 更新代码片段
 */
export async function update(
  snippetId: string,
  userId: string,
  updates: { name?: string; description?: string; code?: string; tags?: string[] }
): Promise<Snippet | null> {
  const db = getDB()

  const updateData: Partial<Snippet> = {
    updatedAt: new Date(),
  }

  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.description !== undefined) updateData.description = updates.description
  if (updates.code !== undefined) updateData.code = updates.code
  if (updates.tags !== undefined) updateData.tags = updates.tags

  await db.collection<Snippet>('snippets').updateOne(
    { _id: new ObjectId(snippetId), userId },
    { $set: updateData }
  )

  return db.collection<Snippet>('snippets').findOne({ _id: new ObjectId(snippetId) })
}

/**
 * 删除代码片段
 */
export async function remove(snippetId: string, userId: string): Promise<boolean> {
  const db = getDB()
  const result = await db.collection<Snippet>('snippets').deleteOne({
    _id: new ObjectId(snippetId),
    userId,
  })
  return result.deletedCount > 0
}

/**
 * 增加使用次数
 */
export async function incrementUseCount(snippetId: string, userId: string): Promise<void> {
  const db = getDB()
  await db.collection<Snippet>('snippets').updateOne(
    { _id: new ObjectId(snippetId), userId },
    {
      $inc: { useCount: 1 },
      $set: { updatedAt: new Date() },
    }
  )
}

/**
 * 获取用户的所有标签
 */
export async function getTags(userId: string): Promise<string[]> {
  const db = getDB()
  const result = await db.collection<Snippet>('snippets').aggregate([
    { $match: { userId } },
    { $unwind: '$tags' },
    { $group: { _id: '$tags' } },
    { $sort: { _id: 1 } },
  ]).toArray()

  return result.map(r => r._id as string)
}

/**
 * 搜索代码片段
 */
export async function search(userId: string, keyword: string): Promise<Snippet[]> {
  const db = getDB()
  const regex = new RegExp(keyword, 'i')

  return db.collection<Snippet>('snippets')
    .find({
      userId,
      $or: [
        { name: regex },
        { description: regex },
        { code: regex },
        { tags: regex },
      ],
    })
    .sort({ useCount: -1, updatedAt: -1 })
    .limit(20)
    .toArray()
}
