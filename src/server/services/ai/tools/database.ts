/**
 * 数据库工具模块
 *
 * 提供 MongoDB 集合分析、查询执行、索引建议功能
 * Sprint 18: 数据库增强
 */

import type { Sort } from 'mongodb'
import { getUserDataDB } from '../../../db.js'

// ==================== 类型定义 ====================

/**
 * 字段 Schema 信息
 */
export interface FieldSchema {
  field: string
  type: string
  nullable: boolean
  frequency: number  // 出现频率 (0-1)
  sampleValues: unknown[]
}

/**
 * 索引信息
 */
export interface IndexInfo {
  name: string
  keys: Record<string, number>
  unique: boolean
  sparse?: boolean
  background?: boolean
}

/**
 * 集合分析结果
 */
export interface CollectionAnalysisResult {
  collection: string
  documentCount: number
  avgDocumentSize: number
  totalSize: number
  schema: FieldSchema[]
  indexes: IndexInfo[]
}

/**
 * 分析集合参数
 */
export interface AnalyzeCollectionParams {
  collection: string
}

// ==================== 辅助函数 ====================

/**
 * 获取值的类型
 */
function getValueType(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return 'array'
  if (value instanceof Date) return 'date'
  if (typeof value === 'object' && '_bsontype' in (value as object)) {
    const bsonType = (value as { _bsontype: string })._bsontype
    if (bsonType === 'ObjectId' || bsonType === 'ObjectID') return 'ObjectId'
    return bsonType.toLowerCase()
  }
  return typeof value
}

/**
 * 脱敏处理样本值
 */
function sanitizeSampleValue(value: unknown, fieldName: string): unknown {
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'api_key', 'accessToken', 'refreshToken', 'privateKey', 'credential']
  const lowerFieldName = fieldName.toLowerCase()

  // 检查是否为敏感字段
  const isSensitive = sensitiveFields.some(sf => lowerFieldName.includes(sf.toLowerCase()))

  if (isSensitive) {
    if (typeof value === 'string') {
      return value.length > 0 ? '***' : ''
    }
    return '***'
  }

  // 处理 ObjectId
  if (typeof value === 'object' && value !== null && '_bsontype' in value) {
    return value.toString()
  }

  // 处理日期
  if (value instanceof Date) {
    return value.toISOString()
  }

  // 处理嵌套对象（只返回键）
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return `{${Object.keys(value).join(', ')}}`
  }

  // 处理数组（返回长度和类型）
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const firstType = getValueType(value[0])
    return `[${firstType}...] (${value.length} items)`
  }

  return value
}

/**
 * 从文档样本中推断 Schema
 */
function inferSchema(documents: Record<string, unknown>[]): FieldSchema[] {
  if (documents.length === 0) return []

  const fieldStats: Map<string, {
    types: Map<string, number>
    nullCount: number
    samples: Set<string>
  }> = new Map()

  // 分析每个文档
  for (const doc of documents) {
    analyzeDocument(doc, '', fieldStats)
  }

  // 生成 Schema
  const schema: FieldSchema[] = []
  const totalDocs = documents.length

  for (const [field, stats] of Array.from(fieldStats.entries())) {
    // 找出最常见的类型
    let mainType = 'unknown'
    let maxCount = 0
    for (const [type, count] of Array.from(stats.types.entries())) {
      if (count > maxCount) {
        mainType = type
        maxCount = count
      }
    }

    // 如果有多种类型，标记为 mixed
    if (stats.types.size > 1) {
      const types = Array.from(stats.types.keys()).join(' | ')
      mainType = `mixed (${types})`
    }

    schema.push({
      field,
      type: mainType,
      nullable: stats.nullCount > 0,
      frequency: (totalDocs - stats.nullCount) / totalDocs,
      sampleValues: Array.from(stats.samples).slice(0, 3),
    })
  }

  // 按字段名排序，_id 优先
  schema.sort((a, b) => {
    if (a.field === '_id') return -1
    if (b.field === '_id') return 1
    return a.field.localeCompare(b.field)
  })

  return schema
}

/**
 * 递归分析文档结构
 */
