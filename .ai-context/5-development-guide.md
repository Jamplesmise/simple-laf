# 5. 开发指南 (Development Guide)

## 环境准备

```bash
# 1. 安装 Node.js 22+ (LTS)
nvm install 22
nvm use 22

# 2. 安装 pnpm (推荐)
npm install -g pnpm

# 3. 克隆项目
git clone <repo>
cd simple-ide

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env 设置 SANDBOX_URL 和 SANDBOX_API_KEY
```

### 外部服务依赖

```bash
# MongoDB (数据存储)
MONGO_URL="mongodb://localhost:27017/simple-ide"

# JWT 密钥
JWT_SECRET="your-jwt-secret"

# Dify Sandbox (代码执行服务)
SANDBOX_URL="https://your-sandbox.example.com"
SANDBOX_API_KEY="your-api-key"

# S3 存储 (文件存储)
S3_ENDPOINT="https://your-s3-endpoint.com"
S3_ACCESS_KEY="your-access-key"
S3_SECRET_KEY="your-secret-key"
S3_BUCKET="your-default-bucket"
S3_REGION="auto"
```

## 本地开发

### 启动 MongoDB

```bash
# 使用 Docker
docker run -d --name mongo -p 27017:27017 mongo:7

# 或使用本地安装的 MongoDB
mongod --dbpath /data/db
```

### 启动开发服务器

```bash
# 终端 1: 后端 (API + LSP)
pnpm install
pnpm dev
# http://localhost:3000

# 终端 2: 前端 (热更新)
cd web
pnpm install
pnpm dev
# http://localhost:5173 (开发时前端独立运行，代理到后端)
```

### 生产构建

```bash
# 构建前端
cd web && pnpm build
# 产物在 web/dist/

# 构建后端
pnpm build
# 产物在 dist/

# 启动生产服务 (后端托管前端静态文件)
pnpm start
# http://localhost:3000
```

### Docker 部署 (单镜像)

```bash
# 构建镜像
docker build -t simple-ide .

# 运行
docker run -d -p 3000:3000 \
  -e MONGO_URL="mongodb://..." \
  -e JWT_SECRET="..." \
  -e SANDBOX_URL="https://..." \
  -e SANDBOX_API_KEY="..." \
  -e S3_ENDPOINT="https://..." \
  -e S3_ACCESS_KEY="..." \
  -e S3_SECRET_KEY="..." \
  -e S3_BUCKET="..." \
  simple-ide
```

## 调试技巧

### 后端调试

```bash
pnpm dev  # 自动重启

# 开启详细日志
DEBUG=* pnpm dev
```

### LSP 调试

```bash
# 在浏览器 DevTools 查看 WebSocket 消息
# Network -> WS -> /_/lsp
```

## 常用命令

```bash
# 类型检查
pnpm typecheck

# 代码格式化
pnpm format

# 构建全部
pnpm build:all    # 先构建前端，再构建后端

# 清理
pnpm clean
```

## 目录说明 (单镜像架构)

```
simple-ide/
├── src/                    # 后端源码
│   ├── index.ts           # Express 入口 (单入口)
│   ├── config.ts          # 配置
│   ├── db.ts              # MongoDB 连接
│   ├── routes/
│   │   ├── auth.ts        # /api/auth/*
│   │   ├── functions.ts   # /api/functions/*
│   │   └── invoke.ts      # /invoke/:name
│   ├── services/
│   │   ├── auth.ts        # 认证逻辑
│   │   ├── function.ts    # 函数 CRUD
│   │   ├── compiler.ts    # TS 编译
│   │   ├── sandbox.ts     # Dify Sandbox 调用
│   │   └── storage.ts     # S3 文件存储
│   ├── lsp/
│   │   └── index.ts       # LSP WebSocket
│   └── middleware/
│       └── auth.ts        # JWT 验证
│
├── web/                    # 前端源码
│   ├── src/
│   │   ├── App.tsx        # 根组件
│   │   ├── pages/         # 页面
│   │   ├── components/    # 组件
│   │   ├── stores/        # Zustand
│   │   └── api/           # API 调用
│   ├── dist/              # 构建产物 → 被后端托管
│   └── package.json
│
├── Dockerfile             # 单镜像构建
├── package.json           # 后端依赖
└── tsconfig.json
```
