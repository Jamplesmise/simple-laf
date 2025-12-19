# Phase 4: 前端 IDE - 任务清单

## 任务概览

| 任务 | 优先级 | 预估 | 状态 |
|------|-------|------|------|
| 4.1 项目初始化 | P0 | 30min | 待开始 |
| 4.2 认证页面 | P0 | 1h | 待开始 |
| 4.3 IDE 布局 | P0 | 1h | 待开始 |
| 4.4 函数列表 | P0 | 1h | 待开始 |
| 4.5 Monaco 编辑器 | P0 | 1.5h | 待开始 |
| 4.6 LSP 集成 | P0 | 1.5h | 待开始 |
| 4.7 调试面板 | P0 | 1.5h | 待开始 |
| 4.8 整体联调 | P1 | 1h | 待开始 |

---

## 4.1 项目初始化

### 任务描述

使用 Vite 创建 React 项目。

### 具体步骤

- [ ] 创建项目：
  ```bash
  cd packages
  pnpm create vite web --template react-ts
  cd web
  ```
- [ ] 安装依赖：
  ```bash
  pnpm add antd @ant-design/icons zustand axios
  pnpm add @monaco-editor/react monaco-languageclient vscode-languageclient
  ```
- [ ] 配置 Vite proxy：
  ```typescript
  // vite.config.ts
  export default defineConfig({
    server: {
      proxy: {
        '/api': 'http://localhost:3000',
        '/invoke': 'http://localhost:8000',
        '/_/lsp': {
          target: 'ws://localhost:8000',
          ws: true
        }
      }
    }
  })
  ```

---

## 4.2 认证页面

### 任务描述

实现登录和注册页面。

### 具体步骤

- [ ] 创建 `src/stores/auth.ts`：
  ```typescript
  import { create } from 'zustand'
  import { persist } from 'zustand/middleware'

  interface AuthState {
    token: string | null
    user: { id: string; username: string } | null
    setAuth: (token: string, user: any) => void
    logout: () => void
  }

  export const useAuthStore = create<AuthState>()(
    persist(
      (set) => ({
        token: null,
        user: null,
        setAuth: (token, user) => set({ token, user }),
        logout: () => set({ token: null, user: null })
      }),
      { name: 'auth-storage' }
    )
  )
  ```

- [ ] 创建 `src/api/auth.ts`：
  ```typescript
  import axios from './axios'

  export const authApi = {
    login: (username: string, password: string) =>
      axios.post('/api/auth/login', { username, password }),
    register: (username: string, password: string) =>
      axios.post('/api/auth/register', { username, password })
  }
  ```

- [ ] 创建登录页 `src/pages/Login.tsx`
- [ ] 创建注册页 `src/pages/Register.tsx`

---

## 4.3 IDE 布局

### 任务描述

实现 IDE 主界面三栏布局。

### 具体步骤

- [ ] 创建 `src/pages/IDE.tsx`：
  ```tsx
  import { Layout } from 'antd'
  import FunctionList from '../components/FunctionList'
  import Editor from '../components/Editor'
  import DebugPanel from '../components/DebugPanel'
  import Header from '../components/Header'

  const { Sider, Content } = Layout

  export default function IDE() {
    return (
      <Layout style={{ height: '100vh' }}>
        <Header />
        <Layout>
          <Sider width={200} theme="light">
            <FunctionList />
          </Sider>
          <Content style={{ display: 'flex' }}>
            <div style={{ flex: 1 }}>
              <Editor />
            </div>
            <div style={{ width: 350 }}>
              <DebugPanel />
            </div>
          </Content>
        </Layout>
      </Layout>
    )
  }
  ```

---

## 4.4 函数列表

### 任务描述

实现函数列表组件。

### 具体步骤

- [ ] 创建 `src/stores/function.ts`：
  ```typescript
  import { create } from 'zustand'

  interface FunctionState {
    functions: any[]
    current: any | null
    setFunctions: (fns: any[]) => void
    setCurrent: (fn: any) => void
  }

  export const useFunctionStore = create<FunctionState>((set) => ({
    functions: [],
    current: null,
    setFunctions: (functions) => set({ functions }),
    setCurrent: (current) => set({ current })
  }))
  ```