function analyzeDocument(
  obj: Record<string, unknown>,
  prefix: string,
  stats: Map<string, { types: Map<string, number>; nullCount: number; samples: Set<string> }>
): void {
  for (const [key, value] of Object.entries(obj)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key

    if (!stats.has(fieldPath)) {
      stats.set(fieldPath, {
        types: new Map(),
        nullCount: 0,
        samples: new Set(),
      })
    }

    const fieldStats = stats.get(fieldPath)!
    const valueType = getValueType(value)

    // 统计类型
    fieldStats.types.set(valueType, (fieldStats.types.get(valueType) || 0) + 1)

    // 统计空值
    if (value === null || value === undefined) {
      fieldStats.nullCount++
    }

    // 收集样本值（最多 3 个）
    if (fieldStats.samples.size < 3 && value !== null && value !== undefined) {
      const sanitized = sanitizeSampleValue(value, key)
      const sampleStr = typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized)
      if (sampleStr.length <= 50) {
        fieldStats.samples.add(sampleStr)
      }
    }

    // 递归处理嵌套对象（限制深度为 3）
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const depth = fieldPath.split('.').length
      if (depth < 3 && !('_bsontype' in value)) {
        analyzeDocument(value as Record<string, unknown>, fieldPath, stats)
      }
    }
  }
}

// ==================== 主函数 ====================

/**
 * 分析 MongoDB 集合结构
 */
export async function analyzeCollection(params: AnalyzeCollectionParams): Promise<CollectionAnalysisResult> {
  const db = getUserDataDB()
  const coll = db.collection(params.collection)

  // 检查集合是否存在
  const collections = await db.listCollections({ name: params.collection }).toArray()
  if (collections.length === 0) {
    throw new Error(`集合 "${params.collection}" 不存在`)
  }

  // 获取统计信息
  const stats = await db.command({ collStats: params.collection })

  // 采样分析 schema（最多 100 个文档）
  const sample = await coll.aggregate([
    { $sample: { size: 100 } }
  ]).toArray() as Record<string, unknown>[]

  const schema = inferSchema(sample)

  // 获取索引信息
  const indexesCursor = await coll.indexes()
  const indexes: IndexInfo[] = indexesCursor.map(idx => ({
    name: idx.name || 'unknown',
    keys: idx.key as Record<string, number>,
    unique: idx.unique || false,
    sparse: idx.sparse,
    background: idx.background,
  }))

  return {
    collection: params.collection,
    documentCount: stats.count || 0,
    avgDocumentSize: stats.avgObjSize || 0,
    totalSize: stats.size || 0,
    schema,
    indexes,
  }
}

// ==================== 查询执行 ====================

/**
 * 查询执行参数
 */
export interface ExecuteQueryParams {
  collection: string
  query: Record<string, unknown>
  projection?: Record<string, number>
  sort?: Record<string, number>
  limit?: number
  skip?: number
}

/**
 * 查询执行结果
 */
export interface ExecuteQueryResult {
  documents: Record<string, unknown>[]
  count: number
  executionTime: number
  hasMore: boolean
}

/**
 * 敏感字段列表
 */
const SENSITIVE_FIELDS = [
  'password', 'passwd', 'pwd',
  'token', 'accessToken', 'refreshToken', 'access_token', 'refresh_token',
  'secret', 'secretKey', 'secret_key',
  'apiKey', 'api_key', 'apikey',
  'privateKey', 'private_key',
  'credential', 'credentials',
  'key', 'authKey', 'auth_key',
]

/**
 * 检查字段名是否为敏感字段
 */
function isSensitiveField(fieldName: string): boolean {
  const lowerName = fieldName.toLowerCase()
  return SENSITIVE_FIELDS.some(sf => lowerName.includes(sf.toLowerCase()))
}

/**
 * 递归脱敏文档
 */
function sanitizeDocument(doc: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(doc)) {
    if (isSensitiveField(key)) {
      // 敏感字段脱敏
      result[key] = typeof value === 'string' && value.length > 0 ? '***' : '***'
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        // 处理数组
        result[key] = value.map(item =>
          typeof item === 'object' && item !== null
            ? sanitizeDocument(item as Record<string, unknown>)
            : item
        )
      } else if ('_bsontype' in value) {
        // 处理 BSON 类型（如 ObjectId）
        result[key] = value.toString()
      } else if (value instanceof Date) {
        // 处理日期
        result[key] = value.toISOString()
      } else {
        // 递归处理嵌套对象
        result[key] = sanitizeDocument(value as Record<string, unknown>)
      }
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * 验证查询是否为只读操作
 * 禁止使用可能修改数据的操作符
 */
function validateReadOnlyQuery(query: Record<string, unknown>): void {
  const dangerousOperators = ['$set', '$unset', '$inc', '$push', '$pull', '$addToSet', '$pop', '$rename', '$bit']

  const checkObject = (obj: unknown, path: string): void => {
    if (typeof obj !== 'object' || obj === null) return

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (dangerousOperators.includes(key)) {
        throw new Error(`禁止使用修改操作符: ${key}`)
      }
      if (typeof value === 'object' && value !== null) {
        checkObject(value, `${path}.${key}`)
      }
    }
  }

  checkObject(query, '')
}

