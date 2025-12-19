# Phase 2: Runtime 引擎 - 任务清单

## 任务概览

| 任务 | 优先级 | 预估 | 状态 |
|------|-------|------|------|
| 2.1 项目初始化 | P0 | 30min | 待开始 |
| 2.2 Console 捕获 | P0 | 30min | 待开始 |
| 2.3 函数模块加载 | P0 | 1h | 待开始 |
| 2.4 函数执行器 | P0 | 1h | 待开始 |
| 2.5 Cloud SDK | P0 | 1h | 待开始 |
| 2.6 HTTP 处理器 | P0 | 1h | 待开始 |
| 2.7 测试验证 | P1 | 30min | 待开始 |

---

## 2.1 项目初始化

### 任务描述

创建 Runtime 项目。

### 具体步骤

- [ ] 创建目录 `packages/runtime`
- [ ] 初始化 `package.json`
- [ ] 安装依赖：
  ```bash
  pnpm add express cors mongodb
  pnpm add -D @types/express @types/cors tsx typescript
  ```
- [ ] 创建基础文件结构
- [ ] 配置端口 8000

---

## 2.2 Console 捕获

### 任务描述

实现 Console 类，捕获函数内的 console.log 输出。

### 参考 laf

`runtimes/nodejs/src/support/engine/console.ts`

### 具体步骤

- [ ] 创建 `src/engine/console.ts`：
  ```typescript
  export class FunctionConsole {
    private logs: string[] = []

    log(...args: any[]) {
      this.logs.push(args.map(a =>
        typeof a === 'object' ? JSON.stringify(a) : String(a)
      ).join(' '))
    }

    error(...args: any[]) {
      this.logs.push('[ERROR] ' + args.map(a =>
        typeof a === 'object' ? JSON.stringify(a) : String(a)
      ).join(' '))
    }

    warn(...args: any[]) {
      this.logs.push('[WARN] ' + args.map(a =>
        typeof a === 'object' ? JSON.stringify(a) : String(a)
      ).join(' '))
    }

    getLogs(): string[] {
      return this.logs
    }

    clear() {
      this.logs = []
    }
  }
  ```

---

## 2.3 函数模块加载

### 任务描述

实现函数代码的加载和缓存。

### 参考 laf

`runtimes/nodejs/src/support/engine/module.ts`

### 具体步骤

- [ ] 创建 `src/engine/module.ts`：
  ```typescript
  import vm from 'vm'

  interface FunctionModule {
    default: Function
    __code_hash?: string
  }

  const moduleCache = new Map<string, FunctionModule>()

  export function loadModule(name: string, code: string, hash: string): FunctionModule {
    // 检查缓存
    const cached = moduleCache.get(name)
    if (cached && cached.__code_hash === hash) {
      return cached
    }

    // 创建模块包装
    const wrapped = `
      const exports = {};
      const module = { exports };
      ${code}
      module.exports;
    `

    // 执行代码
    const script = new vm.Script(wrapped, { filename: `${name}.js` })
    const exports = script.runInThisContext()

    const mod: FunctionModule = {
      default: exports.default || exports,
      __code_hash: hash
    }

    moduleCache.set(name, mod)
    return mod
  }

  export function clearCache(name?: string) {
    if (name) {
      moduleCache.delete(name)
    } else {
      moduleCache.clear()
    }
  }
  ```

---

## 2.4 函数执行器

### 任务描述

实现函数执行逻辑。

### 参考 laf

`runtimes/nodejs/src/support/engine/executor.ts`

### 具体步骤

- [ ] 创建 `src/engine/executor.ts`：
  ```typescript
  import { FunctionConsole } from './console'
  import { loadModule } from './module'
  import { createCloud } from '../cloud'

  export interface FunctionContext {
    body: any
    query: Record<string, string>
    headers: Record<string, string>
    cloud: ReturnType<typeof createCloud>
  }

  export interface ExecuteResult {
    data: any
    logs: string[]
    time: number
    error?: string
  }

  export async function executeFunction(
    name: string,
    code: string,
    hash: string,
    ctx: FunctionContext
  ): Promise<ExecuteResult> {
    const startTime = Date.now()
    const console = new FunctionConsole()

    // 注入 console
    const originalConsole = global.console
    global.console = console as any

    try {
      const mod = loadModule(name, code, hash)
      const fn = mod.default

      if (typeof fn !== 'function') {
        throw new Error('函数必须导出 default function')
      }

      const result = await fn(ctx)

      return {
        data: result,
        logs: console.getLogs(),
        time: Date.now() - startTime
      }
    } catch (error: any) {
      return {
        data: null,
        logs: console.getLogs(),
        time: Date.now() - startTime,
        error: error.message
      }
    } finally {
      global.console = originalConsole
    }
  }
  ```

