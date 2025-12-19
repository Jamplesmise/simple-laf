# Sprint 1: 基础架构 - 任务清单

## 任务概览

| 任务 | 轨道 | 优先级 | 预估 | 状态 |
|------|------|-------|------|------|
| 1.1 创建本地执行引擎 | 后端 | P0 | 2h | 待开始 |
| 1.2 更新调用路由 | 后端 | P0 | 1h | 待开始 |
| 1.3 发布功能 API | 后端 | P0 | 1h | 待开始 |
| 1.4 公开调用端点 | 后端 | P0 | 1h | 待开始 |
| 1.5 清理 Sandbox 代码 | 后端 | P0 | 30min | 待开始 |
| 1.6 三栏布局框架 | 前端 | P0 | 2h | 待开始 |
| 1.7 函数列表组件 | 前端 | P0 | 2h | 待开始 |
| 1.8 依赖面板骨架 | 前端 | P1 | 1h | 待开始 |
| 1.9 发布按钮集成 | 前端 | P0 | 1h | 待开始 |

---

## 后端任务

### 1.1 创建本地执行引擎

**任务描述**：使用 Node.js VM 模块实现代码执行引擎，替代 Dify Sandbox。

**具体步骤**

- [ ] 创建 `src/services/executor.ts`：

```typescript
import vm from 'vm'

interface ExecuteResult {
  data: any
  logs: string[]
  time: number
  error?: string
}

interface FunctionContext {
  body?: any
  query?: Record<string, string>
  headers?: Record<string, string>
  method?: string
}

export async function executeFunction(
  code: string,
  ctx: FunctionContext,
  cloud: any
): Promise<ExecuteResult> {
  const startTime = Date.now()
  const logs: string[] = []

  // 自定义 console
  const customConsole = {
    log: (...args: any[]) => logs.push(args.map(a =>
      typeof a === 'object' ? JSON.stringify(a) : String(a)
    ).join(' ')),
    error: (...args: any[]) => logs.push('[ERROR] ' + args.map(String).join(' ')),
    warn: (...args: any[]) => logs.push('[WARN] ' + args.map(String).join(' ')),
    info: (...args: any[]) => logs.push('[INFO] ' + args.map(String).join(' ')),
  }

  // 创建沙箱环境
  const sandbox = {
    module: { exports: {} },
    exports: {},
    require,              // 允许 require 已安装的包
    console: customConsole,
    cloud,
    ctx,
    Buffer,
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval,
    Promise,
    JSON,
    Date,
    Math,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Error,
    RegExp,
    Map,
    Set,
    fetch,
  }

  try {
    const wrappedCode = `
      (async function() {
        ${code}
        const fn = module.exports.default || module.exports;
        if (typeof fn !== 'function') {
          throw new Error('必须导出 default 函数');
        }
        return await fn(ctx);
      })()
    `

    const script = new vm.Script(wrappedCode, {
      filename: 'function.js',
      timeout: 30000
    })

    const context = vm.createContext(sandbox)
    const result = await script.runInContext(context, {
      timeout: 30000
    })

    return {
      data: result,
      logs,
      time: Date.now() - startTime,
    }
  } catch (error: any) {
    return {
      data: null,
      logs,
      time: Date.now() - startTime,
      error: error.message,
    }
  }
}
```

**验证**

```typescript
// 测试代码
const result = await executeFunction(
  `module.exports.default = async function(ctx) {
    console.log('Hello', ctx.body?.name || 'World');
    return { message: 'success' };
  }`,
  { body: { name: 'Test' } },
  {}
)
// 期望: result.data = { message: 'success' }
// 期望: result.logs = ['Hello Test']
```

---

### 1.2 更新调用路由

**任务描述**：修改 `/invoke/:name` 路由使用本地执行引擎。

**具体步骤**

- [ ] 修改 `src/routes/invoke.ts`：

