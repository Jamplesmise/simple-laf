# Sprint 9: 静态站点托管 (Site Hosting)

> 预计工期: 4-5 天
> 依赖: 现有 S3 存储服务、AI 对话系统

---

## 一、功能概述

### 1.1 核心目标

为 Simple IDE 添加静态站点托管功能，用户可以：
- 在 IDE 中创建/编辑 HTML/CSS/JS 文件
- 通过 `/site/*` 路径直接访问托管的网页
- 前端页面可调用 `/invoke/*` 云函数 API
- 通过 AI 对话管理站点文件 (增删查改)
- 实时预览编辑效果

### 1.2 功能边界

**本 Sprint 包含：**
- ✅ 静态文件托管 (HTML/CSS/JS/图片等)
- ✅ 文件管理 (CRUD + 上传)
- ✅ Monaco 编辑器支持
- ✅ iframe 实时预览
- ✅ AI 对话文件操作
- ✅ SPA 路由支持
- ✅ 基础访问控制 (公开/登录)

**不包含 (后续 Sprint)：**
- ❌ 前端框架构建 (React/Vue) → Sprint 12
- ❌ 自定义域名绑定站点 → 复用现有功能
- ❌ CDN 加速

### 1.3 访问路径设计

```
IDE 访问:     https://your-domain.com/           → React IDE
云函数调用:   https://your-domain.com/invoke/*   → 云函数执行
站点访问:     https://your-domain.com/site/*     → 静态站点 ★ 新增
```

---

## 二、数据模型

### 2.1 站点配置 (sites)

```typescript
interface Site {
  _id: ObjectId
  userId: ObjectId
  
  // 基础配置
  name: string                      // 站点名称 (显示用)
  enabled: boolean                  // 是否启用 (默认 true)
  
  // 托管配置
  defaultFile: string               // 默认文件 (默认 "index.html")
  spaMode: boolean                  // SPA 模式 - 404 回退到 index.html (默认 false)
  notFoundPage: string | null       // 自定义 404 页面路径 (如 "/404.html")
  
  // 访问控制
  accessControl: {
    type: 'public' | 'login' | 'password'  // 访问类型
    password?: string                       // 密码 (type='password' 时)
    protectedPaths?: string[]               // 需要保护的路径前缀 (如 ["/admin", "/dashboard"])
  }
  
  // 统计
  totalFiles: number                // 文件总数
  totalSize: number                 // 总大小 (bytes)
  
  // 权限 (为框架构建预留)
  features: {
    frameworkBuild: boolean         // 是否允许框架构建 (默认 false, 管理员开启)
    maxStorage: number              // 最大存储空间 (bytes, 默认 100MB)
    maxFileSize: number             // 单文件最大 (bytes, 默认 10MB)
  }
  
  createdAt: Date
  updatedAt: Date
}

// 默认值
const DEFAULT_SITE: Partial<Site> = {
  name: '我的站点',
  enabled: true,
  defaultFile: 'index.html',
  spaMode: false,
  notFoundPage: null,
  accessControl: { type: 'public' },
  totalFiles: 0,
  totalSize: 0,
  features: {
    frameworkBuild: false,
    maxStorage: 100 * 1024 * 1024,    // 100MB
    maxFileSize: 10 * 1024 * 1024,    // 10MB
  }
}
```

### 2.2 站点文件 (site_files)

```typescript
interface SiteFile {
  _id: ObjectId
  userId: ObjectId
  
  // 文件信息
  path: string                      // 相对路径: "/index.html", "/css/style.css"
  name: string                      // 文件名: "index.html", "style.css"
  isDirectory: boolean              // 是否为目录
  
  // 文件属性 (目录时为 null)
  size: number | null               // 文件大小 (bytes)
  mimeType: string | null           // MIME 类型
  hash: string | null               // 内容 MD5 (用于缓存/去重)
  
  // S3 存储
  s3Key: string | null              // S3 对象键: "sites/{userId}/{path}"
  
  // 元数据
  createdAt: Date
  updatedAt: Date
}

// 索引
db.site_files.createIndex({ userId: 1, path: 1 }, { unique: true })
db.site_files.createIndex({ userId: 1, isDirectory: 1 })
```

### 2.3 S3 存储结构

```
Bucket: {S3_BUCKET}
└── sites/
    └── {userId}/
        ├── index.html
        ├── favicon.ico
        ├── css/
        │   ├── style.css
        │   └── responsive.css
        ├── js/
        │   └── app.js
        └── images/
            ├── logo.png
            └── banner.jpg
```

---

## 三、API 设计

### 3.1 站点配置 API

```typescript
// 获取站点配置 (自动创建默认配置)
GET /api/site
Response: {
  success: true,
  data: Site
}

// 更新站点配置
PUT /api/site
Body: {
  name?: string
  enabled?: boolean
  defaultFile?: string
  spaMode?: boolean
  notFoundPage?: string | null
  accessControl?: {
    type: 'public' | 'login' | 'password'
    password?: string
    protectedPaths?: string[]
  }
}
Response: { success: true, data: Site }

// 获取站点统计
GET /api/site/stats
Response: {
  success: true,
  data: {
    totalFiles: number
    totalSize: number
    maxStorage: number
    usagePercent: number
    fileTypes: { [ext: string]: number }  // 按类型统计
  }
}
```

### 3.2 文件管理 API

