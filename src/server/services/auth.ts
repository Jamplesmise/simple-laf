import bcrypt from 'bcrypt'
import jwt, { type SignOptions } from 'jsonwebtoken'
import { ObjectId } from 'mongodb'
import { getDB } from '../db.js'
import { config } from '../config.js'

export interface User {
  _id: ObjectId
  username: string
  password: string
  createdAt: Date
}

export interface AuthResult {
  token: string
  user: {
    id: string
    username: string
  }
}

export async function register(
  username: string,
  password: string
): Promise<AuthResult> {
  const db = getDB()

  const existing = await db.collection<User>('users').findOne({ username })
  if (existing) {
    throw new Error('用户名已存在')
  }

  const hash = await bcrypt.hash(password, 10)
  const result = await db.collection('users').insertOne({
    username,
    password: hash,
    createdAt: new Date()
  })

  const token = jwt.sign(
    { userId: result.insertedId.toString(), username },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn } as SignOptions
  )

  return {
    token,
    user: { id: result.insertedId.toString(), username }
  }
}

export async function login(
  username: string,
  password: string
): Promise<AuthResult> {
  const db = getDB()

  const user = await db.collection<User>('users').findOne({ username })
  if (!user) {
    throw new Error('用户不存在')
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    throw new Error('密码错误')
  }

  const token = jwt.sign(
    { userId: user._id.toString(), username },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn } as SignOptions
  )

  return {
    token,
    user: { id: user._id.toString(), username }
  }
}

export async function getUser(userId: string): Promise<{ id: string; username: string } | null> {
  const db = getDB()

  const user = await db.collection<User>('users').findOne({
    _id: new ObjectId(userId)
  })

  if (!user) {
    return null
  }

  return { id: user._id.toString(), username: user.username }
}
