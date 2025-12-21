/**
 * 依赖管理工具
 *
 * 提供 NPM 依赖安装、更新和安全审计功能
 * Sprint 15: 依赖与配置
 */

import * as npmService from '../../npm.js'
import type { AuditVulnerability, AuditResult, UpdateResult } from '../../npm.js'

// ==================== 类型定义 ====================

/**
 * 安装依赖参数
 */
export interface InstallDependencyParams {
  packages: string[]
  dev?: boolean
}

/**
 * 安装依赖结果
 */
export interface InstallDependencyResult {
  success: boolean
  installed: string[]
  failed: string[]
}

/**
 * 更新依赖参数
 */
export interface UpdateDependencyParams {
  packages: string[]
  latest?: boolean
}

/**
 * 更新依赖结果
 */
export interface UpdateDependencyResult {
  success: boolean
  updated: UpdateResult[]
}

/**
 * 安全审计结果（供 AI 使用的简化版）
 */
export interface AuditDependenciesResult {
  vulnerabilities: Array<{
    severity: 'low' | 'moderate' | 'high' | 'critical'
    package: string
    title: string
    fixAvailable: boolean
  }>
  summary: string
}

// ==================== 工具实现 ====================

/**
 * 安装 NPM 依赖
 *
 * 注意：此操作需要用户确认（Level 2 权限）
 */
export async function installDependency(
  params: InstallDependencyParams
): Promise<InstallDependencyResult> {
  const installed: string[] = []
  const failed: string[] = []

  for (const pkg of params.packages) {
    try {
      await npmService.installPackage(pkg)
      installed.push(pkg)
    } catch {
      failed.push(pkg)
    }
  }

  return {
    success: failed.length === 0,
    installed,
    failed,
  }
}

/**
 * 更新 NPM 依赖
 */
export async function updateDependency(
  params: UpdateDependencyParams
): Promise<UpdateDependencyResult> {
  const updated = await npmService.updatePackages(params.packages, params.latest)

  const allSuccess = updated.every((u) => u.to !== 'failed')

  return {
    success: allSuccess,
    updated,
  }
}

/**
 * 安全审计依赖
 */
export async function auditDependencies(): Promise<AuditDependenciesResult> {
  const result: AuditResult = await npmService.auditPackages()

  // 过滤掉 info 级别的漏洞
  const vulnerabilities = result.vulnerabilities
    .filter((v): v is AuditVulnerability & { severity: 'low' | 'moderate' | 'high' | 'critical' } =>
      v.severity !== 'info'
    )
    .map((v) => ({
      severity: v.severity,
      package: v.package,
      title: v.title,
      fixAvailable: v.fixAvailable,
    }))

  // 生成摘要
  const { summary } = result
  let summaryText: string

  if (summary.total === 0) {
    summaryText = '没有发现安全漏洞'
  } else {
    const parts: string[] = []
    if (summary.critical > 0) parts.push(`${summary.critical} 个严重`)
    if (summary.high > 0) parts.push(`${summary.high} 个高危`)
    if (summary.moderate > 0) parts.push(`${summary.moderate} 个中等`)
    if (summary.low > 0) parts.push(`${summary.low} 个低危`)

    summaryText = `发现 ${summary.total} 个安全漏洞: ${parts.join(', ')}`
  }

  return {
    vulnerabilities,
    summary: summaryText,
  }
}

/**
 * 列出已安装的依赖（用于 AI 上下文）
 */
export async function listDependencies(): Promise<Array<{
  name: string
  version: string
  isDevDependency: boolean
}>> {
  // 读取 package.json 获取依赖列表
  const fs = await import('fs/promises')
  const path = await import('path')
  const { fileURLToPath } = await import('url')

  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const projectRoot = path.resolve(__dirname, '../../../../..')
  const packageJsonPath = path.join(projectRoot, 'package.json')

  try {
    const content = await fs.readFile(packageJsonPath, 'utf-8')
    const pkg = JSON.parse(content)

    const dependencies: Array<{
      name: string
      version: string
      isDevDependency: boolean
    }> = []

    // 添加生产依赖
    for (const [name, version] of Object.entries(pkg.dependencies || {})) {
      const installedVersion = npmService.getInstalledVersion(name)
      dependencies.push({
        name,
        version: installedVersion || (version as string),
        isDevDependency: false,
      })
    }

    // 添加开发依赖
    for (const [name, version] of Object.entries(pkg.devDependencies || {})) {
      const installedVersion = npmService.getInstalledVersion(name)
      dependencies.push({
        name,
        version: installedVersion || (version as string),
        isDevDependency: true,
      })
    }

    return dependencies
  } catch {
    return []
  }
}
