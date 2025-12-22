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

# Copy package.json for module resolution
COPY package.json ./

# Copy node_modules from builder to backup (for volume initialization)
COPY --from=builder /app/node_modules ./node_modules_backup

# Copy build artifacts
COPY --from=builder /app/dist ./dist

# Copy and setup entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create empty node_modules dir for volume mount
RUN mkdir -p /app/node_modules

# Environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "dist/server/index.js"]
