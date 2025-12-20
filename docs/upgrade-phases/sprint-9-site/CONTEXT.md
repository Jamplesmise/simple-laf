# Sprint 9: 静态站点托管

## 阶段目标

为 Simple IDE 添加静态站点托管功能，用户可以在 IDE 中创建和管理 HTML/CSS/JS 网页，并通过 `/site/*` 路径直接访问。

## 功能范围

### 核心功能

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 静态文件托管 | 托管 HTML/CSS/JS/图片等静态文件 | P0 |
| 文件管理 | CRUD + 上传/下载/移动/复制 | P0 |
| Monaco 编辑器 | 支持 HTML/CSS/JS 语法高亮 | P0 |
| iframe 实时预览 | 编辑后自动刷新预览 | P0 |
| AI 文件操作 | 通过 AI 对话创建/编辑站点文件 | P1 |
| SPA 路由支持 | 404 回退到 index.html | P1 |
| 访问控制 | 公开/登录/密码保护 | P1 |

### 不包含

- 前端框架构建 (React/Vue) → Sprint 12
- 自定义域名绑定站点 → 复用现有功能
- CDN 加速

## 访问路径设计

```
IDE 访问:     https://your-domain.com/           → React IDE
云函数调用:   https://your-domain.com/invoke/*   → 云函数执行
站点访问:     https://your-domain.com/site/*     → 静态站点 ★ 新增
```

## 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| 文件存储 | S3 | 复用现有存储服务 |
| 元数据 | MongoDB | 与现有架构一致 |
| 编辑器 | Monaco Editor | 已集成，支持多语言 |
| 预览 | iframe | 简单可靠，支持热刷新 |

## 数据模型

### sites 集合 (新增)

```typescript
interface Site {
  _id: ObjectId
  userId: ObjectId

  // 基础配置
  name: string                      // 站点名称 (显示用)
  enabled: boolean                  // 是否启用 (默认 true)

  // 托管配置
  defaultFile: string               // 默认文件 (默认 "index.html")
  spaMode: boolean                  // SPA 模式 - 404 回退到 index.html
  notFoundPage: string | null       // 自定义 404 页面路径

  // 访问控制
  accessControl: {
    type: 'public' | 'login' | 'password'
    password?: string
    protectedPaths?: string[]       // 需要保护的路径前缀
  }

  // 统计
  totalFiles: number
  totalSize: number                 // bytes

  // 权限限制
  features: {
    frameworkBuild: boolean         // 是否允许框架构建 (默认 false)
    maxStorage: number              // 最大存储 (默认 100MB)
    maxFileSize: number             // 单文件最大 (默认 10MB)
  }

  createdAt: Date
  updatedAt: Date
}
```

### site_files 集合 (新增)

```typescript
interface SiteFile {
  _id: ObjectId
  userId: ObjectId

  // 文件信息
  path: string                      // 相对路径: "/index.html"
  name: string                      // 文件名: "index.html"
  isDirectory: boolean              // 是否为目录

  // 文件属性 (目录时为 null)
  size: number | null
  mimeType: string | null
  hash: string | null               // 内容 MD5 (缓存/去重)

  // S3 存储
  s3Key: string | null              // S3 对象键: "sites/{userId}/{path}"

  createdAt: Date
  updatedAt: Date
}

// 索引
db.site_files.createIndex({ userId: 1, path: 1 }, { unique: true })
db.site_files.createIndex({ userId: 1, isDirectory: 1 })
```

### S3 存储结构

```
Bucket: {S3_BUCKET}
└── sites/
    └── {userId}/
        ├── index.html
        ├── favicon.ico
        ├── css/
        │   └── style.css
        ├── js/
        │   └── app.js
        └── images/
            └── logo.png
```

## API 设计

### 站点配置 API

```
GET    /api/site              # 获取站点配置 (自动创建默认)
PUT    /api/site              # 更新站点配置
GET    /api/site/stats        # 获取站点统计
```

### 文件管理 API

```
GET    /api/site/files                # 获取文件树
GET    /api/site/files/content        # 读取文件内容
POST   /api/site/files                # 创建/更新文件
POST   /api/site/files/upload         # 上传文件 (multipart)
DELETE /api/site/files                # 删除文件/目录
POST   /api/site/files/move           # 移动/重命名
POST   /api/site/files/copy           # 复制文件
POST   /api/site/files/batch          # 批量操作
```

