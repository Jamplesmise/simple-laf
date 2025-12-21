# Simple Laf

<p align="center">
  <strong>轻量级 Serverless 云函数 IDE</strong>
</p>

<p align="center">
  <a href="#features">功能特性</a> •
  <a href="#quick-start">快速开始</a> •
  <a href="#development">本地开发</a> •
  <a href="#deployment">部署</a> •
  <a href="#tech-stack">技术栈</a>
</p>

---

## 简介

Simple Laf 是一个轻量级的 Serverless Web IDE，参考 [laf](https://github.com/labring/laf) 的核心功能实现。它提供了云函数的在线编辑、调试、发布的完整工作流，同时集成了 AI 辅助编程能力。

**适用场景：**
- 快速开发 API 接口
- Webhook 处理
- 定时任务
- 轻量级后端服务

## Features

### 核心功能
- **云函数编辑** - Monaco Editor + TypeScript LSP 智能提示
- **即时调试** - 在线执行、Console 日志、结果预览
- **一键发布** - 函数发布获得公开访问 URL
- **版本管理** - 历史版本记录、Diff 对比、一键回滚

### 开发效率
- **NPM 依赖** - 动态安装/管理第三方包
- **环境变量** - 安全存储配置信息
- **代码片段** - 保存常用代码模板
- **全局搜索** - Cmd/Ctrl+K 快速定位
- **测试持久化** - 测试输入自动保存/加载

### 自动化
- **定时任务** - 支持自定义间隔 (天/时/分/秒)
- **Webhook** - 外部服务触发，支持签名验证
- **Git 同步** - 双向同步，冲突检测，选择性同步

### AI 能力
- **AI 编程助手** - 自然语言创建/修改函数
- **AI Debug** - 自动生成测试用例、诊断修复
- **AI 测试** - 云函数测试执行、测试输入持久化
- **代码重构** - 解耦分析、合并分析
- **日志分析** - 智能分析执行日志

### 扩展功能
- **自定义域名** - CNAME 验证、请求路由
- **API Token** - 程序化访问支持
- **MongoDB 管理** - 可视化集合/文档/索引管理
- **审计日志** - 函数操作追溯 (用户/AI/Git)

## Quick Start

### Docker Compose (推荐)

```bash
# 克隆仓库
git clone https://github.com/Jamplesmise/simple-laf.git
cd simple-laf

# 配置环境变量
cp .env.example .env
# 编辑 .env 设置 JWT_SECRET 等

# 启动服务
docker-compose up -d

# 访问 http://localhost:3000
```

### Docker 单独运行

```bash
# 拉取镜像
docker pull ghcr.io/jamplesmise/simple-laf:latest

# 运行 (需要外部 MongoDB)
docker run -d -p 3000:3000 \
  -e MONGO_URL="mongodb://host:27017/simple-laf" \
  -e JWT_SECRET="your-secret-key" \
  -v simple-laf-modules:/app/node_modules \
  ghcr.io/jamplesmise/simple-laf:latest
```

## Development

### 环境要求

- Node.js >= 22.0.0
- pnpm >= 8.0.0
- MongoDB >= 7.0

### 本地开发

```bash
# 安装依赖
pnpm install

# 启动 MongoDB
docker run -d --name mongo -p 27017:27017 mongo:7

# 配置环境变量
cp .env.example .env

# 启动开发服务器
pnpm dev              # 后端 http://localhost:3000
npx vite              # 前端 http://localhost:5173 (另一个终端)
```

### 构建

```bash
# 一键构建前后端
pnpm build            # 构建到 dist/client 和 dist/server

# 生产模式启动
pnpm start
```

## Deployment

### 环境变量

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `MONGO_URL` | 是 | - | MongoDB 连接字符串 |
| `JWT_SECRET` | 是 | - | JWT 签名密钥 (生产环境使用随机字符串) |
| `JWT_EXPIRES_IN` | 否 | `7d` | JWT 过期时间 |
| `PORT` | 否 | `3000` | 服务端口 |
| `DEVELOP_TOKEN` | 否 | - | 开发调试 Token |
| `S3_ENDPOINT` | 否 | - | S3 存储端点 (可选) |
| `S3_ACCESS_KEY` | 否 | - | S3 Access Key |
| `S3_SECRET_KEY` | 否 | - | S3 Secret Key |
| `S3_BUCKET` | 否 | - | S3 默认 Bucket |

### 数据持久化

- MongoDB 数据: 挂载 `/data/db`
- NPM 依赖: 挂载 `/app/node_modules` (用于动态安装的包)

## Tech Stack

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Vite 6 + Monaco Editor + Ant Design 5 |
| 后端 | Express 4 + TypeScript + MongoDB 7 |
| 代码执行 | Node.js VM (沙箱执行) |
| LSP | typescript-language-server |
| 状态管理 | Zustand |
| 认证 | JWT + API Token |
| 部署 | Docker 单镜像 |

## 项目结构

```
simple-laf/
├── src/
│   ├── server/           # 后端 (Express)
│   │   ├── routes/       # API 路由
│   │   ├── services/     # 业务逻辑
│   │   ├── engine/       # VM 执行引擎
│   │   └── lsp/          # LSP WebSocket
│   └── client/           # 前端 (React)
│       ├── pages/        # 页面
│       ├── components/   # 组件
│       ├── stores/       # Zustand 状态
│       └── api/          # API 调用
├── index.html            # Vite 入口
├── vite.config.ts        # Vite 配置
├── docker-compose.yml
├── Dockerfile
└── package.json          # 统一依赖
```

## 云函数示例

```typescript
import cloud from '@/cloud-sdk'

export default async function (ctx: FunctionContext) {
  // 获取请求参数
  const { name } = ctx.body

  // 数据库操作
  const db = cloud.database()
  const users = await db.collection('users').find({ name }).toArray()

  // 返回结果
  return {
    success: true,
    data: users
  }
}
```

## API 文档

详见 [.ai-context/3-api-contracts.md](.ai-context/3-api-contracts.md)

## 贡献

欢迎提交 Issue 和 Pull Request！

## 致谢

本项目参考了 [laf](https://github.com/labring/laf) 的核心实现，特别感谢 laf 团队的开源贡献。

## License

[Apache-2.0](LICENSE)
