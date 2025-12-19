# 3. 接口契约 (API Contracts)

## 统一响应格式

### 成功响应

```typescript
{
  "success": true,
  "data": { ... }
}
```

### 错误响应

```typescript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "函数名称已存在"
  }
}
```

## 认证方式

```
Authorization: Bearer <jwt_token>
// 或
Authorization: sk-xxx...  (API Token)
```

JWT Payload:
```typescript
{
  "userId": "xxx",
  "username": "xxx",
  "iat": 1234567890,
  "exp": 1234567890
}
```

---

## 认证 API

```
POST /api/auth/register       # 注册
POST /api/auth/login          # 登录
```

## 函数 API

```
GET    /api/functions              # 列表
POST   /api/functions              # 创建
GET    /api/functions/:id          # 详情
PUT    /api/functions/:id          # 更新
DELETE /api/functions/:id          # 删除
POST   /api/functions/:id/compile  # 编译
POST   /api/functions/:id/publish  # 发布
POST   /api/functions/:id/unpublish # 取消发布
GET    /api/functions/:id/versions # 版本列表
POST   /api/functions/:id/rollback # 回滚
POST   /api/functions/:id/move     # 移动
```

## 文件夹 API

```
GET    /api/folders             # 获取树
POST   /api/folders             # 创建
PATCH  /api/folders/:id         # 重命名
DELETE /api/folders/:id         # 删除
POST   /api/folders/:id/move    # 移动
```

## 依赖 API

```
GET    /api/dependencies        # 列表
POST   /api/dependencies        # 添加
DELETE /api/dependencies/:name  # 删除
```

## 环境变量 API

```
GET    /api/env                 # 列表
PUT    /api/env/:key            # 设置
DELETE /api/env/:key            # 删除
```

## Git API

```
GET    /api/git/config          # 获取配置
PUT    /api/git/config          # 保存配置
GET    /api/git/preview-pull    # 预览拉取 (变更列表+冲突检测)
GET    /api/git/preview-push    # 预览推送 (变更列表)
POST   /api/git/pull            # 拉取 (支持选择性: {functions: string[]})
POST   /api/git/push            # 推送 (支持选择性: {functions: string[], message})
GET    /api/git/status          # 同步状态
```

## 定时任务 API

```
GET    /api/scheduler           # 任务列表
POST   /api/scheduler           # 创建任务
PUT    /api/scheduler/:id       # 更新任务
DELETE /api/scheduler/:id       # 删除任务
POST   /api/scheduler/:id/run   # 手动执行一次
```

## 执行历史 API

```
GET    /api/execution-logs                 # 历史列表
GET    /api/execution-logs/function/:id    # 函数历史
POST   /api/execution-logs/search          # 搜索日志
GET    /api/execution-logs/stats/overall   # 整体统计
GET    /api/execution-logs/stats/trend     # 执行趋势
GET    /api/execution-logs/stats/:id       # 函数统计
```

## Webhook API

```
GET    /api/webhooks                # Webhook 列表
GET    /api/webhooks/function/:id   # 函数的 Webhook
POST   /api/webhooks                # 创建 Webhook
PATCH  /api/webhooks/:id            # 更新 Webhook
DELETE /api/webhooks/:id            # 删除 Webhook
ALL    /api/webhooks/call/:token    # 调用 Webhook (无需认证)
```

## 代码片段 API

```
GET    /api/snippets            # 片段列表
GET    /api/snippets/tags       # 所有标签
GET    /api/snippets/search     # 搜索片段
POST   /api/snippets            # 创建片段
PATCH  /api/snippets/:id        # 更新片段
DELETE /api/snippets/:id        # 删除片段
POST   /api/snippets/:id/use    # 增加使用次数
```

## 搜索 API

```
GET    /api/search              # 搜索函数 (名称+代码)
```

## AI 供应商/模型 API

```
GET    /api/ai/providers             # 供应商列表
POST   /api/ai/providers             # 创建供应商
GET    /api/ai/providers/:id         # 获取供应商
PUT    /api/ai/providers/:id         # 更新供应商
DELETE /api/ai/providers/:id         # 删除供应商
GET    /api/ai/providers/:id/models  # 供应商的模型列表
POST   /api/ai/providers/:id/models  # 创建模型
GET    /api/ai/all-models            # 所有模型
GET    /api/ai/default-model         # 默认模型
GET    /api/ai/models/:id            # 获取模型
PUT    /api/ai/models/:id            # 更新模型
DELETE /api/ai/models/:id            # 删除模型
POST   /api/ai/models/:id/test       # 测试模型连接
```

## AI 对话 API

```
GET    /api/ai/conversations         # 对话列表
POST   /api/ai/conversations         # 创建对话
GET    /api/ai/conversations/:id     # 获取对话详情
DELETE /api/ai/conversations/:id     # 删除对话
PATCH  /api/ai/conversations/:id     # 更新对话
POST   /api/ai/chat                  # 对话聊天 (SSE 流式)
```

## AI 系统提示词 API

```
GET    /api/ai/prompts               # 提示词列表
POST   /api/ai/prompts               # 创建提示词
PUT    /api/ai/prompts/:id           # 更新提示词
DELETE /api/ai/prompts/:id           # 删除提示词
GET    /api/ai/prompts/:id/versions  # 版本历史
POST   /api/ai/prompts/:id/rollback  # 回滚版本
```

