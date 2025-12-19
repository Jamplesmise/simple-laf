# Sprint 3: 版本与环境 - 任务清单

## 任务概览

| 任务 | 轨道 | 优先级 | 预估 | 状态 |
|------|------|-------|------|------|
| 3.1 版本管理服务 | 后端 | P0 | 2h | 待开始 |
| 3.2 版本 API | 后端 | P0 | 2h | 待开始 |
| 3.3 环境变量服务 | 后端 | P0 | 1.5h | 待开始 |
| 3.4 环境变量注入 | 后端 | P0 | 1h | 待开始 |
| 3.5 发布弹窗 | 前端 | P0 | 2h | 待开始 |
| 3.6 Diff 对比组件 | 前端 | P0 | 1h | 待开始 |
| 3.7 版本历史面板 | 前端 | P0 | 2h | 待开始 |
| 3.8 环境变量管理 | 前端 | P0 | 2h | 待开始 |

---

## 后端任务

### 3.1 版本管理服务

**任务描述**：创建版本管理服务，处理版本保存和查询。

**具体步骤**

- [ ] 创建 `src/services/version.ts`：

```typescript
import { ObjectId } from 'mongodb'
import { getDB } from '../db'

export interface FunctionVersion {
  _id: ObjectId
  functionId: ObjectId
  version: number
  code: string
  compiled: string
  changelog: string
  userId: ObjectId
  createdAt: Date
}

// 创建新版本
export async function createVersion(
  functionId: ObjectId,
  code: string,
  compiled: string,
  changelog: string,
  userId: ObjectId
): Promise<FunctionVersion> {
  const db = getDB()

  // 获取当前最大版本号
  const latest = await db.collection('function_versions')
    .findOne(
      { functionId },
      { sort: { version: -1 } }
    )

  const nextVersion = (latest?.version || 0) + 1

  const version: Partial<FunctionVersion> = {
    functionId,
    version: nextVersion,
    code,
    compiled,
    changelog,
    userId,
    createdAt: new Date()
  }

  const result = await db.collection('function_versions').insertOne(version)
  version._id = result.insertedId

  // 更新函数的版本信息
  await db.collection('functions').updateOne(
    { _id: functionId },
    {
      $set: {
        currentVersion: nextVersion,
        publishedVersion: nextVersion,
        published: true,
        publishedAt: new Date(),
        updatedAt: new Date()
      }
    }
  )

  return version as FunctionVersion
}

// 获取版本列表
export async function getVersions(functionId: ObjectId): Promise<FunctionVersion[]> {
  const db = getDB()
  return db.collection('function_versions')
    .find({ functionId })
    .sort({ version: -1 })
    .toArray() as Promise<FunctionVersion[]>
}

// 获取指定版本
export async function getVersion(
  functionId: ObjectId,
  version: number
): Promise<FunctionVersion | null> {
  const db = getDB()
  return db.collection('function_versions').findOne({
    functionId,
    version
  }) as Promise<FunctionVersion | null>
}

// 获取最新版本
export async function getLatestVersion(
  functionId: ObjectId
): Promise<FunctionVersion | null> {
  const db = getDB()
  return db.collection('function_versions')
    .findOne(
      { functionId },
      { sort: { version: -1 } }
    ) as Promise<FunctionVersion | null>
}

// 回滚到指定版本
export async function rollbackToVersion(
  functionId: ObjectId,
  targetVersion: number,
  userId: ObjectId
): Promise<FunctionVersion> {
  const db = getDB()

  // 获取目标版本
  const targetVersionDoc = await getVersion(functionId, targetVersion)
  if (!targetVersionDoc) {
    throw new Error('版本不存在')
  }

  // 更新函数代码
  await db.collection('functions').updateOne(
    { _id: functionId },
    {
      $set: {
        code: targetVersionDoc.code,
        compiled: targetVersionDoc.compiled,
        publishedVersion: targetVersion,
        updatedAt: new Date()
      }
    }
  )

  // 创建回滚记录 (作为新版本)
  return createVersion(
    functionId,
    targetVersionDoc.code,
    targetVersionDoc.compiled,
    `回滚到 v${targetVersion}`,
    userId
  )
}
```

