// 构建带认证的 URL
export function buildAuthUrl(repoUrl: string, token?: string): string {
  if (!token) return repoUrl

  try {
    const url = new URL(repoUrl)
    return `https://${token}@${url.host}${url.pathname}`
  } catch {
    return repoUrl
  }
}
