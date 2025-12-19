import { MongoClient, Db } from 'mongodb'
import 'dotenv/config'

let client: MongoClient | null = null
let db: Db | null = null

const TEST_DB_NAME = 'simple-ide-test'

export async function connectTestDB(): Promise<Db> {
  if (db) return db

  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017'

  client = new MongoClient(mongoUrl)
  await client.connect()
  // 直接指定测试数据库名
  db = client.db(TEST_DB_NAME)

  return db
}

export async function closeTestDB(): Promise<void> {
  if (client) {
    await client.close()
    client = null
    db = null
  }
}

export async function clearTestDB(): Promise<void> {
  if (!db) return

  const collections = await db.listCollections().toArray()
  for (const col of collections) {
    await db.collection(col.name).deleteMany({})
  }
}

export function getTestDB(): Db {
  if (!db) {
    throw new Error('Test database not connected')
  }
  return db
}