```typescript
import { Router } from 'express'
import { executeFunction } from '../services/executor'
import { createCloud } from '../services/cloud'
import { getDB } from '../db'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.all('/:name', authMiddleware, async (req, res) => {
  const db = getDB()
  const func = await db.collection('functions').findOne({
    name: req.params.name,
    userId: req.user.userId
  })

  if (!func) {
    return res.status(404).json({
      success: false,
      error: { code: 'FUNCTION_NOT_FOUND' }
    })
  }

  if (!func.compiled) {
    return res.status(400).json({
      success: false,
      error: { code: 'FUNCTION_NOT_COMPILED' }
    })
  }

  const ctx = {
    body: req.body,
    query: req.query,
    headers: req.headers,
    method: req.method,
  }

  const cloud = createCloud(req.user.userId)
  const result = await executeFunction(func.compiled, ctx, cloud)

  // 设置响应头
  res.set('x-execution-time', String(result.time))
  res.set('x-function-logs', Buffer.from(JSON.stringify(result.logs)).toString('base64'))

  if (result.error) {
    return res.status(500).json({
      success: false,
      error: { code: 'EXECUTION_ERROR', message: result.error },
      logs: result.logs,
      time: result.time
    })
  }

  res.json({
    success: true,
    data: result.data,
    logs: result.logs,
    time: result.time
  })
})

export default router
```

---

### 1.3 发布功能 API

**任务描述**：添加函数发布和取消发布的 API。

**具体步骤**

- [ ] 修改 `src/routes/functions.ts`，添加发布接口：

```typescript
// 发布函数
router.post('/:id/publish', authMiddleware, async (req, res) => {
  const db = getDB()
  const { ObjectId } = require('mongodb')

  const func = await db.collection('functions').findOne({
    _id: new ObjectId(req.params.id),
    userId: new ObjectId(req.user.userId)
  })

  if (!func) {
    return res.status(404).json({
      success: false,
      error: { code: 'FUNCTION_NOT_FOUND' }
    })
  }

  if (!func.compiled) {
    return res.status(400).json({
      success: false,
      error: { code: 'FUNCTION_NOT_COMPILED', message: '请先编译函数' }
    })
  }

  await db.collection('functions').updateOne(
    { _id: new ObjectId(req.params.id) },
    {
      $set: {
        published: true,
        publishedAt: new Date(),
        updatedAt: new Date()
      }
    }
  )

  res.json({
    success: true,
    data: {
      published: true,
      url: `/${func.name}`
    }
  })
})

// 取消发布
router.post('/:id/unpublish', authMiddleware, async (req, res) => {
  const db = getDB()
  const { ObjectId } = require('mongodb')

  await db.collection('functions').updateOne(
    {
      _id: new ObjectId(req.params.id),
      userId: new ObjectId(req.user.userId)
    },
    {
      $set: {
        published: false,
        updatedAt: new Date()
      },
      $unset: { publishedAt: '' }
    }
  )

  res.json({ success: true })
})
```

---

### 1.4 公开调用端点

**任务描述**：创建无需认证的公开调用路由。

**具体步骤**

- [ ] 创建 `src/routes/public.ts`：

```typescript
import { Router } from 'express'
import { executeFunction } from '../services/executor'
import { createCloud } from '../services/cloud'
import { getDB } from '../db'

const router = Router()

// 公开调用已发布的函数 (无需认证)
router.all('/:name', async (req, res) => {
  const db = getDB()

  const func = await db.collection('functions').findOne({
    name: req.params.name,
    published: true
  })

  if (!func) {
    return res.status(404).json({
      success: false,
      error: { code: 'FUNCTION_NOT_FOUND', message: '函数不存在或未发布' }
    })
  }

  const ctx = {
    body: req.body,
    query: req.query,
    headers: req.headers,
    method: req.method,
  }

  const cloud = createCloud(func.userId)
  const result = await executeFunction(func.compiled, ctx, cloud)

  res.set('x-execution-time', String(result.time))

  if (result.error) {
    return res.status(500).json({
      success: false,
      error: { message: result.error }
    })
  }

  // 公开调用直接返回数据，不包装
  res.json(result.data)
})

export default router
```