```typescript
// 获取文件树
GET /api/site/files
Query: {
  path?: string       // 目录路径 (默认 "/")
  recursive?: boolean // 是否递归 (默认 true)
}
Response: {
  success: true,
  data: SiteFile[]    // 扁平列表，前端构建树
}

// 读取文件内容
GET /api/site/files/content?path=/index.html
Response: {
  success: true,
  data: {
    file: SiteFile
    content: string   // 文本文件返回内容
    // 或
    url: string       // 二进制文件返回临时下载 URL
  }
}

// 创建/更新文件
POST /api/site/files
Body: {
  path: string        // 文件路径
  content?: string    // 文本内容 (文本文件)
  isDirectory?: boolean // 是否创建目录
}
Response: { success: true, data: SiteFile }

// 上传文件 (二进制)
POST /api/site/files/upload
Content-Type: multipart/form-data
Body: {
  path: string        // 目标目录路径
  files: File[]       // 上传的文件
}
Response: {
  success: true,
  data: {
    uploaded: SiteFile[]
    failed: { name: string, error: string }[]
  }
}

// 删除文件/目录
DELETE /api/site/files?path=/old-file.html
Query: {
  path: string
  recursive?: boolean // 删除目录时是否递归 (默认 true)
}
Response: { success: true }

// 移动/重命名
POST /api/site/files/move
Body: {
  from: string        // 原路径
  to: string          // 新路径
}
Response: { success: true, data: SiteFile }

// 复制文件
POST /api/site/files/copy
Body: {
  from: string
  to: string
}
Response: { success: true, data: SiteFile }

// 批量操作
POST /api/site/files/batch
Body: {
  action: 'delete' | 'move' | 'copy'
  items: { from: string, to?: string }[]
}
Response: {
  success: true,
  data: {
    succeeded: string[]
    failed: { path: string, error: string }[]
  }
}
```

### 3.3 静态文件服务

```typescript
// 访问静态文件 (无需认证，除非配置了访问控制)
GET /site/*path
Response: 文件内容 (带正确的 Content-Type)

// 处理逻辑:
// 1. 解析路径: /site/css/style.css → /css/style.css
// 2. 检查访问控制
// 3. 查找文件:
//    - 精确匹配 → 返回文件
//    - 目录 → 返回 {dir}/index.html
//    - 404 且 spaMode → 返回 /index.html
//    - 404 且 notFoundPage → 返回 notFoundPage
//    - 404 → 返回默认 404 页面
```

### 3.4 AI 文件操作 (扩展现有 AI API)

```typescript
// 在现有 /api/ai/execute 基础上扩展
// AI 可执行的站点文件操作:

interface AIAction {
  type: 'site_create_file' | 'site_update_file' | 'site_delete_file' | 'site_read_file'
  path: string
  content?: string
}

// AI 执行器识别到站点文件操作时，调用对应的 site service
```

---

## 四、后端实现

### 4.1 文件结构

```
src/server/
├── routes/
│   ├── site.ts              # 站点配置 API
│   ├── site-files.ts        # 文件管理 API
│   └── site-serve.ts        # 静态文件服务
├── services/
│   ├── site.ts              # 站点业务逻辑
│   └── siteFile.ts          # 文件操作 (含 S3)
├── middleware/
│   └── siteAuth.ts          # 站点访问控制中间件
└── utils/
    └── mime.ts              # MIME 类型工具
```

### 4.2 核心服务实现

#### site.ts - 站点服务

```typescript
// src/server/services/site.ts

import { ObjectId } from 'mongodb'
import { getDb } from '../db'

const DEFAULT_SITE = {
  name: '我的站点',
  enabled: true,
  defaultFile: 'index.html',
  spaMode: false,
  notFoundPage: null,
  accessControl: { type: 'public' as const },
  totalFiles: 0,
  totalSize: 0,
  features: {
    frameworkBuild: false,
    maxStorage: 100 * 1024 * 1024,
    maxFileSize: 10 * 1024 * 1024,
  }
}

export class SiteService {
  private get collection() {
    return getDb().collection('sites')
  }

  // 获取用户站点配置 (不存在则创建)
  async getOrCreate(userId: ObjectId): Promise<Site> {
    let site = await this.collection.findOne({ userId })
    
    if (!site) {
      const now = new Date()
      site = {
        _id: new ObjectId(),
        userId,
        ...DEFAULT_SITE,
        createdAt: now,
        updatedAt: now,
      }
      await this.collection.insertOne(site)
    }
    
    return site as Site
  }

  // 更新站点配置
  async update(userId: ObjectId, updates: Partial<Site>): Promise<Site> {
    const allowed = ['name', 'enabled', 'defaultFile', 'spaMode', 'notFoundPage', 'accessControl']
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k))
    )
    
    const result = await this.collection.findOneAndUpdate(
      { userId },
      { $set: { ...filtered, updatedAt: new Date() } },
      { returnDocument: 'after' }
    )
    
    return result as Site
  }

  // 更新统计
  async updateStats(userId: ObjectId): Promise<void> {
    const db = getDb()
    const files = await db.collection('site_files')
      .find({ userId, isDirectory: false })
      .toArray()
    
    const totalFiles = files.length
    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0)
    
    await this.collection.updateOne(
      { userId },
      { $set: { totalFiles, totalSize, updatedAt: new Date() } }
    )
  }
}

export const siteService = new SiteService()
```

#### siteFile.ts - 文件服务

