import 'dotenv/config'

export const config = {
  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT) || 3000,
  mongoUrl: process.env.MONGO_URL || 'mongodb://localhost:27017/simple-ide',
  // 用户数据库名称 (在同一 MongoDB 实例中创建独立数据库)
  userDataDbName: process.env.USER_DATA_DB || 'simple_ide_userdata',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // 开发调试 token
  developToken: process.env.DEVELOP_TOKEN || 'simple-ide-develop-token',
  // 系统域名 (用于自定义域名 CNAME 验证)
  systemDomain: process.env.SYSTEM_DOMAIN || 'localhost:3000',
  // S3 对象存储配置
  s3: {
    endpoint: process.env.S3_ENDPOINT || '',
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
    bucket: process.env.S3_BUCKET || '',
    region: process.env.S3_REGION || 'us-east-1',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  },
}
