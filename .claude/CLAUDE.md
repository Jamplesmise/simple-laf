# CLAUDE.md - AI 开发指引

> 本文件为 AI 助手快速了解项目的入口文档。详细内容见 `.ai-context/` 目录。

## 项目概述

**Simple IDE** - 轻量级 Serverless Web IDE，参考 [laf](https://github.com/labring/laf) 核心功能实现。

**当前状态**：基础版已完成，升级开发已完成 8 个 Sprint。

**核心功能**：云函数编辑 | LSP 智能提示 | 即时执行调试 | NPM 依赖管理 | 版本控制 | Git 同步 | 定时任务 | Webhook | AI 辅助编程 | AI Debug | 自定义域名 | API Token | MongoDB 管理 | 函数审计日志 | 速率限制 | 函数重命名

**不做什么**：多租户隔离、自动扩缩容、计费系统、团队协作、Kubernetes 部署

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Vite 6 + Monaco Editor + Ant Design 5 |
| 后端 | Express 4 + TypeScript + MongoDB 7 |
| 代码执行 | Node.js VM (本地执行) |
| LSP | typescript-language-server 5.x |
| 状态管理 | Zustand 4 |
| 认证 | JWT + API Token (sk-xxx) |
| 部署 | 单镜像 Docker |
| Node.js | >= 22.0.0 (LTS) |

## 项目结构

```
simple-ide/
├── .ai-context/              # AI 上下文文档 (详细说明)
├── .claude/CLAUDE.md         # 本文件 (快速入门)
├── docs/upgrade-phases/      # 升级版开发文档
├── src/
│   ├── server/               # 后端
│   │   ├── routes/           # API 路由
│   │   ├── services/         # 业务逻辑 (含 ai/, functionAudit.ts)
│   │   ├── middleware/       # 中间件 (auth, rateLimit)
│   │   ├── utils/            # 工具函数 (logger)
│   │   ├── engine/           # VM 执行引擎
│   │   └── lsp/              # LSP WebSocket
│   └── client/               # 前端
│       ├── pages/            # 页面
│       ├── components/       # 组件
│       ├── stores/           # Zustand 状态
│       └── api/              # API 调用
├── Dockerfile
└── docker-compose.yml
```

## 常用命令

```bash
# 启动 MongoDB
docker run -d --name mongo -p 27017:27017 mongo:7

# 安装依赖
pnpm install

# 开发 (两个终端)
pnpm dev:server    # 后端 http://localhost:3000
pnpm dev:web       # 前端 http://localhost:5173

# 构建
pnpm build         # 一键构建前后端

# 生产启动
pnpm start

# Docker 部署
docker-compose up -d
```

## 数据库集合

| 集合 | 用途 |
|------|------|
| `users` | 用户信息 |
| `functions` | 函数代码 |
| `folders` | 文件夹结构 |
| `function_versions` | 历史版本 |
| `function_audit_logs` | 函数审计日志 (操作记录) |
| `dependencies` | NPM 依赖 |
| `env_variables` | 环境变量 |
| `git_config` | Git 配置 |
| `scheduled_tasks` | 定时任务 |
| `execution_logs` | 执行历史 (7天TTL) |
| `webhooks` | Webhook 配置 |
| `snippets` | 代码片段 |
| `ai_*` | AI 相关 (providers/models/conversations/messages/prompts) |
| `custom_domains` | 自定义域名 |
| `api_tokens` | API Token |

## 主要 API 路由

```
/api/auth/*           # 认证
/api/functions/*      # 函数 CRUD/发布/版本/移动
/api/folders/*        # 文件夹管理
/api/dependencies/*   # NPM 依赖
/api/env/*            # 环境变量
/api/git/*            # Git 同步
/api/scheduler/*      # 定时任务
/api/execution-logs/* # 执行历史
/api/webhooks/*       # Webhook
/api/snippets/*       # 代码片段
/api/search           # 全局搜索
/api/ai/*             # AI 操作/对话/模型/Debug
/api/custom-domains/* # 自定义域名
/api/tokens/*         # API Token
/api/database/*       # MongoDB 管理
/api/audit/*          # 审计日志查询
/invoke/*             # 函数调用 (支持多级路径，如 /invoke/api/user/login)
/health               # 健康检查 (含数据库状态)
/_/lsp                # LSP WebSocket
```

详细 API 文档见 `.ai-context/3-api-contracts.md`

## 速率限制

| 路由 | 限制 | 说明 |
|------|------|------|
| `/api/auth/login` | 10次/5分钟 | 防止暴力破解 |
| `/api/auth/register` | 10次/5分钟 | 防止批量注册 |
| `/invoke/*` | 50次/秒 | 函数调用限制 |

超出限制返回 `429 Too Many Requests`，响应头包含：
- `X-RateLimit-Limit`: 限制次数
- `X-RateLimit-Remaining`: 剩余次数
- `X-RateLimit-Reset`: 重置时间戳

## 审计日志系统

记录所有函数的增删改操作，区分操作者类型：

**操作者类型 (operator)**：
- `user` - 用户手动操作
- `ai` - AI 辅助操作 (记录模型名和账号)
- `git` - Git 同步操作
- `system` - 系统操作

**审计动作 (action)**：
`create` | `update` | `delete` | `rename` | `move` | `publish` | `unpublish` | `rollback`

**数据模型**：
```typescript
interface FunctionAuditLog {
  functionId: ObjectId
  functionName: string
  userId: ObjectId
  username: string           // 操作账号
  action: AuditAction
  operator: OperatorType
  operatorDetail?: string    // 如 "AI: deepseek-v3 (账号: admin)"
  changes?: {
    before?: string          // 修改前代码
    after?: string           // 修改后代码
    description?: string
  }
  createdAt: Date
}
```

**查询接口**：
```
GET /api/audit                    # 审计日志列表 (支持筛选)
GET /api/audit/function/:id       # 指定函数的审计日志
GET /api/audit/stats              # 审计统计
```

## 云函数代码格式

```typescript
import cloud from '@/cloud-sdk'

export default async function (ctx: FunctionContext) {
  // ctx.body: 请求体, ctx.query: 查询参数
  // ctx.headers: 请求头, ctx.method: HTTP 方法
  return { data: 'result' }
}
```

## 开发规范

**命名**：文件 `camelCase.ts` | 组件 `PascalCase.tsx` | 常量 `UPPER_SNAKE_CASE`

**TypeScript**：优先 `interface` | 禁止 `any` 用 `unknown` | 使用 `import type`

**API 响应**：
```typescript
// 成功
{ success: true, data: T }
// 失败
{ success: false, error: { code: string, message: string } }
```

**Git 提交**：`feat:` | `fix:` | `docs:` | `refactor:` | `chore:`

## AI 助手操作规范

- **长时间命令**：超过 30 秒中止，交给用户执行
- **网络命令**：`pnpm install` 等直接提供给用户
- **代码参考**：优先参考 laf 项目实现
- **文档优先**：修改前先查阅 `.ai-context/` 和 `docs/upgrade-phases/`

## 详细文档索引

| 文档 | 内容 |
|------|------|
| `.ai-context/0-project-overview.md` | 项目概览 |
| `.ai-context/1-tech-stack.md` | 技术栈 |
| `.ai-context/2-architecture.md` | 系统架构 |
| `.ai-context/3-api-contracts.md` | API 接口定义 |
| `.ai-context/4-coding-standards.md` | 编码规范 |
| `.ai-context/5-development-guide.md` | 开发环境 |
| `.ai-context/6-features.md` | 功能详解 |
| `.ai-context/7-frontend-architecture.md` | 前端架构 |
| `docs/upgrade-phases/` | Sprint 开发文档 |

## MVU 原则

开发时遵循 **Minimum Viable Unit**：
- 单次改动 < 5 个文件
- 单次代码 < 200 行
- 每个单元可独立验证
