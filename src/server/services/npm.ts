import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const execAsync = promisify(exec)
const require = createRequire(import.meta.url)

// 阿里云 NPM 镜像
const REGISTRY = 'https://registry.npmmirror.com'

// 获取 server 包的根目录 (用于安装运行时依赖)
// 编译后: dist/services/npm.js -> ../.. 到 packages/server
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SERVER_ROOT = path.resolve(__dirname, '../..')

export interface PackageInfo {
  name: string
  version: string
  description?: string
}

export interface PackageVersions {
  name: string
  versions: string[]
  latest: string
}

/**
 * 安装包 (使用 pnpm + 阿里云镜像)
 */
export async function installPackage(name: string, version?: string): Promise<void> {
  const packageSpec = version && version !== 'latest' ? `${name}@${version}` : name
  // 使用 --filter 在 monorepo 中正确安装到 server 包
  const cmd = `pnpm add ${packageSpec} --filter @simple-ide/server --registry=${REGISTRY}`

  console.log(`[NPM] Running: ${cmd}`)

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: SERVER_ROOT,
      timeout: 180000, // 3分钟超时
      maxBuffer: 1024 * 1024 * 10, // 10MB
      env: { ...process.env, NODE_ENV: 'development' }, // 避免生产模式下的依赖冲突
    })
    console.log(`[NPM] Install stdout:`, stdout)
    if (stderr) console.log(`[NPM] Install stderr:`, stderr)
  } catch (error: unknown) {
    const err = error as { stderr?: string; stdout?: string; message?: string }
    console.error(`[NPM] Install failed:`, err.stderr || err.stdout || err.message)
    throw new Error(`安装失败: ${err.stderr || err.message}`)
  }
}

/**
 * 卸载包
 */
export async function uninstallPackage(name: string): Promise<void> {
  try {
    await execAsync(`pnpm remove ${name} --filter @simple-ide/server`, {
      cwd: SERVER_ROOT,
      timeout: 60000,
      env: { ...process.env, NODE_ENV: 'development' }, // 避免生产模式下的依赖冲突
    })
  } catch (error: unknown) {
    const err = error as { stderr?: string; message?: string }
    throw new Error(`卸载失败: ${err.stderr || err.message}`)
  }
}

/**
 * 获取包的可用版本列表
 */
export async function getPackageVersions(name: string): Promise<PackageVersions> {
  try {
    const { stdout } = await execAsync(
      `npm view ${name} versions dist-tags.latest --json --registry=${REGISTRY}`,
      { timeout: 30000 }
    )

    const result = JSON.parse(stdout)

    // npm view 返回格式: { versions: [...], 'dist-tags.latest': 'x.x.x' }
    // 或者只有一个版本时直接返回字符串
    let versions: string[]
    let latest: string

    if (typeof result === 'string') {
      // 只有一个版本
      versions = [result]
      latest = result
    } else if (Array.isArray(result.versions)) {
      versions = result.versions
      latest = result['dist-tags.latest'] || versions[versions.length - 1]
    } else if (Array.isArray(result)) {
      versions = result
      latest = versions[versions.length - 1]
    } else {
      throw new Error('无法解析版本信息')
    }

    // 返回最新的 30 个版本 (倒序，最新在前)
    return {
      name,
      versions: versions.reverse().slice(0, 30),
      latest,
    }
  } catch (error: unknown) {
    const err = error as { message?: string }
    throw new Error(`查询失败: 包 ${name} 不存在或网络错误`)
  }
}

/**
 * 获取包信息
 */
export async function getPackageInfo(name: string): Promise<PackageInfo> {
  try {
    const { stdout } = await execAsync(
      `npm view ${name} name version description --json --registry=${REGISTRY}`,
      { timeout: 30000 }
    )
    return JSON.parse(stdout)
  } catch {
    throw new Error(`包 ${name} 不存在`)
  }
}

/**
 * 搜索包
 */
export async function searchPackages(query: string): Promise<PackageInfo[]> {
  try {
    const { stdout } = await execAsync(
      `npm search ${query} --json --registry=${REGISTRY}`,
      { timeout: 30000 }
    )
    const results = JSON.parse(stdout)
    return results.slice(0, 10).map((pkg: Record<string, unknown>) => ({
      name: pkg.name as string,
      version: pkg.version as string,
      description: pkg.description as string,
    }))
  } catch {
    return []
  }
}

/**
 * 检查包是否已安装
 */
export function isPackageInstalled(name: string): boolean {
  try {
    const resolved = require.resolve(name)
    console.log(`[NPM] Package ${name} found at: ${resolved}`)
    return true
  } catch (err) {
    console.log(`[NPM] Package ${name} not found:`, (err as Error).message)
    return false
  }
}

/**
 * 获取已安装包的版本
 */
export function getInstalledVersion(name: string): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require(`${name}/package.json`)
    console.log(`[NPM] Package ${name} version: ${pkg.version}`)
    return pkg.version
  } catch (err) {
    console.log(`[NPM] Cannot get version for ${name}:`, (err as Error).message)
    return null
  }
}