```typescript
// src/server/services/siteFile.ts

import { ObjectId } from 'mongodb'
import { getDb } from '../db'
import { storageService } from './storage'
import { createHash } from 'crypto'
import { lookup } from 'mime-types'
import path from 'path'

export class SiteFileService {
  private get collection() {
    return getDb().collection('site_files')
  }

  // 规范化路径
  private normalizePath(p: string): string {
    // 确保以 / 开头，不以 / 结尾 (除非是根目录)
    let normalized = path.posix.normalize('/' + p.replace(/^\/+/, ''))
    if (normalized !== '/' && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1)
    }
    return normalized
  }

  // 获取 S3 键
  private getS3Key(userId: ObjectId, filePath: string): string {
    return `sites/${userId.toHexString()}${filePath}`
  }

  // 获取文件列表
  async list(userId: ObjectId, dirPath: string = '/', recursive: boolean = true): Promise<SiteFile[]> {
    const normalized = this.normalizePath(dirPath)
    
    const query: any = { userId }
    if (recursive) {
      // 递归: 匹配该目录下所有文件
      if (normalized === '/') {
        // 根目录: 获取所有
      } else {
        query.path = { $regex: `^${normalized}(/|$)` }
      }
    } else {
      // 非递归: 只获取直接子项
      query.$or = [
        { path: normalized }, // 目录本身
        { path: { $regex: `^${normalized}/[^/]+$` } } // 直接子项
      ]
    }
    
    return this.collection.find(query).sort({ isDirectory: -1, name: 1 }).toArray() as Promise<SiteFile[]>
  }

  // 获取单个文件
  async get(userId: ObjectId, filePath: string): Promise<SiteFile | null> {
    const normalized = this.normalizePath(filePath)
    return this.collection.findOne({ userId, path: normalized }) as Promise<SiteFile | null>
  }

  // 读取文件内容
  async readContent(userId: ObjectId, filePath: string): Promise<{ file: SiteFile, content?: string, url?: string }> {
    const file = await this.get(userId, filePath)
    if (!file) {
      throw new Error('文件不存在')
    }
    if (file.isDirectory) {
      throw new Error('不能读取目录内容')
    }

    // 判断是否为文本文件
    const textTypes = ['text/', 'application/json', 'application/javascript', 'application/xml', 'application/xhtml']
    const isText = textTypes.some(t => file.mimeType?.startsWith(t))

    if (isText) {
      const buffer = await storageService.readFile(file.s3Key!)
      return { file, content: buffer.toString('utf-8') }
    } else {
      const url = await storageService.getDownloadUrl(file.s3Key!)
      return { file, url }
    }
  }

  // 创建/更新文件
  async save(userId: ObjectId, filePath: string, content: string | Buffer, site: Site): Promise<SiteFile> {
    const normalized = this.normalizePath(filePath)
    const name = path.basename(normalized)
    const dirPath = path.dirname(normalized)
    
    // 计算文件信息
    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content
    const size = buffer.length
    const hash = createHash('md5').update(buffer).digest('hex')
    const mimeType = lookup(name) || 'application/octet-stream'
    
    // 检查大小限制
    if (size > site.features.maxFileSize) {
      throw new Error(`文件大小超出限制 (最大 ${site.features.maxFileSize / 1024 / 1024}MB)`)
    }

    // 确保父目录存在
    await this.ensureDirectory(userId, dirPath)

    // S3 上传
    const s3Key = this.getS3Key(userId, normalized)
    await storageService.writeFile(s3Key, buffer, mimeType)

    // 数据库记录
    const now = new Date()
    const existing = await this.get(userId, normalized)
    
    if (existing) {
      await this.collection.updateOne(
        { _id: existing._id },
        { $set: { size, hash, mimeType, s3Key, updatedAt: now } }
      )
      return { ...existing, size, hash, mimeType, s3Key, updatedAt: now }
    } else {
      const file: SiteFile = {
        _id: new ObjectId(),
        userId,
        path: normalized,
        name,
        isDirectory: false,
        size,
        mimeType,
        hash,
        s3Key,
        createdAt: now,
        updatedAt: now,
      }
      await this.collection.insertOne(file)
      return file
    }
  }

  // 创建目录
  async createDirectory(userId: ObjectId, dirPath: string): Promise<SiteFile> {
    const normalized = this.normalizePath(dirPath)
    const name = path.basename(normalized)
    const parentPath = path.dirname(normalized)

    // 确保父目录存在
    if (parentPath !== '/') {
      await this.ensureDirectory(userId, parentPath)
    }

    const existing = await this.get(userId, normalized)
    if (existing) {
      if (!existing.isDirectory) {
        throw new Error('该路径已存在同名文件')
      }
      return existing
    }

    const now = new Date()
    const dir: SiteFile = {
      _id: new ObjectId(),
      userId,
      path: normalized,
      name,
      isDirectory: true,
      size: null,
      mimeType: null,
      hash: null,
      s3Key: null,
      createdAt: now,
      updatedAt: now,
    }
    await this.collection.insertOne(dir)
    return dir
  }

  // 确保目录存在 (递归创建)
  private async ensureDirectory(userId: ObjectId, dirPath: string): Promise<void> {
    if (dirPath === '/' || dirPath === '.') return

    const parts = dirPath.split('/').filter(Boolean)
    let current = ''
    
    for (const part of parts) {
      current += '/' + part
      const existing = await this.get(userId, current)
      if (!existing) {
        await this.createDirectory(userId, current)
      } else if (!existing.isDirectory) {
        throw new Error(`路径冲突: ${current} 是文件而非目录`)
      }
    }
  }

  // 删除文件/目录
  async delete(userId: ObjectId, filePath: string, recursive: boolean = true): Promise<void> {
    const normalized = this.normalizePath(filePath)
    const file = await this.get(userId, normalized)
    
    if (!file) {
      throw new Error('文件不存在')
    }

    if (file.isDirectory) {
      // 获取目录下所有文件
      const children = await this.list(userId, normalized, true)
      const childFiles = children.filter(f => f.path !== normalized)
      
      if (childFiles.length > 0 && !recursive) {
        throw new Error('目录不为空，请使用递归删除')
      }

      // 删除 S3 文件
      for (const child of childFiles) {
        if (!child.isDirectory && child.s3Key) {
          await storageService.deleteFile(child.s3Key)
        }
      }

      // 删除数据库记录
      await this.collection.deleteMany({
        userId,
        path: { $regex: `^${normalized}(/|$)` }
      })
    } else {
      // 删除单个文件
      if (file.s3Key) {
        await storageService.deleteFile(file.s3Key)
      }
      await this.collection.deleteOne({ _id: file._id })
    }
  }

  // 移动/重命名
  async move(userId: ObjectId, fromPath: string, toPath: string): Promise<SiteFile> {
    const from = this.normalizePath(fromPath)
    const to = this.normalizePath(toPath)
    
    const file = await this.get(userId, from)
    if (!file) {
      throw new Error('源文件不存在')
    }

    const existing = await this.get(userId, to)
    if (existing) {
      throw new Error('目标路径已存在')
    }

    // 确保目标目录存在
    const toDir = path.dirname(to)
    if (toDir !== '/') {
      await this.ensureDirectory(userId, toDir)
    }

    if (file.isDirectory) {
      // 移动目录: 更新所有子项路径
      const children = await this.list(userId, from, true)
      
      for (const child of children) {
        const newPath = child.path.replace(from, to)
        const newS3Key = child.s3Key?.replace(from, to) || null
        
        // 如果有 S3 文件，需要复制后删除
        if (child.s3Key && newS3Key) {
          await storageService.copyFile(child.s3Key, newS3Key)
          await storageService.deleteFile(child.s3Key)
        }
        
        await this.collection.updateOne(
          { _id: child._id },
          { $set: { path: newPath, name: path.basename(newPath), s3Key: newS3Key, updatedAt: new Date() } }
        )
      }
    } else {
      // 移动文件
      const newS3Key = this.getS3Key(userId, to)
      if (file.s3Key) {
        await storageService.copyFile(file.s3Key, newS3Key)
        await storageService.deleteFile(file.s3Key)
      }
      
      await this.collection.updateOne(
        { _id: file._id },
        { $set: { path: to, name: path.basename(to), s3Key: newS3Key, updatedAt: new Date() } }
      )
    }

    return this.get(userId, to) as Promise<SiteFile>
  }
}

export const siteFileService = new SiteFileService()
```