/**
 * 执行 MongoDB 查询（只读）
 */
export async function executeQuery(params: ExecuteQueryParams): Promise<ExecuteQueryResult> {
  const db = getUserDataDB()
  const coll = db.collection(params.collection)

  // 检查集合是否存在
  const collections = await db.listCollections({ name: params.collection }).toArray()
  if (collections.length === 0) {
    throw new Error(`集合 "${params.collection}" 不存在`)
  }

  // 验证查询是否为只读
  validateReadOnlyQuery(params.query)

  // 限制返回数量（最大 100）
  const limit = Math.min(Math.max(params.limit || 10, 1), 100)
  const skip = Math.max(params.skip || 0, 0)

  const startTime = Date.now()

  // 构建查询
  let cursor = coll.find(params.query)

  if (params.projection) {
    cursor = cursor.project(params.projection)
  }

  if (params.sort) {
    cursor = cursor.sort(params.sort as Sort)
  }

  cursor = cursor.skip(skip).limit(limit + 1)  // 多取一条判断是否有更多

  const documents = await cursor.toArray()
  const executionTime = Date.now() - startTime

  // 判断是否有更多数据
  const hasMore = documents.length > limit
  if (hasMore) {
    documents.pop()
  }

  // 脱敏处理
  const sanitizedDocs = documents.map(doc => sanitizeDocument(doc as Record<string, unknown>))

  return {
    documents: sanitizedDocs,
    count: sanitizedDocs.length,
    executionTime,
    hasMore,
  }
}

// ==================== 索引建议 ====================

/**
 * 索引建议参数
 */
export interface SuggestIndexesParams {
  collection: string
}

/**
 * 索引建议项
 */
export interface IndexSuggestion {
  fields: string[]
  reason: string
  impact: 'high' | 'medium' | 'low'
  type: 'single' | 'compound' | 'text' | 'unique'
}

/**
 * 索引建议结果
 */
export interface SuggestIndexesResult {
  collection: string
  existingIndexes: IndexInfo[]
  suggestions: IndexSuggestion[]
  warnings: string[]
}

/**
 * 分析字段的索引需求
 */
function analyzeFieldIndexNeed(
  fieldName: string,
  schema: FieldSchema,
  existingIndexes: IndexInfo[]
): IndexSuggestion | null {
  // 检查是否已有索引
  const hasIndex = existingIndexes.some(idx =>
    Object.keys(idx.keys).includes(fieldName)
  )

  if (hasIndex) return null

  // _id 字段默认有索引
  if (fieldName === '_id') return null

  // 常见需要索引的字段模式
  const highPriorityPatterns = [
    /^user[_]?id$/i,
    /^created[_]?at$/i,
    /^updated[_]?at$/i,
    /^status$/i,
    /^type$/i,
    /^category$/i,
    /^email$/i,
    /^username$/i,
    /^phone$/i,
  ]

  const mediumPriorityPatterns = [
    /^.*[_]?id$/i,
    /^.*[_]?at$/i,
    /^.*[_]?date$/i,
    /^name$/i,
    /^title$/i,
    /^code$/i,
    /^order$/i,
    /^sort$/i,
  ]

  // 检查字段类型
  const isObjectId = schema.type === 'ObjectId'
  const isDate = schema.type === 'date'
  const isHighFrequency = schema.frequency >= 0.9

  // 高优先级字段
  if (highPriorityPatterns.some(p => p.test(fieldName))) {
    return {
      fields: [fieldName],
      reason: `"${fieldName}" 是常用查询字段，建议添加索引以提升查询性能`,
      impact: 'high',
      type: isObjectId || fieldName.toLowerCase().includes('email') ? 'unique' : 'single',
    }
  }

  // ObjectId 类型字段（通常是外键）
  if (isObjectId && !fieldName.includes('.')) {
    return {
      fields: [fieldName],
      reason: `"${fieldName}" 是 ObjectId 类型，可能是外键关联字段，建议添加索引`,
      impact: 'medium',
      type: 'single',
    }
  }

  // 日期字段
  if (isDate && !fieldName.includes('.')) {
    return {
      fields: [fieldName],
      reason: `"${fieldName}" 是日期类型，常用于范围查询和排序，建议添加索引`,
      impact: 'medium',
      type: 'single',
    }
  }

  // 中等优先级字段
  if (mediumPriorityPatterns.some(p => p.test(fieldName)) && isHighFrequency) {
    return {
      fields: [fieldName],
      reason: `"${fieldName}" 符合常见查询模式，且数据完整度高，建议添加索引`,
      impact: 'low',
      type: 'single',
    }
  }

  return null
}

