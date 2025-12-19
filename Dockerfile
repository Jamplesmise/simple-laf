# Build stage - 前端
FROM node:22-alpine AS web-builder

WORKDIR /app/web

# 安装 pnpm
RUN npm install -g pnpm

# 复制 package 文件
COPY packages/web/package.json packages/web/pnpm-lock.yaml* ./

# 安装依赖
RUN pnpm install --frozen-lockfile || pnpm install

# 复制源码并构建
COPY packages/web/ .
RUN pnpm build

# Build stage - 后端
FROM node:22-alpine AS server-builder

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制 package 文件
COPY packages/server/package.json packages/server/pnpm-lock.yaml* ./

# 安装依赖
RUN pnpm install --frozen-lockfile || pnpm install

# 复制源码
COPY packages/server/src/ ./src/
COPY packages/server/tsconfig.json ./

# 构建
RUN pnpm build

# Production stage
FROM node:22-alpine

WORKDIR /app

# 安装 git (用于 Git 同步功能) 和 pnpm
RUN apk add --no-cache git && npm install -g pnpm typescript typescript-language-server

# 配置 pnpm 使用阿里云镜像
RUN pnpm config set registry https://registry.npmmirror.com

# 复制后端构建产物和依赖
COPY --from=server-builder /app/dist ./dist
COPY --from=server-builder /app/node_modules ./node_modules
COPY --from=server-builder /app/package.json ./

# 复制前端构建产物到 public 目录
COPY --from=web-builder /app/web/dist ./public

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 声明 node_modules 卷 (用于动态安装的依赖持久化)
VOLUME ["/app/node_modules"]

EXPOSE 3000

CMD ["node", "dist/index.js"]
