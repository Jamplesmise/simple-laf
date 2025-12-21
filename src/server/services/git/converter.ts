// 转换 laf 函数格式 → 本地格式
export function convertFromLaf(code: string): string {
  // 移除 laf 特有的 import
  return code.replace(/import\s+cloud\s+from\s+['"]@lafjs\/cloud['"]\s*;?\n?/g, '')
}

// 转换本地格式 → laf 函数格式
export function convertToLaf(code: string): string {
  // 添加 laf 的 import
  if (!code.includes('@lafjs/cloud')) {
    return `import cloud from '@lafjs/cloud'\n\n${code}`
  }
  return code
}
