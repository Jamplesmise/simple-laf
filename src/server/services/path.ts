import { ObjectId } from 'mongodb'
import { getDB } from '../db.js'

// 更新函数路径
export async function updateFunctionPath(functionId: ObjectId): Promise<string> {
  const db = getDB()

  const func = await db.collection('functions').findOne({ _id: functionId })
  if (!func) throw new Error('函数不存在')

  let newPath = func.name as string
  if (func.folderId) {
    const folder = await db.collection('folders').findOne({ _id: func.folderId })
    if (folder) {
      newPath = `${folder.path}/${func.name}`
    }
  }

  await db.collection('functions').updateOne(
    { _id: functionId },
    { $set: { path: newPath } }
  )

  return newPath
}

// 初始化所有函数路径 (一次性迁移)
export async function initializeFunctionPaths(userId: ObjectId): Promise<number> {
  const db = getDB()

  const functions = await db.collection('functions')
    .find({ userId, path: { $exists: false } })
    .toArray()

  let count = 0
  for (const func of functions) {
    const path = func.name as string
    await db.collection('functions').updateOne(
      { _id: func._id },
      { $set: { path, order: func.order ?? 0 } }
    )
    count++
  }

  return count
}

// 修复所有函数路径 (根据 folderId 重新计算)
export async function fixAllFunctionPaths(userId: ObjectId): Promise<number> {
  const db = getDB()

  const functions = await db.collection('functions')
    .find({ userId })
    .toArray()

  let count = 0
  for (const func of functions) {
    let newPath = func.name as string

    if (func.folderId) {
      const folder = await db.collection('folders').findOne({ _id: func.folderId })
      if (folder) {
        newPath = `${folder.path}/${func.name}`
      }
    }

    if (newPath !== func.path) {
      await db.collection('functions').updateOne(
        { _id: func._id },
        { $set: { path: newPath } }
      )
      count++
    }
  }

  return count
}

// 检查路径是否可用
export async function isPathAvailable(
  path: string,
  userId: ObjectId,
  excludeId?: ObjectId
): Promise<boolean> {
  const db = getDB()

  const query: Record<string, unknown> = { userId, path }
  if (excludeId) {
    query._id = { $ne: excludeId }
  }

  // 检查函数
  const existingFunc = await db.collection('functions').findOne(query)
  if (existingFunc) return false

  // 检查文件夹
  const existingFolder = await db.collection('folders').findOne(query)
  if (existingFolder) return false

  return true
}

// 迁移所有用户的函数路径 (启动时调用)
export async function migrateAllFunctionPaths(): Promise<{ migrated: number; fixed: number }> {
  const db = getDB()

  // 找出所有没有 path 字段的函数
  const functionsWithoutPath = await db.collection('functions')
    .find({ path: { $exists: false } })
    .toArray()

  let migrated = 0
  for (const func of functionsWithoutPath) {
    let path = func.name as string

    if (func.folderId) {
      const folder = await db.collection('folders').findOne({ _id: func.folderId })
      if (folder) {
        path = `${folder.path}/${func.name}`
      }
    }

    await db.collection('functions').updateOne(
      { _id: func._id },
      { $set: { path } }
    )
    migrated++
  }

  // 修复路径不正确的函数 (folderId 存在但 path 不包含文件夹路径)
  const allFunctions = await db.collection('functions')
    .find({ folderId: { $exists: true, $ne: null } })
    .toArray()

  let fixed = 0
  for (const func of allFunctions) {
    const folder = await db.collection('folders').findOne({ _id: func.folderId })
    if (folder) {
      const expectedPath = `${folder.path}/${func.name}`
      if (func.path !== expectedPath) {
        await db.collection('functions').updateOne(
          { _id: func._id },
          { $set: { path: expectedPath } }
        )
        fixed++
      }
    }
  }

  return { migrated, fixed }
}

// 验证路径格式
export function validatePath(path: string): { valid: boolean; error?: string } {
  if (!path) {
    return { valid: false, error: '路径不能为空' }
  }

  if (path.startsWith('/') || path.endsWith('/')) {
    return { valid: false, error: '路径不能以斜杠开头或结尾' }
  }

  if (path.includes('//')) {
    return { valid: false, error: '路径不能包含连续斜杠' }
  }

  // 检查每个部分是否合法
  const parts = path.split('/')
  for (const part of parts) {
    if (!part) {
      return { valid: false, error: '路径部分不能为空' }
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(part)) {
      return { valid: false, error: '路径只能包含字母、数字、下划线和连字符' }
    }
  }

  return { valid: true }
}