### 4.3 静态文件服务路由

```typescript
// src/server/routes/site-serve.ts

import { Router, Request, Response } from 'express'
import { siteService } from '../services/site'
import { siteFileService } from '../services/siteFile'
import { storageService } from '../services/storage'
import { verifyToken } from '../middleware/auth'
import { ObjectId } from 'mongodb'
import { getDb } from '../db'

const router = Router()

// 站点访问控制中间件
async function siteAccessControl(req: Request, res: Response, next: Function) {
  const { userId } = req.params
  
  if (!ObjectId.isValid(userId)) {
    return res.status(404).send('站点不存在')
  }

  const site = await siteService.getOrCreate(new ObjectId(userId))
  
  if (!site.enabled) {
    return res.status(503).send('站点已禁用')
  }

  const reqPath = '/' + (req.params[0] || '')

  // 检查访问控制
  if (site.accessControl.type === 'public') {
    return next()
  }

  // 检查是否在保护路径中
  const isProtected = site.accessControl.type !== 'public' && (
    !site.accessControl.protectedPaths?.length ||
    site.accessControl.protectedPaths.some(p => reqPath.startsWith(p))
  )

  if (!isProtected) {
    return next()
  }

  if (site.accessControl.type === 'login') {
    // 需要登录
    const authHeader = req.headers.authorization
    if (!authHeader) {
      return res.status(401).json({ error: '需要登录访问' })
    }
    try {
      await verifyToken(authHeader.replace('Bearer ', ''))
      return next()
    } catch {
      return res.status(401).json({ error: '登录已过期' })
    }
  }

  if (site.accessControl.type === 'password') {
    // 密码保护
    const inputPassword = req.headers['x-site-password'] || req.query.password
    if (inputPassword === site.accessControl.password) {
      return next()
    }
    return res.status(401).json({ error: '需要密码访问' })
  }

  next()
}

// 静态文件服务
// GET /site/:userId/*
router.get('/:userId/*', siteAccessControl, async (req: Request, res: Response) => {
  try {
    const userId = new ObjectId(req.params.userId)
    let reqPath = '/' + (req.params[0] || '')
    
    const site = await siteService.getOrCreate(userId)

    // 尝试获取文件
    let file = await siteFileService.get(userId, reqPath)

    // 如果是目录，尝试获取默认文件
    if (file?.isDirectory) {
      const defaultPath = reqPath === '/' ? `/${site.defaultFile}` : `${reqPath}/${site.defaultFile}`
      file = await siteFileService.get(userId, defaultPath)
    }

    // 文件不存在
    if (!file || file.isDirectory) {
      // SPA 模式: 返回 index.html
      if (site.spaMode) {
        const indexFile = await siteFileService.get(userId, '/' + site.defaultFile)
        if (indexFile && !indexFile.isDirectory) {
          file = indexFile
        }
      }
      
      // 自定义 404 页面
      if (!file && site.notFoundPage) {
        const notFoundFile = await siteFileService.get(userId, site.notFoundPage)
        if (notFoundFile && !notFoundFile.isDirectory) {
          res.status(404)
          file = notFoundFile
        }
      }

      // 默认 404
      if (!file) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head><title>404 Not Found</title></head>
          <body>
            <h1>404 Not Found</h1>
            <p>请求的页面不存在</p>
          </body>
          </html>
        `)
      }
    }

    // 设置响应头
    res.set('Content-Type', file.mimeType || 'application/octet-stream')
    
    // 缓存控制 (静态资源缓存，HTML 不缓存)
    if (file.mimeType?.startsWith('text/html')) {
      res.set('Cache-Control', 'no-cache')
    } else {
      res.set('Cache-Control', 'public, max-age=86400') // 1 天
      res.set('ETag', `"${file.hash}"`)
      
      // 检查 ETag
      if (req.headers['if-none-match'] === `"${file.hash}"`) {
        return res.status(304).end()
      }
    }

    // 获取文件内容
    const buffer = await storageService.readFile(file.s3Key!)
    res.send(buffer)
    
  } catch (error: any) {
    console.error('Site serve error:', error)
    res.status(500).send('服务器错误')
  }
})

