import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { ObjectId } from 'mongodb'
import { connectTestDB, closeTestDB, clearTestDB, getTestDB } from '../test/setup.js'
import { setDB } from '../db.js'
import { config } from '../config.js'
import foldersRouter from './folders.js'

describe('folders routes', () => {
  const app = express()
  app.use(express.json())
  app.use('/api/folders', foldersRouter)

  const testUserId = new ObjectId()
  const token = jwt.sign(
    { userId: testUserId.toString(), username: 'testuser' },
    config.jwtSecret
  )

  beforeAll(async () => {
    const db = await connectTestDB()
    setDB(db)
  })

  afterAll(async () => {
    await closeTestDB()
  })

  beforeEach(async () => {
    await clearTestDB()
  })

  describe('GET /api/folders', () => {
    it('should return empty tree when no folders', async () => {
      const res = await request(app)
        .get('/api/folders')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toEqual([])
    })

    it('should return folder tree structure', async () => {
      // 创建文件夹
      await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'parent' })

      const res = await request(app)
        .get('/api/folders')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].title).toBe('parent')
      expect(res.body.data[0].isFolder).toBe(true)
    })

    it('should require authentication', async () => {
      const res = await request(app).get('/api/folders')
      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/folders', () => {
    it('should create root folder', async () => {
      const res = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'newFolder' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.name).toBe('newFolder')
      expect(res.body.data.path).toBe('newFolder')
    })

    it('should create nested folder', async () => {
      const parentRes = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'parent' })

      const parentId = parentRes.body.data._id

      const res = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'child', parentId })

      expect(res.status).toBe(200)
      expect(res.body.data.path).toBe('parent/child')
    })

    it('should return 400 for empty name', async () => {
      const res = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('INVALID_INPUT')
    })

    it('should return 400 for duplicate folder', async () => {
      await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'duplicate' })

      const res = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'duplicate' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('CREATE_FAILED')
    })
  })

  describe('PATCH /api/folders/:id', () => {
    it('should rename folder', async () => {
      const createRes = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'oldName' })

      const folderId = createRes.body.data._id

      const res = await request(app)
        .patch(`/api/folders/${folderId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'newName' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      // 验证重命名成功
      const treeRes = await request(app)
        .get('/api/folders')
        .set('Authorization', `Bearer ${token}`)

      expect(treeRes.body.data[0].title).toBe('newName')
    })

    it('should return 400 for empty name', async () => {
      const createRes = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'folder' })

      const res = await request(app)
        .patch(`/api/folders/${createRes.body.data._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '' })

      expect(res.status).toBe(400)
    })

    it('should update child paths when renaming parent', async () => {
      const parentRes = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'parent' })

      await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'child', parentId: parentRes.body.data._id })

      await request(app)
        .patch(`/api/folders/${parentRes.body.data._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'renamed' })

      const treeRes = await request(app)
        .get('/api/folders')
        .set('Authorization', `Bearer ${token}`)

      expect(treeRes.body.data[0].title).toBe('renamed')
      expect(treeRes.body.data[0].children[0].path).toBe('renamed/child')
    })
  })

  describe('DELETE /api/folders/:id', () => {
    it('should delete empty folder', async () => {
      const createRes = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'toDelete' })

      const res = await request(app)
        .delete(`/api/folders/${createRes.body.data._id}`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)

      const treeRes = await request(app)
        .get('/api/folders')
        .set('Authorization', `Bearer ${token}`)

      expect(treeRes.body.data).toHaveLength(0)
    })

    it('should return 400 for non-empty folder', async () => {
      const parentRes = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'parent' })

      await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'child', parentId: parentRes.body.data._id })

      const res = await request(app)
        .delete(`/api/folders/${parentRes.body.data._id}`)
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('不为空')
    })
  })

  describe('POST /api/folders/:id/move', () => {
    it('should move folder to new parent', async () => {
      const folder1Res = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'folder1' })

      const folder2Res = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'folder2' })

      const res = await request(app)
        .post(`/api/folders/${folder1Res.body.data._id}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ parentId: folder2Res.body.data._id })

      expect(res.status).toBe(200)
      expect(res.body.data.newPath).toBe('folder2/folder1')
    })

    it('should move folder to root', async () => {
      const parentRes = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'parent' })

      const childRes = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'child', parentId: parentRes.body.data._id })

      const res = await request(app)
        .post(`/api/folders/${childRes.body.data._id}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ parentId: null })

      expect(res.status).toBe(200)
      expect(res.body.data.newPath).toBe('child')
    })

    it('should return 400 when moving to self', async () => {
      const folderRes = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'folder' })

      const res = await request(app)
        .post(`/api/folders/${folderRes.body.data._id}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ parentId: folderRes.body.data._id })

      expect(res.status).toBe(400)
    })
  })
})
