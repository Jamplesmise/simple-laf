import { ObjectId } from 'mongodb'
import dns from 'node:dns/promises'
import { getDB } from '../db.js'
import { config } from '../config.js'

export interface CustomDomain {
  _id: ObjectId
  userId: ObjectId
  domain: string           // 自定义域名 (如 api.example.com)
  targetPath?: string      // 可选：指向特定函数路径
  verified: boolean        // DNS 验证状态
  lastVerifiedAt?: Date    // 上次验证时间
  createdAt: Date
  updatedAt: Date
}

/**
 * 获取系统域名
 */
export function getSystemDomain(): string {
  return config.systemDomain
}

/**
 * 获取用户的自定义域名列表
 */
export async function listDomains(userId: ObjectId): Promise<CustomDomain[]> {
  const db = getDB()
  return db.collection<CustomDomain>('custom_domains')
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray()
}

/**
 * 添加自定义域名
 */
export async function addDomain(
  userId: ObjectId,
  domain: string,
  targetPath?: string
): Promise<CustomDomain> {
  const db = getDB()

  // 规范化域名 (去除协议和路径)
  const normalizedDomain = domain
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .trim()

  if (!normalizedDomain) {
    throw new Error('域名格式无效')
  }

  // 检查域名是否已被使用
  const existing = await db.collection<CustomDomain>('custom_domains').findOne({
    domain: normalizedDomain
  })

  if (existing) {
    if (existing.userId.equals(userId)) {
      throw new Error('该域名已添加')
    } else {
      throw new Error('该域名已被其他用户使用')
    }
  }

  const now = new Date()
  const doc: Omit<CustomDomain, '_id'> = {
    userId,
    domain: normalizedDomain,
    targetPath: targetPath?.trim() || undefined,
    verified: false,
    createdAt: now,
    updatedAt: now
  }

  const result = await db.collection<CustomDomain>('custom_domains').insertOne(doc as CustomDomain)

  return {
    _id: result.insertedId,
    ...doc
  } as CustomDomain
}

/**
 * 更新自定义域名
 */
export async function updateDomain(
  userId: ObjectId,
  domainId: ObjectId,
  updates: { targetPath?: string }
): Promise<boolean> {
  const db = getDB()
  const result = await db.collection<CustomDomain>('custom_domains').updateOne(
    { _id: domainId, userId },
    {
      $set: {
        targetPath: updates.targetPath?.trim() || undefined,
        updatedAt: new Date()
      }
    }
  )
  return result.matchedCount > 0
}

/**
 * 删除自定义域名
 */
export async function removeDomain(
  userId: ObjectId,
  domainId: ObjectId
): Promise<boolean> {
  const db = getDB()
  const result = await db.collection<CustomDomain>('custom_domains').deleteOne({
    _id: domainId,
    userId
  })
  return result.deletedCount > 0
}

/**
 * 验证 DNS CNAME 记录
 * 返回: { verified: boolean, message: string }
 */
export async function verifyDNS(
  userId: ObjectId,
  domainId: ObjectId
): Promise<{ verified: boolean; message: string }> {
  const db = getDB()
  const domain = await db.collection<CustomDomain>('custom_domains').findOne({
    _id: domainId,
    userId
  })

  if (!domain) {
    return { verified: false, message: '域名不存在' }
  }

  const expectedCname = getSystemDomain()

  try {
    // 尝试解析 CNAME 记录
    const cnameRecords = await dns.resolveCname(domain.domain)

    // 检查是否有匹配的 CNAME
    const matched = cnameRecords.some(cname => {
      const normalizedCname = cname.toLowerCase().replace(/\.$/, '')
      const normalizedExpected = expectedCname.toLowerCase().replace(/:\d+$/, '')
      return normalizedCname === normalizedExpected || normalizedCname.endsWith('.' + normalizedExpected)
    })

    if (matched) {
      // 更新验证状态
      await db.collection<CustomDomain>('custom_domains').updateOne(
        { _id: domainId },
        {
          $set: {
            verified: true,
            lastVerifiedAt: new Date(),
            updatedAt: new Date()
          }
        }
      )
      return { verified: true, message: 'DNS 验证成功' }
    } else {
      return {
        verified: false,
        message: `CNAME 记录不匹配，需要指向: ${expectedCname}，当前值: ${cnameRecords.join(', ')}`
      }
    }
  } catch (err) {
    const error = err as NodeJS.ErrnoException

    if (error.code === 'ENODATA' || error.code === 'ENOTFOUND') {
      return {
        verified: false,
        message: `未找到 CNAME 记录，请添加 CNAME 记录指向: ${expectedCname}`
      }
    }

    return {
      verified: false,
      message: `DNS 解析失败: ${error.message}`
    }
  }
}

/**
 * 根据域名查找配置 (用于请求路由)
 */
export async function findDomainByHost(host: string): Promise<CustomDomain | null> {
  const db = getDB()
  // 规范化：去除端口号
  const normalizedHost = host.toLowerCase().replace(/:\d+$/, '')

  return db.collection<CustomDomain>('custom_domains').findOne({
    domain: normalizedHost,
    verified: true
  })
}

/**
 * 获取域名详情
 */
export async function getDomain(
  userId: ObjectId,
  domainId: ObjectId
): Promise<CustomDomain | null> {
  const db = getDB()
  return db.collection<CustomDomain>('custom_domains').findOne({
    _id: domainId,
    userId
  })
}
