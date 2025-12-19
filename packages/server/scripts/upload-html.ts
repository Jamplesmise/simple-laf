import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { config } from '../src/config.js'

const client = new S3Client({
  endpoint: config.s3.endpoint,
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
  forcePathStyle: config.s3.forcePathStyle,
})

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Simple IDE</title>
</head>
<body>
</body>
</html>`

async function main() {
  await client.send(new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: 'index.html',
    Body: html,
    ContentType: 'text/html',
  }))

  console.log('✅ 已上传 index.html')
  console.log(`URL: ${config.s3.endpoint}/${config.s3.bucket}/index.html`)
}

main()
