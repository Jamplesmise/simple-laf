# Sprint 4: 结构与同步 - 任务清单

## 任务概览

| 任务 | 轨道 | 优先级 | 预估 | 状态 |
|------|------|-------|------|------|
| 4.1 文件夹服务 | 后端 | P0 | 1.5h | 待开始 |
| 4.2 文件夹 API | 后端 | P0 | 1.5h | 待开始 |
| 4.3 路径联动 | 后端 | P0 | 1h | 待开始 |
| 4.4 多级路径路由 | 后端 | P0 | 30min | 待开始 |
| 4.5 Git 服务 | 后端 | P0 | 2h | 待开始 |
| 4.6 Git API | 后端 | P0 | 1h | 待开始 |
| 4.7 文件树组件 | 前端 | P0 | 3h | 待开始 |
| 4.8 Git 面板 | 前端 | P0 | 2h | 待开始 |

---

## 后端任务

### 4.1 文件夹服务

**任务描述**：创建文件夹管理服务。

**具体步骤**

- [ ] 创建 `src/services/folder.ts`：

```typescript
import { ObjectId } from 'mongodb'
import { getDB } from '../db'

export interface Folder {
  _id: ObjectId
  name: string
  parentId?: ObjectId
  path: string
  userId: ObjectId
  order: number
  createdAt: Date
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
    parentPath = parent.path
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
export async function getFolderTree(userId: ObjectId): Promise<any[]> {
  const db = getDB()

  const folders = await db.collection('folders')
    .find({ userId })
    .sort({ order: 1 })
    .toArray()

  const functions = await db.collection('functions')
    .find({ userId })
    .sort({ order: 1 })
    .toArray()

  // 构建树结构
  const buildTree = (parentId?: ObjectId) => {
    const children: any[] = []

    // 添加文件夹
    folders
      .filter(f => {
        if (parentId) return f.parentId?.toString() === parentId.toString()
        return !f.parentId
      })
      .forEach(folder => {
        children.push({
          key: folder._id.toString(),
          title: folder.name,
          isFolder: true,
          path: folder.path,
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
          title: func.name,
          isFolder: false,
          path: func.path || func.name,
          published: func.published
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

  const oldPath = folder.path
  const parentPath = oldPath.includes('/') ? oldPath.substring(0, oldPath.lastIndexOf('/')) : ''
  const newPath = parentPath ? `${parentPath}/${newName}` : newName

  // 更新文件夹
  await db.collection('folders').updateOne(
    { _id: folderId },
    { $set: { name: newName, path: newPath } }
  )

  // 更新子路径
  await updateChildPaths(db, userId, oldPath, newPath)
}

// 更新子路径
async function updateChildPaths(db: any, userId: ObjectId, oldPath: string, newPath: string) {
  // 更新子文件夹
  await db.collection('folders').updateMany(
    { userId, path: { $regex: `^${oldPath}/` } },
    [{
      $set: {
        path: {
          $replaceOne: { input: '$path', find: oldPath, replacement: newPath }
        }
      }
    }]
  )

  // 更新函数
  await db.collection('functions').updateMany(
    { userId, path: { $regex: `^${oldPath}/` } },
    [{
      $set: {
        path: {
          $replaceOne: { input: '$path', find: oldPath, replacement: newPath }
        }
      }
    }]
  )
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
    throw new Error('文件夹不为空')
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

  const oldPath = folder.path

  // 获取新父路径
  let newParentPath = ''
  if (newParentId) {
    const newParent = await db.collection('folders').findOne({ _id: newParentId })
    if (!newParent) throw new Error('目标文件夹不存在')
    newParentPath = newParent.path
  }

  const newPath = newParentPath ? `${newParentPath}/${folder.name}` : folder.name

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
  await updateChildPaths(db, userId, oldPath, newPath)

  return newPath
}
```

---

### 4.2 文件夹 API

**任务描述**：创建文件夹相关的 API 端点。

**具体步骤**

- [ ] 创建 `src/routes/folders.ts`：

