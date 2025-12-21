/**
 * 环境变量管理工具
 *
 * 提供环境变量的设置、删除和列表功能
 * Sprint 15: 依赖与配置
 */

import { ObjectId } from 'mongodb'
import * as envService from '../../env.js'

// ==================== 类型定义 ====================

/**
 * 设置环境变量参数
 */
export interface SetEnvVariableParams {
  key: string
  value: string
  isSecret?: boolean
  description?: string
}

/**
 * 设置环境变量结果
 */
export interface SetEnvVariableResult {
  success: boolean
  key: string
}

/**
 * 删除环境变量参数
 */
export interface DeleteEnvVariableParams {
  key: string
}

/**
 * 删除环境变量结果
 */
export interface DeleteEnvVariableResult {
  success: boolean
  key: string
}

/**
 * 环境变量列表项（敏感值脱敏）
 */
export interface EnvVariableItem {
  key: string
  value: string  // 敏感值脱敏后的显示值
  isSecret: boolean
  description?: string
}

/**
 * 列表环境变量结果
 */
export interface ListEnvVariablesResult {
  variables: EnvVariableItem[]
  count: number
}

// ==================== 工具实现 ====================

/**
 * 脱敏函数：隐藏敏感值的中间部分
 */
function maskValue(value: string, isSecret: boolean): string {
  if (!isSecret) return value
  if (value.length <= 4) return '****'
  return value.slice(0, 2) + '****' + value.slice(-2)
}

/**
 * 检测值是否可能是敏感信息
 */
function detectSecret(key: string, value: string): boolean {
  const secretKeyPatterns = [
    /secret/i,
    /password/i,
    /pwd/i,
    /token/i,
    /api[_-]?key/i,
    /private[_-]?key/i,
    /access[_-]?key/i,
    /auth/i,
    /credential/i,
  ]

  // 检查 key 是否匹配敏感模式
  if (secretKeyPatterns.some((pattern) => pattern.test(key))) {
    return true
  }

  // 检查 value 是否看起来像密钥（长字符串，混合大小写和数字）
  if (value.length > 20 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value)) {
    return true
  }

  return false
}

/**
 * 设置环境变量
 */
export async function setEnvVariable(
  params: SetEnvVariableParams,
  userId: ObjectId
): Promise<SetEnvVariableResult> {
  // 验证变量名格式
  if (!/^[A-Z_][A-Z0-9_]*$/.test(params.key)) {
    throw new Error('变量名格式错误，请使用大写字母、数字和下划线')
  }

  // 自动检测敏感信息
  const isSecret = params.isSecret ?? detectSecret(params.key, params.value)

  await envService.setEnvVariable(
    userId,
    params.key,
    params.value,
    params.description || (isSecret ? '敏感信息' : undefined)
  )

  return {
    success: true,
    key: params.key,
  }
}

/**
 * 删除环境变量
 */
export async function deleteEnvVariable(
  params: DeleteEnvVariableParams,
  userId: ObjectId
): Promise<DeleteEnvVariableResult> {
  const deleted = await envService.deleteEnvVariable(userId, params.key)

  if (!deleted) {
    throw new Error(`环境变量 ${params.key} 不存在`)
  }

  return {
    success: true,
    key: params.key,
  }
}

/**
 * 列出环境变量（敏感值脱敏）
 */
export async function listEnvVariables(
  userId: ObjectId
): Promise<ListEnvVariablesResult> {
  const envs = await envService.listEnvVariablesWithValues(userId)

  const variables: EnvVariableItem[] = envs.map((env) => {
    const isSecret = detectSecret(env.key, env.value)
    return {
      key: env.key,
      value: maskValue(env.value, isSecret),
      isSecret,
      description: env.description,
    }
  })

  return {
    variables,
    count: variables.length,
  }
}

/**
 * 获取环境变量上下文（用于 AI 了解可用变量）
 */
export async function getEnvContext(
  userId: ObjectId
): Promise<string> {
  const { variables } = await listEnvVariables(userId)

  if (variables.length === 0) {
    return '当前没有配置环境变量。'
  }

  const lines = ['当前配置的环境变量:']
  for (const v of variables) {
    const desc = v.description ? ` - ${v.description}` : ''
    const secret = v.isSecret ? ' [敏感]' : ''
    lines.push(`- ${v.key}${secret}: ${v.value}${desc}`)
  }

  return lines.join('\n')
}
