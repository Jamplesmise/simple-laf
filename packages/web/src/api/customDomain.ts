import client from './client'

// 自定义域名
export interface CustomDomain {
  _id: string
  domain: string
  targetPath?: string
  verified: boolean
  lastVerifiedAt?: string
  createdAt: string
  updatedAt: string
}

interface ListResponse {
  success: boolean
  data: CustomDomain[]
}

interface DomainResponse {
  success: boolean
  data: CustomDomain
}

interface SystemDomainResponse {
  success: boolean
  data: { systemDomain: string }
}

interface VerifyResponse {
  success: boolean
  data: { verified: boolean; message: string }
}

export const customDomainApi = {
  // 获取系统域名
  getSystemDomain: () =>
    client.get<SystemDomainResponse>('/api/custom-domains/system-domain'),

  // 获取域名列表
  list: () =>
    client.get<ListResponse>('/api/custom-domains'),

  // 添加域名
  add: (domain: string, targetPath?: string) =>
    client.post<DomainResponse>('/api/custom-domains', { domain, targetPath }),

  // 更新域名
  update: (id: string, targetPath?: string) =>
    client.patch<{ success: boolean }>(`/api/custom-domains/${id}`, { targetPath }),

  // 删除域名
  remove: (id: string) =>
    client.delete<{ success: boolean }>(`/api/custom-domains/${id}`),

  // 验证 DNS
  verify: (id: string) =>
    client.post<VerifyResponse>(`/api/custom-domains/${id}/verify`),
}