---

### 3.2 版本 API

**任务描述**：创建版本相关的 API 端点。

**具体步骤**

- [ ] 修改 `src/routes/functions.ts`，添加版本 API：

```typescript
import * as versionService from '../services/version'
import { compileTypeScript } from '../services/compiler'

// 发布函数 (创建新版本)
router.post('/:id/publish', authMiddleware, async (req, res) => {
  const { changelog } = req.body
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

  // 编译代码
  let compiled = func.compiled
  if (!compiled || func.code !== func.lastCompiledCode) {
    try {
      compiled = compileTypeScript(func.code)
      await db.collection('functions').updateOne(
        { _id: func._id },
        { $set: { compiled, lastCompiledCode: func.code } }
      )
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: { code: 'COMPILE_ERROR', message: error.message }
      })
    }
  }

  // 创建版本
  const version = await versionService.createVersion(
    func._id,
    func.code,
    compiled,
    changelog || '无变更日志',
    new ObjectId(req.user.userId)
  )

  res.json({
    success: true,
    data: {
      version: version.version,
      url: `/${func.name}`,
      publishedAt: version.createdAt
    }
  })
})

// 获取版本列表
router.get('/:id/versions', authMiddleware, async (req, res) => {
  const { ObjectId } = require('mongodb')
  const db = getDB()

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

  const versions = await versionService.getVersions(func._id)

  res.json({
    success: true,
    data: versions.map(v => ({
      version: v.version,
      changelog: v.changelog,
      createdAt: v.createdAt
    }))
  })
})

// 获取指定版本详情
router.get('/:id/versions/:version', authMiddleware, async (req, res) => {
  const { ObjectId } = require('mongodb')
  const db = getDB()

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

  const version = await versionService.getVersion(
    func._id,
    parseInt(req.params.version)
  )

  if (!version) {
    return res.status(404).json({
      success: false,
      error: { code: 'VERSION_NOT_FOUND' }
    })
  }

  res.json({
    success: true,
    data: {
      version: version.version,
      code: version.code,
      changelog: version.changelog,
      createdAt: version.createdAt
    }
  })
})

// 版本对比
router.get('/:id/versions/diff', authMiddleware, async (req, res) => {
  const { ObjectId } = require('mongodb')
  const { from, to } = req.query
  const db = getDB()

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

  const fromVersion = await versionService.getVersion(func._id, parseInt(from as string))
  const toVersion = await versionService.getVersion(func._id, parseInt(to as string))

  if (!fromVersion || !toVersion) {
    return res.status(404).json({
      success: false,
      error: { code: 'VERSION_NOT_FOUND' }
    })
  }

  res.json({
    success: true,
    data: {
      from: {
        version: fromVersion.version,
        code: fromVersion.code,
        changelog: fromVersion.changelog
      },
      to: {
        version: toVersion.version,
        code: toVersion.code,
        changelog: toVersion.changelog
      }
    }
  })
})

// 回滚
router.post('/:id/rollback', authMiddleware, async (req, res) => {
  const { version } = req.body
  const { ObjectId } = require('mongodb')
  const db = getDB()

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

  try {
    const newVersion = await versionService.rollbackToVersion(
      func._id,
      version,
      new ObjectId(req.user.userId)
    )

    res.json({
      success: true,
      data: {
        version: newVersion.version,
        message: `已回滚到 v${version}`
      }
    })
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message }
    })
  }
})
```

---

### 3.3 环境变量服务

**任务描述**：创建环境变量管理服务，支持加密存储。

**具体步骤**

- [ ] 安装加密依赖：

```bash
pnpm add crypto-js
pnpm add -D @types/crypto-js
```

- [ ] 创建 `src/services/env.ts`：

