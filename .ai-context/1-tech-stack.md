# 1. 技术栈锁定 (Tech Stack)

## 强制使用

### 后端 (Server)

| 技术 | 版本 | 用途 |
|-----|------|------|
| Node.js | >= 22.0.0 | 运行时 (LTS) |
| TypeScript | 5.x | 类型系统 |
| Express | 4.x | Web 框架 (简单够用) |
| MongoDB | 7.x | 数据库 |
| jsonwebtoken | 9.x | JWT 认证 |

### 前端 (Web)

| 技术 | 版本 | 用途 |
|-----|------|------|
| React | 19.x | UI 框架 |
| TypeScript | 5.x | 类型系统 |
| Vite | 6.x | 构建工具 |
| Monaco Editor | latest | 代码编辑器 |
| Ant Design | 5.x | UI 组件库 |
| Zustand | 4.x | 状态管理 |
| Axios | 1.x | HTTP 客户端 |

### Runtime

| 技术 | 版本 | 用途 |
|-----|------|------|
| Express | 4.x | HTTP 服务 |
| typescript-language-server | 5.x | LSP 服务 |
| ws | 8.x | WebSocket |
| mongodb | 6.x | 数据库驱动 |

## 明确禁止

| 禁止项 | 理由 |
|-------|------|
| NestJS | 过重，Express 足够 |
| Redux | Zustand 更简单 |
| Kubernetes | 简化部署，用 Docker Compose |
| 多数据库支持 | 只支持 MongoDB |

## 环境要求

```yaml
node: ">=22.0.0"   # LTS 版本
npm: ">=10.0.0"
docker: ">=24.0.0"
docker-compose: ">=2.20.0"
```

## React 19 注意事项

1. **useRef 需要初始值**：
   ```typescript
   // React 19 要求
   const ref = useRef<NodeJS.Timeout | undefined>(undefined)
   // 而不是
   const ref = useRef<NodeJS.Timeout>()
   ```

2. **use() Hook**：React 19 新增，可用于读取 Promise 和 Context

3. **Actions**：支持异步函数作为 transition

4. **Ant Design 5 + React 19 兼容**：
   ```bash
   # 需要安装兼容补丁
   pnpm add @ant-design/v5-patch-for-react-19
   ```
   ```typescript
   // main.tsx 顶部引入
   import '@ant-design/v5-patch-for-react-19'
   ```

## 目录结构 (单镜像架构)

```
simple-ide/
├── .ai-context/           # AI 上下文文档
├── .claude/               # Claude 配置
├── docs/phases/           # 分阶段开发文档
├── src/                   # 后端源码
│   ├── index.ts          # Express 入口 (单入口)
│   ├── routes/           # API 路由
│   │   ├── auth.ts       # 认证
│   │   ├── functions.ts  # 函数 CRUD
│   │   └── invoke.ts     # 函数调用
│   ├── services/         # 业务逻辑
│   ├── lsp/              # LSP WebSocket
│   └── middleware/       # 中间件
├── web/                   # 前端源码
│   ├── src/              # React 源码
│   └── dist/             # 构建产物 → 被后端托管
├── Dockerfile            # 单镜像构建
└── README.md
```