## AI 操作 API

```
POST   /api/ai/execute          # 执行 AI 操作 (SSE 流式)
POST   /api/ai/generate         # 生成代码 (SSE 流式)
GET    /api/ai/history          # AI 历史记录
```

## AI Debug API

```
POST   /api/ai/debug            # AI 自动调试 (SSE 流式)
POST   /api/ai/debug/apply      # 应用调试修复
```

## AI 解耦/合并 API

```
POST   /api/ai/refactor         # 解耦分析 (SSE 流式)
POST   /api/ai/refactor/confirm # 确认执行解耦计划
POST   /api/ai/merge-analyze    # 多函数合并分析 (SSE 流式)
POST   /api/ai/merge/confirm    # 确认执行合并计划
```

## AI 日志分析 API

```
GET    /api/ai/log-summary           # 获取日志摘要 (?days=7&functionId=xxx)
GET    /api/ai/log-summary/formatted # 获取格式化摘要 (供 AI 使用)
```

## 自定义域名 API

```
GET    /api/custom-domains             # 域名列表
POST   /api/custom-domains             # 添加域名
PATCH  /api/custom-domains/:id         # 更新域名
DELETE /api/custom-domains/:id         # 删除域名
POST   /api/custom-domains/:id/verify  # 验证 DNS
GET    /api/custom-domains/system-domain  # 获取系统域名
```

## API Token API

```
GET    /api/tokens              # Token 列表
POST   /api/tokens              # 创建 Token { name, expireDays }
DELETE /api/tokens/:id          # 删除 Token
```

## MongoDB 数据库 API

```
GET    /api/database/collections              # 获取集合列表
GET    /api/database/collections/:name        # 获取集合详情
GET    /api/database/collections/:name/documents   # 获取文档列表
POST   /api/database/collections/:name/documents   # 创建文档
PUT    /api/database/collections/:name/documents/:id  # 更新文档
DELETE /api/database/collections/:name/documents/:id  # 删除文档
GET    /api/database/collections/:name/indexes    # 获取索引列表
POST   /api/database/collections/:name/indexes    # 创建索引
DELETE /api/database/collections/:name/indexes/:indexName  # 删除索引
```

## 审计日志 API

```
GET    /api/audit                    # 审计日志列表
       ?functionId=xxx               # 按函数筛选
       &action=update                # 按动作筛选 (create/update/delete/rename/move/publish/unpublish/rollback)
       &operator=ai                  # 按操作者类型筛选 (user/ai/git/system)
       &startDate=2024-01-01         # 开始日期
       &endDate=2024-01-31           # 结束日期
       &limit=50&offset=0            # 分页

GET    /api/audit/function/:id       # 指定函数的审计日志

GET    /api/audit/stats              # 审计统计
       ?days=7                       # 统计天数
```

## 函数调用 API

```
ALL    /invoke/:name            # 内部调用 (需认证)
ALL    /*                       # 公开调用 (无需认证，函数需已发布)
```

## LSP WebSocket

```
WebSocket: ws://localhost:3000/_/lsp

消息格式: JSON-RPC 2.0 (LSP 协议)
```

---

## 错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| AUTH_REQUIRED | 401 | 未登录 |
| INVALID_TOKEN | 401 | Token 无效 |
| FORBIDDEN | 403 | 无权限 |
| NOT_FOUND | 404 | 资源不存在 |
| DUPLICATE_NAME | 409 | 名称重复 |
| VALIDATION_ERROR | 400 | 参数错误 |
| COMPILE_ERROR | 400 | 编译失败 |
| RUNTIME_ERROR | 500 | 执行错误 |
| SERVER_ERROR | 500 | 服务器错误 |

---

## Cloud SDK (云函数内使用)

云函数可通过 `cloud` 对象访问以下 API：

### database() - 数据库访问

```typescript
const db = cloud.database()
const users = await db.collection('users').find().toArray()
```

### invoke() - 调用其他函数

```typescript
// 使用 ES6 导入语法 (推荐)
import { otherFunction } from '@/other-function'
const result = await otherFunction(ctx)
```

### storage - 文件存储

```typescript
const bucket = cloud.storage.bucket('my-bucket')  // 指定桶
const bucket = cloud.storage.bucket()             // 使用默认桶

// 写入文件
await bucket.writeFile('path/file.txt', 'content')
await bucket.writeFile('path/image.png', buffer)

// 读取文件
const content = await bucket.readFile('path/file.txt')

// 删除文件
await bucket.deleteFile('path/file.txt')

// 列出文件
const files = await bucket.listFiles('path/')

// 获取上传/下载签名 URL (1小时有效)
const uploadUrl = await bucket.getUploadUrl('path/file.txt')
const downloadUrl = await bucket.getDownloadUrl('path/file.txt')
```

### 完整示例

```typescript
import cloud from '@/cloud-sdk'

export default async function(ctx: FunctionContext) {
  // 数据库操作
  const db = cloud.database()
  const user = await db.collection('users').findOne({ _id: ctx.body.userId })

  // 文件操作
  const bucket = cloud.storage.bucket()
  await bucket.writeFile(`reports/${user.name}.json`, JSON.stringify(user))
  const url = await bucket.getDownloadUrl(`reports/${user.name}.json`)

  return { success: true, url }
}
```
