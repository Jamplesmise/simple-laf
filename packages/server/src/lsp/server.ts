import { spawn, type ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { createRequire } from 'module'
import { getTypesContent } from './types.js'

const require = createRequire(import.meta.url)

// LSP 工作目录
const workspaceDir = path.join(os.tmpdir(), 'simple-ide-lsp')

function ensureWorkspace() {
  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true })
  }

  // tsconfig.json
  const tsconfigPath = path.join(workspaceDir, 'tsconfig.json')
  if (!fs.existsSync(tsconfigPath)) {
    fs.writeFileSync(tsconfigPath, JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        strict: false,
        esModuleInterop: true,
        skipLibCheck: true,
        lib: ['ES2020'],
        typeRoots: ['.']
      }
    }, null, 2))
  }

  // 全局类型定义
  const typesPath = path.join(workspaceDir, 'globals.d.ts')
  fs.writeFileSync(typesPath, getTypesContent())
}

export function launchLspServer(): ChildProcess {
  ensureWorkspace()

  // 获取 typescript-language-server CLI 路径
  const lspPath = require.resolve('typescript-language-server/lib/cli.mjs')

  const lspProcess = spawn('node', [lspPath, '--stdio'], {
    cwd: workspaceDir,
    stdio: ['pipe', 'pipe', 'pipe']
  })

  lspProcess.stderr?.on('data', (data) => {
    console.error('[LSP stderr]', data.toString())
  })

  lspProcess.on('error', (err) => {
    console.error('[LSP error]', err)
  })

  return lspProcess
}

// 写入函数文件供 LSP 分析
export function writeFunctionFile(name: string, code: string): string {
  ensureWorkspace()
  const filePath = path.join(workspaceDir, `${name}.ts`)
  fs.writeFileSync(filePath, code)
  return `file://${filePath}`
}

// 删除函数文件
export function deleteFunctionFile(name: string): void {
  const filePath = path.join(workspaceDir, `${name}.ts`)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

// 获取工作目录
export function getWorkspaceDir(): string {
  return workspaceDir
}
