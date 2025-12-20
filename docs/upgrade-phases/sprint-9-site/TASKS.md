# Sprint 9: 静态站点托管 - 任务清单

## 任务概览

| 阶段 | 任务数 | 状态 | 说明 |
|------|--------|------|------|
| Phase 1 | 4 | ✅ 完成 | 数据模型 + 站点配置服务 |
| Phase 2 | 6 | ✅ 完成 | 文件管理服务 + S3 集成 |
| Phase 3 | 4 | ✅ 完成 | 静态文件服务 + 访问控制 |
| Phase 4 | 5 | ✅ 完成 | 前端组件 |
| Phase 5 | 3 | ✅ 完成 | AI 集成 + 测试 |

---

## Phase 1: 数据模型 + 站点配置

### 任务 1.1: 数据模型定义

**后端** `src/server/`

- [x] 创建 `services/site.ts` - Site 和 SiteFile 类型定义
- [x] 在 `db.ts` 中注册 `sites` 和 `site_files` 集合
- [x] 创建索引 `{ userId: 1, path: 1 }` (唯一)

### 任务 1.2: 站点服务

**后端** `src/server/services/site.ts`

- [x] 实现站点服务
- [x] `getOrCreate(userId)` - 获取或创建默认站点配置
- [x] `update(userId, updates)` - 更新配置
- [x] `updateStats(userId)` - 更新文件统计
- [x] `getStats(userId)` - 获取站点统计

### 任务 1.3: 站点配置路由

**后端** `src/server/routes/site.ts`

- [x] `GET /api/site` - 获取站点配置
- [x] `PUT /api/site` - 更新站点配置
- [x] `GET /api/site/stats` - 获取站点统计

### 任务 1.4: MIME 类型工具

**后端** `src/server/services/siteFile.ts`

- [x] 内置 MIME 类型映射表
- [x] 封装 MIME 类型查询 `getMimeType`
- [x] 判断是否为文本文件 `isTextFile`

---

## Phase 2: 文件管理服务

### 任务 2.1: 文件服务基础

**后端** `src/server/services/siteFile.ts`

- [x] 实现文件服务
- [x] `normalizePath(path)` - 路径规范化
- [x] `getS3Key(userId, filePath)` - 生成 S3 Key
- [x] `get(userId, path)` - 获取单个文件

### 任务 2.2: 文件列表和读取

**后端** `src/server/services/siteFile.ts`

- [x] `list(userId, dirPath, recursive)` - 获取文件列表
- [x] `readContent(userId, path)` - 读取文件内容
- [x] 文本文件返回 content，二进制返回 url

### 任务 2.3: 文件创建和更新

**后端** `src/server/services/siteFile.ts`

- [x] `save(userId, path, content, site)` - 保存文件
- [x] `createDirectory(userId, path)` - 创建目录
- [x] `ensureDirectory(userId, path)` - 确保目录存在 (递归创建)
- [x] 计算文件 hash (MD5)
- [x] 检查大小限制

### 任务 2.4: 文件删除

**后端** `src/server/services/siteFile.ts`

- [x] `remove(userId, path, recursive)` - 删除文件/目录
- [x] 递归删除目录下所有文件
- [x] 同步删除 S3 对象

### 任务 2.5: 文件移动和复制

**后端** `src/server/services/siteFile.ts`

- [x] `move(userId, from, to)` - 移动/重命名
- [x] `copy(userId, from, to, site)` - 复制文件
- [x] 目录移动需更新所有子项路径

### 任务 2.6: 文件管理路由

**后端** `src/server/routes/site-files.ts`

- [x] `GET /api/site/files` - 获取文件树
- [x] `GET /api/site/files/content` - 读取内容
- [x] `POST /api/site/files` - 创建/更新
- [x] `POST /api/site/files/upload` - 上传 (multipart)
- [x] `DELETE /api/site/files` - 删除
- [x] `POST /api/site/files/move` - 移动
- [x] `POST /api/site/files/copy` - 复制
- [x] `POST /api/site/files/batch` - 批量操作

---

## Phase 3: 静态文件服务

### 任务 3.1: 访问控制中间件

**后端** `src/server/routes/site-serve.ts`

- [x] 检查站点是否启用
- [x] 处理 `public` 类型 - 直接通过
- [x] 处理 `login` 类型 - 验证 JWT
- [x] 处理 `password` 类型 - 检查密码
- [x] 支持路径级别保护 `protectedPaths`

### 任务 3.2: 静态文件服务路由

**后端** `src/server/routes/site-serve.ts`

- [x] `GET /site/:userId/*` - 静态文件访问
- [x] 精确匹配文件
- [x] 目录返回默认文件 (index.html)
- [x] 文件不存在时:
  - SPA 模式返回 index.html
  - 有 notFoundPage 返回自定义 404
  - 否则返回默认 404 页面

### 任务 3.3: 缓存控制

**后端** `src/server/routes/site-serve.ts`

