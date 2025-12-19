import { ObjectId, Db } from 'mongodb'

export interface AISystemPrompt {
  _id: ObjectId
  userId: ObjectId
  name: string
  content: string
  isDefault: boolean
  currentVersion: number
  createdAt: Date
  updatedAt: Date
}

export interface AIPromptVersion {
  _id: ObjectId
  promptId: ObjectId
  version: number
  content: string
  changeNote?: string
  createdAt: Date
}

export interface CreatePromptInput {
  name: string
  content: string
  isDefault?: boolean
}

export interface UpdatePromptInput {
  name?: string
  content?: string
  isDefault?: boolean
  changeNote?: string
}

// 获取系统提示词列表
export async function listSystemPrompts(
  db: Db,
  userId: ObjectId
): Promise<AISystemPrompt[]> {
  const collection = db.collection<AISystemPrompt>('ai_system_prompts')
  return collection.find({ userId }).sort({ isDefault: -1, updatedAt: -1 }).toArray()
}

// 获取单个系统提示词
export async function getSystemPrompt(
  db: Db,
  userId: ObjectId,
  promptId: ObjectId
): Promise<AISystemPrompt | null> {
  const collection = db.collection<AISystemPrompt>('ai_system_prompts')
  return collection.findOne({ _id: promptId, userId })
}

// 创建系统提示词
export async function createSystemPrompt(
  db: Db,
  userId: ObjectId,
  input: CreatePromptInput
): Promise<AISystemPrompt> {
  const collection = db.collection<AISystemPrompt>('ai_system_prompts')
  const versionCollection = db.collection<AIPromptVersion>('ai_prompt_versions')

  // 如果设为默认，先取消其他默认
  if (input.isDefault) {
    await collection.updateMany(
      { userId, isDefault: true },
      { $set: { isDefault: false } }
    )
  }

  const now = new Date()
  const prompt: AISystemPrompt = {
    _id: new ObjectId(),
    userId,
    name: input.name,
    content: input.content,
    isDefault: input.isDefault || false,
    currentVersion: 1,
    createdAt: now,
    updatedAt: now,
  }

  await collection.insertOne(prompt)

  // 创建初始版本
  const version: AIPromptVersion = {
    _id: new ObjectId(),
    promptId: prompt._id,
    version: 1,
    content: input.content,
    changeNote: '初始版本',
    createdAt: now,
  }
  await versionCollection.insertOne(version)

  return prompt
}

// 更新系统提示词
export async function updateSystemPrompt(
  db: Db,
  userId: ObjectId,
  promptId: ObjectId,
  input: UpdatePromptInput
): Promise<AISystemPrompt | null> {
  const collection = db.collection<AISystemPrompt>('ai_system_prompts')
  const versionCollection = db.collection<AIPromptVersion>('ai_prompt_versions')

  const prompt = await collection.findOne({ _id: promptId, userId })
  if (!prompt) return null

  const updateData: Partial<AISystemPrompt> = {
    updatedAt: new Date(),
  }

  if (input.name !== undefined) {
    updateData.name = input.name
  }

  // 如果设为默认，先取消其他默认
  if (input.isDefault === true) {
    await collection.updateMany(
      { userId, isDefault: true, _id: { $ne: promptId } },
      { $set: { isDefault: false } }
    )
    updateData.isDefault = true
  } else if (input.isDefault === false) {
    updateData.isDefault = false
  }

  // 如果内容变更，创建新版本
  if (input.content !== undefined && input.content !== prompt.content) {
    const newVersion = prompt.currentVersion + 1
    updateData.content = input.content
    updateData.currentVersion = newVersion

    const version: AIPromptVersion = {
      _id: new ObjectId(),
      promptId: prompt._id,
      version: newVersion,
      content: input.content,
      changeNote: input.changeNote,
      createdAt: new Date(),
    }
    await versionCollection.insertOne(version)
  }

  await collection.updateOne({ _id: promptId }, { $set: updateData })

  return collection.findOne({ _id: promptId })
}

// 删除系统提示词
export async function deleteSystemPrompt(
  db: Db,
  userId: ObjectId,
  promptId: ObjectId
): Promise<boolean> {
  const collection = db.collection<AISystemPrompt>('ai_system_prompts')
  const versionCollection = db.collection<AIPromptVersion>('ai_prompt_versions')

  const result = await collection.deleteOne({ _id: promptId, userId })
  if (result.deletedCount > 0) {
    // 删除所有版本
    await versionCollection.deleteMany({ promptId })
    return true
  }
  return false
}

// 获取版本列表
export async function listPromptVersions(
  db: Db,
  userId: ObjectId,
  promptId: ObjectId
): Promise<AIPromptVersion[]> {
  const collection = db.collection<AISystemPrompt>('ai_system_prompts')
  const versionCollection = db.collection<AIPromptVersion>('ai_prompt_versions')

  // 验证所有权
  const prompt = await collection.findOne({ _id: promptId, userId })
  if (!prompt) return []

  return versionCollection.find({ promptId }).sort({ version: -1 }).toArray()
}

// 回滚到指定版本
export async function rollbackToVersion(
  db: Db,
  userId: ObjectId,
  promptId: ObjectId,
  version: number
): Promise<AISystemPrompt | null> {
  const collection = db.collection<AISystemPrompt>('ai_system_prompts')
  const versionCollection = db.collection<AIPromptVersion>('ai_prompt_versions')

  // 验证所有权
  const prompt = await collection.findOne({ _id: promptId, userId })
  if (!prompt) return null

  // 获取目标版本
  const targetVersion = await versionCollection.findOne({ promptId, version })
  if (!targetVersion) return null

  // 创建回滚版本
  const newVersion = prompt.currentVersion + 1
  const rollbackVersion: AIPromptVersion = {
    _id: new ObjectId(),
    promptId,
    version: newVersion,
    content: targetVersion.content,
    changeNote: `回滚到版本 ${version}`,
    createdAt: new Date(),
  }
  await versionCollection.insertOne(rollbackVersion)

  // 更新提示词
  await collection.updateOne(
    { _id: promptId },
    {
      $set: {
        content: targetVersion.content,
        currentVersion: newVersion,
        updatedAt: new Date(),
      },
    }
  )

  return collection.findOne({ _id: promptId })
}

// 获取默认提示词
export async function getDefaultSystemPrompt(
  db: Db,
  userId: ObjectId
): Promise<AISystemPrompt | null> {
  const collection = db.collection<AISystemPrompt>('ai_system_prompts')
  return collection.findOne({ userId, isDefault: true })
}