export default router
```

### 4.4 主路由注册

```typescript
// src/server/index.ts (添加)

import siteRouter from './routes/site'
import siteFilesRouter from './routes/site-files'
import siteServeRouter from './routes/site-serve'

// API 路由 (需要认证)
app.use('/api/site', authMiddleware, siteRouter)
app.use('/api/site/files', authMiddleware, siteFilesRouter)

// 静态站点服务 (独立访问控制)
app.use('/site', siteServeRouter)
```

---

## 五、AI 文件操作

### 5.1 扩展 AI Action 类型

```typescript
// src/server/services/ai/types.ts (扩展)

export type AIActionType = 
  | 'create_function'
  | 'update_function'
  | 'delete_function'
  // ... 现有类型
  | 'site_create_file'    // 创建站点文件
  | 'site_update_file'    // 更新站点文件
  | 'site_delete_file'    // 删除站点文件
  | 'site_read_file'      // 读取站点文件
  | 'site_list_files'     // 列出文件

export interface AISiteAction {
  type: 'site_create_file' | 'site_update_file' | 'site_delete_file' | 'site_read_file' | 'site_list_files'
  path: string
  content?: string        // 创建/更新时的内容
}
```

### 5.2 AI 执行器扩展

```typescript
// src/server/services/ai/executor.ts (扩展)

import { siteService } from '../site'
import { siteFileService } from '../siteFile'

// 在 executeAction 方法中添加
async executeAction(action: AIAction, userId: ObjectId, username: string): Promise<ActionResult> {
  switch (action.type) {
    // ... 现有 case
    
    case 'site_create_file':
    case 'site_update_file': {
      const site = await siteService.getOrCreate(userId)
      const file = await siteFileService.save(userId, action.path, action.content || '', site)
      await siteService.updateStats(userId)
      return {
        success: true,
        message: `${action.type === 'site_create_file' ? '创建' : '更新'}文件: ${action.path}`,
        data: file
      }
    }
    
    case 'site_delete_file': {
      await siteFileService.delete(userId, action.path)
      await siteService.updateStats(userId)
      return {
        success: true,
        message: `删除文件: ${action.path}`
      }
    }
    
    case 'site_read_file': {
      const result = await siteFileService.readContent(userId, action.path)
      return {
        success: true,
        message: `读取文件: ${action.path}`,
        data: result
      }
    }
    
    case 'site_list_files': {
      const files = await siteFileService.list(userId, action.path || '/')
      return {
        success: true,
        message: `文件列表: ${action.path || '/'}`,
        data: files
      }
    }
  }
}
```

### 5.3 AI 系统提示词扩展

在系统提示词中添加站点文件操作的说明：

```markdown
## 站点文件操作

你可以帮助用户管理静态站点文件。使用以下操作：

### 创建文件
\`\`\`json
{
  "type": "site_create_file",
  "path": "/index.html",
  "content": "<!DOCTYPE html>..."
}
\`\`\`

### 更新文件
\`\`\`json
{
  "type": "site_update_file",
  "path": "/css/style.css",
  "content": "body { ... }"
}
\`\`\`

### 删除文件
\`\`\`json
{
  "type": "site_delete_file",
  "path": "/old-page.html"
}
\`\`\`

### 读取文件
\`\`\`json
{
  "type": "site_read_file",
  "path": "/index.html"
}
\`\`\`

站点文件访问路径: /site/{userId}/路径
例如: /site/abc123/index.html
```

---

## 六、前端实现

### 6.1 文件结构

```
src/client/
├── components/
│   ├── site/
│   │   ├── SitePanel.tsx           # 站点管理主面板
│   │   ├── SiteFileTree.tsx        # 文件树组件
│   │   ├── SiteEditor.tsx          # 文件编辑器
│   │   ├── SitePreview.tsx         # 预览面板
│   │   ├── SiteSettings.tsx        # 站点设置
│   │   └── SiteUploadModal.tsx     # 上传弹窗
│   └── ...
├── api/
│   └── site.ts                     # API 调用
├── stores/
│   └── site.ts                     # Zustand 状态
└── ...
```

### 6.2 状态管理