### 静态文件服务

```
GET    /site/:userId/*         # 访问静态文件 (独立访问控制)
```

### AI 文件操作 (扩展现有 AI API)

```typescript
type AIActionType =
  | 'site_create_file'    // 创建站点文件
  | 'site_update_file'    // 更新站点文件
  | 'site_delete_file'    // 删除站点文件
  | 'site_read_file'      // 读取站点文件
  | 'site_list_files'     // 列出文件
```

## 目录结构变更

```
src/server/
├── routes/
│   ├── site.ts              # 站点配置 API
│   ├── site-files.ts        # 文件管理 API
│   └── site-serve.ts        # 静态文件服务
├── services/
│   ├── site.ts              # 站点业务逻辑
│   └── siteFile.ts          # 文件操作 (含 S3)
├── middleware/
│   └── siteAuth.ts          # 站点访问控制中间件
└── utils/
    └── mime.ts              # MIME 类型工具

src/client/
├── components/
│   └── site/
│       ├── SitePanel.tsx           # 站点管理主面板
│       ├── SiteFileTree.tsx        # 文件树组件
│       ├── SiteEditor.tsx          # 文件编辑器
│       ├── SitePreview.tsx         # 预览面板
│       ├── SiteSettings.tsx        # 站点设置
│       └── SiteUploadModal.tsx     # 上传弹窗
├── api/
│   └── site.ts                     # API 调用
└── stores/
    └── site.ts                     # Zustand 状态
```

## 前端交互设计

### 入口方式

1. **侧边栏站点图标** - 主入口，切换到站点管理面板
2. **三栏布局** - 左侧文件树 + 中间编辑器 + 右侧预览

### 站点面板布局

```
┌──────────────┬────────────────────────┬──────────────────┐
│ 站点文件     │ /css/style.css         │ 预览    [刷新]   │
│ [+] [刷新]   │                        │ [桌面][平板][手机]│
├──────────────┤ body {                 ├──────────────────┤
│ ▼ /          │   font-family: ...;    │                  │
│   index.html │   margin: 0;           │  ┌────────────┐  │
│   ▼ css/     │   padding: 20px;       │  │            │  │
│     style.css│ }                      │  │  Preview   │  │
│   ▼ js/      │                        │  │  iframe    │  │
│     app.js   │ h1 {                   │  │            │  │
│              │   color: #059669;      │  │            │  │
│              │ }                      │  └────────────┘  │
├──────────────┼────────────────────────┤                  │
│ [上传文件]   │ [保存] 自动刷新 [开关] │                  │
└──────────────┴────────────────────────┴──────────────────┘
```

## 验收标准

### P0 核心功能

- [ ] 站点配置自动创建和更新
- [ ] 文件树展示和操作 (创建/删除/重命名)
- [ ] Monaco 编辑器编辑 HTML/CSS/JS
- [ ] 文件保存到 S3
- [ ] iframe 实时预览
- [ ] 通过 `/site/:userId/*` 访问站点

### P1 功能

- [ ] 文件上传 (支持多文件)
- [ ] 目录创建和递归删除
- [ ] SPA 模式支持
- [ ] 自定义 404 页面
- [ ] 访问控制 (公开/登录/密码)
- [ ] AI 创建/更新/删除站点文件
- [ ] ETag 缓存支持

### P2 功能

- [ ] 文件复制/移动
- [ ] 批量操作
- [ ] 设备模拟预览 (桌面/平板/手机)
- [ ] 自动刷新开关
- [ ] 文件类型模板

## 依赖

- S3 存储服务 (已有)
- AI 对话系统 (已有，扩展 Action 类型)

## 环境变量

```bash
# 站点配置 (可选，有默认值)
SITE_MAX_STORAGE=104857600      # 默认最大存储 100MB
SITE_MAX_FILE_SIZE=10485760     # 默认单文件最大 10MB
```

## 安全考虑

- 文件路径规范化，防止目录穿越
- 文件大小限制
- MIME 类型检测
- 访问控制中间件
- S3 Key 隔离 (按 userId)
