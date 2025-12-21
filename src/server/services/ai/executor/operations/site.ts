/**
 * 站点文件操作执行器
 *
 * 处理站点文件的创建、更新、删除操作
 */

import type { ObjectId } from 'mongodb'
import type {
  AIOperationResult,
  SiteCreateFileOperation,
  SiteUpdateFileOperation,
  SiteDeleteFileOperation,
  SiteCreateFolderOperation,
} from '../../types.js'
import * as siteService from '../../../site.js'
import * as siteFileService from '../../../siteFile.js'

export interface SiteOperationContext {
  userId: ObjectId
}

/**
 * 创建站点文件
 */
export async function siteCreateFile(
  op: SiteCreateFileOperation,
  ctx: SiteOperationContext
): Promise<AIOperationResult> {
  try {
    // 确保站点存在
    const site = await siteService.getOrCreate(ctx.userId)

    // 创建文件
    await siteFileService.save(
      ctx.userId,
      op.path,
      op.content,
      site
    )

    return {
      operation: op,
      success: true,
      result: {
        name: op.path,
      },
    }
  } catch (err) {
    return {
      operation: op,
      success: false,
      error: err instanceof Error ? err.message : '创建文件失败',
    }
  }
}

/**
 * 更新站点文件
 */
export async function siteUpdateFile(
  op: SiteUpdateFileOperation,
  ctx: SiteOperationContext
): Promise<AIOperationResult> {
  try {
    // 检查文件是否存在
    const existingFile = await siteFileService.get(ctx.userId, op.path)
    if (!existingFile) {
      return {
        operation: op,
        success: false,
        error: `文件 "${op.path}" 不存在`,
      }
    }

    // 获取站点配置
    const site = await siteService.getOrCreate(ctx.userId)

    // 更新文件
    await siteFileService.save(
      ctx.userId,
      op.path,
      op.content,
      site
    )

    return {
      operation: op,
      success: true,
      result: {
        name: op.path,
      },
    }
  } catch (err) {
    return {
      operation: op,
      success: false,
      error: err instanceof Error ? err.message : '更新文件失败',
    }
  }
}

/**
 * 删除站点文件
 */
export async function siteDeleteFile(
  op: SiteDeleteFileOperation,
  ctx: SiteOperationContext
): Promise<AIOperationResult> {
  try {
    // 检查文件是否存在
    const existingFile = await siteFileService.get(ctx.userId, op.path)
    if (!existingFile) {
      return {
        operation: op,
        success: false,
        error: `文件 "${op.path}" 不存在`,
      }
    }

    // 删除文件
    await siteFileService.remove(ctx.userId, op.path)

    return {
      operation: op,
      success: true,
      result: {
        name: op.path,
      },
    }
  } catch (err) {
    return {
      operation: op,
      success: false,
      error: err instanceof Error ? err.message : '删除文件失败',
    }
  }
}

/**
 * 创建站点文件夹
 */
export async function siteCreateFolder(
  op: SiteCreateFolderOperation,
  ctx: SiteOperationContext
): Promise<AIOperationResult> {
  try {
    // 确保站点存在
    await siteService.getOrCreate(ctx.userId)

    // 创建文件夹
    await siteFileService.createDirectory(ctx.userId, op.path)

    return {
      operation: op,
      success: true,
      result: {
        name: op.path,
      },
    }
  } catch (err) {
    return {
      operation: op,
      success: false,
      error: err instanceof Error ? err.message : '创建文件夹失败',
    }
  }
}