- [ ] 在 `src/index.ts` 中注册路由 (注意顺序)：

```typescript
// API 路由 (优先匹配)
app.use('/api/auth', authRouter)
app.use('/api/functions', functionsRouter)
app.use('/invoke', invokeRouter)

// 静态文件
app.use(express.static('public'))

// 公开调用路由 (最后匹配，避免与其他路由冲突)
app.use(publicRouter)
```

---

### 1.5 清理 Sandbox 代码

**任务描述**：删除 Dify Sandbox 相关代码和配置。

**具体步骤**

- [ ] 删除 `src/services/sandbox.ts` 文件
- [ ] 修改 `src/config.ts`，移除 Sandbox 配置：

```typescript
export const config = {
  port: process.env.PORT || 3000,
  mongoUrl: process.env.MONGO_URL || 'mongodb://localhost:27017/simple-ide',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtExpiresIn: '7d',
  s3: {
    endpoint: process.env.S3_ENDPOINT || '',
    accessKey: process.env.S3_ACCESS_KEY || '',
    secretKey: process.env.S3_SECRET_KEY || '',
    bucket: process.env.S3_BUCKET || '',
    region: process.env.S3_REGION || 'auto',
  },
  // 已移除：sandbox.url, sandbox.apiKey
}
```

- [ ] 更新 `.env.example`，移除 Sandbox 配置

---

## 前端任务

### 1.6 三栏布局框架

**任务描述**：创建 laf 风格的三栏 IDE 布局。

**具体步骤**

- [ ] 创建 `web/src/layouts/IDELayout.tsx`：

```tsx
import React from 'react'
import { Layout } from 'antd'

const { Header, Sider, Content } = Layout

interface IDELayoutProps {
  leftSidebar: React.ReactNode
  editor: React.ReactNode
  rightPanel: React.ReactNode
  header?: React.ReactNode
}

export function IDELayout({ leftSidebar, editor, rightPanel, header }: IDELayoutProps) {
  return (
    <Layout className="h-screen">
      {/* 顶部栏 */}
      {header && (
        <Header className="h-12 px-4 flex items-center bg-gray-800 border-b border-gray-700">
          {header}
        </Header>
      )}

      <Layout>
        {/* 左侧边栏：函数列表 + 依赖 */}
        <Sider
          width={240}
          className="bg-gray-900 border-r border-gray-700"
          theme="dark"
        >
          {leftSidebar}
        </Sider>

        {/* 中间：编辑器 + Console */}
        <Content className="flex flex-col bg-gray-800">
          {editor}
        </Content>

        {/* 右侧：调试面板 */}
        <Sider
          width={320}
          className="bg-gray-900 border-l border-gray-700"
          theme="dark"
        >
          {rightPanel}
        </Sider>
      </Layout>
    </Layout>
  )
}
```

- [ ] 添加全局样式 `web/src/styles/ide.css`：

```css
/* IDE 暗色主题 */
.ide-layout {
  --bg-primary: #1a1a1a;
  --bg-secondary: #252525;
  --bg-tertiary: #2d2d2d;
  --border-color: #3d3d3d;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
}

.ide-layout .ant-layout-sider {
  background: var(--bg-secondary);
}

.ide-layout .ant-layout-content {
  background: var(--bg-primary);
}
```

---

### 1.7 函数列表组件

**任务描述**：创建左侧函数列表组件，支持搜索和选择。

**具体步骤**

- [ ] 创建 `web/src/components/FunctionList.tsx`：

