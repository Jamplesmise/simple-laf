import logger from '../../utils/logger.js'
import { simpleGit, type SimpleGit } from 'simple-git'
import * as fs from 'fs/promises'
import * as path from 'path'

// 过滤错误信息中的敏感信息（Token）
// 匹配常见的 Token 格式并替换
export function sanitizeError(error: unknown): { message: string; stack?: string } {
  const tokenPatterns = [
    /ghp_[a-zA-Z0-9]{36,}/g,           // GitHub PAT
    /github_pat_[a-zA-Z0-9_]{22,}/g,   // GitHub fine-grained PAT
    /glpat-[a-zA-Z0-9\-_]{20,}/g,      // GitLab PAT
    /gho_[a-zA-Z0-9]{36,}/g,           // GitHub OAuth token
    /ghu_[a-zA-Z0-9]{36,}/g,           // GitHub user-to-server token
    /ghs_[a-zA-Z0-9]{36,}/g,           // GitHub server-to-server token
    /https:\/\/[^:]+:[^@]+@/g,         // 通用 URL 中的认证信息
  ]

  const sanitize = (str: string): string => {
    let result = str
    for (const pattern of tokenPatterns) {
      result = result.replace(pattern, '***REDACTED***')
    }
    return result
  }

  if (error instanceof Error) {
    return {
      message: sanitize(error.message),
      stack: error.stack ? sanitize(error.stack) : undefined
    }
  }

  return { message: sanitize(String(error)) }
}

// 创建 Git 实例，可选跳过 SSL 验证
// workDir: 可选的工作目录（用于已克隆的仓库操作）
export function createGit(repoUrl: string, workDir?: string): SimpleGit {
  const skipSSL = shouldSkipSSL(repoUrl)

  // 配置全局选项，包括强制使用 HTTP/1.1
  const gitOptions = workDir ? { baseDir: workDir } : {}
  const git = simpleGit({
    ...gitOptions,
    config: [
      'http.version=HTTP/1.1'  // 避免 HTTP/2 兼容性问题
    ]
  })

  // 禁用交互式密码提示，认证失败直接报错
  git.env('GIT_TERMINAL_PROMPT', '0')

  if (skipSSL) {
    // 设置环境变量禁用 SSL 证书验证
    git.env('GIT_SSL_NO_VERIFY', 'true')
    if (!workDir) {
      logger.info('[Git Utils] 已禁用 SSL 证书验证', { repoUrl })
    }
  }

  return git
}

// 检测是否需要跳过 SSL 验证（仅对 IP 地址和 localhost 跳过）
function shouldSkipSSL(repoUrl: string): boolean {
  try {
    const url = new URL(repoUrl)
    const host = url.hostname.toLowerCase()

    // 只对 localhost 和 IP 地址跳过
    if (host === 'localhost' || host === '127.0.0.1') {
      logger.info('[Git Utils] 检测到 localhost，将跳过 SSL 验证')
      return true
    }

    // 检测 IP 地址格式（简单的 IPv4 检测）
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/
    if (ipPattern.test(host)) {
      logger.info('[Git Utils] 检测到 IP 地址，将跳过 SSL 验证', { host })
      return true
    }

    // 其他域名不跳过 SSL
    return false
  } catch {
    return false
  }
}

// 检测 Git 服务商类型
export function detectGitProvider(repoUrl: string): 'github' | 'gitlab' | 'gitea' | 'gogs' | 'other' {
  try {
    const url = new URL(repoUrl)
    const host = url.host.toLowerCase()

    if (host.includes('github')) return 'github'
    if (host.includes('gitlab')) return 'gitlab'
    if (host.includes('gitea')) return 'gitea'
    if (host.includes('gogs')) return 'gogs'

    return 'other'
  } catch {
    return 'other'
  }
}

// 构建带认证的 URL
// 不同 Git 服务商的认证格式：
// - GitHub: https://TOKEN@github.com/...
// - GitLab: https://oauth2:TOKEN@gitlab.com/...
// - Gitea/Gogs: https://TOKEN@host/... 或 https://username:TOKEN@host/...
export function buildAuthUrl(repoUrl: string, token?: string, username?: string): string {
  if (!token) {
    logger.info('[Git Utils] 无 Token，使用原始 URL')
    return repoUrl
  }

  try {
    const url = new URL(repoUrl)
    const provider = detectGitProvider(repoUrl)
    let authUrl: string

    switch (provider) {
      case 'github':
        // GitHub 可以直接用 Token，也可以用 x-access-token:TOKEN
        authUrl = `https://${token}@${url.host}${url.pathname}`
        break

      case 'gitlab':
        // GitLab 需要 oauth2:TOKEN 或 username:TOKEN 格式
        if (username) {
          authUrl = `https://${username}:${token}@${url.host}${url.pathname}`
        } else {
          // 使用 oauth2 作为用户名（适用于 Personal Access Token）
          authUrl = `https://oauth2:${token}@${url.host}${url.pathname}`
        }
        break

      case 'gitea':
      case 'gogs':
        // Gitea/Gogs 使用 username:TOKEN 格式，或直接用 TOKEN
        if (username) {
          authUrl = `https://${username}:${token}@${url.host}${url.pathname}`
        } else {
          // 尝试直接用 token 作为用户名（Gogs 支持）
          authUrl = `https://${token}@${url.host}${url.pathname}`
        }
        break

      default:
        // 其他服务商，尝试通用格式
        if (username) {
          authUrl = `https://${username}:${token}@${url.host}${url.pathname}`
        } else {
          // 尝试 git:TOKEN 格式
          authUrl = `https://git:${token}@${url.host}${url.pathname}`
        }
    }

    logger.info('[Git Utils] 构建认证 URL', {
      provider,
      host: url.host,
      hasUsername: !!username,
      authUrlMasked: authUrl.replace(token, '***TOKEN***')
    })

    return authUrl
  } catch (err) {
    logger.error('[Git Utils] 构建认证 URL 失败', {
      repoUrl,
      error: err instanceof Error ? err.message : String(err)
    })
    return repoUrl
  }
}

// 递归读取目录中的所有 .ts 文件，返回相对路径列表
export async function readTsFilesRecursively(dir: string, baseDir: string = dir): Promise<string[]> {
  const files: string[] = []

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        // 递归读取子目录
        const subFiles = await readTsFilesRecursively(fullPath, baseDir)
        files.push(...subFiles)
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        // 计算相对于 baseDir 的路径
        const relativePath = path.relative(baseDir, fullPath)
        files.push(relativePath)
      }
    }
  } catch {
    // 目录不存在或无法读取
  }

  return files
}