```typescript
import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { authMiddleware } from '../middleware/auth'
import * as folderService from '../services/folder'

const router = Router()

// 获取文件夹树
router.get('/', authMiddleware, async (req, res) => {
  const tree = await folderService.getFolderTree(new ObjectId(req.user.userId))
  res.json({ success: true, data: tree })
})

// 创建文件夹
router.post('/', authMiddleware, async (req, res) => {
  const { name, parentId } = req.body

  if (!name) {
    return res.status(400).json({
      success: false,
      error: { message: '文件夹名不能为空' }
    })
  }

  try {
    const folder = await folderService.createFolder(
      name,
      parentId ? new ObjectId(parentId) : null,
      new ObjectId(req.user.userId)
    )
    res.json({ success: true, data: folder })
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message }
    })
  }
})

// 重命名文件夹
router.patch('/:id', authMiddleware, async (req, res) => {
  const { name } = req.body

  try {
    await folderService.renameFolder(
      new ObjectId(req.params.id),
      name,
      new ObjectId(req.user.userId)
    )
    res.json({ success: true })
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message }
    })
  }
})

// 删除文件夹
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await folderService.deleteFolder(
      new ObjectId(req.params.id),
      new ObjectId(req.user.userId)
    )
    res.json({ success: true })
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message }
    })
  }
})

// 移动文件夹
router.post('/:id/move', authMiddleware, async (req, res) => {
  const { parentId } = req.body

  try {
    const newPath = await folderService.moveFolder(
      new ObjectId(req.params.id),
      parentId ? new ObjectId(parentId) : null,
      new ObjectId(req.user.userId)
    )
    res.json({ success: true, data: { newPath } })
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message }
    })
  }
})

export default router
```

- [ ] 修改 `src/routes/functions.ts`，添加移动函数 API：

```typescript
// 移动函数到文件夹
router.post('/:id/move', authMiddleware, async (req, res) => {
  const { folderId } = req.body
  const db = getDB()
  const { ObjectId } = require('mongodb')

  const func = await db.collection('functions').findOne({
    _id: new ObjectId(req.params.id),
    userId: new ObjectId(req.user.userId)
  })

  if (!func) {
    return res.status(404).json({
      success: false,
      error: { code: 'FUNCTION_NOT_FOUND' }
    })
  }

  // 计算新路径
  let newPath = func.name
  if (folderId) {
    const folder = await db.collection('folders').findOne({
      _id: new ObjectId(folderId)
    })
    if (folder) {
      newPath = `${folder.path}/${func.name}`
    }
  }

  await db.collection('functions').updateOne(
    { _id: func._id },
    {
      $set: {
        folderId: folderId ? new ObjectId(folderId) : null,
        path: newPath,
        updatedAt: new Date()
      }
    }
  )

  res.json({
    success: true,
    data: { newPath, newUrl: `/${newPath}` }
  })
})

// 批量移动
router.post('/batch-move', authMiddleware, async (req, res) => {
  const { functionIds, folderId } = req.body
  const db = getDB()
  const { ObjectId } = require('mongodb')

  let folderPath = ''
  if (folderId) {
    const folder = await db.collection('folders').findOne({
      _id: new ObjectId(folderId)
    })
    if (folder) folderPath = folder.path
  }

  for (const id of functionIds) {
    const func = await db.collection('functions').findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(req.user.userId)
    })

    if (func) {
      const newPath = folderPath ? `${folderPath}/${func.name}` : func.name
      await db.collection('functions').updateOne(
        { _id: func._id },
        {
          $set: {
            folderId: folderId ? new ObjectId(folderId) : null,
            path: newPath,
            updatedAt: new Date()
          }
        }
      )
    }
  }

  res.json({ success: true })
})

// 调整排序
router.post('/reorder', authMiddleware, async (req, res) => {
  const { orders } = req.body // [{ id, order }, ...]
  const db = getDB()
  const { ObjectId } = require('mongodb')

  for (const item of orders) {
    await db.collection('functions').updateOne(
      { _id: new ObjectId(item.id), userId: new ObjectId(req.user.userId) },
      { $set: { order: item.order } }
    )
  }

  res.json({ success: true })
})
```

---

### 4.3 路径联动

**任务描述**：创建路径管理服务，确保路径自动更新。

**具体步骤**

- [ ] 创建 `src/services/path.ts`：

```typescript
import { ObjectId } from 'mongodb'
import { getDB } from '../db'

// 更新函数路径
export async function updateFunctionPath(functionId: ObjectId): Promise<string> {
  const db = getDB()

  const func = await db.collection('functions').findOne({ _id: functionId })
  if (!func) throw new Error('函数不存在')

  let newPath = func.name
  if (func.folderId) {
    const folder = await db.collection('folders').findOne({ _id: func.folderId })
    if (folder) {
      newPath = `${folder.path}/${func.name}`
    }
  }

  await db.collection('functions').updateOne(
    { _id: functionId },
    { $set: { path: newPath } }
  )

  return newPath
}

// 初始化所有函数路径 (一次性迁移)
export async function initializeFunctionPaths(userId: ObjectId): Promise<void> {
  const db = getDB()

  const functions = await db.collection('functions')
    .find({ userId, path: { $exists: false } })
    .toArray()

  for (const func of functions) {
    const path = func.name
    await db.collection('functions').updateOne(
      { _id: func._id },
      { $set: { path, order: 0 } }
    )
  }
}
```

