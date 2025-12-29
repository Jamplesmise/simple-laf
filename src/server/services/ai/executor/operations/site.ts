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
  baseUrl?: string  // 基础URL，用于生成完整的站点访问地址
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

/**
 * 列出站点文件
 */
export async function listSiteFiles(
  op: { type: 'listSiteFiles'; path?: string; recursive?: boolean },
  ctx: SiteOperationContext
): Promise<AIOperationResult> {
  try {
    const path = op.path || '/'
    const recursive = op.recursive !== false // 默认 true

    // 获取文件列表
    const files = await siteFileService.list(ctx.userId, path, recursive)

    // 格式化文件信息
    const fileList = files.map(f => ({
      path: f.path,
      name: f.name,
      type: f.isDirectory ? 'folder' : 'file',
      size: f.size,
      mimeType: f.mimeType,
      updatedAt: f.updatedAt,
    }))

    return {
      operation: op,
      success: true,
      result: {
        files: fileList,
        total: fileList.length,
      },
    }
  } catch (err) {
    return {
      operation: op,
      success: false,
      error: err instanceof Error ? err.message : '获取文件列表失败',
    }
  }
}

/**
 * 读取站点文件
 */
export async function readSiteFile(
  op: { type: 'readSiteFile'; path: string },
  ctx: SiteOperationContext
): Promise<AIOperationResult> {
  try {
    // 获取文件信息
    const file = await siteFileService.get(ctx.userId, op.path)
    if (!file) {
      return {
        operation: op,
        success: false,
        error: `文件 "${op.path}" 不存在`,
      }
    }

    if (file.isDirectory) {
      return {
        operation: op,
        success: false,
        error: `"${op.path}" 是文件夹，不是文件`,
      }
    }

    // 读取文件内容
    const result = await siteFileService.readContent(ctx.userId, op.path)

    return {
      operation: op,
      success: true,
      result: {
        path: file.path,
        name: file.name,
        content: result.content,
        mimeType: file.mimeType,
        size: file.size,
        updatedAt: file.updatedAt,
      },
    }
  } catch (err) {
    return {
      operation: op,
      success: false,
      error: err instanceof Error ? err.message : '读取文件失败',
    }
  }
}

/**
 * 获取站点信息
 */
export async function getSiteInfo(
  op: { type: 'getSiteInfo' },
  ctx: SiteOperationContext
): Promise<AIOperationResult> {
  try {
    // 获取站点配置
    const site = await siteService.getOrCreate(ctx.userId)

    // 获取统计信息
    const stats = await siteService.getStats(ctx.userId)

    // 构建访问地址
    // 优先级：1. 请求中的baseUrl  2. 环境变量BASE_URL  3. 相对路径
    const relativePath = `/site/${ctx.userId.toHexString()}/`
    let siteUrl: string

    if (ctx.baseUrl) {
      // 使用请求中传递的 baseUrl（动态获取）
      siteUrl = `${ctx.baseUrl}${relativePath}`
    } else if (process.env.BASE_URL) {
      // 使用环境变量配置
      siteUrl = `${process.env.BASE_URL}${relativePath}`
    } else {
      // 返回相对路径，让前端或用户根据实际域名访问
      siteUrl = relativePath
    }

    return {
      operation: op,
      success: true,
      result: {
        siteUrl,
        relativePath,  // 始终返回相对路径，方便用户在不同环境使用
        name: site.name,
        enabled: site.enabled,
        defaultFile: site.defaultFile,
        spaMode: site.spaMode,
        accessControl: {
          type: site.accessControl.type,
          hasPassword: !!site.accessControl.password,
        },
        stats: {
          totalFiles: stats.totalFiles,
          totalSize: stats.totalSize,
          usedPercent: stats.usagePercent,
        },
      },
    }
  } catch (err) {
    return {
      operation: op,
      success: false,
      error: err instanceof Error ? err.message : '获取站点信息失败',
    }
  }
}
