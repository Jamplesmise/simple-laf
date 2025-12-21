# 2. 架构设计 (Architecture)

## 系统架构图 (单镜像)

```
┌─────────────────────────────────────────────────────────────┐
│                        用户浏览器                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Web IDE (React)                    │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────────────┐  │   │
│  │  │FunctionList│ │  Monaco   │ │   Debug Panel     │  │   │
│  │  │           │ │  Editor   │ │  ├─ Params        │  │   │
│  │  │ + Create  │ │           │ │  ├─ Result        │  │   │
│  │  │ - Delete  │ │  (LSP)    │ │  └─ Console       │  │   │
│  │  └───────────┘ └─────┬─────┘ └───────────────────┘  │   │
│  └──────────────────────┼──────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                          │ HTTP / WebSocket
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              simple-ide (单镜像, 端口 3000)                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Express Server                    │   │
│  │                                                      │   │
│  │  /              → 静态文件 (React 构建产物)           │   │
│  │  /api/auth/*    → 用户认证 (JWT)                     │   │
│  │  /api/functions/*→ 函数 CRUD + 编译                  │   │
│  │  /invoke/:name  → 函数调用 (代理到 Dify Sandbox)      │   │
│  │  /_/lsp         → LSP WebSocket (typescript-language-server) │
│  │                                                      │   │
│  └─────────────────────────┬────────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────┘
                              │
              ┌───────────────┼───────────────┬───────────────┐
              ▼               ▼               ▼               ▼
       ┌──────────┐   ┌─────────────┐   ┌──────────┐   ┌──────────┐
       │ MongoDB  │   │Dify Sandbox │   │   LSP    │   │    S3    │
       │ (托管)   │   │  (外部)     │   │ (内置)   │   │ (外部)   │
       └──────────┘   └─────────────┘   └──────────┘   └──────────┘
```

## 数据流

### 1. 编辑函数流程

```
用户在 Monaco 编辑 → 本地状态更新 → 点击保存
    → POST /api/functions/:id
    → Server 保存到 MongoDB
    → 返回成功
```

### 2. LSP 智能提示流程

```
用户输入代码 → Monaco LSP Client
    → WebSocket 发送到 Runtime /_/lsp
    → typescript-language-server 处理
    → 返回补全/诊断信息
    → Monaco 显示提示
```

### 3. 执行函数流程 (使用 Dify Sandbox)

```
用户点击运行 → 发送参数到 Runtime
    → POST /invoke/:functionName
    → Runtime 加载函数代码
    → 调用 Dify Sandbox API
      POST ${SANDBOX_URL}/v1/sandbox/run
      Header: X-Api-Key: ${SANDBOX_API_KEY}
      Body: { language: "nodejs", code: "..." }
    → 返回执行结果 + 日志
```

## 模块职责 (单镜像)

| 路由 | 职责 |
|------|------|
| `/` | 静态文件 (React 构建产物) |
| `/api/auth/*` | 用户认证 (注册/登录/JWT) |
| `/api/functions/*` | 函数 CRUD + 编译 |
| `/invoke/:name` | 函数调用 (代理到 Dify Sandbox) |
| `/_/lsp` | LSP WebSocket |

| 外部依赖 | 说明 |
|---------|------|
| **MongoDB** | 数据存储 (用户数据、函数代码) |
| **Dify Sandbox** | 代码安全执行 |
| **S3 存储** | 文件存储 (用户上传、云函数生成的文件) |

## AI 工具系统

AI 助手通过工具系统执行操作，工具定义在 `services/ai/tools/` 目录：

| 工具模块 | 文件 | 功能 |
|---------|------|------|
| 函数操作 | `function.ts` | create/update/delete/rename 云函数 |
| 站点操作 | `site.ts` | 站点文件 CRUD |
| 项目操作 | `projectFile.ts` | 读写项目源代码 |
| 代码搜索 | `search.ts` | 项目内代码搜索 |

**执行流程**：
```
用户消息 → AI 解析意图 → 生成工具调用 → AIExecutor 执行 → 返回结果
```

## 数据模型

### User

```typescript
interface User {
  _id: ObjectId
  username: string
  password: string  // bcrypt hash
  createdAt: Date
}
```

### Function

```typescript
interface Function {
  _id: ObjectId
  name: string           // 函数名，唯一
  code: string           // TypeScript 源码
  compiled: string       // 编译后的 JS
  userId: ObjectId       // 所属用户
  createdAt: Date
  updatedAt: Date
}
```