```tsx
import React, { useState } from 'react'
import { Input, List, Button, Badge, Dropdown, Menu, message } from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  FileOutlined,
  CheckCircleOutlined,
  MoreOutlined,
  DeleteOutlined,
  EditOutlined
} from '@ant-design/icons'

interface Function {
  _id: string
  name: string
  published: boolean
  updatedAt: string
}

interface FunctionListProps {
  functions: Function[]
  activeId?: string
  onSelect: (func: Function) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onRename: (id: string) => void
}

export function FunctionList({
  functions,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  onRename
}: FunctionListProps) {
  const [searchText, setSearchText] = useState('')

  const filteredFunctions = functions.filter(f =>
    f.name.toLowerCase().includes(searchText.toLowerCase())
  )

  const menuItems = (func: Function) => [
    { key: 'rename', icon: <EditOutlined />, label: '重命名' },
    { type: 'divider' },
    { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true },
  ]

  const handleMenuClick = (func: Function, key: string) => {
    if (key === 'delete') {
      onDelete(func._id)
    } else if (key === 'rename') {
      onRename(func._id)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* 搜索框 */}
      <div className="p-2 border-b border-gray-700">
        <Input
          prefix={<SearchOutlined className="text-gray-500" />}
          placeholder="搜索函数..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="bg-gray-800 border-gray-600"
        />
      </div>

      {/* 函数列表 */}
      <div className="flex-1 overflow-auto">
        <List
          dataSource={filteredFunctions}
          renderItem={func => (
            <List.Item
              className={`px-2 py-1 cursor-pointer hover:bg-gray-700 ${
                activeId === func._id ? 'bg-gray-700' : ''
              }`}
              onClick={() => onSelect(func)}
            >
              <div className="flex items-center gap-2 w-full">
                <FileOutlined className="text-blue-400" />
                <span className="flex-1 truncate">{func.name}</span>
                {func.published && (
                  <CheckCircleOutlined className="text-green-500" />
                )}
                <Dropdown
                  menu={{
                    items: menuItems(func),
                    onClick: ({ key }) => handleMenuClick(func, key)
                  }}
                  trigger={['click']}
                >
                  <MoreOutlined
                    className="text-gray-500 hover:text-white"
                    onClick={e => e.stopPropagation()}
                  />
                </Dropdown>
              </div>
            </List.Item>
          )}
        />
      </div>

      {/* 创建按钮 */}
      <div className="p-2 border-t border-gray-700">
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={onCreate}
          block
        >
          创建函数
        </Button>
      </div>
    </div>
  )
}
```

---

### 1.8 依赖面板骨架

**任务描述**：创建左侧依赖面板的 UI 骨架（数据功能在 Sprint 2 实现）。

**具体步骤**

- [ ] 创建 `web/src/components/DependencyPanel.tsx`：

```tsx
import React from 'react'
import { Collapse, Tabs, List, Button, Empty } from 'antd'
import { PlusOutlined, AppstoreOutlined } from '@ant-design/icons'

interface DependencyPanelProps {
  onAddDependency?: () => void
}

export function DependencyPanel({ onAddDependency }: DependencyPanelProps) {
  // 内置依赖 (预装)
  const builtinDeps = [
    { name: 'lodash', version: '4.17.21' },
    { name: 'axios', version: '1.6.0' },
    { name: 'dayjs', version: '1.11.10' },
  ]

  return (
    <div className="border-t border-gray-700">
      <Collapse
        ghost
        defaultActiveKey={['deps']}
        className="bg-transparent"
      >
        <Collapse.Panel
          header={
            <div className="flex items-center gap-2">
              <AppstoreOutlined />
              <span>NPM 依赖</span>
            </div>
          }
          key="deps"
          extra={
            <PlusOutlined
              className="text-gray-500 hover:text-white"
              onClick={e => {
                e.stopPropagation()
                onAddDependency?.()
              }}
            />
          }
        >
          <Tabs
            size="small"
            items={[
              {
                key: 'custom',
                label: '自定义 0',
                children: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="暂无自定义依赖"
                  />
                )
              },
              {
                key: 'builtin',
                label: `内置 ${builtinDeps.length}`,
                children: (
                  <List
                    size="small"
                    dataSource={builtinDeps}
                    renderItem={dep => (
                      <List.Item className="px-0 py-1">
                        <span className="text-gray-300">{dep.name}</span>
                        <span className="text-gray-500 text-xs ml-2">
                          {dep.version}
                        </span>
                      </List.Item>
                    )}
                  />
                )
              }
            ]}
          />
        </Collapse.Panel>
      </Collapse>
    </div>
  )
}
```

