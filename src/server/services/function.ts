import { ObjectId } from 'mongodb'
import { getDB } from '../db.js'

export interface CloudFunction {
  _id: ObjectId
  name: string
  path: string  // 完整路径，如 "api/user/login"
  code: string
  compiled: string
  userId: ObjectId
  folderId?: ObjectId
  published: boolean
  publishedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface FunctionData {
  name?: string
  code?: string
  compiled?: string
  published?: boolean
  publishedAt?: Date | null
}

export async function list(userId: string): Promise<CloudFunction[]> {
  const db = getDB()
  return db
    .collection<CloudFunction>('functions')
    .find({ userId: new ObjectId(userId) })
    .sort({ updatedAt: -1 })
    .toArray()
}

export async function create(
  userId: string,
  name: string,
  code: string,
  folderId?: string
): Promise<CloudFunction> {
  const db = getDB()
  const now = new Date()

  // 计算完整路径
  let path = name
  let folderOid: ObjectId | undefined
  if (folderId) {
    folderOid = new ObjectId(folderId)
    const folder = await db.collection('folders').findOne({
      _id: folderOid,
      userId: new ObjectId(userId)
    })
    if (folder) {
      path = `${folder.path}/${name}`
    }
  }

  const doc = {
    name,
    path,
    code,
    compiled: '',
    userId: new ObjectId(userId),
    folderId: folderOid,
    published: true,
    createdAt: now,
    updatedAt: now
  }

  const result = await db.collection('functions').insertOne(doc)

  return {
    _id: result.insertedId,
    ...doc
  } as CloudFunction
}

export async function findById(
  id: string,
  userId: string
): Promise<CloudFunction | null> {
  const db = getDB()
  return db.collection<CloudFunction>('functions').findOne({
    _id: new ObjectId(id),
    userId: new ObjectId(userId)
  })
}

export async function update(
  id: string,
  userId: string,
  data: FunctionData
): Promise<boolean> {
  const db = getDB()
  const result = await db.collection('functions').updateOne(
    { _id: new ObjectId(id), userId: new ObjectId(userId) },
    { $set: { ...data, updatedAt: new Date() } }
  )
  return result.matchedCount > 0
}

export async function remove(id: string, userId: string): Promise<boolean> {
  const db = getDB()
  const result = await db.collection('functions').deleteOne({
    _id: new ObjectId(id),
    userId: new ObjectId(userId)
  })
  return result.deletedCount > 0
}

export async function rename(
  id: string,
  userId: string,
  newName: string
): Promise<{ success: boolean; newPath?: string; error?: string }> {
  const db = getDB()
  const userOid = new ObjectId(userId)
  const funcOid = new ObjectId(id)

  // 获取当前函数
  const func = await db.collection<CloudFunction>('functions').findOne({
    _id: funcOid,
    userId: userOid
  })

  if (!func) {
    return { success: false, error: '函数不存在' }
  }

  // 计算新路径
  let newPath = newName
  if (func.folderId) {
    const folder = await db.collection('folders').findOne({
      _id: func.folderId,
      userId: userOid
    })
    if (folder) {
      newPath = `${folder.path}/${newName}`
    }
  }

  // 检查新路径是否已存在
  const existing = await db.collection<CloudFunction>('functions').findOne({
    path: newPath,
    userId: userOid,
    _id: { $ne: funcOid }
  })

  if (existing) {
    return { success: false, error: '已存在同名函数' }
  }

  // 更新函数名和路径
  const result = await db.collection('functions').updateOne(
    { _id: funcOid, userId: userOid },
    {
      $set: {
        name: newName,
        path: newPath,
        updatedAt: new Date()
      }
    }
  )

  if (result.matchedCount === 0) {
    return { success: false, error: '更新失败' }
  }

  return { success: true, newPath }
}
