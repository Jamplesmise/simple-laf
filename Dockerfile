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

# Prune dev dependencies, keep only production deps
RUN pnpm prune --prod

# Production stage
FROM node:22-alpine

WORKDIR /app

# Install git (for Git sync) and global tools
RUN apk add --no-cache git && npm install -g typescript typescript-language-server

# Copy node_modules from builder (already pruned to prod only)
COPY --from=builder /app/node_modules ./node_modules

# Copy package.json for module resolution
COPY package.json ./

# Copy build artifacts
COPY --from=builder /app/dist ./dist

# Environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/server/index.js"]
