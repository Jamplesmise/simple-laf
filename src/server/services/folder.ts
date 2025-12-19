import { ObjectId } from 'mongodb'
import { getDB } from '../db.js'

export interface Folder {
  _id: ObjectId
  name: string
  parentId?: ObjectId
  path: string
  userId: ObjectId
  order: number
  createdAt: Date
}

export interface TreeNode {
  key: string
  title: string
  isFolder: boolean
  path: string
  published?: boolean
  children?: TreeNode[]
}

// 创建文件夹
export async function createFolder(
  name: string,
  parentId: ObjectId | null,
  userId: ObjectId
): Promise<Folder> {
  const db = getDB()

  // 获取父文件夹路径
  let parentPath = ''
  if (parentId) {
    const parent = await db.collection('folders').findOne({ _id: parentId })
    if (!parent) throw new Error('父文件夹不存在')
    parentPath = parent.path as string
  }

  const path = parentPath ? `${parentPath}/${name}` : name

  // 检查路径是否存在
  const existing = await db.collection('folders').findOne({ userId, path })
  if (existing) throw new Error('文件夹已存在')

  // 获取排序序号
  const maxOrder = await db.collection('folders')
    .find({ userId, parentId: parentId || { $exists: false } })
    .sort({ order: -1 })
    .limit(1)
    .toArray()

  const order = (maxOrder[0]?.order || 0) + 1

  const folder: Partial<Folder> = {
    name,
    parentId: parentId || undefined,
    path,
    userId,
    order,
    createdAt: new Date()
  }

  const result = await db.collection('folders').insertOne(folder)
  folder._id = result.insertedId

  return folder as Folder
}

// 获取文件夹树
export async function getFolderTree(userId: ObjectId): Promise<TreeNode[]> {
  const db = getDB()

  const folders = await db.collection('folders')
    .find({ userId })
    .sort({ order: 1 })
    .toArray()

  const functions = await db.collection('functions')
    .find({ userId })
    .sort({ order: 1, name: 1 })
    .toArray()

  // 构建树结构
  const buildTree = (parentId?: ObjectId): TreeNode[] => {
    const children: TreeNode[] = []

    // 添加文件夹
    folders
      .filter(f => {
        if (parentId) return f.parentId?.toString() === parentId.toString()
        return !f.parentId
      })
      .forEach(folder => {
        children.push({
          key: folder._id.toString(),
          title: folder.name as string,
          isFolder: true,
          path: folder.path as string,
          children: buildTree(folder._id)
        })
      })

    // 添加函数
    functions
      .filter(f => {
        if (parentId) return f.folderId?.toString() === parentId.toString()
        return !f.folderId
      })
      .forEach(func => {
        children.push({
          key: func._id.toString(),
          title: func.name as string,
          isFolder: false,
          path: (func.path as string) || (func.name as string),
          published: func.published as boolean
        })
      })

    return children
  }

  return buildTree()
}

// 重命名文件夹
export async function renameFolder(
  folderId: ObjectId,
  newName: string,
  userId: ObjectId
): Promise<void> {
  const db = getDB()

  const folder = await db.collection('folders').findOne({ _id: folderId, userId })
  if (!folder) throw new Error('文件夹不存在')

  const oldPath = folder.path as string
  const parentPath = oldPath.includes('/') ? oldPath.substring(0, oldPath.lastIndexOf('/')) : ''
  const newPath = parentPath ? `${parentPath}/${newName}` : newName

  // 检查新路径是否已存在
  const existing = await db.collection('folders').findOne({
    userId,
    path: newPath,
    _id: { $ne: folderId }
  })
  if (existing) throw new Error('目标路径已存在同名文件夹')

  // 更新文件夹
  await db.collection('folders').updateOne(
    { _id: folderId },
    { $set: { name: newName, path: newPath } }
  )

  // 更新子路径
  await updateChildPaths(userId, oldPath, newPath)
}

