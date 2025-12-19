# Phase 1: 后端基础 - 任务清单

## 任务概览

| 任务 | 优先级 | 预估 | 状态 |
|------|-------|------|------|
| 1.1 项目初始化 | P0 | 30min | 待开始 |
| 1.2 MongoDB 连接 | P0 | 30min | 待开始 |
| 1.3 用户认证 API | P0 | 1h | 待开始 |
| 1.4 函数 CRUD API | P0 | 1.5h | 待开始 |
| 1.5 TypeScript 编译 | P0 | 1h | 待开始 |
| 1.6 测试验证 | P1 | 30min | 待开始 |

---

## 1.1 项目初始化

### 任务描述

创建 Server 项目，配置 TypeScript 和依赖。

### 具体步骤

- [ ] 创建目录 `packages/server`
- [ ] 初始化 `package.json`
- [ ] 安装依赖：
  ```bash
  pnpm add express cors mongodb bcrypt jsonwebtoken typescript
  pnpm add -D @types/express @types/cors @types/bcrypt @types/jsonwebtoken tsx
  ```
- [ ] 创建 `tsconfig.json`
- [ ] 创建 `src/index.ts` 基础 Express 应用
- [ ] 添加 npm scripts

### 预期结果

```bash
cd packages/server
pnpm dev
# Server running on http://localhost:3000
```

---

## 1.2 MongoDB 连接

### 任务描述

实现数据库连接和集合定义。

### 具体步骤

- [ ] 创建 `src/config.ts`：
  ```typescript
  export const config = {
    port: process.env.PORT || 3000,
    mongoUrl: process.env.MONGO_URL || 'mongodb://localhost:27017/simple-ide',
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    jwtExpiresIn: '7d'
  }
  ```
- [ ] 创建 `src/db.ts`：
  ```typescript
  import { MongoClient, Db } from 'mongodb'
  import { config } from './config'

  let db: Db

  export async function connectDB() {
    const client = new MongoClient(config.mongoUrl)
    await client.connect()
    db = client.db()
    console.log('MongoDB connected')

    // 创建索引
    await db.collection('functions').createIndex(
      { userId: 1, name: 1 },
      { unique: true }
    )
  }

  export function getDB() {
    return db
  }
  ```
- [ ] 在 `index.ts` 中调用 `connectDB()`

### 验证命令

```bash
# 启动 MongoDB
docker run -d -p 27017:27017 mongo:6

# 启动 Server，查看 "MongoDB connected" 日志
pnpm dev
```

---

## 1.3 用户认证 API

### 任务描述

实现注册、登录、获取当前用户 API。

### 具体步骤

- [ ] 创建 `src/middleware/auth.ts`：
  ```typescript
  import jwt from 'jsonwebtoken'
  import { config } from '../config'

  export function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED' } })
    }
    try {
      const payload = jwt.verify(token, config.jwtSecret)
      req.user = payload
      next()
    } catch {
      res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN' } })
    }
  }
  ```

- [ ] 创建 `src/services/auth.ts`：
  ```typescript
  import bcrypt from 'bcrypt'
  import jwt from 'jsonwebtoken'
  import { getDB } from '../db'
  import { config } from '../config'

  export async function register(username: string, password: string) {
    const db = getDB()
    const existing = await db.collection('users').findOne({ username })
    if (existing) throw new Error('用户名已存在')

    const hash = await bcrypt.hash(password, 10)
    const result = await db.collection('users').insertOne({
      username,
      password: hash,
      createdAt: new Date()
    })

    const token = jwt.sign({ userId: result.insertedId, username }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn
    })

    return { token, user: { id: result.insertedId, username } }
  }

  export async function login(username: string, password: string) {
    const db = getDB()
    const user = await db.collection('users').findOne({ username })
    if (!user) throw new Error('用户不存在')

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) throw new Error('密码错误')

    const token = jwt.sign({ userId: user._id, username }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn
    })

    return { token, user: { id: user._id, username } }
  }
  ```