```typescript
// src/client/stores/site.ts

import { create } from 'zustand'
import * as siteApi from '../api/site'

interface SiteFile {
  _id: string
  path: string
  name: string
  isDirectory: boolean
  size: number | null
  mimeType: string | null
  updatedAt: string
}

interface SiteState {
  // 站点配置
  site: Site | null
  loading: boolean
  
  // 文件管理
  files: SiteFile[]
  currentFile: SiteFile | null
  fileContent: string
  openFiles: SiteFile[]           // 打开的文件标签
  
  // 预览
  previewUrl: string | null
  previewDevice: 'desktop' | 'tablet' | 'mobile'
  autoRefresh: boolean
  
  // 操作
  fetchSite: () => Promise<void>
  updateSite: (updates: Partial<Site>) => Promise<void>
  fetchFiles: () => Promise<void>
  selectFile: (file: SiteFile) => Promise<void>
  saveFile: (path: string, content: string) => Promise<void>
  createFile: (path: string, content?: string) => Promise<void>
  createFolder: (path: string) => Promise<void>
  deleteFile: (path: string) => Promise<void>
  uploadFiles: (path: string, files: FileList) => Promise<void>
  refreshPreview: () => void
}

export const useSiteStore = create<SiteState>((set, get) => ({
  site: null,
  loading: false,
  files: [],
  currentFile: null,
  fileContent: '',
  openFiles: [],
  previewUrl: null,
  previewDevice: 'desktop',
  autoRefresh: true,

  fetchSite: async () => {
    set({ loading: true })
    try {
      const res = await siteApi.getSite()
      set({ site: res.data })
    } finally {
      set({ loading: false })
    }
  },

  updateSite: async (updates) => {
    const res = await siteApi.updateSite(updates)
    set({ site: res.data })
  },

  fetchFiles: async () => {
    const res = await siteApi.getFiles()
    set({ files: res.data })
  },

  selectFile: async (file) => {
    if (file.isDirectory) return
    
    const res = await siteApi.getFileContent(file.path)
    set({ 
      currentFile: file, 
      fileContent: res.data.content || '' 
    })
    
    // 添加到打开的标签
    const { openFiles } = get()
    if (!openFiles.find(f => f.path === file.path)) {
      set({ openFiles: [...openFiles, file] })
    }
  },

  saveFile: async (path, content) => {
    await siteApi.saveFile(path, content)
    await get().fetchFiles()
    
    // 自动刷新预览
    if (get().autoRefresh) {
      get().refreshPreview()
    }
  },

  createFile: async (path, content = '') => {
    await siteApi.saveFile(path, content)
    await get().fetchFiles()
  },

  createFolder: async (path) => {
    await siteApi.createFolder(path)
    await get().fetchFiles()
  },

  deleteFile: async (path) => {
    await siteApi.deleteFile(path)
    await get().fetchFiles()
    
    // 如果删除的是当前文件，清空编辑器
    if (get().currentFile?.path === path) {
      set({ currentFile: null, fileContent: '' })
    }
  },

  uploadFiles: async (path, files) => {
    await siteApi.uploadFiles(path, files)
    await get().fetchFiles()
  },

  refreshPreview: () => {
    const { site } = get()
    if (site) {
      // 添加时间戳强制刷新
      set({ previewUrl: `/site/${site.userId}/?t=${Date.now()}` })
    }
  },
}))
```

### 6.3 核心组件

#### SitePanel.tsx - 站点管理面板

```tsx
// src/client/components/site/SitePanel.tsx

import { useEffect } from 'react'
import { Layout, Tabs, Button, Switch, Space, message } from 'antd'
import { ReloadOutlined, SettingOutlined, EyeOutlined } from '@ant-design/icons'
import { useSiteStore } from '../../stores/site'
import SiteFileTree from './SiteFileTree'
import SiteEditor from './SiteEditor'
import SitePreview from './SitePreview'
import SiteSettings from './SiteSettings'

const { Sider, Content } = Layout

export default function SitePanel() {
  const { 
    site, 
    fetchSite, 
    fetchFiles,
    currentFile,
    fileContent,
    saveFile,
    autoRefresh,
    refreshPreview
  } = useSiteStore()

  useEffect(() => {
    fetchSite()
    fetchFiles()
  }, [])

  const handleSave = async () => {
    if (!currentFile) return
    try {
      await saveFile(currentFile.path, fileContent)
      message.success('保存成功')
    } catch (e: any) {
      message.error(e.message)
    }
  }

  return (
    <Layout style={{ height: '100%' }}>
      {/* 左侧: 文件树 */}
      <Sider width={240} theme="light" style={{ borderRight: '1px solid #e5e7eb' }}>
        <div style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
          <Space>
            <span style={{ fontWeight: 500 }}>站点文件</span>
            <Button size="small" icon={<ReloadOutlined />} onClick={fetchFiles} />
            <SiteSettings />
          </Space>
        </div>
        <SiteFileTree />
      </Sider>

      {/* 中间: 编辑器 */}
      <Content style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
          <span>{currentFile?.path || '未选择文件'}</span>
          <Space>
            <span>自动刷新</span>
            <Switch 
              size="small" 
              checked={autoRefresh} 
              onChange={(v) => useSiteStore.setState({ autoRefresh: v })} 
            />
            <Button size="small" onClick={handleSave} disabled={!currentFile}>
              保存
            </Button>
          </Space>
        </div>
        <div style={{ flex: 1 }}>
          <SiteEditor />
        </div>
      </Content>

      {/* 右侧: 预览 */}
      <Sider width={400} theme="light" style={{ borderLeft: '1px solid #e5e7eb' }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>
          <Space>
            <span>预览</span>
            <Button size="small" icon={<ReloadOutlined />} onClick={refreshPreview} />
            <Button 
              size="small" 
              icon={<EyeOutlined />} 
              onClick={() => window.open(`/site/${site?.userId}/`, '_blank')}
            >
              新窗口
            </Button>
          </Space>
        </div>
        <SitePreview />
      </Sider>
    </Layout>
  )
}
```

