# Sprint 2: 依赖与调试 - 任务清单

## 任务概览

| 任务 | 轨道 | 优先级 | 预估 | 状态 |
|------|------|-------|------|------|
| 2.1 NPM 操作服务 | 后端 | P0 | 2h | 待开始 |
| 2.2 依赖管理 API | 后端 | P0 | 2h | 待开始 |
| 2.3 启动依赖恢复 | 后端 | P0 | 1h | 待开始 |
| 2.4 部署配置更新 | 后端 | P0 | 1h | 待开始 |
| 2.5 多标签编辑器 | 前端 | P0 | 2h | 待开始 |
| 2.6 Console 面板 | 前端 | P0 | 1h | 待开始 |
| 2.7 调试面板 | 前端 | P0 | 3h | 待开始 |
| 2.8 依赖面板交互 | 前端 | P0 | 2h | 待开始 |

---

## 后端任务

### 2.1 NPM 操作服务

**任务描述**：创建 NPM 包安装、卸载、版本查询服务。

**具体步骤**

- [ ] 创建 `src/services/npm.ts`：

```typescript
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface PackageInfo {
  name: string
  version: string
  description?: string
}

// 安装包
export async function installPackage(name: string, version: string): Promise<void> {
  const packageSpec = version ? `${name}@${version}` : name

  try {
    await execAsync(`npm install ${packageSpec} --save`, {
      cwd: process.cwd(),
      timeout: 120000, // 2分钟超时
      maxBuffer: 1024 * 1024 * 10, // 10MB
    })
  } catch (error: any) {
    throw new Error(`安装失败: ${error.stderr || error.message}`)
  }
}

// 卸载包
export async function uninstallPackage(name: string): Promise<void> {
  try {
    await execAsync(`npm uninstall ${name}`, {
      cwd: process.cwd(),
      timeout: 60000,
    })
  } catch (error: any) {
    throw new Error(`卸载失败: ${error.stderr || error.message}`)
  }
}

// 获取包的可用版本
export async function getPackageVersions(name: string): Promise<string[]> {
  try {
    const { stdout } = await execAsync(`npm view ${name} versions --json`, {
      timeout: 30000,
    })
    const versions = JSON.parse(stdout)
    // 返回最新的 20 个版本
    return Array.isArray(versions)
      ? versions.reverse().slice(0, 20)
      : [versions]
  } catch (error: any) {
    throw new Error(`查询失败: 包 ${name} 不存在`)
  }
}

// 获取包信息
export async function getPackageInfo(name: string): Promise<PackageInfo> {
  try {
    const { stdout } = await execAsync(
      `npm view ${name} name version description --json`,
      { timeout: 30000 }
    )
    return JSON.parse(stdout)
  } catch (error: any) {
    throw new Error(`包 ${name} 不存在`)
  }
}

// 检查包是否已安装
export function isPackageInstalled(name: string): boolean {
  try {
    require.resolve(name)
    return true
  } catch {
    return false
  }
}

// 搜索包
export async function searchPackages(query: string): Promise<PackageInfo[]> {
  try {
    const { stdout } = await execAsync(
      `npm search ${query} --json --long`,
      { timeout: 30000 }
    )
    const results = JSON.parse(stdout)
    return results.slice(0, 10).map((pkg: any) => ({
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
    }))
  } catch {
    return []
  }
}
```

---

### 2.2 依赖管理 API

**任务描述**：创建依赖 CRUD API。

**具体步骤**

- [ ] 创建 `src/routes/dependencies.ts`：