```typescript
import { ObjectId } from 'mongodb'
import CryptoJS from 'crypto-js'
import { getDB } from '../db'
import { config } from '../config'

// 加密密钥 (使用 JWT secret)
const ENCRYPTION_KEY = config.jwtSecret

// 加密
function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString()
}

// 解密
function decrypt(ciphertext: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY)
  return bytes.toString(CryptoJS.enc.Utf8)
}

export interface EnvVariable {
  _id: ObjectId
  key: string
  value: string
  description?: string
  userId: ObjectId
  createdAt: Date
  updatedAt: Date
}

// 获取环境变量列表 (不返回值)
export async function listEnvVariables(userId: ObjectId): Promise<Array<{
  key: string
  description?: string
  hasValue: boolean
}>> {
  const db = getDB()
  const envs = await db.collection('env_variables')
    .find({ userId })
    .toArray()

  return envs.map(env => ({
    key: env.key,
    description: env.description,
    hasValue: !!env.value
  }))
}

// 获取所有环境变量 (解密后的值)
export async function getEnvVariables(userId: ObjectId): Promise<Record<string, string>> {
  const db = getDB()
  const envs = await db.collection('env_variables')
    .find({ userId })
    .toArray()

  const result: Record<string, string> = {}
  for (const env of envs) {
    result[env.key] = decrypt(env.value)
  }
  return result
}

// 设置环境变量
export async function setEnvVariable(
  userId: ObjectId,
  key: string,
  value: string,
  description?: string
): Promise<void> {
  const db = getDB()

  await db.collection('env_variables').updateOne(
    { userId, key },
    {
      $set: {
        value: encrypt(value),
        description,
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    { upsert: true }
  )
}

// 删除环境变量
export async function deleteEnvVariable(
  userId: ObjectId,
  key: string
): Promise<void> {
  const db = getDB()
  await db.collection('env_variables').deleteOne({ userId, key })
}
```

- [ ] 创建 `src/routes/env.ts`：

```typescript
import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { authMiddleware } from '../middleware/auth'
import * as envService from '../services/env'

const router = Router()

// 获取环境变量列表
router.get('/', authMiddleware, async (req, res) => {
  const envs = await envService.listEnvVariables(
    new ObjectId(req.user.userId)
  )
  res.json({ success: true, data: envs })
})

// 设置环境变量
router.put('/:key', authMiddleware, async (req, res) => {
  const { value, description } = req.body
  const { key } = req.params

  if (!value) {
    return res.status(400).json({
      success: false,
      error: { message: '值不能为空' }
    })
  }

  await envService.setEnvVariable(
    new ObjectId(req.user.userId),
    key,
    value,
    description
  )

  res.json({ success: true })
})

// 删除环境变量
router.delete('/:key', authMiddleware, async (req, res) => {
  await envService.deleteEnvVariable(
    new ObjectId(req.user.userId),
    req.params.key
  )
  res.json({ success: true })
})

export default router
```

- [ ] 在 `src/index.ts` 注册路由：

```typescript
import envRouter from './routes/env'
app.use('/api/env', envRouter)
```

---

### 3.4 环境变量注入

**任务描述**：修改执行引擎，注入用户环境变量。

**具体步骤**

- [ ] 修改 `src/services/executor.ts`：

```typescript
import * as envService from './env'

export async function executeFunction(
  code: string,
  ctx: FunctionContext,
  cloud: any,
  userId: ObjectId
): Promise<ExecuteResult> {
  const startTime = Date.now()
  const logs: string[] = []

  // 获取用户环境变量
  const userEnv = await envService.getEnvVariables(userId)

  const customConsole = {
    // ... 同前
  }

  // 扩展 cloud 对象
  const extendedCloud = {
    ...cloud,
    env: userEnv,  // cloud.env.XXX
  }

  const sandbox = {
    module: { exports: {} },
    exports: {},
    require,
    console: customConsole,
    cloud: extendedCloud,
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
    // 注入 process.env
    process: {
      env: {
        ...process.env,
        ...userEnv,  // 用户环境变量覆盖
      }
    },
  }

  // ... 执行代码
}
```

- [ ] 修改调用路由传递 userId：