---

### 1.9 发布按钮集成

**任务描述**：在编辑器区域集成发布按钮，显示公开 URL。

**具体步骤**

- [ ] 创建 `web/src/components/PublishButton.tsx`：

```tsx
import React, { useState } from 'react'
import { Button, message, Input, Space, Tooltip } from 'antd'
import {
  CloudUploadOutlined,
  CloudDownloadOutlined,
  CopyOutlined,
  CheckOutlined
} from '@ant-design/icons'
import { api } from '../api'

interface PublishButtonProps {
  functionId: string
  functionName: string
  published: boolean
  onPublishChange: (published: boolean) => void
}

export function PublishButton({
  functionId,
  functionName,
  published,
  onPublishChange
}: PublishButtonProps) {
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const publicUrl = `${window.location.origin}/${functionName}`

  const handlePublish = async () => {
    setLoading(true)
    try {
      await api.post(`/api/functions/${functionId}/publish`)
      message.success('发布成功')
      onPublishChange(true)
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '发布失败')
    } finally {
      setLoading(false)
    }
  }

  const handleUnpublish = async () => {
    setLoading(true)
    try {
      await api.post(`/api/functions/${functionId}/unpublish`)
      message.success('已取消发布')
      onPublishChange(false)
    } catch (error) {
      message.error('操作失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    message.success('已复制到剪贴板')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Space>
      {published ? (
        <>
          <Input
            value={publicUrl}
            readOnly
            style={{ width: 280 }}
            addonAfter={
              <Tooltip title="复制链接">
                {copied ? (
                  <CheckOutlined className="text-green-500" />
                ) : (
                  <CopyOutlined
                    className="cursor-pointer"
                    onClick={handleCopy}
                  />
                )}
              </Tooltip>
            }
          />
          <Button
            icon={<CloudDownloadOutlined />}
            onClick={handleUnpublish}
            loading={loading}
          >
            取消发布
          </Button>
        </>
      ) : (
        <Button
          type="primary"
          icon={<CloudUploadOutlined />}
          onClick={handlePublish}
          loading={loading}
        >
          发布
        </Button>
      )}
    </Space>
  )
}
```

---

## 验证清单

### 后端验证

```bash
# 1. 测试本地执行
curl -X POST http://localhost:3000/invoke/hello \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "test"}'
# 期望: 返回函数执行结果

# 2. 测试发布
curl -X POST http://localhost:3000/api/functions/$FUNC_ID/publish \
  -H "Authorization: Bearer $TOKEN"
# 期望: { "success": true, "data": { "url": "/hello" } }

# 3. 测试公开访问
curl -X POST http://localhost:3000/hello \
  -H "Content-Type: application/json" \
  -d '{"name": "world"}'
# 期望: 返回函数执行结果 (无需 token)

# 4. 测试取消发布
curl -X POST http://localhost:3000/api/functions/$FUNC_ID/unpublish \
  -H "Authorization: Bearer $TOKEN"

# 5. 验证公开访问失败
curl http://localhost:3000/hello
# 期望: 404
```

### 前端验证

- [ ] 访问 IDE 页面显示三栏布局
- [ ] 左侧显示函数列表
- [ ] 点击函数切换编辑内容
- [ ] 搜索框可过滤函数
- [ ] 发布按钮点击后显示 URL
- [ ] URL 可复制

---

## 开发日志

| 日期 | 任务 | 完成情况 | 备注 |
|------|------|---------|------|
| - | - | - | - |