/**
 * 分析复合索引需求
 */
function analyzeCompoundIndexNeed(
  schema: FieldSchema[],
  existingIndexes: IndexInfo[]
): IndexSuggestion[] {
  const suggestions: IndexSuggestion[] = []

  // 常见的复合索引组合
  const commonCompounds = [
    { fields: ['userId', 'createdAt'], reason: '用户+时间查询优化' },
    { fields: ['userId', 'status'], reason: '用户+状态查询优化' },
    { fields: ['status', 'createdAt'], reason: '状态+时间查询优化' },
    { fields: ['type', 'status'], reason: '类型+状态查询优化' },
    { fields: ['category', 'createdAt'], reason: '分类+时间查询优化' },
  ]

  const schemaFields = new Set(schema.map(s => s.field))

  for (const compound of commonCompounds) {
    // 检查字段是否都存在
    const fieldsExist = compound.fields.every(f =>
      schemaFields.has(f) || schemaFields.has(f.replace(/([A-Z])/g, '_$1').toLowerCase())
    )

    if (!fieldsExist) continue

    // 检查是否已有该复合索引
    const hasCompoundIndex = existingIndexes.some(idx => {
      const indexFields = Object.keys(idx.keys)
      return compound.fields.every((f, i) =>
        indexFields[i]?.toLowerCase() === f.toLowerCase() ||
        indexFields[i]?.toLowerCase() === f.replace(/([A-Z])/g, '_$1').toLowerCase()
      )
    })

    if (hasCompoundIndex) continue

    // 找到实际字段名
    const actualFields = compound.fields.map(f => {
      if (schemaFields.has(f)) return f
      const snakeCase = f.replace(/([A-Z])/g, '_$1').toLowerCase()
      if (schemaFields.has(snakeCase)) return snakeCase
      return f
    })

    suggestions.push({
      fields: actualFields,
      reason: compound.reason,
      impact: 'medium',
      type: 'compound',
    })
  }

  return suggestions
}

/**
 * 生成索引优化建议
 */
export async function suggestIndexes(params: SuggestIndexesParams): Promise<SuggestIndexesResult> {
  const db = getUserDataDB()
  const coll = db.collection(params.collection)

  // 检查集合是否存在
  const collections = await db.listCollections({ name: params.collection }).toArray()
  if (collections.length === 0) {
    throw new Error(`集合 "${params.collection}" 不存在`)
  }

  // 获取统计信息
  const stats = await db.command({ collStats: params.collection })
  const documentCount = stats.count || 0

  // 采样分析 schema
  const sample = await coll.aggregate([
    { $sample: { size: 100 } }
  ]).toArray() as Record<string, unknown>[]

  const schema = inferSchema(sample)

  // 获取现有索引
  const indexesCursor = await coll.indexes()
  const existingIndexes: IndexInfo[] = indexesCursor.map(idx => ({
    name: idx.name || 'unknown',
    keys: idx.key as Record<string, number>,
    unique: idx.unique || false,
    sparse: idx.sparse,
    background: idx.background,
  }))

  const suggestions: IndexSuggestion[] = []
  const warnings: string[] = []

  // 分析单字段索引需求
  for (const field of schema) {
    // 只分析顶层字段
    if (field.field.includes('.')) continue

    const suggestion = analyzeFieldIndexNeed(field.field, field, existingIndexes)
    if (suggestion) {
      suggestions.push(suggestion)
    }
  }

  // 分析复合索引需求
  const compoundSuggestions = analyzeCompoundIndexNeed(schema, existingIndexes)
  suggestions.push(...compoundSuggestions)

  // 生成警告
  if (documentCount > 10000 && existingIndexes.length <= 1) {
    warnings.push(`集合有 ${documentCount} 个文档但只有默认 _id 索引，可能存在性能问题`)
  }

  if (existingIndexes.length > 10) {
    warnings.push(`集合有 ${existingIndexes.length} 个索引，过多索引会影响写入性能`)
  }

  // 按影响程度排序
  const impactOrder = { high: 0, medium: 1, low: 2 }
  suggestions.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact])

  return {
    collection: params.collection,
    existingIndexes,
    suggestions,
    warnings,
  }
}
