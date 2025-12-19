import { WebSocketServer, WebSocket } from 'ws'
import type http from 'http'
import { config } from '../config.js'
import { launchLspServer } from './server.js'

export function setupLspWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url!, `http://${request.headers.host}`)

    if (url.pathname === '/_/lsp') {
      // 验证 token (通过 Sec-WebSocket-Protocol 传递)
      const token = request.headers['sec-websocket-protocol']
      if (token !== config.developToken) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        console.log('[LSP] WebSocket connected')
        handleLspConnection(ws)
      })
    } else {
      socket.destroy()
    }
  })
}

function handleLspConnection(ws: WebSocket) {
  const lspProcess = launchLspServer()

  // WebSocket 消息 → LSP stdin (添加 Content-Length 头)
  ws.on('message', (data) => {
    const message = data.toString()
    const content = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`
    lspProcess.stdin?.write(content)
  })

  // LSP stdout → WebSocket (解析 Content-Length 协议)
  let buffer = ''
  lspProcess.stdout?.on('data', (chunk) => {
    buffer += chunk.toString()

    // 解析 LSP 消息 (Content-Length 头 + JSON body)
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n')
      if (headerEnd === -1) break

      const header = buffer.slice(0, headerEnd)
      const match = header.match(/Content-Length: (\d+)/)
      if (!match) {
        // 无效头，清除并继续
        buffer = buffer.slice(headerEnd + 4)
        continue
      }

      const contentLength = parseInt(match[1], 10)
      const contentStart = headerEnd + 4

      if (buffer.length < contentStart + contentLength) {
        // 消息体不完整，等待更多数据
        break
      }

      const content = buffer.slice(contentStart, contentStart + contentLength)
      buffer = buffer.slice(contentStart + contentLength)

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(content)
      }
    }
  })

  // 连接关闭
  ws.on('close', () => {
    console.log('[LSP] WebSocket closed')
    lspProcess.kill()
  })

  ws.on('error', (err) => {
    console.error('[LSP] WebSocket error:', err)
    lspProcess.kill()
  })

  // LSP 进程退出
  lspProcess.on('exit', (code) => {
    console.log('[LSP] Process exited with code:', code)
    if (ws.readyState === WebSocket.OPEN) {
      ws.close()
    }
  })
}