#### SiteFileTree.tsx - 文件树

```tsx
// src/client/components/site/SiteFileTree.tsx

import { useState } from 'react'
import { Tree, Dropdown, Input, Modal, message } from 'antd'
import { 
  FileOutlined, 
  FolderOutlined, 
  PlusOutlined,
  DeleteOutlined,
  EditOutlined
} from '@ant-design/icons'
import type { DataNode, TreeProps } from 'antd/es/tree'
import { useSiteStore } from '../../stores/site'

export default function SiteFileTree() {
  const { files, selectFile, createFile, createFolder, deleteFile, currentFile } = useSiteStore()
  const [newFileModal, setNewFileModal] = useState<{ visible: boolean; type: 'file' | 'folder'; path: string }>({ 
    visible: false, 
    type: 'file', 
    path: '/' 
  })
  const [newName, setNewName] = useState('')

  // 将扁平列表转换为树结构
  const buildTree = (): DataNode[] => {
    const map = new Map<string, DataNode>()
    const roots: DataNode[] = []

    // 先创建所有节点
    files.forEach(file => {
      map.set(file.path, {
        key: file.path,
        title: file.name,
        icon: file.isDirectory ? <FolderOutlined /> : <FileOutlined />,
        isLeaf: !file.isDirectory,
        children: [],
      })
    })

    // 构建父子关系
    files.forEach(file => {
      const node = map.get(file.path)!
      const parentPath = file.path.substring(0, file.path.lastIndexOf('/')) || '/'
      
      if (parentPath === '/' || parentPath === '') {
        roots.push(node)
      } else {
        const parent = map.get(parentPath)
        if (parent) {
          parent.children = parent.children || []
          parent.children.push(node)
        }
      }
    })

    return roots
  }

  const handleSelect: TreeProps['onSelect'] = (keys) => {
    if (keys.length === 0) return
    const file = files.find(f => f.path === keys[0])
    if (file) selectFile(file)
  }

  const handleCreate = async () => {
    const fullPath = newFileModal.path === '/' 
      ? `/${newName}` 
      : `${newFileModal.path}/${newName}`
    
    try {
      if (newFileModal.type === 'folder') {
        await createFolder(fullPath)
      } else {
        await createFile(fullPath, getTemplate(newName))
      }
      message.success('创建成功')
      setNewFileModal({ ...newFileModal, visible: false })
      setNewName('')
    } catch (e: any) {
      message.error(e.message)
    }
  }

  const handleDelete = async (path: string) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除 ${path} 吗？`,
      onOk: async () => {
        try {
          await deleteFile(path)
          message.success('删除成功')
        } catch (e: any) {
          message.error(e.message)
        }
      }
    })
  }

  // 右键菜单
  const getContextMenu = (path: string, isDirectory: boolean) => ({
    items: [
      ...(isDirectory ? [
        { key: 'new-file', label: '新建文件', icon: <PlusOutlined /> },
        { key: 'new-folder', label: '新建文件夹', icon: <FolderOutlined /> },
      ] : []),
      { key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'new-file') {
        setNewFileModal({ visible: true, type: 'file', path })
        setNewName('')
      } else if (key === 'new-folder') {
        setNewFileModal({ visible: true, type: 'folder', path })
        setNewName('')
      } else if (key === 'delete') {
        handleDelete(path)
      }
    }
  })

  return (
    <>
      <div style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>
        <Dropdown menu={getContextMenu('/', true)} trigger={['click']}>
          <PlusOutlined style={{ cursor: 'pointer' }} />
        </Dropdown>
      </div>
      
      <Tree
        showIcon
        treeData={buildTree()}
        selectedKeys={currentFile ? [currentFile.path] : []}
        onSelect={handleSelect}
        titleRender={(node) => (
          <Dropdown menu={getContextMenu(node.key as string, !node.isLeaf)} trigger={['contextMenu']}>
            <span>{node.title as string}</span>
          </Dropdown>
        )}
        style={{ padding: '8px' }}
      />

      <Modal
        title={newFileModal.type === 'file' ? '新建文件' : '新建文件夹'}
        open={newFileModal.visible}
        onOk={handleCreate}
        onCancel={() => setNewFileModal({ ...newFileModal, visible: false })}
      >
        <Input 
          placeholder={newFileModal.type === 'file' ? '文件名 (如 index.html)' : '文件夹名'}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onPressEnter={handleCreate}
        />
      </Modal>
    </>
  )
}

// 根据文件扩展名返回模板
function getTemplate(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'html':
      return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>页面标题</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <h1>Hello World</h1>
  
  <script src="/js/app.js"></script>
</body>
</html>`
    case 'css':
      return `/* 样式文件 */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  margin: 0;
  padding: 20px;
}

h1 {
  color: #059669;
}
`
    case 'js':
      return `// JavaScript 文件

// 调用云函数示例
async function callApi() {
  const response = await fetch('/invoke/hello')
  const data = await response.json()
  console.log(data)
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('页面加载完成')
})
`
    case 'json':
      return '{\n  \n}'
    default:
      return ''
  }
}
```

#### SitePreview.tsx - 预览面板