```typescript
import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { getDB } from '../db'
import { authMiddleware } from '../middleware/auth'
import * as npmService from '../services/npm'

const router = Router()

// 获取依赖列表
router.get('/', authMiddleware, async (req, res) => {
  const db = getDB()
  const deps = await db.collection('dependencies')
    .find({ userId: new ObjectId(req.user.userId) })
    .sort({ createdAt: -1 })
    .toArray()

  res.json({ success: true, data: deps })
})

// 添加依赖
router.post('/', authMiddleware, async (req, res) => {
  const { name, version } = req.body
  const db = getDB()

  // 检查是否已存在
  const existing = await db.collection('dependencies').findOne({
    name,
    userId: new ObjectId(req.user.userId)
  })

  if (existing) {
    return res.status(400).json({
      success: false,
      error: { code: 'DEPENDENCY_EXISTS', message: '依赖已存在' }
    })
  }

  // 插入记录
  const result = await db.collection('dependencies').insertOne({
    name,
    version: version || 'latest',
    status: 'installing',
    userId: new ObjectId(req.user.userId),
    createdAt: new Date()
  })

  const depId = result.insertedId

  // 返回响应，后台安装
  res.json({
    success: true,
    data: { _id: depId, name, version, status: 'installing' }
  })

  // 异步安装
  try {
    await npmService.installPackage(name, version)
    await db.collection('dependencies').updateOne(
      { _id: depId },
      {
        $set: {
          status: 'installed',
          installedAt: new Date()
        }
      }
    )
  } catch (error: any) {
    await db.collection('dependencies').updateOne(
      { _id: depId },
      {
        $set: {
          status: 'failed',
          error: error.message
        }
      }
    )
  }
})

// 获取依赖状态
router.get('/:name/status', authMiddleware, async (req, res) => {
  const db = getDB()
  const dep = await db.collection('dependencies').findOne({
    name: req.params.name,
    userId: new ObjectId(req.user.userId)
  })

  if (!dep) {
    return res.status(404).json({
      success: false,
      error: { code: 'DEPENDENCY_NOT_FOUND' }
    })
  }

  res.json({ success: true, data: dep })
})

// 删除依赖
router.delete('/:name', authMiddleware, async (req, res) => {
  const db = getDB()

  // 删除数据库记录
  await db.collection('dependencies').deleteOne({
    name: req.params.name,
    userId: new ObjectId(req.user.userId)
  })

  // 卸载包
  try {
    await npmService.uninstallPackage(req.params.name)
  } catch (error) {
    // 忽略卸载错误
  }

  res.json({ success: true })
})

// 获取包的可用版本
router.get('/:name/versions', authMiddleware, async (req, res) => {
  try {
    const versions = await npmService.getPackageVersions(req.params.name)
    res.json({ success: true, data: versions })
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message }
    })
  }
})

// 搜索包
router.get('/search', authMiddleware, async (req, res) => {
  const query = req.query.q as string
  if (!query) {
    return res.json({ success: true, data: [] })
  }

  const results = await npmService.searchPackages(query)
  res.json({ success: true, data: results })
})

export default router
```

- [ ] 在 `src/index.ts` 注册路由：

```typescript
import dependenciesRouter from './routes/dependencies'
app.use('/api/dependencies', dependenciesRouter)
```

---

### 2.3 启动依赖恢复

**任务描述**：服务启动时自动恢复数据库中记录的依赖。

**具体步骤**

- [ ] 在 `src/index.ts` 添加恢复逻辑：

```typescript
import * as npmService from './services/npm'

async function restoreDependencies() {
  const db = getDB()
  const deps = await db.collection('dependencies')
    .find({ status: 'installed' })
    .toArray()

  console.log(`检查 ${deps.length} 个依赖...`)

  for (const dep of deps) {
    if (!npmService.isPackageInstalled(dep.name)) {
      console.log(`恢复依赖: ${dep.name}@${dep.version}`)
      try {
        await npmService.installPackage(dep.name, dep.version)
        console.log(`  ✓ ${dep.name} 安装成功`)
      } catch (error: any) {
        console.error(`  ✗ ${dep.name} 安装失败: ${error.message}`)
        // 更新状态为失败
        await db.collection('dependencies').updateOne(
          { _id: dep._id },
          { $set: { status: 'failed', error: error.message } }
        )
      }
    }
  }
}

// 启动流程
async function main() {
  await connectDB()
  await restoreDependencies()

  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`)
  })
}

main().catch(console.error)
```

---

### 2.4 部署配置更新

**任务描述**：更新 Dockerfile 和创建 docker-compose.yml。

**具体步骤**

- [ ] 更新 `Dockerfile`：

```dockerfile
# Build stage - 前端
FROM node:22-alpine AS web-builder

WORKDIR /app/web
COPY web/package.json web/pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY web/ .
RUN pnpm build

