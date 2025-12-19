# Sprint 6: 数据管理 - 任务清单

## 任务概览

| 阶段 | 任务数 | 说明 |
|------|--------|------|
| Phase 1 | 4 | MongoDB 后端：集合/文档/索引 API |
| Phase 2 | 5 | MongoDB 前端：列表/编辑器/查询 |
| Phase 3 | 4 | S3 后端：配置/存储桶/对象 API |
| Phase 4 | 5 | S3 前端：浏览/上传/预览 |
| Phase 5 | 3 | 集成与优化 |

---

## Phase 1: MongoDB 后端

### 任务 1.1: 数据库服务层

**后端** `packages/server/src/services/database.ts`

- [ ] 创建 `DatabaseService` 类
- [ ] 实现 `listCollections()` - 获取集合列表
- [ ] 实现 `getCollectionStats(name)` - 获取集合统计
- [ ] 实现 `createCollection(name)` - 创建集合
- [ ] 实现 `dropCollection(name)` - 删除集合

```typescript
class DatabaseService {
  async listCollections(): Promise<CollectionInfo[]>
  async getCollectionStats(name: string): Promise<CollectionStats>
  async createCollection(name: string): Promise<void>
  async dropCollection(name: string): Promise<void>
}
```

### 任务 1.2: 文档操作 API

**后端** `packages/server/src/services/database.ts`

- [ ] 实现 `findDocuments(collection, query, options)` - 查询文档
- [ ] 实现 `insertDocument(collection, doc)` - 插入文档
- [ ] 实现 `updateDocument(collection, id, update)` - 更新文档
- [ ] 实现 `deleteDocument(collection, id)` - 删除文档
- [ ] 实现 `countDocuments(collection, query)` - 统计数量

```typescript
interface FindOptions {
  query?: object;
  skip?: number;
  limit?: number;
  sort?: object;
  projection?: object;
}

async findDocuments(collection: string, options: FindOptions): Promise<{
  documents: Document[];
  total: number;
}>
```

### 任务 1.3: 索引管理 API

**后端** `packages/server/src/services/database.ts`

- [ ] 实现 `listIndexes(collection)` - 获取索引列表
- [ ] 实现 `createIndex(collection, keys, options)` - 创建索引
- [ ] 实现 `dropIndex(collection, indexName)` - 删除索引

```typescript
interface IndexInfo {
  name: string;
  key: object;
  unique?: boolean;
  sparse?: boolean;
  expireAfterSeconds?: number;
}

async listIndexes(collection: string): Promise<IndexInfo[]>
async createIndex(collection: string, keys: object, options?: object): Promise<string>
async dropIndex(collection: string, indexName: string): Promise<void>
```

### 任务 1.4: 数据库路由

**后端** `packages/server/src/routes/database.ts`

- [ ] `GET /api/database/collections` - 集合列表
- [ ] `POST /api/database/collections` - 创建集合
- [ ] `DELETE /api/database/collections/:name` - 删除集合
- [ ] `GET /api/database/collections/:name/stats` - 集合统计
- [ ] `GET /api/database/collections/:name/documents` - 查询文档
- [ ] `POST /api/database/collections/:name/documents` - 插入文档
- [ ] `PUT /api/database/collections/:name/documents/:id` - 更新文档
- [ ] `DELETE /api/database/collections/:name/documents/:id` - 删除文档
- [ ] `GET /api/database/collections/:name/indexes` - 索引列表
- [ ] `POST /api/database/collections/:name/indexes` - 创建索引
- [ ] `DELETE /api/database/collections/:name/indexes/:indexName` - 删除索引
- [ ] 在 `index.ts` 中注册路由

请求/响应格式：

```typescript
// GET /api/database/collections/:name/documents
// Query: ?query={}&skip=0&limit=20&sort={}
// Response:
{
  success: true,
  data: {
    documents: [...],
    total: 156,
    page: 1,
    pageSize: 20
  }
}

// POST /api/database/collections/:name/indexes
// Body:
{
  keys: { "email": 1 },
  options: { unique: true }
}
```

---

## Phase 2: MongoDB 前端

### 任务 2.1: API 和状态管理

**前端** `packages/web/src/`

- [ ] 创建 `api/database.ts` - API 调用封装
- [ ] 创建 `stores/database.ts` - 状态管理