---

### 4.4 多级路径路由

**任务描述**：更新公开调用路由，支持多级路径匹配。

**具体步骤**

- [ ] 修改 `src/routes/public.ts`：

```typescript
import { Router } from 'express'
import { executeFunction } from '../services/executor'
import { createCloud } from '../services/cloud'
import { getDB } from '../db'

const router = Router()

// 支持多级路径公开调用
router.all('/*', async (req, res) => {
  // 获取完整路径，去除前导斜杠
  const path = req.params[0] || req.path.slice(1)

  // 跳过 API 路由
  if (path.startsWith('api/') || path.startsWith('_/')) {
    return res.status(404).json({ error: 'Not Found' })
  }

  const db = getDB()

  const func = await db.collection('functions').findOne({
    path: path,
    published: true
  })

  if (!func) {
    return res.status(404).json({
      success: false,
      error: { code: 'FUNCTION_NOT_FOUND', message: '函数不存在或未发布' }
    })
  }

  const ctx = {
    body: req.body,
    query: req.query,
    headers: req.headers,
    method: req.method,
    path: path,
  }

  try {
    const cloud = createCloud(func.userId)
    const result = await executeFunction(func.compiled, ctx, cloud, func.userId)

    res.set('x-execution-time', String(result.time))

    if (result.error) {
      return res.status(500).json({ error: result.error })
    }

    res.json(result.data)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
```

- [ ] 更新 `src/index.ts` 路由注册顺序：

```typescript
// 确保公开路由在最后，且使用 /*
app.use('/api/auth', authRouter)
app.use('/api/functions', functionsRouter)
app.use('/api/folders', foldersRouter)
app.use('/api/dependencies', dependenciesRouter)
app.use('/api/env', envRouter)
app.use('/api/git', gitRouter)
app.use('/invoke', invokeRouter)
app.use('/_/lsp', lspRouter)

// 静态文件
app.use(express.static('public'))

// 公开调用 (匹配所有剩余路径)
app.use(publicRouter)
```

---

### 4.5 Git 服务

**任务描述**：创建 Git 操作服务，支持拉取和推送。

**具体步骤**

- [ ] 安装 simple-git：

```bash
pnpm add simple-git
```

- [ ] 创建 `src/services/git.ts`：

