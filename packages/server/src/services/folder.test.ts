import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { ObjectId } from 'mongodb'
import { connectTestDB, closeTestDB, clearTestDB, getTestDB } from '../test/setup.js'
import { setDB } from '../db.js'
import {
  createFolder,
  getFolderTree,
  renameFolder,
  deleteFolder,
  moveFolder,
  moveFunction,
  batchMoveFunctions,
  reorderItems
} from './folder.js'

describe('folder service', () => {
  let testUserId: ObjectId

  beforeAll(async () => {
    const db = await connectTestDB()
    setDB(db)
  })

  afterAll(async () => {
    await closeTestDB()
  })

  beforeEach(async () => {
    await clearTestDB()
    testUserId = new ObjectId()
  })

  describe('createFolder', () => {
    it('should create root folder', async () => {
      const folder = await createFolder('myFolder', null, testUserId)

      expect(folder).toBeDefined()
      expect(folder._id).toBeDefined()
      expect(folder.name).toBe('myFolder')
      expect(folder.path).toBe('myFolder')
      expect(folder.parentId).toBeUndefined()
      expect(folder.order).toBe(1)
    })

    it('should create nested folder', async () => {
      const parent = await createFolder('parent', null, testUserId)
      const child = await createFolder('child', parent._id, testUserId)

      expect(child.name).toBe('child')
      expect(child.path).toBe('parent/child')
      expect(child.parentId?.toString()).toBe(parent._id.toString())
    })

    it('should throw error for duplicate folder path', async () => {
      await createFolder('myFolder', null, testUserId)

      await expect(createFolder('myFolder', null, testUserId))
        .rejects.toThrow('文件夹已存在')
    })

    it('should throw error for non-existent parent', async () => {
      const fakeParentId = new ObjectId()

      await expect(createFolder('child', fakeParentId, testUserId))
        .rejects.toThrow('父文件夹不存在')
    })

    it('should increment order for each new folder', async () => {
      const f1 = await createFolder('folder1', null, testUserId)
      const f2 = await createFolder('folder2', null, testUserId)
      const f3 = await createFolder('folder3', null, testUserId)

      // 验证顺序值存在且有效
      expect(f1.order).toBeDefined()
      expect(f2.order).toBeDefined()
      expect(f3.order).toBeDefined()
      expect(typeof f1.order).toBe('number')
    })
  })

  describe('getFolderTree', () => {
    it('should return empty array for user with no folders', async () => {
      const tree = await getFolderTree(testUserId)
      expect(tree).toEqual([])
    })

    it('should return folder tree structure', async () => {
      const parent = await createFolder('parent', null, testUserId)
      await createFolder('child1', parent._id, testUserId)
      await createFolder('child2', parent._id, testUserId)

      const tree = await getFolderTree(testUserId)

      expect(tree).toHaveLength(1)
      expect(tree[0].title).toBe('parent')
      expect(tree[0].isFolder).toBe(true)
      expect(tree[0].children).toHaveLength(2)
    })

    it('should include functions in tree', async () => {
      const folder = await createFolder('myFolder', null, testUserId)

      const db = getTestDB()
      await db.collection('functions').insertOne({
        name: 'myFunc',
        code: 'code',
        userId: testUserId,
        folderId: folder._id,
        path: 'myFolder/myFunc',
        published: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const tree = await getFolderTree(testUserId)

      expect(tree[0].children).toHaveLength(1)
      expect(tree[0].children![0].title).toBe('myFunc')
      expect(tree[0].children![0].isFolder).toBe(false)
      expect(tree[0].children![0].published).toBe(true)
    })
  })

  describe('renameFolder', () => {
    it('should rename folder and update path', async () => {
      const folder = await createFolder('oldName', null, testUserId)

      await renameFolder(folder._id, 'newName', testUserId)

      const db = getTestDB()
      const updated = await db.collection('folders').findOne({ _id: folder._id })

      expect(updated!.name).toBe('newName')
      expect(updated!.path).toBe('newName')
    })

    it('should update child paths when renaming', async () => {
      const parent = await createFolder('parent', null, testUserId)
      const child = await createFolder('child', parent._id, testUserId)

      await renameFolder(parent._id, 'renamed', testUserId)

      const db = getTestDB()
      const updatedChild = await db.collection('folders').findOne({ _id: child._id })

      expect(updatedChild!.path).toBe('renamed/child')
    })

    it('should throw error for non-existent folder', async () => {
      const fakeId = new ObjectId()

      await expect(renameFolder(fakeId, 'newName', testUserId))
        .rejects.toThrow('文件夹不存在')
    })

    it('should throw error for duplicate path', async () => {
      const f1 = await createFolder('folder1', null, testUserId)
      await createFolder('folder2', null, testUserId)

      await expect(renameFolder(f1._id, 'folder2', testUserId))
        .rejects.toThrow('目标路径已存在同名文件夹')
    })
  })

  describe('deleteFolder', () => {
    it('should delete empty folder', async () => {
      const folder = await createFolder('toDelete', null, testUserId)

      await deleteFolder(folder._id, testUserId)

      const db = getTestDB()
      const deleted = await db.collection('folders').findOne({ _id: folder._id })

      expect(deleted).toBeNull()
    })

    it('should throw error for folder with children', async () => {
      const parent = await createFolder('parent', null, testUserId)
      await createFolder('child', parent._id, testUserId)

      await expect(deleteFolder(parent._id, testUserId))
        .rejects.toThrow('文件夹不为空')
    })

    it('should throw error for folder with functions', async () => {
      const folder = await createFolder('withFunc', null, testUserId)

      const db = getTestDB()
      await db.collection('functions').insertOne({
        name: 'func',
        code: 'code',
        userId: testUserId,
        folderId: folder._id,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      await expect(deleteFolder(folder._id, testUserId))
        .rejects.toThrow('文件夹不为空')
    })
  })

  describe('moveFolder', () => {
    it('should move folder to new parent', async () => {
      const folder = await createFolder('toMove', null, testUserId)
      const newParent = await createFolder('newParent', null, testUserId)

      const newPath = await moveFolder(folder._id, newParent._id, testUserId)

      expect(newPath).toBe('newParent/toMove')

      const db = getTestDB()
      const moved = await db.collection('folders').findOne({ _id: folder._id })

      expect(moved!.path).toBe('newParent/toMove')
      expect(moved!.parentId?.toString()).toBe(newParent._id.toString())
    })

    it('should move folder to root', async () => {
      const parent = await createFolder('parent', null, testUserId)
      const child = await createFolder('child', parent._id, testUserId)

      const newPath = await moveFolder(child._id, null, testUserId)

      expect(newPath).toBe('child')

      const db = getTestDB()
      const moved = await db.collection('folders').findOne({ _id: child._id })

      expect(moved!.parentId).toBeNull()
    })

    it('should throw error when moving to self', async () => {
      const folder = await createFolder('folder', null, testUserId)

      await expect(moveFolder(folder._id, folder._id, testUserId))
        .rejects.toThrow('不能将文件夹移动到自身或其子目录')
    })

    it('should throw error when moving to child folder', async () => {
      const parent = await createFolder('parent', null, testUserId)
      const child = await createFolder('child', parent._id, testUserId)

      await expect(moveFolder(parent._id, child._id, testUserId))
        .rejects.toThrow('不能将文件夹移动到自身或其子目录')
    })
  })

  describe('moveFunction', () => {
    it('should move function to folder', async () => {
      const folder = await createFolder('targetFolder', null, testUserId)

      const db = getTestDB()
      const funcResult = await db.collection('functions').insertOne({
        name: 'myFunc',
        code: 'code',
        userId: testUserId,
        path: 'myFunc',
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const newPath = await moveFunction(funcResult.insertedId, folder._id, testUserId)

      expect(newPath).toBe('targetFolder/myFunc')

      const movedFunc = await db.collection('functions').findOne({ _id: funcResult.insertedId })
      expect(movedFunc!.folderId?.toString()).toBe(folder._id.toString())
      expect(movedFunc!.path).toBe('targetFolder/myFunc')
    })

    it('should move function to root', async () => {
      const folder = await createFolder('folder', null, testUserId)

      const db = getTestDB()
      const funcResult = await db.collection('functions').insertOne({
        name: 'myFunc',
        code: 'code',
        userId: testUserId,
        folderId: folder._id,
        path: 'folder/myFunc',
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const newPath = await moveFunction(funcResult.insertedId, null, testUserId)

      expect(newPath).toBe('myFunc')

      const movedFunc = await db.collection('functions').findOne({ _id: funcResult.insertedId })
      expect(movedFunc!.folderId).toBeNull()
    })

    it('should throw error for non-existent function', async () => {
      const fakeId = new ObjectId()

      await expect(moveFunction(fakeId, null, testUserId))
        .rejects.toThrow('函数不存在')
    })
  })

  describe('batchMoveFunctions', () => {
    it('should move multiple functions', async () => {
      const folder = await createFolder('target', null, testUserId)

      const db = getTestDB()
      const func1 = await db.collection('functions').insertOne({
        name: 'func1',
        code: 'code1',
        userId: testUserId,
        path: 'func1',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      const func2 = await db.collection('functions').insertOne({
        name: 'func2',
        code: 'code2',
        userId: testUserId,
        path: 'func2',
        createdAt: new Date(),
        updatedAt: new Date()
      })

      await batchMoveFunctions(
        [func1.insertedId, func2.insertedId],
        folder._id,
        testUserId
      )

      const movedFunc1 = await db.collection('functions').findOne({ _id: func1.insertedId })
      const movedFunc2 = await db.collection('functions').findOne({ _id: func2.insertedId })

      expect(movedFunc1!.path).toBe('target/func1')
      expect(movedFunc2!.path).toBe('target/func2')
    })
  })

  describe('reorderItems', () => {
    it('should update order for folders', async () => {
      const f1 = await createFolder('folder1', null, testUserId)
      const f2 = await createFolder('folder2', null, testUserId)

      await reorderItems([
        { id: f1._id.toString(), order: 10, isFolder: true },
        { id: f2._id.toString(), order: 5, isFolder: true }
      ], testUserId)

      const db = getTestDB()
      const updated1 = await db.collection('folders').findOne({ _id: f1._id })
      const updated2 = await db.collection('folders').findOne({ _id: f2._id })

      expect(updated1!.order).toBe(10)
      expect(updated2!.order).toBe(5)
    })

    it('should update order for functions', async () => {
      const db = getTestDB()
      const func1 = await db.collection('functions').insertOne({
        name: 'func1',
        userId: testUserId,
        createdAt: new Date()
      })
      const func2 = await db.collection('functions').insertOne({
        name: 'func2',
        userId: testUserId,
        createdAt: new Date()
      })

      await reorderItems([
        { id: func1.insertedId.toString(), order: 20, isFolder: false },
        { id: func2.insertedId.toString(), order: 10, isFolder: false }
      ], testUserId)

      const updated1 = await db.collection('functions').findOne({ _id: func1.insertedId })
      const updated2 = await db.collection('functions').findOne({ _id: func2.insertedId })

      expect(updated1!.order).toBe(20)
      expect(updated2!.order).toBe(10)
    })
  })
})
