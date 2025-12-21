# CLAUDE.md - AI 开发指引

> 本文件为 AI 助手快速了解项目的入口文档。详细内容见 `.ai-context/` 目录。

## 项目概述

**Simple IDE** - 轻量级 Serverless Web IDE，参考 [laf](https://github.com/labring/laf) 核心功能实现。

**当前状态**：v2.0.0，升级开发已完成 19 个 Sprint。AI 全能助手开发进行中（Sprint 10-20）。

**核心功能**：云函数编辑 | LSP 智能提示 | 即时执行调试 | NPM 依赖管理 | 版本控制 | Git 同步 | 定时任务 | Webhook | AI 辅助编程 | AI Debug | 自定义域名 | API Token | MongoDB 管理 | 函数审计日志 | 速率限制 | 函数重命名 | 站点托管 | AI 项目文件操作 | **云函数测试**

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
├── docs/
│   ├── upgrade-phases/       # v2.0 升级开发文档 (Sprint 1-9)
│   └── ai-development-plan/  # AI 全能助手开发计划 (Sprint 10-20)
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
| `sites` | 站点配置 |
| `site_files` | 站点文件记录 |
| `site_file_versions` | 站点文件版本 |

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
/api/site             # 站点配置
/api/site/files/*     # 站点文件管理/版本控制
/api/storage/*        # S3 对象存储
/invoke/*             # 函数调用 (支持多级路径，如 /invoke/api/user/login)
/site/:userId/*       # 站点静态文件访问
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

## 站点托管 (Sprint 9)

静态站点托管功能，支持 HTML/CSS/JS 等静态文件管理。

**核心功能**：
- 站点文件树管理（新建/重命名/删除文件和文件夹）
- 文件版本控制和回滚
- AI 建站助手（创建/修改站点文件）
- 站点预览（桌面/平板/手机视图）
- S3 对象存储集成

**文件存储**：
- 文件内容存储在 S3（路径：`sites/{userId}/{filePath}`）
- 文件元信息存储在 MongoDB（`site_files` 集合）
- 删除时自动同步清理 S3 和 MongoDB

**AI 建站最佳实践**：
- 默认使用单文件 HTML（CSS 放 `<style>`，JS 放 `<script>`）
- 如需分离文件，先创建文件夹再将相关文件放入
- 页面主文件命名为 `index.html`

**访问地址**：`/site/{userId}/` 或 `/site/{userId}/{filePath}`

## AI 项目文件操作 (Sprint 14)

AI 助手可以读取和修改项目源代码，支持以下工具：

**可用工具**：
- `read_project_file` - 读取项目文件内容
- `write_project_file` - 写入/修改项目文件
- `get_file_tree` - 获取项目文件树结构
- `search_code` - 在项目中搜索代码

**安全限制**：
- 白名单路径：`src/`, `docs/`, `package.json`, `tsconfig*.json`, `.env.example`
- 黑名单模式：`node_modules/`, `.git/`, `dist/`, `*.log`, `.env`（非 example）

**路径约定**：所有路径相对于项目根目录，如 `src/server/routes/ai.ts`

## 云函数测试 (Sprint 19)

云函数测试功能，支持测试输入持久化和 AI 辅助测试。

**核心功能**：
- 测试输入持久化（method/body/query/headers）
- 切换函数时自动加载保存的测试输入
- 运行成功后自动保存测试输入
- AI 可执行云函数测试并获取控制台输出

**AI 测试工具**：
- `test_function` - 执行单个云函数测试
- `batch_test_function` - 批量测试多个用例
- `save_test_input` - 保存测试输入
- `get_test_input` - 获取保存的测试输入

**API 接口**：
```
GET /api/functions/:id/test-input   # 获取测试输入
PUT /api/functions/:id/test-input   # 保存测试输入
```

**数据存储**：测试输入存储在 `functions` 集合的 `testInput` 字段中。

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

## 文件大小限制 ⚠️

**单文件行数上限**：
- 路由文件 (routes/*.ts)：< 300 行
- 服务文件 (services/*.ts)：< 500 行
- 组件文件 (components/*.tsx)：< 400 行
- 页面文件 (pages/*.tsx)：< 500 行

**超限处理**：
- 超过限制时必须拆分为模块目录结构
- 例如：`routes/ai.ts` (3000行) → `routes/ai/` 目录
  ```
  routes/ai/
  ├── index.ts        # 主入口，合并子路由
  ├── config.ts       # 配置相关
  ├── generate.ts     # 生成相关
  ├── conversations.ts # 对话相关
  └── ...
  ```

**拆分原则**：
- 按功能域拆分，每个文件职责单一
- 共享工具函数放入 `utils.ts`
- 主入口 `index.ts` 只做路由合并，不含业务逻辑
- 拆分后每个模块 100-500 行为宜

**已拆分的模块目录**（参考结构）：
```
后端:
├── routes/ai/              # AI 路由 (conversations/, generate/)
├── routes/functions/       # 函数路由
├── services/ai/executor/   # AI 执行器
├── services/ai/tools/      # AI 工具 (projectFile, search)
└── services/git/           # Git 服务

前端:
├── components/SystemPromptManager/
├── components/SitePanel/SiteAIPanel/
├── components/StoragePanel/
└── pages/IDE/
```

**预防措施**：
- 新增功能前检查目标文件行数
- 接近 300 行时考虑提前拆分
- 定期运行 `wc -l src/**/*.ts | sort -rn | head -20` 检查

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
| `docs/upgrade-phases/` | v2.0 升级开发文档 (Sprint 1-9) |
| `docs/ai-development-plan/` | AI 全能助手开发计划 (Sprint 10-20) |
| `docs/AI-Assistant-Analysis-and-Roadmap.md` | AI 助手现状分析与路线图 |

## AI 全能助手开发计划 (Sprint 10-20)

构建能够操控整个平台的 AI 助手，目标完成度从 31% 提升至 85%。

**开发阶段**：

| Phase | Sprint | 目标 | 可并行 |
|-------|--------|------|--------|
| Phase 1 | 10-12 | Chat 增强 (状态可视化/Canvas/Artifacts) | 11-12 可并行 |
| Phase 1.5 | 13 | 实时监控 (可选) | - |
| Phase 2 | 14-16 | 开发能力 (项目操作/依赖/上下文控制) | 14-15 可并行 |
| Phase 3 | 17-18 | Git + 数据库 | 可并行 |
| Phase 4 | 19-20 | 测试增强 | - |

**开发原则**：
- 每个任务控制在 50K tokens 以内
- 单次改动 < 5 个文件，代码 < 200 行
- 前后端任务可并行开发

详见 `docs/ai-development-plan/README.md`

## MVU 原则

开发时遵循 **Minimum Viable Unit**：
- 单次改动 < 5 个文件
- 单次新增代码 < 200 行
- 单个文件不超过行数限制（见"文件大小限制"）
- 每个单元可独立验证
- 功能增长时及时拆分模块
