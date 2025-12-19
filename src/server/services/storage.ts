import {
  S3Client,
  ListBucketsCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Upload } from '@aws-sdk/lib-storage'
import { config } from '../config.js'

// ==================== 类型定义 ====================

export interface BucketInfo {
  name: string
  creationDate?: Date
}

export interface ObjectInfo {
  key: string
  size: number
  lastModified: Date
  isFolder: boolean
  etag?: string
}

export interface ListObjectsResult {
  objects: ObjectInfo[]
  prefixes: string[]  // 文件夹前缀
  isTruncated: boolean
  nextContinuationToken?: string
}

// ==================== S3 客户端 ====================

let s3Client: S3Client | null = null

/**
 * 获取 S3 客户端 (单例)
 */
function getClient(): S3Client {
  if (!config.s3.endpoint || !config.s3.accessKeyId || !config.s3.secretAccessKey) {
    throw new Error('S3 存储未配置，请设置环境变量 S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY')
  }

  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: config.s3.endpoint,
      region: config.s3.region || 'us-east-1',
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
      forcePathStyle: config.s3.forcePathStyle,
    })
  }

  return s3Client
}

/**
 * 获取默认存储桶
 */
function getDefaultBucket(): string {
  if (!config.s3.bucket) {
    throw new Error('未配置默认存储桶，请设置环境变量 S3_BUCKET')
  }
  return config.s3.bucket
}

/**
 * 检查 S3 是否已配置
 */
export function isConfigured(): boolean {
  return !!(config.s3.endpoint && config.s3.accessKeyId && config.s3.secretAccessKey)
}

/**
 * 获取 S3 配置状态 (脱敏)
 */
export function getConfigStatus(): {
  configured: boolean
  endpoint?: string
  bucket?: string
  region?: string
} {
  return {
    configured: isConfigured(),
    endpoint: config.s3.endpoint ? config.s3.endpoint.replace(/\/\/.*@/, '//***@') : undefined,
    bucket: config.s3.bucket || undefined,
    region: config.s3.region || 'us-east-1',
  }
}

/**
 * 测试 S3 连接
 */
export async function testConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const client = getClient()
    const bucket = config.s3.bucket

    if (bucket) {
      await client.send(new HeadBucketCommand({ Bucket: bucket }))
      return { success: true, message: `成功连接到存储桶: ${bucket}` }
    }

    await client.send(new ListBucketsCommand({}))
    return { success: true, message: '连接成功' }
  } catch (err) {
    const message = err instanceof Error ? err.message : '连接失败'
    return { success: false, message }
  }
}

// ==================== 存储桶操作 ====================

/**
 * 列出所有存储桶
 */
export async function listBuckets(): Promise<BucketInfo[]> {
  const client = getClient()
  const response = await client.send(new ListBucketsCommand({}))

  return (response.Buckets || []).map((bucket) => ({
    name: bucket.Name || '',
    creationDate: bucket.CreationDate,
  }))
}

/**
 * 创建存储桶
 */
export async function createBucket(bucketName: string): Promise<void> {
  if (!bucketName || !/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(bucketName)) {
    throw new Error('存储桶名称无效，只能包含小写字母、数字、点和连字符')
  }

  const client = getClient()
  await client.send(new CreateBucketCommand({ Bucket: bucketName }))
}

/**
 * 删除存储桶
 */
export async function deleteBucket(bucketName: string): Promise<void> {
  const client = getClient()
  await client.send(new DeleteBucketCommand({ Bucket: bucketName }))
}

// ==================== 对象操作 ====================

/**
 * 列出对象
 */
export async function listObjects(
  bucket: string,
  prefix?: string,
  continuationToken?: string,
  maxKeys: number = 100
): Promise<ListObjectsResult> {
  const client = getClient()

  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix || '',
      Delimiter: '/',
      MaxKeys: maxKeys,
      ContinuationToken: continuationToken,
    })
  )

  const objects: ObjectInfo[] = (response.Contents || [])
    .filter((obj) => obj.Key && obj.Key !== prefix) // 排除前缀本身
    .map((obj) => ({
      key: obj.Key || '',
      size: obj.Size || 0,
      lastModified: obj.LastModified || new Date(),
      isFolder: false,
      etag: obj.ETag?.replace(/"/g, ''),
    }))

  // 处理文件夹 (CommonPrefixes)
  const prefixes = (response.CommonPrefixes || [])
    .map((p) => p.Prefix || '')
    .filter(Boolean)

  // 将文件夹添加到对象列表前面
  const folders: ObjectInfo[] = prefixes.map((p) => ({
    key: p,
    size: 0,
    lastModified: new Date(),
    isFolder: true,
  }))

  return {
    objects: [...folders, ...objects],
    prefixes,
    isTruncated: response.IsTruncated || false,
    nextContinuationToken: response.NextContinuationToken,
  }
}

/**
 * 上传对象
 */
export async function uploadObject(
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const client = getClient()

  // 对于大文件使用分片上传
  if (body.length > 5 * 1024 * 1024) {
    const upload = new Upload({
      client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      },
    })
    await upload.done()
  } else {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    )
  }
}

/**
 * 下载对象
 */
export async function downloadObject(
  bucket: string,
  key: string
): Promise<{ body: Buffer; contentType: string }> {
  const client = getClient()

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  )

  if (!response.Body) {
    throw new Error('文件内容为空')
  }

  // 转换流为 Buffer
  const chunks: Uint8Array[] = []
  const stream = response.Body as AsyncIterable<Uint8Array>
  for await (const chunk of stream) {
    chunks.push(chunk)
  }

  return {
    body: Buffer.concat(chunks),
    contentType: response.ContentType || 'application/octet-stream',
  }
}

/**
 * 删除单个对象
 */
export async function deleteObject(bucket: string, key: string): Promise<void> {
  const client = getClient()
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  )
}

/**
 * 批量删除对象
 */
export async function deleteObjects(bucket: string, keys: string[]): Promise<void> {
  if (keys.length === 0) return

  const client = getClient()

  // S3 批量删除限制 1000 个
  const batchSize = 1000
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize)
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: batch.map((key) => ({ Key: key })),
          Quiet: true, // 不返回删除结果，提高性能
        },
      })
    )
  }
}

/**
 * 创建文件夹 (通过创建空对象实现)
 */
export async function createFolder(bucket: string, prefix: string): Promise<void> {
  const client = getClient()

  // 确保前缀以斜杠结尾
  const folderKey = prefix.endsWith('/') ? prefix : prefix + '/'

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: folderKey,
      Body: Buffer.alloc(0),
    })
  )
}

/**
 * 获取预签名下载 URL
 */
export async function getPresignedUrl(
  bucket: string,
  key: string,
  expiresIn: number = 3600 // 默认 1 小时
): Promise<string> {
  const client = getClient()

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  return await getSignedUrl(client, command, { expiresIn })
}

/**
 * 获取预签名上传 URL
 */
export async function getPresignedUploadUrl(
  bucket: string,
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getClient()

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  })

  return await getSignedUrl(client, command, { expiresIn })
}