```typescript
// api/database.ts
export async function listCollections(): Promise<CollectionInfo[]>
export async function queryDocuments(collection: string, options: QueryOptions): Promise<QueryResult>
export async function insertDocument(collection: string, doc: object): Promise<Document>
export async function updateDocument(collection: string, id: string, doc: object): Promise<Document>
export async function deleteDocument(collection: string, id: string): Promise<void>

// stores/database.ts
interface DatabaseState {
  collections: CollectionInfo[];
  currentCollection: string | null;
  documents: Document[];
  total: number;
  page: number;
  pageSize: number;
  query: object;
  loading: boolean;
}
```

### 任务 2.2: 集合列表组件

**前端** `packages/web/src/components/Database/CollectionList.tsx`

- [ ] 显示所有集合列表
- [ ] 显示文档数量
- [ ] 点击切换当前集合
- [ ] 右键菜单：删除集合
- [ ] 新建集合按钮

样式参考：
```
┌────────────────┐
│  集合列表       │
├────────────────┤
│  ▸ users (156) │  ← 选中高亮
│    functions   │
│    folders     │
│    ...         │
├────────────────┤
│  [+] 新建集合   │
└────────────────┘
```

### 任务 2.3: 文档列表组件

**前端** `packages/web/src/components/Database/DocumentList.tsx`

- [ ] 表格展示文档列表
- [ ] 自动识别字段作为列
- [ ] 分页控件
- [ ] 选择行查看详情
- [ ] 操作列：编辑、删除

样式参考：
```
┌──────────────────────────────────────────────────────────────┐
│  _id          │ name    │ email       │ createdAt   │ 操作  │
├──────────────────────────────────────────────────────────────┤
│  673a...      │ Alice   │ a@b.com     │ 2024-12-18  │ ✏️ 🗑 │
│  673b...      │ Bob     │ b@c.com     │ 2024-12-18  │ ✏️ 🗑 │
├──────────────────────────────────────────────────────────────┤
│  显示 1-20 / 共 156 条                    [<] 1 2 3 ... [>] │
└──────────────────────────────────────────────────────────────┘
```

### 任务 2.4: 文档编辑器组件

**前端** `packages/web/src/components/Database/DocumentEditor.tsx`

- [ ] Monaco Editor 展示 JSON
- [ ] 新建文档模式
- [ ] 编辑文档模式
- [ ] JSON 格式验证
- [ ] 保存/取消按钮

样式参考：
```
┌──────────────────────────────────────┐
│  编辑文档                    [×]     │
├──────────────────────────────────────┤
│  {                                   │
│    "_id": "673a...",                 │
│    "name": "Alice",                  │
│    "email": "a@b.com",               │
│    "createdAt": "2024-12-18..."      │
│  }                                   │
├──────────────────────────────────────┤
│                    [取消] [保存]     │
└──────────────────────────────────────┘
```

### 任务 2.5: 查询构建器 + 索引管理

**前端** `packages/web/src/components/Database/`

- [ ] `QueryBuilder.tsx` - 查询输入框 + 执行按钮
- [ ] 支持 JSON 格式查询条件
- [ ] 查询历史记录
- [ ] `IndexManager.tsx` - 索引列表 + 创建表单
- [ ] 显示索引字段、类型、选项

查询栏样式：
```
┌────────────────────────────────────────────────────────────┐
│ 查询: [{ "name": { "$regex": "A" } }        ] [执行] [清空]│
└────────────────────────────────────────────────────────────┘
```

---

## Phase 3: S3 后端

### 任务 3.1: S3 配置模型

**后端** `packages/server/src/models/s3Config.ts`

- [ ] 定义 `S3Config` 接口
- [ ] 在 `db.ts` 中注册集合

```typescript
interface S3Config {
  _id?: ObjectId;
  userId: ObjectId;
  endpoint: string;
  accessKeyId: string;      // 加密存储
  secretAccessKey: string;  // 加密存储
  region: string;
  bucket: string;
  forcePathStyle: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### 任务 3.2: S3 服务层

**后端** `packages/server/src/services/storage.ts`

- [ ] 安装依赖：`pnpm add @aws-sdk/client-s3 @aws-sdk/lib-storage`
- [ ] 创建 `StorageService` 类
- [ ] 实现 `getClient(userId)` - 获取 S3 客户端
- [ ] 实现 `testConnection()` - 测试连接
- [ ] 实现 `listBuckets()` - 列出存储桶
- [ ] 实现 `createBucket(name)` - 创建存储桶
- [ ] 实现 `deleteBucket(name)` - 删除存储桶

```typescript
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3'