- [ ] 创建 `src/components/FunctionList.tsx`：
  ```tsx
  import { useEffect, useState } from 'react'
  import { List, Button, Input, Modal, message } from 'antd'
  import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
  import { useFunctionStore } from '../stores/function'
  import { functionApi } from '../api/functions'

  export default function FunctionList() {
    const { functions, current, setFunctions, setCurrent } = useFunctionStore()
    const [newName, setNewName] = useState('')
    const [modalOpen, setModalOpen] = useState(false)

    useEffect(() => {
      loadFunctions()
    }, [])

    const loadFunctions = async () => {
      const res = await functionApi.list()
      setFunctions(res.data.data)
    }

    const handleCreate = async () => {
      if (!newName) return
      await functionApi.create(newName, defaultCode)
      setNewName('')
      setModalOpen(false)
      loadFunctions()
    }

    const handleDelete = async (id: string) => {
      await functionApi.remove(id)
      loadFunctions()
      if (current?._id === id) setCurrent(null)
    }

    return (
      <div style={{ padding: 8 }}>
        <Button icon={<PlusOutlined />} onClick={() => setModalOpen(true)} block>
          新建函数
        </Button>

        <List
          dataSource={functions}
          renderItem={(fn) => (
            <List.Item
              onClick={() => setCurrent(fn)}
              style={{
                cursor: 'pointer',
                background: current?._id === fn._id ? '#e6f7ff' : undefined
              }}
              actions={[
                <DeleteOutlined onClick={(e) => { e.stopPropagation(); handleDelete(fn._id) }} />
              ]}
            >
              {fn.name}
            </List.Item>
          )}
        />

        <Modal title="新建函数" open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
          <Input placeholder="函数名称" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </Modal>
      </div>
    )
  }

  const defaultCode = `export default async function(ctx) {
    console.log('Hello from function')
    return { message: 'Hello World' }
  }`
  ```

---

## 4.5 Monaco 编辑器

### 任务描述

集成 Monaco 编辑器。

### 具体步骤

- [ ] 创建 `src/components/Editor.tsx`：
  ```tsx
  import { useEffect, useRef } from 'react'
  import MonacoEditor from '@monaco-editor/react'
  import { useFunctionStore } from '../stores/function'
  import { functionApi } from '../api/functions'
  import { Button, message } from 'antd'

  export default function Editor() {
    const { current, setCurrent } = useFunctionStore()
    const codeRef = useRef(current?.code || '')

    useEffect(() => {
      codeRef.current = current?.code || ''
    }, [current?._id])

    const handleSave = async () => {
      if (!current) return
      await functionApi.update(current._id, codeRef.current)
      await functionApi.compile(current._id)
      message.success('保存成功')
      // 更新本地状态
      setCurrent({ ...current, code: codeRef.current })
    }

    if (!current) {
      return <div style={{ padding: 20, color: '#999' }}>选择或创建一个函数</div>
    }

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 8, borderBottom: '1px solid #eee' }}>
          <strong>{current.name}</strong>
          <Button size="small" onClick={handleSave} style={{ marginLeft: 8 }}>
            保存 (Ctrl+S)
          </Button>
        </div>
        <div style={{ flex: 1 }}>
          <MonacoEditor
            language="typescript"
            theme="vs-light"
            value={current.code}
            onChange={(value) => { codeRef.current = value || '' }}
            options={{
              minimap: { enabled: false },
              fontSize: 14
            }}
          />
        </div>
      </div>
    )
  }
  ```

---

## 4.6 LSP 集成

### 任务描述

连接 LSP 服务，实现智能提示。

### 参考 laf

`web/src/components/Editor/FunctionEditor.tsx` 中的 LSP 连接部分

### 具体步骤

- [ ] 安装额外依赖：
  ```bash
  pnpm add monaco-languageclient vscode-languageclient vscode-jsonrpc
  ```

