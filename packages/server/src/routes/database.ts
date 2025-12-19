/**
 * MongoDB 数据库管理路由
 */

import { Router, type IRouter } from 'express'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import * as databaseService from '../services/database.js'

const router: IRouter = Router()

// 所有路由都需要认证
router.use(authMiddleware)

// ==================== 集合管理 ====================

// 获取集合列表
router.get('/collections', async (_req: AuthRequest, res) => {
  try {
    const collections = await databaseService.listCollections()
    res.json({ success: true, data: collections })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取集合列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 创建集合
router.post('/collections', async (req: AuthRequest, res) => {
  try {
    const { name } = req.body

    if (!name) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '集合名称不能为空' }
      })
      return
    }

    await databaseService.createCollection(name)
    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建集合失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 删除集合
router.delete('/collections/:name', async (req: AuthRequest, res) => {
  try {
    const { name } = req.params
    await databaseService.dropCollection(name)
    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除集合失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取集合统计
router.get('/collections/:name/stats', async (req: AuthRequest, res) => {
  try {
    const { name } = req.params
    const stats = await databaseService.getCollectionStats(name)
    res.json({ success: true, data: stats })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取集合统计失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// ==================== 文档管理 ====================

// 查询文档
router.get('/collections/:name/documents', async (req: AuthRequest, res) => {
  try {
    const { name } = req.params
    const { query, skip, limit, sort } = req.query

    const options: databaseService.FindOptions = {}

    if (query) {
      try {
        options.query = JSON.parse(query as string)
      } catch {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_QUERY', message: '查询条件格式无效' }
        })
        return
      }
    }

    if (skip) options.skip = parseInt(skip as string, 10)
    if (limit) options.limit = parseInt(limit as string, 10)

    if (sort) {
      try {
        options.sort = JSON.parse(sort as string)
      } catch {
        // 忽略无效的排序
      }
    }

    const result = await databaseService.findDocuments(name, options)
    res.json({
      success: true,
      data: {
        documents: result.documents,
        total: result.total,
        skip: options.skip || 0,
        limit: options.limit || 20,
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询文档失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 获取单个文档
router.get('/collections/:name/documents/:id', async (req: AuthRequest, res) => {
  try {
    const { name, id } = req.params
    const doc = await databaseService.findDocument(name, id)

    if (!doc) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '文档不存在' }
      })
      return
    }

    res.json({ success: true, data: doc })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取文档失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 插入文档
router.post('/collections/:name/documents', async (req: AuthRequest, res) => {
  try {
    const { name } = req.params
    const doc = req.body

    if (!doc || typeof doc !== 'object') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '文档内容无效' }
      })
      return
    }

    const inserted = await databaseService.insertDocument(name, doc)
    res.json({ success: true, data: inserted })
  } catch (err) {
    const message = err instanceof Error ? err.message : '插入文档失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 更新文档 (部分更新)
router.patch('/collections/:name/documents/:id', async (req: AuthRequest, res) => {
  try {
    const { name, id } = req.params
    const update = req.body

    if (!update || typeof update !== 'object') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '更新内容无效' }
      })
      return
    }

    const updated = await databaseService.updateDocument(name, id, update)

    if (!updated) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '文档不存在' }
      })
      return
    }

    res.json({ success: true, data: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新文档失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 替换文档 (完整替换)
router.put('/collections/:name/documents/:id', async (req: AuthRequest, res) => {
  try {
    const { name, id } = req.params
    const doc = req.body

    if (!doc || typeof doc !== 'object') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '文档内容无效' }
      })
      return
    }

    const replaced = await databaseService.replaceDocument(name, id, doc)

    if (!replaced) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '文档不存在' }
      })
      return
    }

    res.json({ success: true, data: replaced })
  } catch (err) {
    const message = err instanceof Error ? err.message : '替换文档失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 删除文档
router.delete('/collections/:name/documents/:id', async (req: AuthRequest, res) => {
  try {
    const { name, id } = req.params
    const deleted = await databaseService.deleteDocument(name, id)

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '文档不存在' }
      })
      return
    }

    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除文档失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 批量删除文档
router.post('/collections/:name/documents/delete', async (req: AuthRequest, res) => {
  try {
    const { name } = req.params
    const { ids } = req.body

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请提供要删除的文档 ID 列表' }
      })
      return
    }

    const deletedCount = await databaseService.deleteDocuments(name, ids)
    res.json({ success: true, data: { deletedCount } })
  } catch (err) {
    const message = err instanceof Error ? err.message : '批量删除失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// ==================== 索引管理 ====================

// 获取索引列表
router.get('/collections/:name/indexes', async (req: AuthRequest, res) => {
  try {
    const { name } = req.params
    const indexes = await databaseService.listIndexes(name)
    res.json({ success: true, data: indexes })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取索引列表失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 创建索引
router.post('/collections/:name/indexes', async (req: AuthRequest, res) => {
  try {
    const { name } = req.params
    const { keys, options } = req.body

    if (!keys || typeof keys !== 'object') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '索引键无效' }
      })
      return
    }

    const indexName = await databaseService.createIndex(name, keys, options || {})
    res.json({ success: true, data: { name: indexName } })
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建索引失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

// 删除索引
router.delete('/collections/:name/indexes/:indexName', async (req: AuthRequest, res) => {
  try {
    const { name, indexName } = req.params
    await databaseService.dropIndex(name, indexName)
    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除索引失败'
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message }
    })
  }
})

export default router
