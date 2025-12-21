/**
 * 项目文件操作执行器
 *
 * 处理项目文件的读取、写入、文件树、搜索操作
 * Sprint 14: 项目代码操作
 */

import type {
  AIOperationResult,
  ReadProjectFileOperation,
  WriteProjectFileOperation,
  GetFileTreeOperation,
  SearchCodeOperation,
} from '../../types.js'
import * as projectFileTools from '../../tools/projectFile.js'
import * as searchTools from '../../tools/search.js'

/**
 * 读取项目文件
 */
export async function readProjectFile(
  op: ReadProjectFileOperation
): Promise<AIOperationResult> {
  try {
    await projectFileTools.readProjectFile({
      path: op.path,
      lineStart: op.lineStart,
      lineEnd: op.lineEnd,
    })

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
      error: err instanceof Error ? err.message : '读取文件失败',
    }
  }
}

/**
 * 写入项目文件（需要用户确认）
 */
export async function writeProjectFile(
  op: WriteProjectFileOperation
): Promise<AIOperationResult> {
  try {
    await projectFileTools.writeProjectFile({
      path: op.path,
      content: op.content,
      createBackup: op.createBackup ?? true,
    })

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
      error: err instanceof Error ? err.message : '写入文件失败',
    }
  }
}

/**
 * 获取文件树
 */
export async function getFileTree(
  op: GetFileTreeOperation
): Promise<AIOperationResult> {
  try {
    await projectFileTools.getFileTree({
      path: op.path,
      depth: op.depth,
      exclude: op.exclude,
    })

    return {
      operation: op,
      success: true,
      result: {
        name: op.path || '.',
      },
    }
  } catch (err) {
    return {
      operation: op,
      success: false,
      error: err instanceof Error ? err.message : '获取文件树失败',
    }
  }
}

/**
 * 代码搜索
 */
export async function searchCode(
  op: SearchCodeOperation
): Promise<AIOperationResult> {
  try {
    const result = await searchTools.searchCode({
      query: op.query,
      filePattern: op.filePattern,
      caseSensitive: op.caseSensitive,
    })

    return {
      operation: op,
      success: true,
      result: {
        name: `找到 ${result.totalMatches} 个匹配`,
      },
    }
  } catch (err) {
    return {
      operation: op,
      success: false,
      error: err instanceof Error ? err.message : '搜索失败',
    }
  }
}