```typescript
import { ObjectId } from 'mongodb'
import simpleGit, { SimpleGit } from 'simple-git'
import * as fs from 'fs/promises'
import * as path from 'path'
import { getDB } from '../db'
import CryptoJS from 'crypto-js'
import { config } from '../config'

export interface GitConfig {
  _id: ObjectId
  repoUrl: string
  branch: string
  token?: string
  functionsPath: string
  lastSyncAt?: Date
  userId: ObjectId
}

// 加密/解密
const encrypt = (text: string) => CryptoJS.AES.encrypt(text, config.jwtSecret).toString()
const decrypt = (ciphertext: string) => CryptoJS.AES.decrypt(ciphertext, config.jwtSecret).toString(CryptoJS.enc.Utf8)

// 获取配置
export async function getGitConfig(userId: ObjectId): Promise<GitConfig | null> {
  const db = getDB()
  return db.collection('git_config').findOne({ userId }) as Promise<GitConfig | null>
}

// 保存配置
export async function saveGitConfig(
  userId: ObjectId,
  repoUrl: string,
  branch: string,
  token: string | undefined,
  functionsPath: string
): Promise<void> {
  const db = getDB()

  await db.collection('git_config').updateOne(
    { userId },
    {
      $set: {
        repoUrl,
        branch,
        token: token ? encrypt(token) : undefined,
        functionsPath,
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    { upsert: true }
  )
}

// 转换 laf 函数格式 → 本地格式
function convertFromLaf(code: string): string {
  // 移除 laf 特有的 import
  return code.replace(/import\s+cloud\s+from\s+['"]@lafjs\/cloud['"]\s*\n?/g, '')
}

// 转换本地格式 → laf 函数格式
function convertToLaf(code: string): string {
  // 添加 laf 的 import
  if (!code.includes('@lafjs/cloud')) {
    return `import cloud from '@lafjs/cloud'\n\n${code}`
  }
  return code
}

// 从 Git 拉取
export async function pullFromGit(userId: ObjectId): Promise<{
  added: string[]
  updated: string[]
  deleted: string[]
}> {
  const db = getDB()
  const gitConfig = await getGitConfig(userId)

  if (!gitConfig) throw new Error('未配置 Git 仓库')

  const tempDir = `/tmp/git-sync-${Date.now()}`
  const git: SimpleGit = simpleGit()

  try {
    // 构建认证 URL
    let cloneUrl = gitConfig.repoUrl
    if (gitConfig.token) {
      const token = decrypt(gitConfig.token)
      const url = new URL(gitConfig.repoUrl)
      cloneUrl = `https://${token}@${url.host}${url.pathname}`
    }

    // 克隆仓库
    await git.clone(cloneUrl, tempDir, {
      '--branch': gitConfig.branch,
      '--depth': '1',
    })

    // 读取函数文件
    const functionsDir = path.join(tempDir, gitConfig.functionsPath)
    let files: string[] = []

    try {
      files = await fs.readdir(functionsDir)
    } catch {
      throw new Error(`函数目录不存在: ${gitConfig.functionsPath}`)
    }

    const added: string[] = []
    const updated: string[] = []

    // 获取现有函数
    const existingFunctions = await db.collection('functions')
      .find({ userId })
      .toArray()
    const existingMap = new Map(existingFunctions.map(f => [f.name, f]))

    // 处理每个函数文件
    for (const file of files) {
      if (!file.endsWith('.ts')) continue

      const funcName = file.replace('.ts', '')
      const filePath = path.join(functionsDir, file)
      const code = await fs.readFile(filePath, 'utf-8')
      const convertedCode = convertFromLaf(code)

      const existing = existingMap.get(funcName)

      if (existing) {
        // 更新
        await db.collection('functions').updateOne(
          { _id: existing._id },
          {
            $set: {
              code: convertedCode,
              compiled: '',  // 需要重新编译
              updatedAt: new Date()
            }
          }
        )
        updated.push(funcName)
      } else {
        // 新增
        await db.collection('functions').insertOne({
          name: funcName,
          code: convertedCode,
          compiled: '',
          path: funcName,
          userId,
          published: false,
          order: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        added.push(funcName)
      }
    }

    // 更新同步时间
    await db.collection('git_config').updateOne(
      { userId },
      { $set: { lastSyncAt: new Date() } }
    )

    return { added, updated, deleted: [] }
  } finally {
    // 清理临时目录
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

// 推送到 Git
export async function pushToGit(
  userId: ObjectId,
  commitMessage: string
): Promise<void> {
  const db = getDB()
  const gitConfig = await getGitConfig(userId)

  if (!gitConfig) throw new Error('未配置 Git 仓库')

  const tempDir = `/tmp/git-sync-${Date.now()}`
  const git: SimpleGit = simpleGit()

  try {
    // 构建认证 URL
    let cloneUrl = gitConfig.repoUrl
    if (gitConfig.token) {
      const token = decrypt(gitConfig.token)
      const url = new URL(gitConfig.repoUrl)
      cloneUrl = `https://${token}@${url.host}${url.pathname}`
    }

    // 克隆仓库
    await git.clone(cloneUrl, tempDir, {
      '--branch': gitConfig.branch,
    })

    // 获取所有函数
    const functions = await db.collection('functions')
      .find({ userId })
      .toArray()

    // 写入函数文件
    const functionsDir = path.join(tempDir, gitConfig.functionsPath)
    await fs.mkdir(functionsDir, { recursive: true })

    for (const func of functions) {
      const code = convertToLaf(func.code)
      await fs.writeFile(
        path.join(functionsDir, `${func.name}.ts`),
        code
      )
    }

    // 提交并推送
    await git.cwd(tempDir)
    await git.add('.')
    await git.commit(commitMessage)
    await git.push()

    // 更新同步时间
    await db.collection('git_config').updateOne(
      { userId },
      { $set: { lastSyncAt: new Date() } }
    )
  } finally {
    // 清理临时目录
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}
```

---

### 4.6 Git API

**任务描述**：创建 Git 相关的 API 端点。

**具体步骤**

- [ ] 创建 `src/routes/git.ts`：

```typescript
import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { authMiddleware } from '../middleware/auth'
import * as gitService from '../services/git'

const router = Router()

// 获取 Git 配置
router.get('/config', authMiddleware, async (req, res) => {
  const config = await gitService.getGitConfig(new ObjectId(req.user.userId))

  if (!config) {
    return res.json({
      success: true,
      data: { configured: false }
    })
  }

  res.json({
    success: true,
    data: {
      configured: true,
      repoUrl: config.repoUrl,
      branch: config.branch,
      functionsPath: config.functionsPath,
      lastSyncAt: config.lastSyncAt
    }
  })
})

// 保存 Git 配置
router.put('/config', authMiddleware, async (req, res) => {
  const { repoUrl, branch, token, functionsPath } = req.body

  if (!repoUrl || !branch || !functionsPath) {
    return res.status(400).json({
      success: false,
      error: { message: '请填写完整配置' }
    })
  }

  try {
    await gitService.saveGitConfig(
      new ObjectId(req.user.userId),
      repoUrl,
      branch,
      token,
      functionsPath
    )
    res.json({ success: true })
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message }
    })
  }
})

