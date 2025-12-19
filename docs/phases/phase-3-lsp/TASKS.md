# Phase 3: LSP 集成 - 任务清单

## 任务概览

| 任务 | 优先级 | 预估 | 状态 |
|------|-------|------|------|
| 3.1 安装 LSP 依赖 | P0 | 15min | 待开始 |
| 3.2 WebSocket 服务 | P0 | 1h | 待开始 |
| 3.3 LSP 进程管理 | P0 | 1.5h | 待开始 |
| 3.4 类型定义文件 | P1 | 1h | 待开始 |
| 3.5 测试验证 | P1 | 30min | 待开始 |

---

## 3.1 安装 LSP 依赖

### 任务描述

安装 typescript-language-server 和相关依赖。

### 具体步骤

- [ ] 安装依赖：
  ```bash
  cd packages/runtime
  pnpm add ws typescript-language-server typescript vscode-languageserver vscode-ws-jsonrpc
  pnpm add -D @types/ws
  ```

---

## 3.2 WebSocket 服务

### 任务描述

实现 WebSocket 服务，处理 LSP 连接。

### 参考 laf

`runtimes/nodejs/src/support/lsp.ts` 中的 `handleUpgrade` 部分

### 具体步骤

- [ ] 创建 `src/lsp/index.ts`：
  ```typescript
  import { WebSocketServer, WebSocket } from 'ws'
  import http from 'http'
  import { config } from '../config'
  import { launchLspServer } from './server'

  export function setupLspWebSocket(server: http.Server) {
    const wss = new WebSocketServer({ noServer: true })

    server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url!, `http://${request.headers.host}`)

      if (url.pathname === '/_/lsp') {
        // 验证 token
        const token = request.headers['sec-websocket-protocol']
        if (token !== config.developToken) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
          socket.destroy()
          return
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
          console.log('LSP WebSocket connected')
          handleLspConnection(ws)
        })
      } else {
        socket.destroy()
      }
    })
  }

  function handleLspConnection(ws: WebSocket) {
    const lspProcess = launchLspServer()

    // WebSocket → LSP stdin
    ws.on('message', (data) => {
      const message = data.toString()
      // JSON-RPC 消息需要添加 Content-Length 头
      const content = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`
      lspProcess.stdin?.write(content)
    })

    // LSP stdout → WebSocket
    let buffer = ''
    lspProcess.stdout?.on('data', (chunk) => {
      buffer += chunk.toString()

      // 解析 LSP 消息
      while (true) {
        const headerEnd = buffer.indexOf('\r\n\r\n')
        if (headerEnd === -1) break

        const header = buffer.slice(0, headerEnd)
        const match = header.match(/Content-Length: (\d+)/)
        if (!match) break

        const contentLength = parseInt(match[1])
        const contentStart = headerEnd + 4
        if (buffer.length < contentStart + contentLength) break

        const content = buffer.slice(contentStart, contentStart + contentLength)
        buffer = buffer.slice(contentStart + contentLength)

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(content)
        }
      }
    })

    ws.on('close', () => {
      console.log('LSP WebSocket closed')
      lspProcess.kill()
    })

    lspProcess.on('exit', () => {
      ws.close()
    })
  }
  ```

---

## 3.3 LSP 进程管理

### 任务描述

启动和管理 typescript-language-server 进程。

### 具体步骤

- [ ] 创建 `src/lsp/server.ts`：
  ```typescript
  import { spawn, ChildProcess } from 'child_process'
  import path from 'path'
  import fs from 'fs'
  import os from 'os'

  // 创建临时工作目录
  const workspaceDir = path.join(os.tmpdir(), 'simple-ide-lsp')

  export function launchLspServer(): ChildProcess {
    // 确保工作目录存在
    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true })
    }

    // 创建 tsconfig.json
    const tsconfigPath = path.join(workspaceDir, 'tsconfig.json')
    if (!fs.existsSync(tsconfigPath)) {
      fs.writeFileSync(tsconfigPath, JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          strict: false,
          esModuleInterop: true,
          skipLibCheck: true,
          lib: ['ES2020']
        }
      }, null, 2))
    }

    // 启动 typescript-language-server
    const lspPath = require.resolve('typescript-language-server/lib/cli.js')
    const process = spawn('node', [lspPath, '--stdio'], {
      cwd: workspaceDir,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    process.stderr?.on('data', (data) => {
      console.error('LSP stderr:', data.toString())
    })

    return process
  }

  // 写入函数文件 (供 LSP 分析)
  export function writeFunctionFile(name: string, code: string) {
    const filePath = path.join(workspaceDir, `${name}.ts`)
    fs.writeFileSync(filePath, code)
    return `file://${filePath}`
  }

  // 删除函数文件
  export function deleteFunctionFile(name: string) {
    const filePath = path.join(workspaceDir, `${name}.ts`)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  }
  ```

- [ ] 在 `index.ts` 中集成：
  ```typescript
  import http from 'http'
  import { setupLspWebSocket } from './lsp'

  const server = http.createServer(app)
  setupLspWebSocket(server)

  server.listen(config.port, () => {
    console.log(`Runtime running on http://localhost:${config.port}`)
  })
  ```

---

## 3.4 类型定义文件

### 任务描述

为云函数提供类型定义，支持 ctx 和 cloud 的智能提示。

### 具体步骤

- [ ] 创建 `src/lsp/types.ts`，生成类型定义：
  ```typescript
  export const cloudTypes = `
  interface FunctionContext {
    body: any
    query: Record<string, string>
    headers: Record<string, string>
    cloud: Cloud
  }

  interface Cloud {
    database(): import('mongodb').Db
    invoke(name: string, data?: any): Promise<any>
    env: Record<string, string>
  }

  declare const ctx: FunctionContext
  declare const cloud: Cloud
  declare const console: Console
  `

  export function getTypesContent() {
    return cloudTypes
  }
  ```

- [ ] 在工作目录写入类型定义文件：
  ```typescript
  // server.ts 中添加
  const typesPath = path.join(workspaceDir, 'globals.d.ts')
  fs.writeFileSync(typesPath, getTypesContent())
  ```

---

## 3.5 测试验证

### 测试方法

1. 使用 wscat 测试 WebSocket：
   ```bash
   npm install -g wscat
   wscat -c ws://localhost:8000/_/lsp -H "Sec-WebSocket-Protocol: your-token"
   ```

2. 发送 initialize 请求：
   ```json
   {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}
   ```

3. 期望收到 initialize 响应

### 验证点

- [ ] WebSocket 连接成功
- [ ] 收到 initialize 响应
- [ ] 发送 didOpen 后可收到诊断消息

---

## 开发日志

| 日期 | 任务 | 完成情况 | 备注 |
|------|------|---------|------|
| - | - | - | - |