```typescript
// src/routes/invoke.ts
const result = await executeFunction(
  func.compiled,
  ctx,
  createCloud(req.user.userId),
  new ObjectId(req.user.userId)  // 传递 userId
)

// src/routes/public.ts
const result = await executeFunction(
  func.compiled,
  ctx,
  createCloud(func.userId),
  func.userId  // 传递 userId
)
```

---

## 前端任务

### 3.5 发布弹窗

**任务描述**：创建发布弹窗，显示 Diff 对比和变更日志编辑。

**具体步骤**

- [ ] 安装 diff 库：

```bash
cd web
pnpm add react-diff-viewer-continued
```

- [ ] 创建 `web/src/components/PublishModal.tsx`：

```tsx
import React, { useState, useEffect } from 'react'
import { Modal, Input, Button, Spin, message } from 'antd'
import ReactDiffViewer from 'react-diff-viewer-continued'
import { api } from '../api'

interface PublishModalProps {
  open: boolean
  functionId: string
  functionName: string
  currentCode: string
  onClose: () => void
  onPublished: (version: number) => void
}

export function PublishModal({
  open,
  functionId,
  functionName,
  currentCode,
  onClose,
  onPublished
}: PublishModalProps) {
  const [changelog, setChangelog] = useState('')
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [lastPublishedCode, setLastPublishedCode] = useState('')
  const [currentVersion, setCurrentVersion] = useState(0)

  // 加载最新发布版本的代码
  useEffect(() => {
    if (open) {
      loadLastVersion()
    }
  }, [open, functionId])

  const loadLastVersion = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/functions/${functionId}/versions`)
      const versions = res.data.data
      if (versions.length > 0) {
        setCurrentVersion(versions[0].version)
        const detailRes = await api.get(
          `/api/functions/${functionId}/versions/${versions[0].version}`
        )
        setLastPublishedCode(detailRes.data.data.code)
      } else {
        setLastPublishedCode('')
        setCurrentVersion(0)
      }
    } catch (error) {
      setLastPublishedCode('')
    } finally {
      setLoading(false)
    }
  }

  const handlePublish = async () => {
    setPublishing(true)
    try {
      const res = await api.post(`/api/functions/${functionId}/publish`, {
        changelog: changelog || '无变更日志'
      })
      message.success(`发布成功，版本 v${res.data.data.version}`)
      onPublished(res.data.data.version)
      onClose()
      setChangelog('')
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '发布失败')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <Modal
      title={`发布 ${functionName}`}
      open={open}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="publish"
          type="primary"
          loading={publishing}
          onClick={handlePublish}
        >
          确认发布
        </Button>
      ]}
    >
      {loading ? (
        <div className="py-8 text-center">
          <Spin />
        </div>
      ) : (
        <>
          {/* 版本信息 */}
          <div className="mb-4 text-gray-500">
            当前版本: v{currentVersion} → v{currentVersion + 1}
          </div>

          {/* Diff 对比 */}
          <div className="mb-4 border rounded overflow-hidden" style={{ maxHeight: 400 }}>
            <ReactDiffViewer
              oldValue={lastPublishedCode || '// 首次发布'}
              newValue={currentCode}
              splitView={true}
              useDarkTheme={true}
              leftTitle={`v${currentVersion || '无'}`}
              rightTitle="当前代码"
            />
          </div>

          {/* 变更日志 */}
          <div>
            <label className="block mb-2 font-medium">变更日志</label>
            <Input.TextArea
              value={changelog}
              onChange={e => setChangelog(e.target.value)}
              placeholder="描述本次发布的变更内容..."
              rows={3}
            />
          </div>
        </>
      )}
    </Modal>
  )
}
```

---

### 3.6 Diff 对比组件

**任务描述**：创建独立的 Diff 对比组件，用于版本历史对比。

**具体步骤**

- [ ] 创建 `web/src/components/DiffViewer.tsx`：

```tsx
import React from 'react'
import ReactDiffViewer from 'react-diff-viewer-continued'

