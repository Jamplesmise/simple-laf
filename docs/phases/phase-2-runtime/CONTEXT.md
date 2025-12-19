# Phase 2: Runtime 引擎

## 阶段目标

实现函数执行服务，使用 Dify Sandbox 执行代码，支持调用云函数并返回结果和日志。

## 功能范围

### 包含

- Express 服务器
- Dify Sandbox API 集成
- 简化版 Cloud SDK

### 不包含

- 完整的 Cloud SDK (存储、复杂数据库操作)
- 函数版本切换
- 热更新

## 使用 Dify Sandbox (简化开发)

不再需要自己写 VM 执行引擎，直接调用 Dify Sandbox API：

```typescript
// POST https://sandbox.example.com/v1/sandbox/run
// Header: X-Api-Key: your-api-key
{
  "language": "nodejs",
  "code": "编译后的 JS 代码",
  "preload": "",
  "enable_network": true
}
```

优势：
- 多层安全隔离 (系统调用白名单、文件系统、网络)
- 支持 Node.js + Python
- 无需维护执行引擎

## 执行流程

```
HTTP 请求 POST /invoke/:name
    ↓
验证 develop_token
    ↓
从数据库加载函数代码
    ↓
构造执行代码 (注入 ctx 和 cloud)
    ↓
调用 Dify Sandbox API
    POST ${SANDBOX_URL}/v1/sandbox/run
    ↓
解析执行结果
    ↓
返回结果 + 日志 (响应头)
```

## 目录结构 (单镜像架构)

```
simple-ide/src/               # 后端源码 (与 Phase 1 共用)
├── routes/
│   └── invoke.ts            # /invoke/:name 函数调用路由
├── services/
│   ├── sandbox.ts           # Dify Sandbox API 封装
│   └── function.ts          # 函数服务 (Phase 1 已创建)
└── cloud/
    └── index.ts             # Cloud SDK (注入到执行代码)
```

> 注：单镜像架构下，Runtime 功能直接集成在主服务中，无需独立进程。

## Cloud SDK

```typescript
interface Cloud {
  // 数据库访问
  database(): Db

  // 调用其他函数
  invoke(name: string, data?: any): Promise<any>

  // 文件存储
  storage: {
    bucket(name?: string): StorageBucket
  }

  // 环境变量
  env: Record<string, string>
}

interface StorageBucket {
  writeFile(key: string, body: Buffer | string): Promise<void>
  readFile(key: string): Promise<Buffer>
  deleteFile(key: string): Promise<void>
  listFiles(prefix?: string): Promise<object[]>
  getUploadUrl(key: string, expiresIn?: number): Promise<string>
  getDownloadUrl(key: string, expiresIn?: number): Promise<string>
}

// 使用示例
export default async function(ctx: FunctionContext) {
  const db = cloud.database()
  const users = await db.collection('users').find().toArray()

  // 存储文件
  const bucket = cloud.storage.bucket()
  await bucket.writeFile('export/users.json', JSON.stringify(users))
  const url = await bucket.getDownloadUrl('export/users.json')

  return { users, downloadUrl: url }
}
```

## 验收标准

- [ ] Runtime 启动无错误
- [ ] POST /invoke/:name 能执行函数
- [ ] 函数能访问 ctx.body, ctx.query
- [ ] 函数能使用 cloud.database()
- [ ] 函数能使用 cloud.invoke()
- [ ] console.log 输出能在响应头返回
- [ ] 执行时间在响应头返回

## 依赖

- Phase 1 完成 (函数存储在数据库)

## 下一阶段

完成本阶段后，进入 Phase 3：LSP 集成