// 从 Git 拉取
router.post('/pull', authMiddleware, async (req, res) => {
  try {
    const result = await gitService.pullFromGit(new ObjectId(req.user.userId))
    res.json({ success: true, data: result })
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message }
    })
  }
})

// 推送到 Git
router.post('/push', authMiddleware, async (req, res) => {
  const { message } = req.body

  try {
    await gitService.pushToGit(
      new ObjectId(req.user.userId),
      message || 'Update functions'
    )
    res.json({ success: true })
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message }
    })
  }
})

// 获取同步状态
router.get('/status', authMiddleware, async (req, res) => {
  const config = await gitService.getGitConfig(new ObjectId(req.user.userId))

  res.json({
    success: true,
    data: {
      configured: !!config,
      lastSyncAt: config?.lastSyncAt
    }
  })
})

export default router
```

---

## 前端任务

### 4.7 文件树组件

**任务描述**：创建可拖拽的文件树组件。

**具体步骤**

- [ ] 创建 `web/src/components/FunctionTree.tsx`：

```tsx
import React, { useState, useEffect } from 'react'
import { Tree, Dropdown, Modal, Input, message } from 'antd'
import type { TreeProps, DataNode } from 'antd/es/tree'
import {
  FolderOutlined,
  FolderOpenOutlined,
  FileOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'
import { api } from '../api'

interface TreeNode {
  key: string
  title: string
  isFolder: boolean
  path: string
  published?: boolean
  children?: TreeNode[]
}

interface FunctionTreeProps {
  onSelect: (key: string, isFolder: boolean) => void
  onRefresh: () => void
}

export function FunctionTree({ onSelect, onRefresh }: FunctionTreeProps) {
  const [treeData, setTreeData] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])

  // 弹窗状态
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'folder' | 'function' | 'rename'>('folder')
  const [inputValue, setInputValue] = useState('')
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)

  // 加载树数据
  const loadTree = async () => {
    try {
      const res = await api.get('/api/folders')
      setTreeData(res.data.data)
    } catch (error) {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTree()
  }, [])

  // 右键菜单
  const contextMenuItems = (node: TreeNode) => {
    if (node.isFolder) {
      return [
        { key: 'newFolder', icon: <FolderOutlined />, label: '新建文件夹' },
        { key: 'newFunction', icon: <FileOutlined />, label: '新建函数' },
        { type: 'divider' },
        { key: 'rename', icon: <EditOutlined />, label: '重命名' },
        { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true },
      ]
    }
    return [
      { key: 'rename', icon: <EditOutlined />, label: '重命名' },
      { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true },
    ]
  }

  // 菜单点击
  const handleMenuClick = async (key: string, node: TreeNode) => {
    setSelectedNode(node)

    switch (key) {
      case 'newFolder':
        setModalType('folder')
        setInputValue('')
        setModalOpen(true)
        break
      case 'newFunction':
        setModalType('function')
        setInputValue('')
        setModalOpen(true)
        break
      case 'rename':
        setModalType('rename')
        setInputValue(node.title)
        setModalOpen(true)
        break
      case 'delete':
        Modal.confirm({
          title: '确认删除',
          content: `确定要删除 ${node.title} 吗？`,
          onOk: async () => {
            try {
              if (node.isFolder) {
                await api.delete(`/api/folders/${node.key}`)
              } else {
                await api.delete(`/api/functions/${node.key}`)
              }
              message.success('已删除')
              loadTree()
              onRefresh()
            } catch (error: any) {
              message.error(error.response?.data?.error?.message || '删除失败')
            }
          }
        })
        break
    }
  }

  // 弹窗确认
  const handleModalOk = async () => {
    if (!inputValue.trim()) {
      message.error('名称不能为空')
      return
    }

    try {
      if (modalType === 'folder') {
        await api.post('/api/folders', {
          name: inputValue,
          parentId: selectedNode?.isFolder ? selectedNode.key : null
        })
        message.success('文件夹已创建')
      } else if (modalType === 'function') {
        await api.post('/api/functions', {
          name: inputValue,
          code: `export default async function(ctx: FunctionContext) {\n  return { message: 'Hello' }\n}`,
          folderId: selectedNode?.isFolder ? selectedNode.key : null
        })
        message.success('函数已创建')
      } else if (modalType === 'rename') {
        if (selectedNode?.isFolder) {
          await api.patch(`/api/folders/${selectedNode.key}`, { name: inputValue })
        } else {
          await api.put(`/api/functions/${selectedNode?.key}`, { name: inputValue })
        }
        message.success('已重命名')
      }

      setModalOpen(false)
      loadTree()
      onRefresh()
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '操作失败')
    }
  }

  // 拖拽处理
  const onDrop: TreeProps['onDrop'] = async (info) => {
    const dragKey = info.dragNode.key as string
    const dropKey = info.node.key as string
    const dropToGap = info.dropToGap
    const isFolder = (info.dragNode as any).isFolder

    try {
      if (isFolder) {
        // 移动文件夹
        const targetParentId = dropToGap ? null : dropKey
        await api.post(`/api/folders/${dragKey}/move`, {
          parentId: (info.node as any).isFolder ? targetParentId : null
        })
      } else {
        // 移动函数
        const targetFolderId = (info.node as any).isFolder && !dropToGap
          ? dropKey
          : null
        await api.post(`/api/functions/${dragKey}/move`, {
          folderId: targetFolderId
        })
      }

      message.success('已移动')
      loadTree()
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '移动失败')
    }
  }

  // 渲染节点
  const titleRender = (node: TreeNode) => (
    <Dropdown
      menu={{
        items: contextMenuItems(node),
        onClick: ({ key }) => handleMenuClick(key, node)
      }}
      trigger={['contextMenu']}
    >
      <div className="flex items-center gap-2 py-1">
        {node.isFolder ? (
          expandedKeys.includes(node.key) ? (
            <FolderOpenOutlined className="text-yellow-500" />
          ) : (
            <FolderOutlined className="text-yellow-500" />
          )
        ) : (
          <FileOutlined className="text-blue-400" />
        )}
        <span>{node.title}</span>
        {!node.isFolder && node.published && (
          <CheckCircleOutlined className="text-green-500 text-xs" />
        )}
      </div>
    </Dropdown>
  )

  return (
    <div className="h-full flex flex-col">
      {/* 工具栏 */}
      <div className="p-2 border-b border-gray-700 flex gap-2">
        <button
          className="text-gray-400 hover:text-white"
          onClick={() => {
            setSelectedNode(null)
            setModalType('folder')
            setInputValue('')
            setModalOpen(true)
          }}
          title="新建文件夹"
        >
          <FolderOutlined />
        </button>
        <button
          className="text-gray-400 hover:text-white"
          onClick={() => {
            setSelectedNode(null)
            setModalType('function')
            setInputValue('')
            setModalOpen(true)
          }}
          title="新建函数"
        >
          <FileOutlined />
          <PlusOutlined className="text-xs" />
        </button>
      </div>

      {/* 树 */}
      <div className="flex-1 overflow-auto p-2">
        <Tree
          draggable
          blockNode
          treeData={treeData as DataNode[]}
          expandedKeys={expandedKeys}
          onExpand={(keys) => setExpandedKeys(keys as string[])}
          onDrop={onDrop}
          onSelect={(keys) => {
            if (keys.length > 0) {
              const node = findNode(treeData, keys[0] as string)
              if (node && !node.isFolder) {
                onSelect(node.key, false)
              }
            }
          }}
          titleRender={titleRender as any}
        />
      </div>

      {/* 弹窗 */}
      <Modal
        title={
          modalType === 'folder' ? '新建文件夹' :
          modalType === 'function' ? '新建函数' : '重命名'
        }
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={() => setModalOpen(false)}
      >
        <Input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder={modalType === 'folder' ? '文件夹名称' : '函数名称'}
          onPressEnter={handleModalOk}
          autoFocus
        />
      </Modal>
    </div>
  )
}

