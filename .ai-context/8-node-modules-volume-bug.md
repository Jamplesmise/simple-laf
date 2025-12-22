# Node Modules Volume 依赖丢失问题

> 记录一个反复出现的顽固 bug，涉及 Docker volume 挂载与依赖初始化。

## 问题现象

部署到 Sealos 后启动失败，报错：

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'socket.io' imported from /app/dist/server/services/monitor/websocket.js
```

或其他核心依赖如 `express` 找不到。

## 问题根源

### 背景：项目的依赖管理机制

本项目支持**用户自定义安装 NPM 依赖**（通过 Web UI 的依赖管理功能），允许用户在运行时安装额外的 npm 包供云函数使用。

为了持久化用户安装的依赖，`docker-compose.yml` 和 Sealos 配置中挂载了 `node_modules` volume：

```yaml
volumes:
  - node_modules:/app/node_modules
```

### 问题本质

Docker volume 挂载会**覆盖**镜像内的目录内容：

1. 镜像构建时，`/app/node_modules` 包含完整的生产依赖
2. 容器启动时，外部 volume 挂载到 `/app/node_modules`
3. 如果 volume 是空的或旧的，镜像内的依赖就被覆盖丢失了
4. Node.js 启动时找不到 `express`、`socket.io` 等核心依赖

## 解决方案

### 1. Entrypoint 初始化机制

使用 `docker-entrypoint.sh` 脚本，在容器启动时检测并恢复依赖：

```bash
#!/bin/sh
set -e

# 如果挂载的 node_modules 为空，从备份恢复
if [ ! -f "/app/node_modules/.initialized" ]; then
  echo "Initializing node_modules from backup..."
  if [ -d "/app/node_modules_backup" ] && [ "$(ls -A /app/node_modules_backup 2>/dev/null)" ]; then
    cp -r /app/node_modules_backup/. /app/node_modules/
    touch /app/node_modules/.initialized
    echo "Done."
  else
    echo "ERROR: node_modules_backup is empty or missing!"
    exit 1
  fi
fi

exec "$@"
```

### 2. Dockerfile 配置

```dockerfile
# 构建阶段
FROM node:22-alpine AS builder
# ... 安装依赖、构建 ...
RUN pnpm prune --prod  # 只保留生产依赖

# 生产阶段
FROM node:22-alpine

# 复制依赖到备份目录（不是 node_modules）
COPY --from=builder /app/node_modules ./node_modules_backup

# 创建空的 node_modules 作为 volume 挂载点
RUN mkdir -p /app/node_modules

# 配置 entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "dist/server/index.js"]
```

### 3. 关键点

| 目录 | 用途 |
|------|------|
| `/app/node_modules_backup` | 镜像内置的完整生产依赖备份 |
| `/app/node_modules` | Volume 挂载点，包含用户安装的额外依赖 |
| `/app/node_modules/.initialized` | 标记文件，防止重复初始化 |

## 常见陷阱

### 陷阱 1：简化 Dockerfile 去掉 entrypoint

**错误做法**：为了简化，直接复制 node_modules 而不用 entrypoint：

```dockerfile
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/server/index.js"]
```

**问题**：如果有 volume 挂载，复制的内容会被空 volume 覆盖。

### 陷阱 2：在生产阶段重新安装依赖

**错误做法**：

```dockerfile
RUN pnpm install --prod
```

**问题**：pnpm 的依赖解析可能因为 lockfile 或配置问题失败。

### 陷阱 3：忘记清理旧 volume

**现象**：更新镜像后问题依旧。

**原因**：旧 volume 中有 `.initialized` 标记，不会触发重新初始化。

**解决**：清空 volume 或删除 `.initialized` 文件。

## 排查清单

遇到 `ERR_MODULE_NOT_FOUND` 时：

1. [ ] 确认 Dockerfile 包含 entrypoint 机制
2. [ ] 确认 `node_modules_backup` 在镜像中存在且非空
3. [ ] 确认 `docker-entrypoint.sh` 有执行权限
4. [ ] 检查部署平台是否支持 ENTRYPOINT
5. [ ] 检查是否需要清理旧 volume 触发重新初始化
6. [ ] 确认镜像 tag 是新的（避免使用缓存的旧镜像）

## 历史修复记录

| 版本 | 提交 | 说明 |
|------|------|------|
| v1.3.0 | `5243315` | 首次引入 entrypoint 解决方案 |
| v2.5.0 | `63e1188` | 意外简化 Dockerfile，问题复发 |
| v2.5.1 | `39a7264` | 尝试从 builder 复制 node_modules，仍失败 |
| v2.5.2 | `1cd5f09` | 恢复 entrypoint 机制，问题解决 |

## 为什么不能放弃 volume

如果不用 volume 持久化 `node_modules`：
- 用户通过 Web UI 安装的依赖在容器重启后丢失
- 每次更新镜像都需要用户重新安装所有自定义依赖
- 严重影响用户体验

因此必须保留 volume + entrypoint 的设计。