interface DiffViewerProps {
  oldCode: string
  newCode: string
  oldTitle?: string
  newTitle?: string
  splitView?: boolean
}

export function DiffViewer({
  oldCode,
  newCode,
  oldTitle = '旧版本',
  newTitle = '新版本',
  splitView = true
}: DiffViewerProps) {
  return (
    <div className="diff-viewer-container">
      <ReactDiffViewer
        oldValue={oldCode}
        newValue={newCode}
        splitView={splitView}
        useDarkTheme={true}
        leftTitle={oldTitle}
        rightTitle={newTitle}
        styles={{
          variables: {
            dark: {
              diffViewerBackground: '#1e1e1e',
              gutterBackground: '#252525',
              addedBackground: '#1e3a1e',
              removedBackground: '#3a1e1e',
              wordAddedBackground: '#2e5e2e',
              wordRemovedBackground: '#5e2e2e',
            }
          }
        }}
      />
    </div>
  )
}
```

---

### 3.7 版本历史面板

**任务描述**：创建版本历史面板，支持查看、对比和回滚。

**具体步骤**

- [ ] 创建 `web/src/components/VersionHistory.tsx`：

```tsx
import React, { useState, useEffect } from 'react'
import { Drawer, List, Button, Tag, Modal, message, Spin, Select } from 'antd'
import {
  HistoryOutlined,
  EyeOutlined,
  DiffOutlined,
  RollbackOutlined
} from '@ant-design/icons'
import { DiffViewer } from './DiffViewer'
import { api } from '../api'
import dayjs from 'dayjs'

interface Version {
  version: number
  changelog: string
  createdAt: string
}

interface VersionHistoryProps {
  functionId: string
  currentVersion?: number
  publishedVersion?: number
  onRollback: () => void
}

