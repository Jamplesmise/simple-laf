import { MongoClient, Db } from 'mongodb'
import { config } from './config.js'

let db: Db
let userDataDb: Db
let client: MongoClient | null = null

export async function connectDB(): Promise<void> {
  client = new MongoClient(config.mongoUrl)
  await client.connect()
  // 从连接字符串解析数据库名，如果没有则使用默认值 'simple-ide'
  const url = new URL(config.mongoUrl)
  const dbName = url.pathname.slice(1) || 'simple-ide'
  db = client.db(dbName)
  console.log(`MongoDB connected to database: ${dbName}`)

  // 连接用户数据库 (独立数据库，用于用户自定义集合)
  userDataDb = client.db(config.userDataDbName)
  console.log(`User data database: ${config.userDataDbName}`)

  // 创建索引
  await db.collection('users').createIndex({ username: 1 }, { unique: true })
  await db.collection('functions').createIndex(
    { userId: 1, name: 1 }
    // 注意：不再是唯一索引，允许不同文件夹下存在同名函数
  )
  await db.collection('functions').createIndex(
    { userId: 1, path: 1 },
    { unique: true }  // path 是唯一的，保证完整路径不重复
  )
  await db.collection('functions').createIndex(
    { path: 1, published: 1 }
  )
  await db.collection('dependencies').createIndex(
    { userId: 1, name: 1 },
    { unique: true }
  )
  await db.collection('function_versions').createIndex(
    { functionId: 1, version: -1 }
  )
  await db.collection('env_variables').createIndex(
    { userId: 1, key: 1 },
    { unique: true }
  )
  // 文件夹索引
  await db.collection('folders').createIndex(
    { userId: 1, path: 1 },
    { unique: true }
  )
  await db.collection('folders').createIndex(
    { userId: 1, parentId: 1 }
  )
  // Git 配置索引
  await db.collection('git_config').createIndex(
    { userId: 1 },
    { unique: true }
  )
  // 定时任务索引
  await db.collection('scheduled_tasks').createIndex(
    { userId: 1, functionId: 1 },
    { unique: true }
  )
  await db.collection('scheduled_tasks').createIndex(
    { userId: 1, enabled: 1 }
  )
  // 执行日志索引
  await db.collection('execution_logs').createIndex(
    { userId: 1, functionId: 1, createdAt: -1 }
  )
  await db.collection('execution_logs').createIndex(
    { userId: 1, createdAt: -1 }
  )
  await db.collection('execution_logs').createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 7 * 24 * 60 * 60 } // 7天自动过期
  )
  // AI 配置索引
  await db.collection('ai_config').createIndex(
    { userId: 1 },
    { unique: true }
  )
  // AI 历史索引
  await db.collection('ai_history').createIndex(
    { userId: 1, createdAt: -1 }
  )
  await db.collection('ai_history').createIndex(
    { userId: 1, functionId: 1 }
  )
  // API Token 索引
  await db.collection('api_tokens').createIndex(
    { userId: 1 }
  )
  await db.collection('api_tokens').createIndex(
    { token: 1 },
    { unique: true }
  )
  await db.collection('api_tokens').createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 } // TTL 自动删除过期 token
  )
}

export async function closeDB(): Promise<void> {
  if (client) {
    await client.close()
    client = null
  }
}

export function getDB(): Db {
  if (!db) {
    throw new Error('Database not connected')
  }
  return db
}

export function getUserDataDB(): Db {
  if (!userDataDb) {
    throw new Error('User data database not connected')
  }
  return userDataDb
}

// For testing purposes
export function setDB(testDb: Db): void {
  db = testDb
}