# Build stage - 后端
FROM node:22-alpine AS server-builder

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY src/ ./src/
COPY tsconfig.json ./
RUN pnpm build

# Production stage
FROM node:22-alpine

WORKDIR /app

# 安装 git (用于 Git 同步功能)
RUN apk add --no-cache git

# 安装 LSP
RUN npm install -g typescript typescript-language-server

# 复制后端构建产物
COPY --from=server-builder /app/dist ./dist
COPY --from=server-builder /app/node_modules ./node_modules
COPY --from=server-builder /app/package.json ./

# 复制前端构建产物
COPY --from=web-builder /app/web/dist ./public

# 声明 node_modules 卷
VOLUME ["/app/node_modules"]

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

- [ ] 创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  simple-ide:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - node_modules:/app/node_modules
    environment:
      - MONGO_URL=mongodb://mongo:27017/simple-ide
      - JWT_SECRET=${JWT_SECRET:-dev-secret-change-in-production}
      - S3_ENDPOINT=${S3_ENDPOINT}
      - S3_ACCESS_KEY=${S3_ACCESS_KEY}
      - S3_SECRET_KEY=${S3_SECRET_KEY}
      - S3_BUCKET=${S3_BUCKET}
    depends_on:
      - mongo
    restart: unless-stopped

  mongo:
    image: mongo:7
    volumes:
      - mongo_data:/data/db
    restart: unless-stopped

volumes:
  node_modules:
  mongo_data:
```

- [ ] 更新 `.env.example`：

```bash
# MongoDB
MONGO_URL=mongodb://localhost:27017/simple-ide

# JWT (必须修改!)
JWT_SECRET=your-secure-random-string

# S3 存储 (可选)
S3_ENDPOINT=https://your-s3-endpoint.com
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET=your-bucket

# 已移除 (不再需要)
# SANDBOX_URL
# SANDBOX_API_KEY
```

---

## 前端任务

### 2.5 多标签编辑器

**任务描述**：实现多标签页管理多个打开的函数。

**具体步骤**

- [ ] 创建 `web/src/components/EditorTabs.tsx`：

```tsx
import React from 'react'
import { Tabs } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import MonacoEditor from '@monaco-editor/react'

interface OpenFunction {
  _id: string
  name: string
  code: string
  modified: boolean
}

interface EditorTabsProps {
  openFunctions: OpenFunction[]
  activeId: string
  onTabChange: (id: string) => void
  onTabClose: (id: string) => void
  onCodeChange: (id: string, code: string) => void
}

export function EditorTabs({
  openFunctions,
  activeId,
  onTabChange,
  onTabClose,
  onCodeChange
}: EditorTabsProps) {
  const items = openFunctions.map(func => ({
    key: func._id,
    label: (
      <span className="flex items-center gap-1">
        {func.modified && <span className="text-orange-400">●</span>}
        {func.name}
      </span>
    ),
    children: (
      <div className="h-full">
        <MonacoEditor
          height="100%"
          language="typescript"
          theme="vs-dark"
          value={func.code}
          onChange={(value) => onCodeChange(func._id, value || '')}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            tabSize: 2,
            automaticLayout: true,
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    ),
    closable: true,
  }))

  return (
    <Tabs
      type="editable-card"
      activeKey={activeId}
      onChange={onTabChange}
      onEdit={(targetKey, action) => {
        if (action === 'remove' && typeof targetKey === 'string') {
          onTabClose(targetKey)
        }
      }}
      items={items}
      hideAdd
      className="editor-tabs h-full"
    />
  )
}
```

---

### 2.6 Console 面板

**任务描述**：创建底部 Console 日志输出面板。

**具体步骤**

- [ ] 创建 `web/src/components/ConsolePanel.tsx`：

```tsx
import React, { useRef, useEffect } from 'react'
import { Button, Collapse } from 'antd'
import { ClearOutlined } from '@ant-design/icons'

interface ConsolePanelProps {
  logs: string[]
  onClear: () => void
}

