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
  // Sprint 10.2 新增字段
  parentMessageId?: ObjectId    // 分支：父消息 ID
  version: number               // 版本号（编辑后递增）
  feedback?: 'like' | 'dislike' // 用户反馈
  feedbackNote?: string         // 反馈备注
  createdAt: Date
  updatedAt: Date
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
  executionResult?: AIMessage['executionResult'],
  parentMessageId?: ObjectId
): Promise<AIMessage> {
  const db = getDB()
  const now = new Date()

  const message: Omit<AIMessage, '_id'> = {
    conversationId,
    role,
    content,
    executionResult,
    parentMessageId,
    version: 1,
    createdAt: now,
    updatedAt: now,
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
 * 更新消息内容（编辑）
 */
export async function updateMessage(
  messageId: ObjectId,
  userId: ObjectId,
  content: string
): Promise<{ message: AIMessage; deletedCount: number } | null> {
  const db = getDB()
  const now = new Date()

  // 查找消息并验证权限
  const message = await db.collection<AIMessage>('ai_messages').findOne({ _id: messageId })
  if (!message) return null

  // 验证对话属于用户
  const conversation = await db.collection<AIConversation>('ai_conversations')
    .findOne({ _id: message.conversationId, userId })
  if (!conversation) return null

  // 更新消息
  const updatedMessage = await db.collection<AIMessage>('ai_messages')
    .findOneAndUpdate(
      { _id: messageId },
      {
        $set: { content, updatedAt: now },
        $inc: { version: 1 }
      },
      { returnDocument: 'after' }
    )

  if (!updatedMessage) return null

  // 如果是用户消息，删除后续所有消息
  let deletedCount = 0
  if (message.role === 'user') {
    const deleteResult = await db.collection<AIMessage>('ai_messages')
      .deleteMany({
        conversationId: message.conversationId,
        createdAt: { $gt: message.createdAt }
      })
    deletedCount = deleteResult.deletedCount
  }

  // 更新对话时间
  await db.collection<AIConversation>('ai_conversations')
    .updateOne(
      { _id: message.conversationId },
      { $set: { updatedAt: now } }
    )

  return { message: updatedMessage, deletedCount }
}

/**
 * 更新消息反馈
 */
export async function updateMessageFeedback(
  messageId: ObjectId,
  userId: ObjectId,
  feedback: 'like' | 'dislike' | null,
  feedbackNote?: string
): Promise<AIMessage | null> {
  const db = getDB()

  // 查找消息并验证权限
  const message = await db.collection<AIMessage>('ai_messages').findOne({ _id: messageId })
  if (!message) return null

  // 验证对话属于用户
  const conversation = await db.collection<AIConversation>('ai_conversations')
    .findOne({ _id: message.conversationId, userId })
  if (!conversation) return null

  // 更新反馈
  const update: Record<string, unknown> = { updatedAt: new Date() }
  if (feedback === null) {
    // 取消反馈
    update.feedback = null
    update.feedbackNote = null
  } else {
    update.feedback = feedback
    if (feedbackNote !== undefined) {
      update.feedbackNote = feedbackNote
    }
  }

  return db.collection<AIMessage>('ai_messages')
    .findOneAndUpdate(
      { _id: messageId },
      { $set: update },
      { returnDocument: 'after' }
    )
}

/**
 * 从指定消息创建分支对话
 */
export async function createBranch(
  messageId: ObjectId,
  userId: ObjectId,
  newContent?: string
): Promise<{ conversation: AIConversation; messages: AIMessage[] } | null> {
  const db = getDB()
  const now = new Date()

  // 查找源消息
  const sourceMessage = await db.collection<AIMessage>('ai_messages').findOne({ _id: messageId })
  if (!sourceMessage) return null

  // 验证原对话属于用户
  const sourceConversation = await db.collection<AIConversation>('ai_conversations')
    .findOne({ _id: sourceMessage.conversationId, userId })
  if (!sourceConversation) return null

  // 获取到源消息为止的所有消息（包含源消息）
  const messagesToCopy = await db.collection<AIMessage>('ai_messages')
    .find({
      conversationId: sourceMessage.conversationId,
      createdAt: { $lte: sourceMessage.createdAt }
    })
    .sort({ createdAt: 1 })
    .toArray()

  // 创建新对话
  const branchConversation: Omit<AIConversation, '_id'> = {
    userId,
    title: `${sourceConversation.title} (分支)`,
    archived: false,
    starred: false,
    systemPromptId: sourceConversation.systemPromptId,
    createdAt: now,
    updatedAt: now,
  }

  const conversationResult = await db.collection<AIConversation>('ai_conversations')
    .insertOne(branchConversation as AIConversation)
  const newConversationId = conversationResult.insertedId

  // 复制消息到新对话
  const newMessages: AIMessage[] = []
  for (let i = 0; i < messagesToCopy.length; i++) {
    const msg = messagesToCopy[i]
    const isLastMessage = i === messagesToCopy.length - 1

    const newMessage: Omit<AIMessage, '_id'> = {
      conversationId: newConversationId,
      role: msg.role,
      content: isLastMessage && newContent !== undefined ? newContent : msg.content,
      executionResult: msg.executionResult,
      parentMessageId: isLastMessage ? messageId : undefined, // 最后一条消息标记父消息
      version: 1,
      createdAt: now,
      updatedAt: now,
    }

    const result = await db.collection<AIMessage>('ai_messages')
      .insertOne(newMessage as AIMessage)
    newMessages.push({ ...newMessage, _id: result.insertedId } as AIMessage)
  }

  return {
    conversation: { ...branchConversation, _id: newConversationId } as AIConversation,
    messages: newMessages
  }
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
