import { ObjectId } from 'mongodb'
import { getDB } from '../../db.js'

// 对话接口
export interface AIConversation {
  _id: ObjectId
  userId: ObjectId
  title: string
  archived: boolean
  starred: boolean
  systemPromptId?: ObjectId  // 使用的系统提示词 ID
  createdAt: Date
  updatedAt: Date
}

// 消息接口
export interface AIMessage {
  _id: ObjectId
  conversationId: ObjectId
  role: 'user' | 'assistant' | 'system'
  content: string
  // AI 执行结果 (如果有)
  executionResult?: {
    success: boolean
    operations?: Array<{
      type: string
      success: boolean
      error?: string
    }>
  }
  createdAt: Date
}

// 创建对话输入
export interface CreateConversationInput {
  title?: string
  systemPromptId?: string
}

// 更新对话输入
export interface UpdateConversationInput {
  title?: string
  archived?: boolean
  starred?: boolean
}

// 对话列表过滤
export interface ConversationFilter {
  archived?: boolean
  starred?: boolean
}

/**
 * 获取对话列表
 */
export async function listConversations(
  userId: ObjectId,
  filter: ConversationFilter = {}
): Promise<AIConversation[]> {
  const db = getDB()

  const query: Record<string, unknown> = { userId }

  if (filter.archived !== undefined) {
    query.archived = filter.archived
  }
  if (filter.starred !== undefined) {
    query.starred = filter.starred
  }

  return db.collection<AIConversation>('ai_conversations')
    .find(query)
    .sort({ updatedAt: -1 })
    .toArray()
}

/**
 * 获取对话详情 (含消息)
 */
export async function getConversation(
  userId: ObjectId,
  conversationId: ObjectId
): Promise<{ conversation: AIConversation; messages: AIMessage[] } | null> {
  const db = getDB()

  const conversation = await db.collection<AIConversation>('ai_conversations')
    .findOne({ _id: conversationId, userId })

  if (!conversation) {
    return null
  }

  const messages = await db.collection<AIMessage>('ai_messages')
    .find({ conversationId })
    .sort({ createdAt: 1 })
    .toArray()

  return { conversation, messages }
}

/**
 * 创建对话
 */
export async function createConversation(
  userId: ObjectId,
  input: CreateConversationInput = {}
): Promise<AIConversation> {
  const db = getDB()
  const now = new Date()

  const conversation: Omit<AIConversation, '_id'> = {
    userId,
    title: input.title || '新对话',
    archived: false,
    starred: false,
    systemPromptId: input.systemPromptId ? new ObjectId(input.systemPromptId) : undefined,
    createdAt: now,
    updatedAt: now,
  }

  const result = await db.collection<AIConversation>('ai_conversations')
    .insertOne(conversation as AIConversation)

  return { ...conversation, _id: result.insertedId } as AIConversation
}

/**
 * 更新对话
 */
export async function updateConversation(
  userId: ObjectId,
  conversationId: ObjectId,
  input: UpdateConversationInput
): Promise<AIConversation | null> {
  const db = getDB()

  const update: Record<string, unknown> = {
    updatedAt: new Date()
  }

  if (input.title !== undefined) {
    update.title = input.title
  }
  if (input.archived !== undefined) {
    update.archived = input.archived
  }
  if (input.starred !== undefined) {
    update.starred = input.starred
  }

  const result = await db.collection<AIConversation>('ai_conversations')
    .findOneAndUpdate(
      { _id: conversationId, userId },
      { $set: update },
      { returnDocument: 'after' }
    )

  return result
}

/**
 * 删除对话 (同时删除消息)
 */
export async function deleteConversation(
  userId: ObjectId,
  conversationId: ObjectId
): Promise<boolean> {
  const db = getDB()

  // 验证对话属于用户
  const conversation = await db.collection<AIConversation>('ai_conversations')
    .findOne({ _id: conversationId, userId })

  if (!conversation) {
    return false
  }

  // 删除消息
  await db.collection<AIMessage>('ai_messages')
    .deleteMany({ conversationId })

  // 删除对话
  await db.collection<AIConversation>('ai_conversations')
    .deleteOne({ _id: conversationId })

  return true
}

/**
 * 添加消息到对话
 */
export async function addMessage(
  conversationId: ObjectId,
  role: AIMessage['role'],
  content: string,
  executionResult?: AIMessage['executionResult']
): Promise<AIMessage> {
  const db = getDB()
  const now = new Date()

  const message: Omit<AIMessage, '_id'> = {
    conversationId,
    role,
    content,
    executionResult,
    createdAt: now,
  }

  const result = await db.collection<AIMessage>('ai_messages')
    .insertOne(message as AIMessage)

  // 更新对话的 updatedAt
  await db.collection<AIConversation>('ai_conversations')
    .updateOne(
      { _id: conversationId },
      { $set: { updatedAt: now } }
    )

  return { ...message, _id: result.insertedId } as AIMessage
}

/**
 * 获取对话消息列表
 */
export async function getMessages(
  conversationId: ObjectId,
  limit = 100
): Promise<AIMessage[]> {
  const db = getDB()

  return db.collection<AIMessage>('ai_messages')
    .find({ conversationId })
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray()
}

/**
 * 根据第一条用户消息自动生成对话标题
 */
export async function autoGenerateTitle(
  conversationId: ObjectId,
  firstMessage: string
): Promise<void> {
  const db = getDB()

  // 截取前 30 个字符作为标题
  let title = firstMessage.trim().slice(0, 30)
  if (firstMessage.length > 30) {
    title += '...'
  }

  await db.collection<AIConversation>('ai_conversations')
    .updateOne(
      { _id: conversationId, title: '新对话' },
      { $set: { title, updatedAt: new Date() } }
    )
}