export function ConsolePanel({ logs, onClear }: ConsolePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs])

  return (
    <Collapse
      defaultActiveKey={['console']}
      className="console-collapse"
      items={[
        {
          key: 'console',
          label: (
            <div className="flex items-center justify-between w-full">
              <span>Console</span>
              <span className="text-gray-500 text-xs">{logs.length} 条日志</span>
            </div>
          ),
          extra: (
            <Button
              type="text"
              size="small"
              icon={<ClearOutlined />}
              onClick={(e) => {
                e.stopPropagation()
                onClear()
              }}
            />
          ),
          children: (
            <div
              ref={containerRef}
              className="h-32 overflow-auto bg-gray-900 p-2 font-mono text-sm"
            >
              {logs.length === 0 ? (
                <div className="text-gray-500">暂无日志输出</div>
              ) : (
                logs.map((log, index) => (
                  <div
                    key={index}
                    className={`${
                      log.startsWith('[ERROR]')
                        ? 'text-red-400'
                        : log.startsWith('[WARN]')
                        ? 'text-yellow-400'
                        : 'text-green-400'
                    }`}
                  >
                    {log}
                  </div>
                ))
              )}
            </div>
          ),
        },
      ]}
    />
  )
}
```

---

### 2.7 调试面板

**任务描述**：创建右侧调试面板，支持请求参数设置和运行。

**具体步骤**

- [ ] 创建 `web/src/components/DebugPanel.tsx`：

```tsx
import React, { useState } from 'react'
import { Button, Select, Tabs, Input, message, Spin } from 'antd'
import { PlayCircleOutlined } from '@ant-design/icons'
import MonacoEditor from '@monaco-editor/react'
import { api } from '../api'

interface DebugPanelProps {
  functionName: string
  published: boolean
  onLogsReceived: (logs: string[]) => void
}

