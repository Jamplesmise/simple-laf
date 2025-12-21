import type { EnvVariable } from '../../api/env'

/**
 * 将环境变量数组转换为 .env 格式的字符串
 */
export function envsToCode(vars: EnvVariable[]): string {
  return vars.map(v => {
    const needsQuote = /[\s"'=]/.test(v.value) || v.value === ''
    const value = needsQuote ? `"${v.value.replace(/"/g, '\\"')}"` : v.value
    return `${v.key}=${value}`
  }).join('\n')
}

/**
 * 将 .env 格式的字符串解析为环境变量数组
 */
export function codeToEnvs(code: string): EnvVariable[] {
  const lines = code.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'))
  const result: EnvVariable[] = []
  for (const line of lines) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (match) {
      let value = match[2]
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1).replace(/\\"/g, '"')
      }
      result.push({ key: match[1], value })
    }
  }
  return result
}

/**
 * 对敏感值进行脱敏显示
 */
export function maskValue(value: string): string {
  if (value.length <= 4) return '••••••'
  return value.slice(0, 2) + '••••••' + value.slice(-2)
}
