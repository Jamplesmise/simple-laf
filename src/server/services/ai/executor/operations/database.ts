/**
 * 数据库操作执行器
 *
 * Sprint 18: 数据库增强
 * 实现集合分析、查询执行、索引建议操作
 */

import type {
  AnalyzeCollectionOperation,
  ExecuteQueryOperation,
  SuggestIndexesOperation,
  AIOperationResult,
} from '../../types.js'
import {
  analyzeCollection as doAnalyzeCollection,
  executeQuery as doExecuteQuery,
  suggestIndexes as doSuggestIndexes,
} from '../../tools/database.js'

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/**
 * 执行集合分析
 */
export async function analyzeCollection(operation: AnalyzeCollectionOperation): Promise<AIOperationResult> {
  try {
    const result = await doAnalyzeCollection({
      collection: operation.collection,
    })

    // 格式化输出
    const schemaPreview = result.schema.slice(0, 10).map(f =>
      `  - ${f.field}: ${f.type}${f.nullable ? ' (nullable)' : ''}`
    ).join('\n')

    const indexesInfo = result.indexes.map(idx =>
      `  - ${idx.name}: ${JSON.stringify(idx.keys)}${idx.unique ? ' [unique]' : ''}`
    ).join('\n')

    const summary = [
      `集合: ${result.collection}`,
      `文档数量: ${result.documentCount.toLocaleString()}`,
      `平均文档大小: ${formatSize(result.avgDocumentSize)}`,
      `总存储大小: ${formatSize(result.totalSize)}`,
      '',
      `字段结构 (共 ${result.schema.length} 个字段):`,
      schemaPreview,
      result.schema.length > 10 ? `  ... 还有 ${result.schema.length - 10} 个字段` : '',
      '',
      `索引 (共 ${result.indexes.length} 个):`,
      indexesInfo || '  无索引',
    ].filter(Boolean).join('\n')

    return {
      operation,
      success: true,
      result: {
        ...result,
        summary,
      },
    }
  } catch (err) {
    return {
      operation,
      success: false,
      error: (err as Error).message,
    }
  }
}

/**
 * 执行查询
 */
export async function executeQuery(operation: ExecuteQueryOperation): Promise<AIOperationResult> {
  try {
    const result = await doExecuteQuery({
      collection: operation.collection,
      query: operation.query,
      projection: operation.projection,
      sort: operation.sort,
      limit: operation.limit,
      skip: operation.skip,
    })

    // 格式化输出
    const summary = [
      `集合: ${operation.collection}`,
      `查询条件: ${JSON.stringify(operation.query)}`,
      `返回文档数: ${result.count}`,
      `执行时间: ${result.executionTime}ms`,
      result.hasMore ? '(还有更多数据)' : '',
    ].filter(Boolean).join('\n')

    return {
      operation,
      success: true,
      result: {
        ...result,
        summary,
      },
    }
  } catch (err) {
    return {
      operation,
      success: false,
      error: (err as Error).message,
    }
  }
}

/**
 * 执行索引建议分析
 */
export async function suggestIndexes(operation: SuggestIndexesOperation): Promise<AIOperationResult> {
  try {
    const result = await doSuggestIndexes({
      collection: operation.collection,
    })

    // 格式化输出
    const existingInfo = result.existingIndexes.map(idx =>
      `  - ${idx.name}: ${JSON.stringify(idx.keys)}${idx.unique ? ' [unique]' : ''}`
    ).join('\n')

    const suggestionsInfo = result.suggestions.map((s, i) =>
      `  ${i + 1}. [${s.impact.toUpperCase()}] ${s.fields.join(', ')}\n     类型: ${s.type}\n     原因: ${s.reason}`
    ).join('\n\n')

    const warningsInfo = result.warnings.length > 0
      ? `\n警告:\n${result.warnings.map(w => `  - ${w}`).join('\n')}`
      : ''

    const summary = [
      `集合: ${result.collection}`,
      '',
      `现有索引 (${result.existingIndexes.length} 个):`,
      existingInfo || '  无索引',
      '',
      `索引建议 (${result.suggestions.length} 个):`,
      suggestionsInfo || '  无需额外索引',
      warningsInfo,
    ].filter(Boolean).join('\n')

    return {
      operation,
      success: true,
      result: {
        ...result,
        summary,
      },
    }
  } catch (err) {
    return {
      operation,
      success: false,
      error: (err as Error).message,
    }
  }
}