export function DebugPanel({
  functionName,
  published,
  onLogsReceived
}: DebugPanelProps) {
  const [method, setMethod] = useState('POST')
  const [queryParams, setQueryParams] = useState('')
  const [bodyContent, setBodyContent] = useState('{\n  \n}')
  const [headers, setHeaders] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [execTime, setExecTime] = useState<number | null>(null)
  const [statusCode, setStatusCode] = useState<number | null>(null)

  const handleRun = async () => {
    setLoading(true)
    setResult('')
    setExecTime(null)
    setStatusCode(null)

    try {
      // 解析 query 参数
      const queryObj: Record<string, string> = {}
      queryParams.split('\n').forEach(line => {
        const [key, value] = line.split('=').map(s => s.trim())
        if (key && value) queryObj[key] = value
      })

      // 解析 headers
      const headersObj: Record<string, string> = {}
      headers.split('\n').forEach(line => {
        const [key, value] = line.split(':').map(s => s.trim())
        if (key && value) headersObj[key] = value
      })

      // 解析 body
      let body = undefined
      if (method !== 'GET' && bodyContent.trim()) {
        try {
          body = JSON.parse(bodyContent)
        } catch {
          message.error('Body JSON 格式错误')
          setLoading(false)
          return
        }
      }

      // 调用函数
      const response = await api.request({
        method: method as any,
        url: `/invoke/${functionName}`,
        params: queryObj,
        data: body,
        headers: headersObj,
      })

      setStatusCode(response.status)
      setExecTime(response.data.time)
      setResult(JSON.stringify(response.data.data, null, 2))

      // 传递日志
      if (response.data.logs) {
        onLogsReceived(response.data.logs)
      }
    } catch (error: any) {
      setStatusCode(error.response?.status || 500)
      setResult(JSON.stringify(
        error.response?.data || { error: error.message },
        null,
        2
      ))
      if (error.response?.data?.logs) {
        onLogsReceived(error.response.data.logs)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* 运行控制 */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <Select
            value={method}
            onChange={setMethod}
            style={{ width: 100 }}
            options={[
              { value: 'GET', label: 'GET' },
              { value: 'POST', label: 'POST' },
              { value: 'PUT', label: 'PUT' },
              { value: 'DELETE', label: 'DELETE' },
              { value: 'PATCH', label: 'PATCH' },
            ]}
          />
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleRun}
            loading={loading}
            className="flex-1"
          >
            运行
          </Button>
        </div>
        {published && (
          <div className="text-xs text-gray-500">
            公开地址: {window.location.origin}/{functionName}
          </div>
        )}
      </div>

      {/* 参数设置 */}
      <div className="flex-1 overflow-hidden">
        <Tabs
          size="small"
          className="h-full debug-tabs"
          items={[
            {
              key: 'query',
              label: 'Query',
              children: (
                <Input.TextArea
                  value={queryParams}
                  onChange={e => setQueryParams(e.target.value)}
                  placeholder="key=value&#10;key2=value2"
                  className="h-full font-mono text-sm"
                  style={{ resize: 'none' }}
                />
              ),
            },
            {
              key: 'body',
              label: 'Body',
              children: (
                <MonacoEditor
                  height="100%"
                  language="json"
                  theme="vs-dark"
                  value={bodyContent}
                  onChange={(v) => setBodyContent(v || '')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 12,
                    lineNumbers: 'off',
                    scrollBeyondLastLine: false,
                  }}
                />
              ),
            },
            {
              key: 'headers',
              label: 'Headers',
              children: (
                <Input.TextArea
                  value={headers}
                  onChange={e => setHeaders(e.target.value)}
                  placeholder="Content-Type: application/json&#10;X-Custom: value"
                  className="h-full font-mono text-sm"
                  style={{ resize: 'none' }}
                />
              ),
            },
          ]}
        />
      </div>

      {/* 运行结果 */}
      <div className="border-t border-gray-700">
        <div className="p-2 flex items-center justify-between border-b border-gray-700">
          <span className="text-gray-400 text-sm">运行结果</span>
          {statusCode !== null && (
            <span className="text-xs">
              <span className={statusCode < 400 ? 'text-green-400' : 'text-red-400'}>
                {statusCode}
              </span>
              {execTime !== null && (
                <span className="text-gray-500 ml-2">{execTime}ms</span>
              )}
            </span>
          )}
        </div>
        <div className="h-48">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Spin />
            </div>
          ) : (
            <MonacoEditor
              height="100%"
              language="json"
              theme="vs-dark"
              value={result}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 12,
                lineNumbers: 'off',
                scrollBeyondLastLine: false,
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
```

---

### 2.8 依赖面板交互

**任务描述**：完善依赖面板，添加添加/删除依赖交互。

**具体步骤**

- [ ] 更新 `web/src/components/DependencyPanel.tsx`：

```tsx
import React, { useState, useEffect } from 'react'
import {
  Collapse, Tabs, List, Button, Modal, Input, Select, message, Spin, Tag
} from 'antd'
import {
  PlusOutlined, AppstoreOutlined, DeleteOutlined, ReloadOutlined
} from '@ant-design/icons'
import { api } from '../api'

interface Dependency {
  _id: string
  name: string
  version: string
  status: 'pending' | 'installing' | 'installed' | 'failed'
  error?: string
}

export function DependencyPanel() {
  const [deps, setDeps] = useState<Dependency[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [packageName, setPackageName] = useState('')
  const [packageVersion, setPackageVersion] = useState('')
  const [versions, setVersions] = useState<string[]>([])
  const [installing, setInstalling] = useState(false)

  // 内置依赖
  const builtinDeps = [
    { name: 'lodash', version: '4.17.21' },
    { name: 'axios', version: '1.6.0' },
    { name: 'dayjs', version: '1.11.10' },
    { name: 'uuid', version: '9.0.0' },
  ]

  // 加载依赖列表
  const loadDeps = async () => {
    try {
      const res = await api.get('/api/dependencies')
      setDeps(res.data.data)
    } catch (error) {
      message.error('加载依赖失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDeps()
    // 轮询更新安装中的依赖状态
    const interval = setInterval(() => {
      if (deps.some(d => d.status === 'installing')) {
        loadDeps()
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [deps])

  // 查询版本
  const handlePackageNameChange = async (name: string) => {
    setPackageName(name)
    setVersions([])
    setPackageVersion('')

    if (name.length > 2) {
      try {
        const res = await api.get(`/api/dependencies/${name}/versions`)
        setVersions(res.data.data)
      } catch {
        // 忽略
      }
    }
  }

  // 添加依赖
  const handleAdd = async () => {
    if (!packageName) {
      message.error('请输入包名')
      return
    }

    setInstalling(true)
    try {
      await api.post('/api/dependencies', {
        name: packageName,
        version: packageVersion || 'latest'
      })
      message.success('正在安装...')
      setModalOpen(false)
      setPackageName('')
      setPackageVersion('')
      loadDeps()
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '添加失败')
    } finally {
      setInstalling(false)
    }
  }

  // 删除依赖
  const handleDelete = async (name: string) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除依赖 ${name} 吗？`,
      onOk: async () => {
        try {
          await api.delete(`/api/dependencies/${name}`)
          message.success('已删除')
          loadDeps()
        } catch {
          message.error('删除失败')
        }
      }
    })
  }

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'installed':
        return <Tag color="success">已安装</Tag>
      case 'installing':
        return <Tag color="processing">安装中</Tag>
      case 'failed':
        return <Tag color="error">失败</Tag>
      default:
        return <Tag>等待中</Tag>
    }
  }

  return (
    <div className="border-t border-gray-700">
      <Collapse
        ghost
        defaultActiveKey={['deps']}
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
                setModalOpen(true)
              }}
            />
          }
        >
          {loading ? (
            <div className="py-4 text-center">
              <Spin size="small" />
            </div>
          ) : (
            <Tabs
              size="small"
              items={[
                {
                  key: 'custom',
                  label: `自定义 ${deps.length}`,
                  children: deps.length === 0 ? (
                    <div className="text-gray-500 text-center py-4">
                      暂无自定义依赖
                    </div>
                  ) : (
                    <List
                      size="small"
                      dataSource={deps}
                      renderItem={dep => (
                        <List.Item className="px-0 py-1 flex justify-between">
                          <div>
                            <span className="text-gray-300">{dep.name}</span>
                            <span className="text-gray-500 text-xs ml-2">
                              {dep.version}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusTag(dep.status)}
                            <DeleteOutlined
                              className="text-gray-500 hover:text-red-400 cursor-pointer"
                              onClick={() => handleDelete(dep.name)}
                            />
                          </div>
                        </List.Item>
                      )}
                    />
                  ),
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
                  ),
                },
              ]}
            />
          )}
        </Collapse.Panel>
      </Collapse>

      {/* 添加依赖弹窗 */}
      <Modal
        title="添加依赖"
        open={modalOpen}
        onOk={handleAdd}
        onCancel={() => setModalOpen(false)}
        confirmLoading={installing}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1">包名</label>
            <Input
              placeholder="例如: lodash"
              value={packageName}
              onChange={e => handlePackageNameChange(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">版本</label>
            <Select
              style={{ width: '100%' }}
              placeholder="选择版本 (默认 latest)"
              value={packageVersion}
              onChange={setPackageVersion}
              options={[
                { value: '', label: 'latest (最新)' },
                ...versions.map(v => ({ value: v, label: v }))
              ]}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
```

---

## 验证清单

### 后端验证

```bash
# 1. 添加依赖
curl -X POST http://localhost:3000/api/dependencies \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "pg", "version": "8.11.0"}'
# 期望: { "success": true, "data": { "status": "installing" } }

# 2. 查询状态
curl http://localhost:3000/api/dependencies/pg/status \
  -H "Authorization: Bearer $TOKEN"
# 期望: status 变为 "installed"

# 3. 列表依赖
curl http://localhost:3000/api/dependencies \
  -H "Authorization: Bearer $TOKEN"

# 4. 在函数中使用
# 创建使用 pg 的函数，执行应成功

# 5. 删除依赖
curl -X DELETE http://localhost:3000/api/dependencies/pg \
  -H "Authorization: Bearer $TOKEN"

# 6. 测试 docker-compose
docker-compose up -d
docker-compose logs -f simple-ide
```

### 前端验证

- [ ] 多标签打开多个函数
- [ ] 切换标签编辑不同函数
- [ ] 关闭标签
- [ ] Console 显示执行日志
- [ ] 清空 Console
- [ ] 切换请求方法
- [ ] 编辑 Query 参数
- [ ] 编辑 Body JSON
- [ ] 编辑 Headers
- [ ] 运行按钮执行函数
- [ ] 显示状态码和耗时
- [ ] 依赖面板添加依赖
- [ ] 显示安装状态
- [ ] 删除依赖

---

## 开发日志

| 日期 | 任务 | 完成情况 | 备注 |
|------|------|---------|------|
| - | - | - | - |