class StorageService {
  private async getClient(userId: ObjectId): Promise<S3Client>
  async testConnection(userId: ObjectId): Promise<boolean>
  async listBuckets(userId: ObjectId): Promise<BucketInfo[]>
  async createBucket(userId: ObjectId, name: string): Promise<void>
  async deleteBucket(userId: ObjectId, name: string): Promise<void>
}
```

### 任务 3.3: 对象操作 API

**后端** `packages/server/src/services/storage.ts`

- [ ] 实现 `listObjects(bucket, prefix)` - 列出对象
- [ ] 实现 `uploadObject(bucket, key, body)` - 上传对象
- [ ] 实现 `downloadObject(bucket, key)` - 下载对象
- [ ] 实现 `deleteObject(bucket, key)` - 删除对象
- [ ] 实现 `getPresignedUrl(bucket, key)` - 获取预签名 URL
- [ ] 实现 `createFolder(bucket, prefix)` - 创建文件夹

```typescript
interface ObjectInfo {
  key: string;
  size: number;
  lastModified: Date;
  isFolder: boolean;
}

async listObjects(userId: ObjectId, bucket: string, prefix?: string): Promise<ObjectInfo[]>
async uploadObject(userId: ObjectId, bucket: string, key: string, body: Buffer, contentType: string): Promise<void>
async getPresignedUrl(userId: ObjectId, bucket: string, key: string, expiresIn?: number): Promise<string>
```

### 任务 3.4: 存储路由

**后端** `packages/server/src/routes/storage.ts`

- [ ] `GET /api/storage/config` - 获取配置
- [ ] `PUT /api/storage/config` - 保存配置
- [ ] `POST /api/storage/config/test` - 测试连接
- [ ] `GET /api/storage/buckets` - 存储桶列表
- [ ] `POST /api/storage/buckets` - 创建存储桶
- [ ] `DELETE /api/storage/buckets/:name` - 删除存储桶
- [ ] `GET /api/storage/objects` - 列出对象
- [ ] `POST /api/storage/objects/upload` - 上传文件 (multipart)
- [ ] `GET /api/storage/objects/download` - 下载文件
- [ ] `DELETE /api/storage/objects` - 删除对象
- [ ] `POST /api/storage/objects/folder` - 创建文件夹
- [ ] `GET /api/storage/objects/presigned` - 获取预签名 URL
- [ ] 在 `index.ts` 中注册路由

文件上传处理：
```typescript
import multer from 'multer'
const upload = multer({ limits: { fileSize: 100 * 1024 * 1024 } }) // 100MB