```tsx
// src/client/components/site/SitePreview.tsx

import { useEffect, useRef } from 'react'
import { Segmented, Empty } from 'antd'
import { DesktopOutlined, TabletOutlined, MobileOutlined } from '@ant-design/icons'
import { useSiteStore } from '../../stores/site'

const DEVICE_SIZES = {
  desktop: { width: '100%', height: '100%' },
  tablet: { width: '768px', height: '100%' },
  mobile: { width: '375px', height: '100%' },
}

export default function SitePreview() {
  const { site, previewUrl, previewDevice, refreshPreview } = useSiteStore()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (site && !previewUrl) {
      refreshPreview()
    }
  }, [site])

  const deviceOptions = [
    { value: 'desktop', icon: <DesktopOutlined /> },
    { value: 'tablet', icon: <TabletOutlined /> },
    { value: 'mobile', icon: <MobileOutlined /> },
  ]

  if (!previewUrl) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="暂无预览" />
      </div>
    )
  }

  const size = DEVICE_SIZES[previewDevice]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
        <Segmented
          size="small"
          options={deviceOptions}
          value={previewDevice}
          onChange={(v) => useSiteStore.setState({ previewDevice: v as any })}
        />
      </div>
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'flex-start',
        padding: '16px',
        background: '#f0f0f0',
        overflow: 'auto'
      }}>
        <iframe
          ref={iframeRef}
          src={previewUrl}
          style={{
            width: size.width,
            height: size.height === '100%' ? 'calc(100vh - 200px)' : size.height,
            maxWidth: '100%',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            background: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        />
      </div>
    </div>
  )
}
```

### 6.4 侧边栏入口

```tsx
// 在 IDE.tsx 侧边栏添加站点入口

import { Globe } from 'lucide-react'

// 侧边栏图标
const sidebarItems = [
  { key: 'functions', icon: <Code size={20} />, label: '云函数' },
  { key: 'database', icon: <Database size={20} />, label: '数据库' },
  { key: 'site', icon: <Globe size={20} />, label: '站点' },  // 新增
]

// 根据 currentView 渲染不同面板
{currentView === 'site' && <SitePanel />}
```

---

## 七、部署配置

### 7.1 环境变量

```bash
# .env (新增)

# S3 存储 (已有，站点复用)
S3_ENDPOINT="https://your-s3-endpoint.com"
S3_ACCESS_KEY="your-access-key"
S3_SECRET_KEY="your-secret-key"
S3_BUCKET="your-bucket"

# 站点配置
SITE_MAX_STORAGE=104857600      # 默认最大存储 100MB
SITE_MAX_FILE_SIZE=10485760     # 默认单文件最大 10MB
```

### 7.2 Nginx 配置 (可选优化)

如果需要更高性能，可以让 Nginx 直接代理 S3：

```nginx
# 站点静态文件 (高性能方案)
location ~ ^/site/([a-f0-9]+)/(.*)$ {
    set $user_id $1;
    set $file_path $2;
    
    # 直接代理到 S3
    proxy_pass https://your-s3-endpoint.com/sites/$user_id/$file_path;
    
    # 缓存配置
    proxy_cache_valid 200 1d;
    proxy_cache_valid 404 1m;
    
    # 添加 CORS
    add_header Access-Control-Allow-Origin *;
}
```

---

## 八、测试计划

### 8.1 API 测试

```bash
# 获取站点配置
curl -X GET http://localhost:3000/api/site \
  -H "Authorization: Bearer {token}"

# 创建文件
curl -X POST http://localhost:3000/api/site/files \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"path": "/index.html", "content": "<!DOCTYPE html>..."}'

# 访问站点
curl http://localhost:3000/site/{userId}/index.html
```

### 8.2 功能测试清单

```
□ 站点配置
  □ 获取默认配置
  □ 更新配置
  □ 启用/禁用站点

□ 文件管理
  □ 创建文件
  □ 创建文件夹
  □ 更新文件
  □ 删除文件
  □ 删除文件夹 (递归)
  □ 上传文件
  □ 移动/重命名

□ 静态服务
  □ 访问 HTML
  □ 访问 CSS/JS
  □ 访问图片
  □ 目录默认文件
  □ SPA 模式
  □ 自定义 404
  □ ETag 缓存

□ 访问控制
  □ 公开访问
  □ 登录保护
  □ 密码保护
  □ 路径级别保护

□ AI 操作
  □ AI 创建文件
  □ AI 更新文件
  □ AI 删除文件
  □ AI 读取文件
  □ AI 列出文件

□ 前端功能
  □ 文件树展示
  □ 文件编辑
  □ 实时预览
  □ 自动刷新
  □ 设备切换
```

---

## 九、时间安排

| 天数 | 任务 | 产出 |
|------|------|------|
| Day 1 | 数据模型 + 站点配置 API | `site.ts` 服务和路由 |
| Day 2 | 文件管理 API + S3 集成 | `siteFile.ts` 服务，文件 CRUD |
| Day 3 | 静态文件服务 + 访问控制 | `/site/*` 路由，认证中间件 |
| Day 4 | 前端文件树 + 编辑器 | React 组件，Zustand 状态 |
| Day 5 | 预览功能 + AI 集成 + 测试 | 完整功能，AI 文件操作 |

---

## 十、后续迭代 (Sprint 10-12)

### Sprint 10: 编辑体验增强
- Emmet 支持
- 代码格式化
- 多标签编辑
- 快捷键

### Sprint 11: 高级功能
- 文件搜索
- 批量操作
- 拖拽上传
- 图片预览

### Sprint 12: 框架构建 (可选)
- 权限控制 (仅授权用户)
- 浏览器端 ESBuild
- 构建进度显示
- 错误提示