// 辅助函数：在树中查找节点
function findNode(nodes: TreeNode[], key: string): TreeNode | null {
  for (const node of nodes) {
    if (node.key === key) return node
    if (node.children) {
      const found = findNode(node.children, key)
      if (found) return found
    }
  }
  return null
}
```

---

### 4.8 Git 面板

**任务描述**：创建 Git 同步面板和配置弹窗。

**具体步骤**

- [ ] 创建 `web/src/components/GitPanel.tsx`：

```tsx
import React, { useState, useEffect } from 'react'
import { Button, Space, Tag, message, Modal, Input, Form } from 'antd'
import {
  GithubOutlined,
  CloudDownloadOutlined,
  CloudUploadOutlined,
  SettingOutlined,
  SyncOutlined
} from '@ant-design/icons'
import { api } from '../api'
import dayjs from 'dayjs'

interface GitConfig {
  configured: boolean
  repoUrl?: string
  branch?: string
  functionsPath?: string
  lastSyncAt?: string
}

interface GitPanelProps {
  onSynced: () => void
}

export function GitPanel({ onSynced }: GitPanelProps) {
  const [config, setConfig] = useState<GitConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [pulling, setPulling] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [pushModalOpen, setPushModalOpen] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [form] = Form.useForm()

  // 加载配置
  const loadConfig = async () => {
    try {
      const res = await api.get('/api/git/config')
      setConfig(res.data.data)
    } catch (error) {
      message.error('加载 Git 配置失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfig()
  }, [])

  // 保存配置
  const handleSaveConfig = async () => {
    try {
      const values = await form.validateFields()
      await api.put('/api/git/config', values)
      message.success('配置已保存')
      setConfigModalOpen(false)
      loadConfig()
    } catch (error: any) {
      if (error.errorFields) return
      message.error('保存失败')
    }
  }

  // 拉取
  const handlePull = async () => {
    Modal.confirm({
      title: '从 Git 拉取',
      content: '这将覆盖本地同名函数，确定继续？',
      onOk: async () => {
        setPulling(true)
        try {
          const res = await api.post('/api/git/pull')
          const { added, updated } = res.data.data
          message.success(`拉取成功: 新增 ${added.length}, 更新 ${updated.length}`)
          loadConfig()
          onSynced()
        } catch (error: any) {
          message.error(error.response?.data?.error?.message || '拉取失败')
        } finally {
          setPulling(false)
        }
      }
    })
  }

  // 推送
  const handlePush = async () => {
    setPushModalOpen(true)
  }

  const handleConfirmPush = async () => {
    setPushing(true)
    try {
      await api.post('/api/git/push', { message: commitMessage || 'Update functions' })
      message.success('推送成功')
      setPushModalOpen(false)
      setCommitMessage('')
      loadConfig()
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '推送失败')
    } finally {
      setPushing(false)
    }
  }

  if (loading) return null

  return (
    <div className="border-t border-gray-700 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <GithubOutlined />
          <span className="font-medium">Git 同步</span>
        </div>
        <Button
          type="text"
          size="small"
          icon={<SettingOutlined />}
          onClick={() => {
            if (config?.configured) {
              form.setFieldsValue({
                repoUrl: config.repoUrl,
                branch: config.branch,
                functionsPath: config.functionsPath,
              })
            }
            setConfigModalOpen(true)
          }}
        />
      </div>

      {config?.configured ? (
        <>
          <div className="text-xs text-gray-500 mb-2">
            <div className="truncate">{config.repoUrl}</div>
            <div>
              分支: {config.branch} | 路径: {config.functionsPath}
            </div>
            {config.lastSyncAt && (
              <div>
                上次同步: {dayjs(config.lastSyncAt).format('MM-DD HH:mm')}
              </div>
            )}
          </div>

          <Space>
            <Button
              size="small"
              icon={<CloudDownloadOutlined />}
              onClick={handlePull}
              loading={pulling}
            >
              拉取
            </Button>
            <Button
              size="small"
              icon={<CloudUploadOutlined />}
              onClick={handlePush}
              loading={pushing}
            >
              推送
            </Button>
          </Space>
        </>
      ) : (
        <div className="text-gray-500 text-sm">
          <Button
            type="dashed"
            size="small"
            onClick={() => setConfigModalOpen(true)}
          >
            配置 Git 仓库
          </Button>
        </div>
      )}

      {/* 配置弹窗 */}
      <Modal
        title="Git 仓库配置"
        open={configModalOpen}
        onOk={handleSaveConfig}
        onCancel={() => setConfigModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="repoUrl"
            label="仓库地址"
            rules={[{ required: true, message: '请输入仓库地址' }]}
          >
            <Input placeholder="https://github.com/user/repo.git" />
          </Form.Item>
          <Form.Item
            name="branch"
            label="分支"
            rules={[{ required: true }]}
            initialValue="main"
          >
            <Input placeholder="main" />
          </Form.Item>
          <Form.Item
            name="token"
            label="访问令牌"
            extra="私有仓库需要填写"
          >
            <Input.Password placeholder="ghp_xxx (可选)" />
          </Form.Item>
          <Form.Item
            name="functionsPath"
            label="函数目录"
            rules={[{ required: true }]}
            initialValue="functions/"
          >
            <Input placeholder="functions/" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 推送弹窗 */}
      <Modal
        title="推送到 Git"
        open={pushModalOpen}
        onOk={handleConfirmPush}
        onCancel={() => setPushModalOpen(false)}
        confirmLoading={pushing}
      >
        <Input
          value={commitMessage}
          onChange={e => setCommitMessage(e.target.value)}
          placeholder="提交信息 (可选)"
        />
      </Modal>
    </div>
  )
}
```

---

## 验证清单

### 后端验证

```bash
# 1. 创建文件夹
curl -X POST http://localhost:3000/api/folders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "api"}'

