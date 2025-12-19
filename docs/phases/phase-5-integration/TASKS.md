# Phase 5: 集成部署 - 任务清单

## 任务概览

| 任务 | 优先级 | 预估 | 状态 |
|------|-------|------|------|
| 5.1 Dockerfile | P0 | 30min | 待开始 |
| 5.2 环境变量配置 | P0 | 15min | 待开始 |
| 5.3 端到端测试 | P0 | 1h | 待开始 |

---

## 5.1 Dockerfile (单镜像)

### 具体步骤

- [ ] 创建 `Dockerfile`：
  ```dockerfile
  # Build stage - 前端
  FROM node:22-alpine AS web-builder

  WORKDIR /app/web

  COPY web/package.json web/pnpm-lock.yaml ./
  RUN npm install -g pnpm && pnpm install --frozen-lockfile

  COPY web/ .
  RUN pnpm build

  # Build stage - 后端
  FROM node:22-alpine AS server-builder

  WORKDIR /app

  COPY package.json pnpm-lock.yaml ./
  RUN npm install -g pnpm && pnpm install --frozen-lockfile

  COPY src/ ./src/
  COPY tsconfig.json ./
  RUN pnpm build

  # Production stage
  FROM node:22-alpine

  WORKDIR /app

  # 安装 typescript-language-server (LSP)
  RUN npm install -g typescript typescript-language-server

  # 复制后端构建产物
  COPY --from=server-builder /app/dist ./dist
  COPY --from=server-builder /app/node_modules ./node_modules
  COPY --from=server-builder /app/package.json ./

  # 复制前端构建产物到 public 目录
  COPY --from=web-builder /app/web/dist ./public

  EXPOSE 3000

  CMD ["node", "dist/index.js"]
  ```

- [ ] 创建 `.dockerignore`：
  ```
  node_modules
  dist
  web/node_modules
  web/dist
  .env
  .git
  *.md
  docs/
  .ai-context/
  .claude/
  ```

---

## 5.2 环境变量配置

### 具体步骤

- [ ] 创建 `.env.example`：
  ```bash
  # MongoDB 连接 (必需)
  MONGO_URL=mongodb://localhost:27017/simple-ide

  # JWT 密钥 (必需)
  JWT_SECRET=change-this-to-a-random-string

  # Dify Sandbox (必需)
  SANDBOX_URL=https://your-sandbox.example.com
  SANDBOX_API_KEY=your-api-key

  # S3 存储 (必需)
  S3_ENDPOINT=https://your-s3-endpoint.com
  S3_ACCESS_KEY=your-access-key
  S3_SECRET_KEY=your-secret-key
  S3_BUCKET=your-default-bucket
  S3_REGION=auto

  # 服务端口 (可选，默认 3000)
  PORT=3000
  ```

- [ ] 更新 `src/config.ts` 读取环境变量：
  ```typescript
  export const config = {
    port: process.env.PORT || 3000,
    mongoUrl: process.env.MONGO_URL || 'mongodb://localhost:27017/simple-ide',
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
    sandbox: {
      url: process.env.SANDBOX_URL || '',
      apiKey: process.env.SANDBOX_API_KEY || '',
    },
    s3: {
      endpoint: process.env.S3_ENDPOINT || '',
      accessKey: process.env.S3_ACCESS_KEY || '',
      secretKey: process.env.S3_SECRET_KEY || '',
      bucket: process.env.S3_BUCKET || '',
      region: process.env.S3_REGION || 'auto',
    },
  }
  ```

---

## 5.3 端到端测试

### 本地测试

- [ ] 构建镜像：
  ```bash
  docker build -t simple-ide .
  ```

- [ ] 启动 MongoDB (如果没有)：
  ```bash
  docker run -d --name mongo -p 27017:27017 mongo:7
  ```

- [ ] 运行镜像：
  ```bash
  docker run -d --name simple-ide \
    -p 3000:3000 \
    -e MONGO_URL="mongodb://host.docker.internal:27017/simple-ide" \
    -e JWT_SECRET="test-secret" \
    -e SANDBOX_URL="https://your-sandbox.example.com" \
    -e SANDBOX_API_KEY="your-api-key" \
    -e S3_ENDPOINT="https://your-s3-endpoint.com" \
    -e S3_ACCESS_KEY="your-access-key" \
    -e S3_SECRET_KEY="your-secret-key" \
    -e S3_BUCKET="your-bucket" \
    simple-ide
  ```

- [ ] 检查服务状态：
  ```bash
  docker logs simple-ide
  # 应该看到 "Server running on port 3000"
  ```

### 功能测试

- [ ] 访问 http://localhost:3000
- [ ] 注册新账号
- [ ] 登录
- [ ] 创建函数
- [ ] 编辑代码，检查智能提示
- [ ] 保存函数
- [ ] 运行函数，查看结果
- [ ] 查看控制台日志
- [ ] 删除函数
- [ ] 登出

### Sealos 部署测试

- [ ] 推送镜像到镜像仓库：
  ```bash
  docker tag simple-ide your-registry/simple-ide:latest
  docker push your-registry/simple-ide:latest
  ```

- [ ] 在 Sealos 创建应用：
  - 镜像: your-registry/simple-ide:latest
  - 端口: 3000
  - 环境变量: MONGO_URL, JWT_SECRET, SANDBOX_URL, SANDBOX_API_KEY

- [ ] 使用 Sealos 托管的 MongoDB 数据库

- [ ] 验证功能正常

### 清理

- [ ] 本地清理：
  ```bash
  docker stop simple-ide
  docker rm simple-ide
  docker stop mongo
  docker rm mongo
  ```

---

## 开发日志

| 日期 | 任务 | 完成情况 | 备注 |
|------|------|---------|------|
| - | - | - | - |
