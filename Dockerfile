# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source files
COPY src/ ./src/
COPY public/ ./public/
COPY index.html vite.config.ts tsconfig.json tsconfig.server.json ./

# Build client and server
RUN pnpm build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Install git (for Git sync) and global tools
RUN apk add --no-cache git && npm install -g pnpm typescript typescript-language-server

# Configure pnpm mirror
RUN pnpm config set registry https://registry.npmmirror.com

# Copy package files and install production dependencies
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod

# Copy build artifacts
COPY --from=builder /app/dist ./dist

# Environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/server/index.js"]
