/**
 * 函数操作执行器
 *
 * 处理函数的创建、更新、删除、重命名、移动操作
 */

import { ObjectId, type Db } from 'mongodb'
import type {
  AIOperationResult,
  CreateFunctionOperation,
  UpdateFunctionOperation,
  DeleteFunctionOperation,
  RenameFunctionOperation,
  MoveFunctionOperation,
  CreateFolderOperation,
} from '../../types.js'
import { logAIAction } from '../../../functionAudit.js'

export interface OperationContext {
  db: Db
  userId: ObjectId
  username: string
  modelName?: string
}

/**
 * 创建函数
 */
export async function createFunction(
  op: CreateFunctionOperation,
  ctx: OperationContext
): Promise<AIOperationResult> {
  const functions = ctx.db.collection('functions')

  // 检查名称是否已存在
  const existing = await functions.findOne({
    userId: ctx.userId,
    name: op.name,
  })

  if (existing) {
    return {
      operation: op,
      success: false,
      error: `函数 "${op.name}" 已存在`,
    }
  }

  // 计算路径
  let path = `/${op.name}`
  if (op.folderId) {
    const folder = await ctx.db.collection('folders').findOne({
      _id: new ObjectId(op.folderId),
      userId: ctx.userId,
    })
    if (folder) {
      path = `${folder.path}/${op.name}`
    }
  }

  const result = await functions.insertOne({
    userId: ctx.userId,
    name: op.name,
    code: op.code,
    path,
    folderId: op.folderId ? new ObjectId(op.folderId) : null,
    published: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  // 记录审计日志
  await logAIAction({
    functionId: result.insertedId,
    functionName: op.name,
    userId: ctx.userId,
    username: ctx.username,
    action: 'create',
    modelName: ctx.modelName,
    changes: {
      after: op.code,
      description: op.description || 'AI 创建函数',
    },
  }, ctx.db)

  return {
    operation: op,
    success: true,
    result: {
      functionId: result.insertedId.toString(),
      name: op.name,
    },
  }
}

/**
 * 更新函数
 */
export async function updateFunction(
  op: UpdateFunctionOperation,
  ctx: OperationContext
): Promise<AIOperationResult> {
  const functions = ctx.db.collection('functions')

  // 获取更新前的函数信息
  const oldFunc = await functions.findOne({
    _id: new ObjectId(op.functionId),
    userId: ctx.userId,
  })

  if (!oldFunc) {
    return {
      operation: op,
      success: false,
      error: '函数不存在或无权限',
    }
  }

  const result = await functions.updateOne(
    {
      _id: new ObjectId(op.functionId),
      userId: ctx.userId,
    },
    {
      $set: {
        code: op.code,
        updatedAt: new Date(),
      },
    }
  )

  if (result.matchedCount === 0) {
    return {
      operation: op,
      success: false,
      error: '函数不存在或无权限',
    }
  }

  // 记录审计日志
  await logAIAction({
    functionId: op.functionId,
    functionName: oldFunc.name as string,
    userId: ctx.userId,
    username: ctx.username,
    action: 'update',
    modelName: ctx.modelName,
    changes: {
      before: oldFunc.code as string,
      after: op.code,
      description: op.description || 'AI 更新函数',
    },
  }, ctx.db)

  return {
    operation: op,
    success: true,
    result: {
      functionId: op.functionId,
    },
  }
}

/**
 * 删除函数
 */
export async function deleteFunction(
  op: DeleteFunctionOperation,
  ctx: OperationContext
): Promise<AIOperationResult> {
  const functions = ctx.db.collection('functions')

  const fn = await functions.findOne({
    _id: new ObjectId(op.functionId),
    userId: ctx.userId,
  })

  if (!fn) {
    return {
      operation: op,
      success: false,
      error: '函数不存在或无权限',
    }
  }

  await functions.deleteOne({ _id: new ObjectId(op.functionId) })

  // 记录审计日志
  await logAIAction({
    functionId: op.functionId,
    functionName: fn.name as string,
    userId: ctx.userId,
    username: ctx.username,
    action: 'delete',
    modelName: ctx.modelName,
    changes: {
      before: fn.code as string,
      description: 'AI 删除函数',
    },
  }, ctx.db)

  return {
    operation: op,
    success: true,
    result: {
      functionId: op.functionId,
      name: fn.name,
    },
  }
}

/**
 * 重命名函数
 */
export async function renameFunction(
  op: RenameFunctionOperation,
  ctx: OperationContext
): Promise<AIOperationResult> {
  const functions = ctx.db.collection('functions')

  // 检查新名称是否已存在
  const existing = await functions.findOne({
    userId: ctx.userId,
    name: op.newName,
    _id: { $ne: new ObjectId(op.functionId) },
  })

  if (existing) {
    return {
      operation: op,
      success: false,
      error: `函数名 "${op.newName}" 已存在`,
    }
  }

  const fn = await functions.findOne({
    _id: new ObjectId(op.functionId),
    userId: ctx.userId,
  })

  if (!fn) {
    return {
      operation: op,
      success: false,
      error: '函数不存在或无权限',
    }
  }

  // 更新路径
  const oldName = fn.name as string
  const newPath = (fn.path as string).replace(new RegExp(`/${oldName}$`), `/${op.newName}`)

  await functions.updateOne(
    { _id: new ObjectId(op.functionId) },
    {
      $set: {
        name: op.newName,
        path: newPath,
        updatedAt: new Date(),
      },
    }
  )

  // 记录审计日志
  await logAIAction({
    functionId: op.functionId,
    functionName: op.newName,
    userId: ctx.userId,
    username: ctx.username,
    action: 'rename',
    modelName: ctx.modelName,
    changes: {
      description: `AI 重命名函数: ${oldName} -> ${op.newName}`,
    },
    metadata: {
      oldName,
      newName: op.newName,
    },
  }, ctx.db)

  return {
    operation: op,
    success: true,
    result: {
      functionId: op.functionId,
      name: op.newName,
    },
  }
}

/**
 * 创建文件夹
 */
export async function createFolder(
  op: CreateFolderOperation,
  ctx: OperationContext
): Promise<AIOperationResult> {
  const folders = ctx.db.collection('folders')

  // 检查名称是否已存在
  const existing = await folders.findOne({
    userId: ctx.userId,
    name: op.name,
    parentId: op.parentId ? new ObjectId(op.parentId) : null,
  })

  if (existing) {
    return {
      operation: op,
      success: false,
      error: `文件夹 "${op.name}" 已存在`,
    }
  }

  // 计算路径
  let path = `/${op.name}`
  if (op.parentId) {
    const parent = await folders.findOne({
      _id: new ObjectId(op.parentId),
      userId: ctx.userId,
    })
    if (parent) {
      path = `${parent.path}/${op.name}`
    }
  }

  const result = await folders.insertOne({
    userId: ctx.userId,
    name: op.name,
    parentId: op.parentId ? new ObjectId(op.parentId) : null,
    path,
    order: Date.now(),
    createdAt: new Date(),
  })

  return {
    operation: op,
    success: true,
    result: {
      folderId: result.insertedId.toString(),
      name: op.name,
    },
  }
}

/**
 * 移动函数
 */
export async function moveFunction(
  op: MoveFunctionOperation,
  ctx: OperationContext
): Promise<AIOperationResult> {
  const functions = ctx.db.collection('functions')
  const folders = ctx.db.collection('folders')

  const fn = await functions.findOne({
    _id: new ObjectId(op.functionId),
    userId: ctx.userId,
  })

  if (!fn) {
    return {
      operation: op,
      success: false,
      error: '函数不存在或无权限',
    }
  }

  const oldPath = fn.path as string

  // 计算新路径
  let newPath = `/${fn.name}`
  if (op.targetFolderId) {
    const folder = await folders.findOne({
      _id: new ObjectId(op.targetFolderId),
      userId: ctx.userId,
    })
    if (folder) {
      newPath = `${folder.path}/${fn.name}`
    }
  }

  await functions.updateOne(
    { _id: new ObjectId(op.functionId) },
    {
      $set: {
        folderId: op.targetFolderId ? new ObjectId(op.targetFolderId) : null,
        path: newPath,
        updatedAt: new Date(),
      },
    }
  )

  // 记录审计日志
  await logAIAction({
    functionId: op.functionId,
    functionName: fn.name as string,
    userId: ctx.userId,
    username: ctx.username,
    action: 'move',
    modelName: ctx.modelName,
    changes: {
      description: `AI 移动函数: ${oldPath} -> ${newPath}`,
    },
    metadata: {
      oldPath,
      newPath,
      targetFolderId: op.targetFolderId || null,
    },
  }, ctx.db)

  return {
    operation: op,
    success: true,
    result: {
      functionId: op.functionId,
      name: fn.name,
    },
  }
}