router.post('/objects/upload', upload.single('file'), async (req, res) => {
  const { bucket, key } = req.body
  const file = req.file
  await storageService.uploadObject(userId, bucket, key, file.buffer, file.mimetype)
})
```

---

## Phase 4: S3 前端

### 任务 4.1: API 和状态管理

**前端** `packages/web/src/`

- [ ] 创建 `api/storage.ts` - API 调用封装
- [ ] 扩展 `stores/database.ts` 或创建 `stores/storage.ts`

```typescript
// api/storage.ts
export async function getStorageConfig(): Promise<S3Config | null>
export async function saveStorageConfig(config: S3ConfigInput): Promise<void>
export async function testStorageConnection(): Promise<boolean>
export async function listBuckets(): Promise<BucketInfo[]>
export async function listObjects(bucket: string, prefix?: string): Promise<ObjectInfo[]>
export async function uploadFile(bucket: string, key: string, file: File): Promise<void>
export async function deleteObjects(bucket: string, keys: string[]): Promise<void>
export async function getDownloadUrl(bucket: string, key: string): Promise<string>
```

### 任务 4.2: S3 配置组件

**前端** `packages/web/src/components/Storage/StorageConfig.tsx`

- [ ] Endpoint 输入框
- [ ] Access Key / Secret Key 输入框 (密码模式)
- [ ] Region 选择
- [ ] 默认存储桶
- [ ] Force Path Style 开关 (MinIO 需要)
- [ ] 测试连接按钮
- [ ] 保存按钮

放入设置弹窗的新 Tab 中。

### 任务 4.3: 存储桶和文件列表

**前端** `packages/web/src/components/Storage/`

- [ ] `BucketList.tsx` - 存储桶列表
- [ ] `FileList.tsx` - 文件列表 (表格)
- [ ] 面包屑导航显示当前路径
- [ ] 支持进入文件夹
- [ ] 多选文件
- [ ] 操作按钮：下载、删除

文件列表样式：
```
┌────────────────────────────────────────────────────────────┐
│ 路径: uploads / images / avatars /                [上传]   │
├────────────────────────────────────────────────────────────┤
│ ☑  名称              │ 大小     │ 修改时间                │
├────────────────────────────────────────────────────────────┤
│ ☐  📁 thumbnails     │ -        │ 2024-12-18 10:30       │
│ ☑  🖼 avatar1.jpg    │ 125 KB   │ 2024-12-18 09:15       │
│ ☑  🖼 avatar2.png    │ 89 KB    │ 2024-12-17 14:22       │
│ ☐  📄 config.json    │ 2 KB     │ 2024-12-16 08:00       │
├────────────────────────────────────────────────────────────┤
│ 已选择 2 个文件                       [下载] [删除]         │
└────────────────────────────────────────────────────────────┘
```

### 任务 4.4: 文件上传组件

**前端** `packages/web/src/components/Storage/FileUploader.tsx`

- [ ] 点击选择文件
- [ ] 拖拽上传区域
- [ ] 上传进度条
- [ ] 支持多文件上传
- [ ] 取消上传

```
┌────────────────────────────────────────┐
│                                        │
│     📁 拖拽文件到此处，或点击上传       │
│                                        │
├────────────────────────────────────────┤
│  avatar3.jpg          [=====>   ] 65%  │
│  document.pdf         [=========] 100% ✓│
└────────────────────────────────────────┘
```

### 任务 4.5: 文件预览组件

**前端** `packages/web/src/components/Storage/FilePreview.tsx`

- [ ] 图片预览 (jpg, png, gif, webp)
- [ ] 文本预览 (txt, json, md, log)
- [ ] 代码高亮 (js, ts, py, etc.)
- [ ] 不支持的类型显示文件信息
- [ ] 下载按钮

```
┌──────────────────────────────────────┐
│  预览: avatar1.jpg           [下载]  │
├──────────────────────────────────────┤
│                                      │
│         ┌──────────────┐             │
│         │              │             │
│         │   [图片]     │             │
│         │              │             │
│         └──────────────┘             │
│                                      │
├──────────────────────────────────────┤
│  大小: 125 KB                        │
│  类型: image/jpeg                    │
│  修改: 2024-12-18 09:15              │
└──────────────────────────────────────┘
```

---

## Phase 5: 集成与优化

### 任务 5.1: 主面板集成

**前端** `packages/web/src/components/`

- [ ] 创建 `Database/DatabasePanel.tsx` - 数据库管理主面板
- [ ] 创建 `Storage/StoragePanel.tsx` - 存储管理主面板
- [ ] 整合左中右三栏布局

### 任务 5.2: 页面入口

**前端** `packages/web/src/pages/IDE/index.tsx`

- [ ] Header 添加页面切换：云函数 | 数据库 | 存储
- [ ] 使用 Tab 或 Segmented 组件
- [ ] 路由支持：`/ide/functions`, `/ide/database`, `/ide/storage`

```
┌─────────────────────────────────────────────────────────────┐
│  Simple IDE    [云函数] [数据库] [存储]      用户 ▾  [设置] │
├─────────────────────────────────────────────────────────────┤
│                        ...                                  │
└─────────────────────────────────────────────────────────────┘
```

### 任务 5.3: 设置集成

**前端** `packages/web/src/components/SettingsModal.tsx`

- [ ] 添加"对象存储"设置 Tab
- [ ] 添加"数据库"设置 Tab (可选，如白名单配置)

---

## 开发日志

| 日期 | 任务 | 状态 | 备注 |
|------|------|------|------|
| - | - | - | - |

---

## 测试清单

### 单元测试

- [ ] MongoDB 服务层方法
- [ ] S3 服务层方法
- [ ] JSON 查询解析

### 集成测试

- [ ] 文档 CRUD 完整流程
- [ ] 索引创建删除
- [ ] S3 配置保存读取
- [ ] 文件上传下载

### 手动测试

- [ ] 大集合分页性能
- [ ] 复杂查询语法
- [ ] 大文件上传 (>10MB)
- [ ] MinIO 兼容性
- [ ] 中文文件名处理

---

## 注意事项

1. **系统集合保护** - `users`, `sessions` 等集合需要特殊处理
2. **查询注入** - 验证用户输入的查询 JSON
3. **大数据量** - 列表需要分页，禁止全量拉取
4. **S3 密钥** - 使用与 AI Key 相同的加密方式
5. **文件大小** - 后端和前端都要限制
6. **CORS** - S3 预签名 URL 可能有跨域问题
7. **超时** - 大文件上传需要增加超时时间