---

## 2.5 Cloud SDK

### 任务描述

实现 Cloud SDK，包含数据库、函数调用和文件存储。

### 具体步骤

- [ ] 安装 S3 依赖：
  ```bash
  pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
  ```

- [ ] 创建 `src/services/storage.ts`：
  ```typescript
  import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
  import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'auto',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY!,
      secretAccessKey: process.env.S3_SECRET_KEY!,
    },
  })

  export class StorageBucket {
    constructor(private bucket: string) {}

    async writeFile(key: string, body: Buffer | string) {
      await s3.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
      }))
    }

    async readFile(key: string): Promise<Buffer> {
      const res = await s3.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }))
      return Buffer.from(await res.Body!.transformToByteArray())
    }

    async deleteFile(key: string) {
      await s3.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }))
    }

    async listFiles(prefix?: string) {
      const res = await s3.send(new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
      }))
      return res.Contents || []
    }

    async getUploadUrl(key: string, expiresIn = 3600) {
      return getSignedUrl(s3, new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }), { expiresIn })
    }

    async getDownloadUrl(key: string, expiresIn = 3600) {
      return getSignedUrl(s3, new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }), { expiresIn })
    }
  }

  export const storage = {
    bucket: (name?: string) => new StorageBucket(name || process.env.S3_BUCKET!),
  }
  ```

- [ ] 创建 `src/cloud/index.ts`：
  ```typescript
  import { getDB } from '../db'
  import { storage } from '../services/storage'

  export function createCloud() {
    return {
      database() {
        return getDB()
      },

      async invoke(name: string, data?: any) {
        // 内部调用其他函数
        const db = getDB()
        const func = await db.collection('functions').findOne({ name })
        if (!func) throw new Error(`函数 ${name} 不存在`)

        const { executeFunction } = await import('../engine/executor')
        const result = await executeFunction(name, func.compiled, func.hash || '', {
          body: data,
          query: {},
          headers: {},
          cloud: this
        })

        if (result.error) throw new Error(result.error)
        return result.data
      },

      storage,

      env: process.env
    }
  }
  ```

---

## 2.6 HTTP 处理器

### 任务描述

实现函数调用的 HTTP 端点。

### 具体步骤

- [ ] 创建 `src/handler/invoke.ts`：
  ```typescript
  import { Router } from 'express'
  import { getDB } from '../db'
  import { executeFunction } from '../engine/executor'
  import { createCloud } from '../cloud'
  import { config } from '../config'
  import zlib from 'zlib'

  const router = Router()

  // Token 验证中间件
  function verifyToken(req, res, next) {
    const token = req.headers['x-develop-token']
    if (token !== config.developToken) {
      return res.status(401).json({ error: 'Invalid token' })
    }
    next()
  }

  router.all('/:name', verifyToken, async (req, res) => {
    const { name } = req.params
    const db = getDB()

    // 查找函数
    const func = await db.collection('functions').findOne({ name })
    if (!func) {
      return res.status(404).json({ error: `函数 ${name} 不存在` })
    }

    if (!func.compiled) {
      return res.status(400).json({ error: '函数未编译' })
    }

    // 创建上下文
    const ctx = {
      body: req.body,
      query: req.query as Record<string, string>,
      headers: req.headers as Record<string, string>,
      cloud: createCloud()
    }

    // 执行函数
    const result = await executeFunction(name, func.compiled, func.hash || '', ctx)

    // 设置响应头
    const logsCompressed = zlib.gzipSync(JSON.stringify(result.logs)).toString('base64')
    res.set('x-function-logs', logsCompressed)
    res.set('x-execution-time', String(result.time))

    if (result.error) {
      return res.status(500).json({ error: result.error })
    }

    res.json(result.data)
  })

  export default router
  ```

- [ ] 在 `index.ts` 中注册路由：
  ```typescript
  import invokeRouter from './handler/invoke'
  app.use('/invoke', invokeRouter)
  ```

---

## 2.7 测试验证

### 测试用例

- [ ] 创建一个简单函数：
  ```typescript
  export default async function(ctx) {
    console.log('Hello from function')
    return { message: 'Hello', body: ctx.body }
  }
  ```
- [ ] 编译函数
- [ ] 调用 POST /invoke/hello → 返回结果
- [ ] 检查响应头中的 logs
- [ ] 测试 cloud.database() 访问
- [ ] 测试 cloud.invoke() 调用其他函数
- [ ] 测试 cloud.storage.bucket() 文件操作

---

## 开发日志

| 日期 | 任务 | 完成情况 | 备注 |
|------|------|---------|------|
| - | - | - | - |