- [ ] 创建 `src/utils/lsp.ts`：
  ```typescript
  import * as monaco from 'monaco-editor'
  import { MonacoLanguageClient } from 'monaco-languageclient'
  import { WebSocketMessageReader, WebSocketMessageWriter, toSocket } from 'vscode-ws-jsonrpc'

  let client: MonacoLanguageClient | null = null

  export function connectLsp(token: string) {
    const url = `ws://${location.host}/_/lsp`
    const ws = new WebSocket(url, token)

    ws.onopen = () => {
      const socket = toSocket(ws)
      const reader = new WebSocketMessageReader(socket)
      const writer = new WebSocketMessageWriter(socket)

      client = new MonacoLanguageClient({
        name: 'TypeScript Language Client',
        clientOptions: {
          documentSelector: ['typescript']
        },
        connectionProvider: {
          get: () => Promise.resolve({ reader, writer })
        }
      })

      client.start()
    }

    ws.onerror = (e) => console.error('LSP error', e)
    ws.onclose = () => console.log('LSP disconnected')
  }

  export function disconnectLsp() {
    client?.stop()
    client = null
  }
  ```

- [ ] 在 IDE 组件中初始化 LSP

---

## 4.7 调试面板

### 任务描述

实现调试面板。

### 具体步骤

- [ ] 创建 `src/components/DebugPanel.tsx`：
  ```tsx
  import { useState } from 'react'
  import { Button, Input, Card, Tabs } from 'antd'
  import { PlayCircleOutlined } from '@ant-design/icons'
  import { useFunctionStore } from '../stores/function'
  import { useAuthStore } from '../stores/auth'
  import axios from 'axios'
  import pako from 'pako'

  export default function DebugPanel() {
    const { current } = useFunctionStore()
    const { token } = useAuthStore()
    const [params, setParams] = useState('{}')
    const [result, setResult] = useState<any>(null)
    const [logs, setLogs] = useState<string[]>([])
    const [loading, setLoading] = useState(false)

    const handleRun = async () => {
      if (!current) return

      setLoading(true)
      setResult(null)
      setLogs([])

      try {
        const body = JSON.parse(params)
        const res = await axios.post(`/invoke/${current.name}`, body, {
          headers: { 'x-develop-token': token }
        })

        setResult(res.data)

        // 解析日志
        const logsHeader = res.headers['x-function-logs']
        if (logsHeader) {
          const compressed = Buffer.from(logsHeader, 'base64')
          const decompressed = pako.ungzip(compressed, { to: 'string' })
          setLogs(JSON.parse(decompressed))
        }
      } catch (error: any) {
        setResult({ error: error.response?.data?.error || error.message })
      } finally {
        setLoading(false)
      }
    }

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #eee' }}>
        <div style={{ padding: 8, borderBottom: '1px solid #eee' }}>
          <strong>调试</strong>
        </div>

        <div style={{ padding: 8 }}>
          <Input.TextArea
            placeholder="请求参数 (JSON)"
            value={params}
            onChange={(e) => setParams(e.target.value)}
            rows={4}
          />
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleRun}
            loading={loading}
            style={{ marginTop: 8 }}
            block
          >
            运行
          </Button>
        </div>

        <Tabs
          items={[
            {
              key: 'result',
              label: '返回值',
              children: (
                <pre style={{ padding: 8, margin: 0, overflow: 'auto', flex: 1 }}>
                  {result ? JSON.stringify(result, null, 2) : '点击运行查看结果'}
                </pre>
              )
            },
            {
              key: 'console',
              label: '控制台',
              children: (
                <div style={{ padding: 8, fontFamily: 'monospace', fontSize: 12 }}>
                  {logs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                  {logs.length === 0 && <span style={{ color: '#999' }}>暂无日志</span>}
                </div>
              )
            }
          ]}
          style={{ flex: 1 }}
        />
      </div>
    )
  }
  ```

---

## 4.8 整体联调

### 测试流程

- [ ] 启动所有服务 (MongoDB, Server, Runtime, Web)
- [ ] 注册账号并登录
- [ ] 创建函数
- [ ] 编辑代码，测试智能提示
- [ ] 保存函数
- [ ] 运行函数，查看结果和日志
- [ ] 删除函数

---

## 开发日志

| 日期 | 任务 | 完成情况 | 备注 |
|------|------|---------|------|
| - | - | - | - |