- [x] HTML 文件: `Cache-Control: no-cache`
- [x] 其他资源: `Cache-Control: public, max-age=86400`
- [x] 添加 ETag 头
- [x] 处理 If-None-Match 返回 304

### 任务 3.4: 主路由注册

**后端** `src/server/index.ts`

- [x] 注册 `/api/site` 路由 (需认证)
- [x] 注册 `/api/site/files` 路由 (需认证)
- [x] 注册 `/site` 路由 (独立访问控制)

---

## Phase 4: 前端组件

### 任务 4.1: API 调用和状态管理

**前端** `src/client/`

- [x] 创建 `api/site.ts` - API 调用封装
- [x] 创建 `stores/site.ts` - Zustand 状态管理

### 任务 4.2: 文件树组件

**前端** `src/client/components/SitePanel/SiteFileTree.tsx`

- [x] 将扁平文件列表转换为树结构
- [x] 展示文件/文件夹图标
- [x] 点击文件加载内容
- [x] 右键菜单 (新建/删除/重命名)
- [x] 新建文件/文件夹弹窗
- [x] 文件类型模板 (HTML/CSS/JS)

### 任务 4.3: 编辑器组件

**前端** `src/client/components/SitePanel/SiteEditor.tsx`

- [x] 复用现有 Monaco Editor
- [x] 根据文件扩展名设置语言
- [x] 保存快捷键 Ctrl+S
- [x] 保存成功后自动刷新预览

### 任务 4.4: 预览组件

**前端** `src/client/components/SitePanel/SitePreview.tsx`

- [x] iframe 嵌入预览
- [x] 刷新按钮
- [x] 设备切换 (桌面/平板/手机)
- [x] 新窗口打开按钮
- [x] 自动刷新开关

### 任务 4.5: 站点面板集成

**前端** `src/client/components/SitePanel/`

- [x] 创建 `index.tsx` - 三栏布局主组件
- [x] 在 IDE 侧边栏添加站点入口图标 (Globe)
- [x] 更新 `stores/view.ts` 添加 'site' 视图类型
- [x] 更新 `pages/IDE.tsx` 切换视图渲染 SitePanel

---

## Phase 5: AI 集成 + 测试

### 任务 5.1: AI Action 扩展

**后端** `src/server/services/ai/`

- [x] 扩展 `types.ts` 添加站点文件操作类型
  - `siteCreateFile`
  - `siteUpdateFile`
  - `siteDeleteFile`
  - `siteCreateFolder`
- [x] 在 `executor.ts` 中处理新 Action 类型
- [x] 在 `tools.ts` 中添加站点工具定义

### 任务 5.2: AI 提示词

**后端** `src/server/services/ai/executor.ts`

- [x] 更新 `getActionSystemPrompt` 添加站点操作说明
- [x] 更新 `toolToOperationType` 映射

### 任务 5.3: 构建验证

- [x] TypeScript 类型检查通过
- [x] 生产构建通过

---

## 开发日志

| 日期 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2025-12-20 | Phase 1-3 | ✅ 完成 | 后端服务和 API 开发完成 |
| 2025-12-20 | Phase 4 | ✅ 完成 | 前端组件开发完成 |
| 2025-12-20 | Phase 5 | ✅ 完成 | AI 集成和构建验证完成 |

---

## 创建的文件清单

### 后端
- `src/server/services/site.ts` - 站点配置服务
- `src/server/services/siteFile.ts` - 文件管理服务
- `src/server/routes/site.ts` - 站点配置 API
- `src/server/routes/site-files.ts` - 文件管理 API
- `src/server/routes/site-serve.ts` - 静态文件服务

### 前端
- `src/client/api/site.ts` - API 调用封装
- `src/client/stores/site.ts` - Zustand 状态
- `src/client/components/SitePanel/index.tsx` - 主面板
- `src/client/components/SitePanel/SiteFileTree.tsx` - 文件树
- `src/client/components/SitePanel/SiteEditor.tsx` - 编辑器
- `src/client/components/SitePanel/SitePreview.tsx` - 预览组件

### 修改的文件
- `src/server/db.ts` - 添加索引
- `src/server/index.ts` - 注册路由
- `src/server/middleware/auth.ts` - 导出 verifyToken
- `src/server/services/ai/types.ts` - 添加操作类型
- `src/server/services/ai/executor.ts` - 添加操作处理
- `src/server/services/ai/tools.ts` - 添加工具定义
- `src/client/stores/view.ts` - 添加 'site' 视图类型
- `src/client/pages/IDE.tsx` - 添加站点导航

---

## 注意事项

1. **路径安全** - 规范化路径，防止 `../` 目录穿越
2. **大小限制** - 检查单文件和总存储限制
3. **MIME 类型** - 正确设置 Content-Type
4. **S3 隔离** - 按 userId 隔离存储路径
5. **缓存策略** - HTML 不缓存，资源文件缓存
6. **错误处理** - 友好的错误提示
