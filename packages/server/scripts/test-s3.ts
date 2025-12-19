/**
 * S3 连接和读写测试脚本
 * 运行: npx tsx scripts/test-s3.ts
 */

import { S3Client, ListBucketsCommand, ListObjectsV2Command, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { config } from '../src/config.js'

const { s3 } = config

console.log('=== S3 连接测试 ===\n')
console.log('配置信息:')
console.log('  Endpoint:', s3.endpoint)
console.log('  Access Key:', s3.accessKeyId)
console.log('  Bucket:', s3.bucket)
console.log('  Region:', s3.region)
console.log('  Force Path Style:', s3.forcePathStyle)
console.log('')

// 创建 S3 客户端
const client = new S3Client({
  endpoint: s3.endpoint,
  region: s3.region,
  credentials: {
    accessKeyId: s3.accessKeyId,
    secretAccessKey: s3.secretAccessKey,
  },
  forcePathStyle: s3.forcePathStyle,
})

async function testConnection() {
  console.log('1. 测试连接 - 列出存储桶...')
  try {
    const { Buckets } = await client.send(new ListBucketsCommand({}))
    console.log('   ✅ 连接成功!')
    console.log('   存储桶列表:', Buckets?.map(b => b.Name).join(', ') || '(空)')
  } catch (error: unknown) {
    console.log('   ❌ 连接失败:', (error as Error).message)
    throw error
  }
}

async function testListObjects() {
  console.log(`\n2. 列出对象 - ${s3.bucket}...`)
  try {
    const { Contents, KeyCount } = await client.send(new ListObjectsV2Command({
      Bucket: s3.bucket,
      MaxKeys: 10,
    }))
    console.log('   ✅ 成功!')
    console.log('   对象数量:', KeyCount || 0)
    if (Contents && Contents.length > 0) {
      console.log('   前10个对象:')
      Contents.forEach(obj => {
        console.log(`     - ${obj.Key} (${obj.Size} bytes)`)
      })
    }
  } catch (error: unknown) {
    console.log('   ❌ 失败:', (error as Error).message)
    throw error
  }
}

async function testWriteObject() {
  const testKey = 'test/hello.txt'
  const testContent = `Hello from Simple IDE!\nTimestamp: ${new Date().toISOString()}`

  console.log(`\n3. 写入测试 - ${testKey}...`)
  try {
    await client.send(new PutObjectCommand({
      Bucket: s3.bucket,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
    }))
    console.log('   ✅ 写入成功!')
    console.log('   内容:', testContent.replace(/\n/g, ' | '))
  } catch (error: unknown) {
    console.log('   ❌ 写入失败:', (error as Error).message)
    throw error
  }
}

async function testReadObject() {
  const testKey = 'test/hello.txt'

  console.log(`\n4. 读取测试 - ${testKey}...`)
  try {
    const { Body, ContentType, ContentLength } = await client.send(new GetObjectCommand({
      Bucket: s3.bucket,
      Key: testKey,
    }))
    const content = await Body?.transformToString()
    console.log('   ✅ 读取成功!')
    console.log('   Content-Type:', ContentType)
    console.log('   Content-Length:', ContentLength)
    console.log('   内容:', content?.replace(/\n/g, ' | '))
  } catch (error: unknown) {
    console.log('   ❌ 读取失败:', (error as Error).message)
    throw error
  }
}

async function testDeleteObject() {
  const testKey = 'test/hello.txt'

  console.log(`\n5. 删除测试 - ${testKey}...`)
  try {
    await client.send(new DeleteObjectCommand({
      Bucket: s3.bucket,
      Key: testKey,
    }))
    console.log('   ✅ 删除成功!')
  } catch (error: unknown) {
    console.log('   ❌ 删除失败:', (error as Error).message)
    throw error
  }
}

async function main() {
  try {
    await testConnection()
    await testListObjects()
    await testWriteObject()
    await testReadObject()
    await testDeleteObject()

    console.log('\n=== 所有测试通过 ✅ ===\n')
  } catch {
    console.log('\n=== 测试失败 ❌ ===\n')
    process.exit(1)
  }
}

main()
