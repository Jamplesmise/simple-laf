import express from 'express'
import cors from 'cors'
import http from 'http'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'
import { connectDB, getDB } from './db.js'
import * as npmService from './services/npm.js'
import authRoutes from './routes/auth.js'
import functionsRoutes from './routes/functions.js'
import foldersRoutes from './routes/folders.js'
import dependenciesRoutes from './routes/dependencies.js'
import envRoutes from './routes/env.js'
import gitRoutes from './routes/git.js'
import schedulerRoutes from './routes/scheduler.js'
import executionLogsRoutes from './routes/executionLogs.js'
import webhookRoutes from './routes/webhook.js'
import snippetsRoutes from './routes/snippets.js'
import searchRoutes from './routes/search.js'
import aiRoutes from './routes/ai.js'
import invokeRoutes from './routes/invoke.js'
import publicRoutes from './routes/public.js'
import customDomainRoutes from './routes/customDomain.js'
import apiTokenRoutes from './routes/apiToken.js'
import databaseRoutes from './routes/database.js'
import storageRoutes from './routes/storage.js'
import auditRoutes from './routes/audit.js'
import { setupLspWebSocket } from './lsp/index.js'
import * as schedulerService from './services/scheduler.js'
import * as customDomainService from './services/customDomain.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

// 中间件
app.use(cors())
app.use(express.json())

// 自定义域名路由中间件
// 当请求来自自定义域名时，将请求重定向到对应的函数
app.use(async (req, res, next) => {
  const host = req.hostname
  const systemDomain = customDomainService.getSystemDomain().replace(/:\d+$/, '')

  // 跳过系统域名和 localhost
  if (host === systemDomain || host === 'localhost' || host === '127.0.0.1') {
    return next()
  }

  // 跳过 API 和静态资源路径
  if (req.path.startsWith('/api/') || req.path.startsWith('/_/') || req.path === '/health') {
    return next()
  }

  try {
    const customDomain = await customDomainService.findDomainByHost(host)

    if (customDomain && customDomain.verified) {
      // 找到匹配的自定义域名，修改请求路径
      // 如果有 targetPath，使用 targetPath；否则使用原始路径
      const targetPath = customDomain.targetPath || req.path.replace(/^\//, '')

      if (targetPath) {
        // 重写请求 URL
        req.url = '/' + targetPath.replace(/^\//, '')
        // 标记为自定义域名请求
        ;(req as Express.Request & { customDomain?: typeof customDomain }).customDomain = customDomain
      }
    }
  } catch (err) {
    // 查询失败时继续正常处理
    console.error('Custom domain lookup error:', err)
  }

  next()
})

// API 路由
app.use('/api/auth', authRoutes)
app.use('/api/functions', functionsRoutes)
app.use('/api/folders', foldersRoutes)
app.use('/api/dependencies', dependenciesRoutes)
app.use('/api/env', envRoutes)
app.use('/api/git', gitRoutes)
app.use('/api/scheduler', schedulerRoutes)
app.use('/api/execution-logs', executionLogsRoutes)
app.use('/api/webhooks', webhookRoutes)
app.use('/api/snippets', snippetsRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/custom-domains', customDomainRoutes)
app.use('/api/tokens', apiTokenRoutes)
app.use('/api/database', databaseRoutes)
app.use('/api/storage', storageRoutes)
app.use('/api/audit', auditRoutes)
app.use('/invoke', invokeRoutes)

// 健康检查
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 生产环境: 托管前端静态文件
const isProduction = process.env.NODE_ENV === 'production'
const clientDistPath = path.join(__dirname, '..', 'client')

if (isProduction && fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath))
}

// 公开调用路由 (最后匹配，避免与其他路由冲突)
app.use(publicRoutes)

// SPA fallback: 所有未匹配的 GET 请求返回 index.html (仅生产环境)
if (isProduction && fs.existsSync(clientDistPath)) {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'))
  })
}

// 创建 HTTP 服务器 (支持 WebSocket 升级)
const server = http.createServer(app)

// 设置 LSP WebSocket
setupLspWebSocket(server)

/**
 * 启动时恢复数据库中记录的依赖
 */
async function restoreDependencies() {
  const db = getDB()
  const deps = await db.collection('dependencies')
    .find({ status: 'installed' })
    .toArray()

  if (deps.length === 0) {
    console.log('无需恢复依赖')
    return
  }

  console.log(`检查 ${deps.length} 个依赖...`)

  for (const dep of deps) {
    if (!npmService.isPackageInstalled(dep.name)) {
      console.log(`恢复依赖: ${dep.name}@${dep.version}`)
      try {
        await npmService.installPackage(dep.name, dep.version)
        console.log(`  ✓ ${dep.name} 安装成功`)
      } catch (error: unknown) {
        const err = error as Error
        console.error(`  ✗ ${dep.name} 安装失败: ${err.message}`)
        // 更新状态为失败
        await db.collection('dependencies').updateOne(
          { _id: dep._id },
          { $set: { status: 'failed', error: err.message } }
        )
      }
    } else {
      console.log(`  ✓ ${dep.name} 已存在`)
    }
  }
}

// 启动服务
async function main() {
  try {
    await connectDB()

    // 恢复依赖 (后台执行，不阻塞启动)
    restoreDependencies().catch((err) => {
      console.error('恢复依赖失败:', err)
    })

    // 初始化定时任务
    schedulerService.initSchedulers().catch((err) => {
      console.error('初始化定时任务失败:', err)
    })

    server.listen(config.port, config.host, () => {
      console.log(`Server running on http://${config.host}:${config.port}`)
      console.log(`LSP WebSocket available at ws://${config.host}:${config.port}/_/lsp`)
    })
  } catch (err) {
    console.error('Failed to start server:', err)
    process.exit(1)
  }
}

main()