// 更新子路径
async function updateChildPaths(userId: ObjectId, oldPath: string, newPath: string): Promise<void> {
  const db = getDB()
  const escapedOldPath = oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // 更新子文件夹
  const childFolders = await db.collection('folders')
    .find({ userId, path: { $regex: `^${escapedOldPath}/` } })
    .toArray()

  for (const folder of childFolders) {
    const updatedPath = (folder.path as string).replace(oldPath, newPath)
    await db.collection('folders').updateOne(
      { _id: folder._id },
      { $set: { path: updatedPath } }
    )
  }

  // 更新函数
  const childFunctions = await db.collection('functions')
    .find({ userId, path: { $regex: `^${escapedOldPath}/` } })
    .toArray()

  for (const func of childFunctions) {
    const updatedPath = (func.path as string).replace(oldPath, newPath)
    await db.collection('functions').updateOne(
      { _id: func._id },
      { $set: { path: updatedPath } }
    )
  }
}

// 删除文件夹
export async function deleteFolder(folderId: ObjectId, userId: ObjectId): Promise<void> {
  const db = getDB()

  // 检查是否为空
  const hasChildren = await db.collection('folders').findOne({
    parentId: folderId,
    userId
  })
  const hasFunctions = await db.collection('functions').findOne({
    folderId,
    userId
  })

  if (hasChildren || hasFunctions) {
    throw new Error('文件夹不为空，请先删除或移动其中的内容')
  }

  await db.collection('folders').deleteOne({ _id: folderId, userId })
}

// 移动文件夹
export async function moveFolder(
  folderId: ObjectId,
  newParentId: ObjectId | null,
  userId: ObjectId
): Promise<string> {
  const db = getDB()

  const folder = await db.collection('folders').findOne({ _id: folderId, userId })
  if (!folder) throw new Error('文件夹不存在')

  const oldPath = folder.path as string

  // 获取新父路径
  let newParentPath = ''
  if (newParentId) {
    const newParent = await db.collection('folders').findOne({ _id: newParentId, userId })
    if (!newParent) throw new Error('目标文件夹不存在')
    newParentPath = newParent.path as string

    // 防止移动到自身或子目录
    if (newParentPath === oldPath || newParentPath.startsWith(`${oldPath}/`)) {
      throw new Error('不能将文件夹移动到自身或其子目录')
    }
  }

  const newPath = newParentPath ? `${newParentPath}/${folder.name}` : folder.name as string

  // 检查目标路径是否已存在
  const existing = await db.collection('folders').findOne({
    userId,
    path: newPath,
    _id: { $ne: folderId }
  })
  if (existing) throw new Error('目标位置已存在同名文件夹')

  // 更新文件夹
  await db.collection('folders').updateOne(
    { _id: folderId },
    {
      $set: {
        parentId: newParentId || null,
        path: newPath
      }
    }
  )

  // 更新子路径
  await updateChildPaths(userId, oldPath, newPath)

  return newPath
}

// 移动函数到文件夹
export async function moveFunction(
  functionId: ObjectId,
  folderId: ObjectId | null,
  userId: ObjectId
): Promise<string> {
  const db = getDB()

  const func = await db.collection('functions').findOne({
    _id: functionId,
    userId
  })

  if (!func) throw new Error('函数不存在')

  // 计算新路径
  let newPath = func.name as string
  if (folderId) {
    const folder = await db.collection('folders').findOne({
      _id: folderId,
      userId
    })
    if (!folder) throw new Error('目标文件夹不存在')
    newPath = `${folder.path}/${func.name}`
  }

  await db.collection('functions').updateOne(
    { _id: functionId },
    {
      $set: {
        folderId: folderId || null,
        path: newPath,
        updatedAt: new Date()
      }
    }
  )

  return newPath
}

// 批量移动函数
export async function batchMoveFunctions(
  functionIds: ObjectId[],
  folderId: ObjectId | null,
  userId: ObjectId
): Promise<void> {
  for (const id of functionIds) {
    await moveFunction(id, folderId, userId)
  }
}

// 调整排序
export async function reorderItems(
  orders: Array<{ id: string; order: number; isFolder: boolean }>,
  userId: ObjectId
): Promise<void> {
  const db = getDB()

  for (const item of orders) {
    const collection = item.isFolder ? 'folders' : 'functions'
    await db.collection(collection).updateOne(
      { _id: new ObjectId(item.id), userId },
      { $set: { order: item.order } }
    )
  }
}
