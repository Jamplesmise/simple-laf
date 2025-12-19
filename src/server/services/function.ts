import { ObjectId } from 'mongodb'
import { getDB } from '../db.js'

export interface CloudFunction {
  _id: ObjectId
  name: string
  code: string
  compiled: string
  userId: ObjectId
  published: boolean
  publishedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface FunctionData {
  name?: string
  code?: string
  compiled?: string
  published?: boolean
  publishedAt?: Date | null
}

export async function list(userId: string): Promise<CloudFunction[]> {
  const db = getDB()
  return db
    .collection<CloudFunction>('functions')
    .find({ userId: new ObjectId(userId) })
    .sort({ updatedAt: -1 })
    .toArray()
}

export async function create(
  userId: string,
  name: string,
  code: string
): Promise<CloudFunction> {
  const db = getDB()
  const now = new Date()

  const doc = {
    name,
    code,
    compiled: '',
    userId: new ObjectId(userId),
    published: true,
    createdAt: now,
    updatedAt: now
  }

  const result = await db.collection('functions').insertOne(doc)

  return {
    _id: result.insertedId,
    ...doc
  }
}

export async function findById(
  id: string,
  userId: string
): Promise<CloudFunction | null> {
  const db = getDB()
  return db.collection<CloudFunction>('functions').findOne({
    _id: new ObjectId(id),
    userId: new ObjectId(userId)
  })
}

export async function update(
  id: string,
  userId: string,
  data: FunctionData
): Promise<boolean> {
  const db = getDB()
  const result = await db.collection('functions').updateOne(
    { _id: new ObjectId(id), userId: new ObjectId(userId) },
    { $set: { ...data, updatedAt: new Date() } }
  )
  return result.matchedCount > 0
}

export async function remove(id: string, userId: string): Promise<boolean> {
  const db = getDB()
  const result = await db.collection('functions').deleteOne({
    _id: new ObjectId(id),
    userId: new ObjectId(userId)
  })
  return result.deletedCount > 0
}
