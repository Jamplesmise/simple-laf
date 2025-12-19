# Phase 1: 后端基础

## 阶段目标

搭建 Server 服务，实现用户认证和函数 CRUD API。

## 功能范围

### 包含

- Express 服务器搭建
- MongoDB 连接
- JWT 用户认证 (注册/登录)
- 函数 CRUD API
- TypeScript 编译服务

### 不包含

- 复杂权限控制
- 函数版本管理
- 多用户协作

## 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| Web 框架 | Express | 简单够用 |
| 数据库 | MongoDB | 灵活，laf 同款 |
| 认证 | JWT | 无状态，易于实现 |
| 密码加密 | bcrypt | 业界标准 |
| TS 编译 | typescript | 官方编译器 |

## 数据模型

### users 集合

```typescript
{
  _id: ObjectId,
  username: string,      // 唯一
  password: string,      // bcrypt hash
  createdAt: Date
}
```

### functions 集合

```typescript
{
  _id: ObjectId,
  name: string,          // 唯一 (用户内)
  code: string,          // TypeScript 源码
  compiled: string,      // 编译后的 JS
  userId: ObjectId,      // 所属用户
  createdAt: Date,
  updatedAt: Date
}

// 索引
{ userId: 1, name: 1 }  // 唯一复合索引
```

## API 设计

```
POST   /api/auth/register    # 注册
POST   /api/auth/login       # 登录
GET    /api/auth/me          # 获取当前用户

GET    /api/functions        # 列表 (当前用户)
POST   /api/functions        # 创建
GET    /api/functions/:id    # 详情
PUT    /api/functions/:id    # 更新
DELETE /api/functions/:id    # 删除
POST   /api/functions/:id/compile  # 编译
```

## 目录结构 (单镜像架构)

```
simple-ide/
├── src/                       # 后端源码
│   ├── index.ts              # 入口，Express app (单入口)
│   ├── config.ts             # 配置 (含 SANDBOX_URL)
│   ├── db.ts                 # MongoDB 连接
│   ├── routes/
│   │   ├── auth.ts           # /api/auth/* 认证路由
│   │   ├── functions.ts      # /api/functions/* 函数路由
│   │   └── invoke.ts         # /invoke/:name 函数调用
│   ├── services/
│   │   ├── auth.ts           # 认证服务
│   │   ├── function.ts       # 函数服务
│   │   ├── compiler.ts       # TS 编译服务
│   │   └── sandbox.ts        # Dify Sandbox 调用
│   ├── lsp/
│   │   └── index.ts          # LSP WebSocket (/_/lsp)
│   ├── middleware/
│   │   └── auth.ts           # JWT 验证中间件
│   └── utils/
│       └── response.ts       # 统一响应格式
├── web/                       # 前端源码 (独立子项目)
│   ├── src/
│   └── dist/                 # 构建产物 → 被后端托管
├── package.json
├── tsconfig.json
└── Dockerfile                # 单镜像构建
```

## 验收标准

- [ ] Server 启动无错误
- [ ] POST /api/auth/register 能注册用户
- [ ] POST /api/auth/login 能登录并返回 token
- [ ] GET /api/functions 能获取函数列表
- [ ] POST /api/functions 能创建函数
- [ ] PUT /api/functions/:id 能更新函数
- [ ] DELETE /api/functions/:id 能删除函数
- [ ] POST /api/functions/:id/compile 能编译 TS

## 依赖

- 无前置依赖

## 下一阶段

完成本阶段后，进入 Phase 2：Runtime 引擎