# 2. 创建子文件夹
curl -X POST http://localhost:3000/api/folders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "user", "parentId": "FOLDER_ID"}'

# 3. 移动函数到文件夹
curl -X POST http://localhost:3000/api/functions/$FUNC_ID/move \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"folderId": "FOLDER_ID"}'

# 4. 测试多级路径访问
curl http://localhost:3000/api/user/login
# 期望: 返回函数执行结果

# 5. 配置 Git
curl -X PUT http://localhost:3000/api/git/config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"repoUrl": "...", "branch": "main", "functionsPath": "functions/"}'

# 6. Git 拉取
curl -X POST http://localhost:3000/api/git/pull \
  -H "Authorization: Bearer $TOKEN"

# 7. Git 推送
curl -X POST http://localhost:3000/api/git/push \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Update functions"}'
```

### 前端验证

- [ ] 文件树显示文件夹和函数
- [ ] 右键菜单正常
- [ ] 新建文件夹/函数
- [ ] 重命名/删除
- [ ] 拖拽移动功能
- [ ] 发布 URL 显示完整路径
- [ ] Git 配置弹窗
- [ ] Git 拉取按钮
- [ ] Git 推送按钮
- [ ] 同步状态显示

---

## 开发日志

| 日期 | 任务 | 完成情况 | 备注 |
|------|------|---------|------|
| 2025-12-17 | UI 全局优化 | ✅ 完成 | 参考 LAF 设计优化整体界面 |
| 2025-12-17 | RightPanel 优化 | ✅ 完成 | 绿色左边框指示器、HTTP方法颜色、Form Data 支持 |
| 2025-12-17 | 请求参数持久化 | ✅ 完成 | localStorage 保存请求参数 |
| 2025-12-17 | 环境变量弹窗 | ✅ 完成 | 60%宽度居中Modal、表单/代码双模式、显示真实值 |
| 2025-12-17 | 环境变量 API | ✅ 完成 | 后端返回解密值、批量更新接口 |
| 2025-12-17 | 全局字体优化 | ✅ 完成 | 使用 Monaco 同款等宽字体 |
| 2025-12-17 | 版本历史卡片化 | ✅ 完成 | 悬停效果、更好的视觉层次 |
| 2025-12-17 | 编辑器优化 | ✅ 完成 | 禁用右侧 OverviewRuler 错误标记 |
| 2025-12-17 | 格式切换按钮优化 | ✅ 完成 | 柔和灰色阴影风格、独立圆角矩形 |

### 详细变更记录

#### 2025-12-17 UI 优化

**后端变更：**
- `packages/server/src/routes/env.ts` - 添加批量更新 API (`POST /api/env/bulk`)
- `packages/server/src/services/env.ts` - 添加 `listEnvVariablesWithValues()`、`bulkUpdateEnvVariables()` 函数

**前端变更：**
- `packages/web/src/index.css` - 全局字体改为等宽字体 (SF Mono, Monaco, Menlo...)
- `packages/web/src/api/env.ts` - 更新接口类型，添加 `bulkUpdate()` 方法
- `packages/web/src/components/EnvManager.tsx` - 重写为 Modal 弹窗，支持表单/代码双模式
- `packages/web/src/components/Header.tsx` - 从 Drawer 改为 Modal 调用 EnvManager
- `packages/web/src/components/RightPanel.tsx` - 优化 Form Data 编辑器、格式切换按钮、版本历史卡片
- `packages/web/src/components/Editor.tsx` - 禁用 OverviewRuler (右侧错误标记)
- `packages/web/src/components/FunctionTree.tsx` - TS 文本标签优化
- `packages/web/src/components/EditorTabs.tsx` - TS 文本标签优化