- [ ] 创建 `src/routes/auth.ts`：
  ```typescript
  import { Router } from 'express'
  import * as authService from '../services/auth'

  const router = Router()

  router.post('/register', async (req, res) => {
    try {
      const { username, password } = req.body
      const result = await authService.register(username, password)
      res.json({ success: true, data: result })
    } catch (error) {
      res.status(400).json({ success: false, error: { message: error.message } })
    }
  })

  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body
      const result = await authService.login(username, password)
      res.json({ success: true, data: result })
    } catch (error) {
      res.status(400).json({ success: false, error: { message: error.message } })
    }
  })

  export default router
  ```

- [ ] 在 `index.ts` 中注册路由

### 验证

```bash
# 注册
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"123456"}'

# 登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"123456"}'
```

---

## 1.4 函数 CRUD API

### 任务描述

实现函数的增删改查 API。

### 具体步骤

- [ ] 创建 `src/services/function.ts`：
  ```typescript
  import { ObjectId } from 'mongodb'
  import { getDB } from '../db'

  export async function list(userId: string) {
    const db = getDB()
    return db.collection('functions')
      .find({ userId: new ObjectId(userId) })
      .sort({ updatedAt: -1 })
      .toArray()
  }

  export async function create(userId: string, name: string, code: string) {
    const db = getDB()
    const result = await db.collection('functions').insertOne({
      name,
      code,
      compiled: '',
      userId: new ObjectId(userId),
      createdAt: new Date(),
      updatedAt: new Date()
    })
    return { _id: result.insertedId, name, code }
  }

  export async function update(id: string, userId: string, data: { code?: string }) {
    const db = getDB()
    await db.collection('functions').updateOne(
      { _id: new ObjectId(id), userId: new ObjectId(userId) },
      { $set: { ...data, updatedAt: new Date() } }
    )
  }

  export async function remove(id: string, userId: string) {
    const db = getDB()
    await db.collection('functions').deleteOne({
      _id: new ObjectId(id),
      userId: new ObjectId(userId)
    })
  }

  export async function findById(id: string, userId: string) {
    const db = getDB()
    return db.collection('functions').findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(userId)
    })
  }
  ```

- [ ] 创建 `src/routes/functions.ts`
- [ ] 注册路由并添加 authMiddleware

### 验证

```bash
TOKEN="your_jwt_token"

# 创建函数
curl -X POST http://localhost:3000/api/functions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"hello","code":"export default async function() { return \"Hello\" }"}'

# 列表
curl http://localhost:3000/api/functions \
  -H "Authorization: Bearer $TOKEN"
```

---

## 1.5 TypeScript 编译

### 任务描述

实现 TypeScript 到 JavaScript 的编译服务。

### 具体步骤

- [ ] 创建 `src/services/compiler.ts`：
  ```typescript
  import ts from 'typescript'

  export function compileTypeScript(code: string): string {
    const result = ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        strict: false,
        esModuleInterop: true
      }
    })
    return result.outputText
  }
  ```

- [ ] 在 functions 路由中添加编译端点：
  ```typescript
  router.post('/:id/compile', authMiddleware, async (req, res) => {
    const func = await functionService.findById(req.params.id, req.user.userId)
    if (!func) return res.status(404).json({ success: false })

    try {
      const compiled = compileTypeScript(func.code)
      await functionService.update(func._id, req.user.userId, { compiled })
      res.json({ success: true, data: { compiled } })
    } catch (error) {
      res.status(400).json({ success: false, error: { code: 'COMPILE_ERROR', message: error.message } })
    }
  })
  ```

### 验证

```bash
curl -X POST http://localhost:3000/api/functions/$FUNC_ID/compile \
  -H "Authorization: Bearer $TOKEN"
```

---

## 1.6 测试验证

### 任务描述

完整流程测试。

### 测试用例

- [ ] 注册新用户 → 成功
- [ ] 重复注册 → 返回错误
- [ ] 登录 → 返回 token
- [ ] 错误密码登录 → 返回错误
- [ ] 创建函数 → 成功
- [ ] 创建同名函数 → 返回错误
- [ ] 列表函数 → 返回列表
- [ ] 更新函数 → 成功
- [ ] 编译函数 → 返回编译后代码
- [ ] 删除函数 → 成功
- [ ] 无 token 访问 → 401

---

## 开发日志

| 日期 | 任务 | 完成情况 | 备注 |
|------|------|---------|------|
| - | - | - | - |
