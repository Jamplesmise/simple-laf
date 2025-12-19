/**
 * 格式化工具函数
 */

/**
 * 格式化相对时间
 */
export function formatTime(date: Date | string): string {
  const now = new Date()
  const d = new Date(date)
  const diff = now.getTime() - d.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}天前`
  if (hours > 0) return `${hours}小时前`
  if (minutes > 0) return `${minutes}分钟前`
  return '刚刚'
}

/**
 * 代码字体
 */
export const codeFont = '"JetBrains Mono", "SF Mono", Monaco, Menlo, Consolas, "Liberation Mono", "Courier New", monospace'