export function VersionHistory({
  functionId,
  currentVersion,
  publishedVersion,
  onRollback
}: VersionHistoryProps) {
  const [open, setOpen] = useState(false)
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(false)

  // 查看版本
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [viewingVersion, setViewingVersion] = useState<{
    version: number
    code: string
    changelog: string
  } | null>(null)

  // 对比版本
  const [diffModalOpen, setDiffModalOpen] = useState(false)
  const [diffFrom, setDiffFrom] = useState<number | null>(null)
  const [diffTo, setDiffTo] = useState<number | null>(null)
  const [diffData, setDiffData] = useState<{
    from: { code: string; version: number }
    to: { code: string; version: number }
  } | null>(null)

  const loadVersions = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/functions/${functionId}/versions`)
      setVersions(res.data.data)
    } catch (error) {
      message.error('加载版本失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadVersions()
    }
  }, [open])

  // 查看版本
  const handleView = async (version: number) => {
    try {
      const res = await api.get(`/api/functions/${functionId}/versions/${version}`)
      setViewingVersion(res.data.data)
      setViewModalOpen(true)
    } catch (error) {
      message.error('加载版本失败')
    }
  }

  // 对比版本
  const handleCompare = async () => {
    if (!diffFrom || !diffTo) {
      message.warning('请选择要对比的版本')
      return
    }
    try {
      const res = await api.get(
        `/api/functions/${functionId}/versions/diff?from=${diffFrom}&to=${diffTo}`
      )
      setDiffData(res.data.data)
    } catch (error) {
      message.error('加载对比失败')
    }
  }

  // 回滚
  const handleRollback = (version: number) => {
    Modal.confirm({
      title: '确认回滚',
      content: `确定要回滚到 v${version} 吗？这将创建一个新版本。`,
      onOk: async () => {
        try {
          await api.post(`/api/functions/${functionId}/rollback`, { version })
          message.success(`已回滚到 v${version}`)
          loadVersions()
          onRollback()
        } catch (error) {
          message.error('回滚失败')
        }
      }
    })
  }

  return (
    <>
      <Button
        icon={<HistoryOutlined />}
        onClick={() => setOpen(true)}
      >
        版本历史
      </Button>

      <Drawer
        title="版本历史"
        open={open}
        onClose={() => setOpen(false)}
        width={400}
        extra={
          <Button type="link" onClick={() => setDiffModalOpen(true)}>
            版本对比
          </Button>
        }
      >
        {loading ? (
          <div className="py-8 text-center">
            <Spin />
          </div>
        ) : (
          <List
            dataSource={versions}
            renderItem={v => (
              <List.Item
                actions={[
                  <Button
                    type="text"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => handleView(v.version)}
                  />,
                  <Button
                    type="text"
                    size="small"
                    icon={<RollbackOutlined />}
                    onClick={() => handleRollback(v.version)}
                    disabled={v.version === publishedVersion}
                  />
                ]}
              >
                <List.Item.Meta
                  title={
                    <div className="flex items-center gap-2">
                      <span>v{v.version}</span>
                      {v.version === publishedVersion && (
                        <Tag color="green">当前</Tag>
                      )}
                    </div>
                  }
                  description={
                    <>
                      <div className="text-gray-400 text-xs">
                        {dayjs(v.createdAt).format('YYYY-MM-DD HH:mm')}
                      </div>
                      <div className="text-gray-500 text-sm truncate">
                        {v.changelog}
                      </div>
                    </>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>

      {/* 查看版本 */}
      <Modal
        title={`查看 v${viewingVersion?.version}`}
        open={viewModalOpen}
        onCancel={() => setViewModalOpen(false)}
        width={800}
        footer={null}
      >
        {viewingVersion && (
          <div>
            <div className="mb-2 text-gray-500">{viewingVersion.changelog}</div>
            <pre className="bg-gray-900 p-4 rounded overflow-auto max-h-96 text-sm">
              {viewingVersion.code}
            </pre>
          </div>
        )}
      </Modal>

      {/* 版本对比 */}
      <Modal
        title="版本对比"
        open={diffModalOpen}
        onCancel={() => {
          setDiffModalOpen(false)
          setDiffData(null)
        }}
        width={1000}
        footer={null}
      >
        <div className="flex gap-4 mb-4">
          <Select
            placeholder="选择旧版本"
            style={{ width: 150 }}
            value={diffFrom}
            onChange={setDiffFrom}
            options={versions.map(v => ({
              value: v.version,
              label: `v${v.version}`
            }))}
          />
          <span className="leading-8">→</span>
          <Select
            placeholder="选择新版本"
            style={{ width: 150 }}
            value={diffTo}
            onChange={setDiffTo}
            options={versions.map(v => ({
              value: v.version,
              label: `v${v.version}`
            }))}
          />
          <Button type="primary" onClick={handleCompare}>
            对比
          </Button>
        </div>
        {diffData && (
          <DiffViewer
            oldCode={diffData.from.code}
            newCode={diffData.to.code}
            oldTitle={`v${diffData.from.version}`}
            newTitle={`v${diffData.to.version}`}
          />
        )}
      </Modal>
    </>
  )
}
```

---

### 3.8 环境变量管理

**任务描述**：创建环境变量管理页面。

**具体步骤**

- [ ] 创建 `web/src/components/EnvManager.tsx`：

```tsx
import React, { useState, useEffect } from 'react'
import {
  Table, Button, Modal, Input, Form, message, Popconfirm, Typography
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, EditOutlined, EyeOutlined, EyeInvisibleOutlined
} from '@ant-design/icons'
import { api } from '../api'

interface EnvVariable {
  key: string
  description?: string
  hasValue: boolean
}

export function EnvManager() {
  const [envs, setEnvs] = useState<EnvVariable[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [form] = Form.useForm()

  // 加载环境变量
  const loadEnvs = async () => {
    try {
      const res = await api.get('/api/env')
      setEnvs(res.data.data)
    } catch (error) {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEnvs()
  }, [])

  // 添加/编辑
  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      await api.put(`/api/env/${values.key}`, {
        value: values.value,
        description: values.description
      })
      message.success(editingKey ? '已更新' : '已添加')
      setModalOpen(false)
      setEditingKey(null)
      form.resetFields()
      loadEnvs()
    } catch (error: any) {
      if (error.errorFields) return
      message.error('保存失败')
    }
  }

  // 删除
  const handleDelete = async (key: string) => {
    try {
      await api.delete(`/api/env/${key}`)
      message.success('已删除')
      loadEnvs()
    } catch (error) {
      message.error('删除失败')
    }
  }

  // 编辑
  const handleEdit = (record: EnvVariable) => {
    setEditingKey(record.key)
    form.setFieldsValue({
      key: record.key,
      description: record.description,
      value: ''
    })
    setModalOpen(true)
  }

  const columns = [
    {
      title: '变量名',
      dataIndex: 'key',
      key: 'key',
      render: (key: string) => (
        <Typography.Text code copyable>
          {key}
        </Typography.Text>
      )
    },
    {
      title: '值',
      dataIndex: 'hasValue',
      key: 'value',
      render: (hasValue: boolean) => (
        <span className="text-gray-500">
          {hasValue ? '••••••••' : '-'}
        </span>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string) => desc || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: EnvVariable) => (
        <div className="flex gap-2">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="确定删除？"
            onConfirm={() => handleDelete(record.key)}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </div>
      )
    }
  ]

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium">环境变量</h2>
          <p className="text-gray-500 text-sm">
            在云函数中使用 <code>cloud.env.XXX</code> 或{' '}
            <code>process.env.XXX</code> 读取
          </p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingKey(null)
            form.resetFields()
            setModalOpen(true)
          }}
        >
          添加变量
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={envs}
        rowKey="key"
        loading={loading}
        pagination={false}
      />

      <Modal
        title={editingKey ? '编辑环境变量' : '添加环境变量'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => {
          setModalOpen(false)
          setEditingKey(null)
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="key"
            label="变量名"
            rules={[
              { required: true, message: '请输入变量名' },
              { pattern: /^[A-Z_][A-Z0-9_]*$/, message: '使用大写字母和下划线' }
            ]}
          >
            <Input
              placeholder="例如: DATABASE_URL"
              disabled={!!editingKey}
            />
          </Form.Item>
          <Form.Item
            name="value"
            label="值"
            rules={[{ required: true, message: '请输入值' }]}
          >
            <Input.Password placeholder="变量值" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="可选描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
```

---

## 验证清单

### 后端验证

```bash
# 1. 发布函数
curl -X POST http://localhost:3000/api/functions/$FUNC_ID/publish \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"changelog": "首次发布"}'
# 期望: { "success": true, "data": { "version": 1 } }

# 2. 查看版本列表
curl http://localhost:3000/api/functions/$FUNC_ID/versions \
  -H "Authorization: Bearer $TOKEN"

# 3. 版本对比
curl "http://localhost:3000/api/functions/$FUNC_ID/versions/diff?from=1&to=2" \
  -H "Authorization: Bearer $TOKEN"

# 4. 回滚
curl -X POST http://localhost:3000/api/functions/$FUNC_ID/rollback \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"version": 1}'

# 5. 设置环境变量
curl -X PUT http://localhost:3000/api/env/DATABASE_URL \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "mongodb://...", "description": "数据库连接"}'

# 6. 测试环境变量读取
# 创建函数: return { url: cloud.env.DATABASE_URL }
# 执行应返回设置的值
```

### 前端验证

- [ ] 点击发布按钮弹出发布弹窗
- [ ] 弹窗显示 Diff 对比
- [ ] 可编辑变更日志
- [ ] 发布成功后版本号增加
- [ ] 版本历史按钮打开抽屉
- [ ] 版本列表正确显示
- [ ] 点击查看显示版本代码
- [ ] 版本对比功能正常
- [ ] 回滚功能正常
- [ ] 环境变量页面列表正确
- [ ] 可添加/编辑/删除环境变量
- [ ] 环境变量值隐藏显示

---

## 开发日志

| 日期 | 任务 | 完成情况 | 备注 |
|------|------|---------|------|
| - | - | - | - |
