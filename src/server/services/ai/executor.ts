import { ObjectId, type Db } from 'mongodb'
import type {
  AIOperation,
  AIExecutionPlan,
  AIOperationResult,
  AIExecutionResponse,
  CreateFunctionOperation,
  UpdateFunctionOperation,
  DeleteFunctionOperation,
  RenameFunctionOperation,
  CreateFolderOperation,
  MoveFunctionOperation,
  SiteCreateFileOperation,
  SiteUpdateFileOperation,
  SiteDeleteFileOperation,
  SiteCreateFolderOperation,
} from './types.js'
import * as siteService from '../site.js'
import * as siteFileService from '../siteFile.js'
import { allTools, generateToolDescriptions } from './tools.js'
import { logAIAction } from '../functionAudit.js'
// 导入模块化提示词
import {
  FUNCTION_CODE_FORMAT,
  CODE_STANDARDS,
  TOOL_USE_FORMAT,
  FUNCTION_OPERATIONS,
  SITE_OPERATIONS,
  SITE_BEST_PRACTICES,
  DEBUG_PROMPT,
  REFACTOR_PROMPT,
  EXPLAIN_PROMPT,
  MERGE_PROMPT,
} from './prompts/index.js'

/**
 * AI 执行器配置
 */
export interface AIExecutorOptions {
  username: string
  modelName?: string
}

/**
 * AI Action 执行器
 * 负责解析 AI 返回的结构化操作并执行
 */
export class AIExecutor {
  private username: string
  private modelName?: string

  constructor(
    private db: Db,
    private userId: ObjectId,
    options?: AIExecutorOptions
  ) {
    this.username = options?.username || 'unknown'
    this.modelName = options?.modelName
  }

  /**
   * 从 AI 响应中解析执行计划
   */
  parsePlan(aiResponse: string): AIExecutionPlan | null {
    try {
      // 尝试提取 JSON 块
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)```/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1].trim())
      }

      // 尝试直接解析
      const parsed = JSON.parse(aiResponse)
      if (parsed.operations && Array.isArray(parsed.operations)) {
        return parsed
      }

      return null
    } catch {
      return null
    }
  }

  /**
   * 执行整个计划
   */
  async execute(plan: AIExecutionPlan): Promise<AIExecutionResponse> {
    const results: AIOperationResult[] = []
    let allSuccess = true

    for (const operation of plan.operations) {
      const result = await this.executeOperation(operation)
      results.push(result)
      if (!result.success) {
        allSuccess = false
      }
    }

    return {
      success: allSuccess,
      plan,
      results,
      message: allSuccess
        ? `成功执行 ${results.length} 个操作`
        : `执行完成，${results.filter(r => r.success).length}/${results.length} 成功`,
    }
  }

  /**
   * 执行单个操作
   */
  private async executeOperation(operation: AIOperation): Promise<AIOperationResult> {
    try {
      switch (operation.type) {
        case 'createFunction':
          return await this.createFunction(operation)
        case 'updateFunction':
          return await this.updateFunction(operation)
        case 'deleteFunction':
          return await this.deleteFunction(operation)
        case 'renameFunction':
          return await this.renameFunction(operation)
        case 'createFolder':
          return await this.createFolder(operation)
        case 'moveFunction':
          return await this.moveFunction(operation)
        // 站点文件操作
        case 'siteCreateFile':
          return await this.siteCreateFile(operation)
        case 'siteUpdateFile':
          return await this.siteUpdateFile(operation)
        case 'siteDeleteFile':
          return await this.siteDeleteFile(operation)
        case 'siteCreateFolder':
          return await this.siteCreateFolder(operation)
        default:
          return {
            operation,
            success: false,
            error: `未知操作类型: ${(operation as AIOperation).type}`,
          }
      }
    } catch (err) {
      return {
        operation,
        success: false,
        error: err instanceof Error ? err.message : '执行失败',
      }
    }
  }

  /**
   * 创建函数
   */
  private async createFunction(op: CreateFunctionOperation): Promise<AIOperationResult> {
    const functions = this.db.collection('functions')

    // 检查名称是否已存在
    const existing = await functions.findOne({
      userId: this.userId,
      name: op.name,
    })

    if (existing) {
      return {
        operation: op,
        success: false,
        error: `函数 "${op.name}" 已存在`,
      }
    }

    // 计算路径
    let path = `/${op.name}`
    if (op.folderId) {
      const folder = await this.db.collection('folders').findOne({
        _id: new ObjectId(op.folderId),
        userId: this.userId,
      })
      if (folder) {
        path = `${folder.path}/${op.name}`
      }
    }

    const result = await functions.insertOne({
      userId: this.userId,
      name: op.name,
      code: op.code,
      path,
      folderId: op.folderId ? new ObjectId(op.folderId) : null,
      published: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // 记录审计日志
    await logAIAction({
      functionId: result.insertedId,
      functionName: op.name,
      userId: this.userId,
      username: this.username,
      action: 'create',
      modelName: this.modelName,
      changes: {
        after: op.code,
        description: op.description || 'AI 创建函数',
      },
    }, this.db)

    return {
      operation: op,
      success: true,
      result: {
        functionId: result.insertedId.toString(),
        name: op.name,
      },
    }
  }

  /**
   * 更新函数
   */
  private async updateFunction(op: UpdateFunctionOperation): Promise<AIOperationResult> {
    const functions = this.db.collection('functions')

    // 获取更新前的函数信息
    const oldFunc = await functions.findOne({
      _id: new ObjectId(op.functionId),
      userId: this.userId,
    })

    if (!oldFunc) {
      return {
        operation: op,
        success: false,
        error: '函数不存在或无权限',
      }
    }

    const result = await functions.updateOne(
      {
        _id: new ObjectId(op.functionId),
        userId: this.userId,
      },
      {
        $set: {
          code: op.code,
          updatedAt: new Date(),
        },
      }
    )

    if (result.matchedCount === 0) {
      return {
        operation: op,
        success: false,
        error: '函数不存在或无权限',
      }
    }

    // 记录审计日志
    await logAIAction({
      functionId: op.functionId,
      functionName: oldFunc.name as string,
      userId: this.userId,
      username: this.username,
      action: 'update',
      modelName: this.modelName,
      changes: {
        before: oldFunc.code as string,
        after: op.code,
        description: op.description || 'AI 更新函数',
      },
    }, this.db)

    return {
      operation: op,
      success: true,
      result: {
        functionId: op.functionId,
      },
    }
  }

  /**
   * 删除函数
   */
  private async deleteFunction(op: DeleteFunctionOperation): Promise<AIOperationResult> {
    const functions = this.db.collection('functions')

    const fn = await functions.findOne({
      _id: new ObjectId(op.functionId),
      userId: this.userId,
    })

    if (!fn) {
      return {
        operation: op,
        success: false,
        error: '函数不存在或无权限',
      }
    }

    await functions.deleteOne({ _id: new ObjectId(op.functionId) })

    // 记录审计日志
    await logAIAction({
      functionId: op.functionId,
      functionName: fn.name as string,
      userId: this.userId,
      username: this.username,
      action: 'delete',
      modelName: this.modelName,
      changes: {
        before: fn.code as string,
        description: 'AI 删除函数',
      },
    }, this.db)

    return {
      operation: op,
      success: true,
      result: {
        functionId: op.functionId,
        name: fn.name,
      },
    }
  }

  /**
   * 重命名函数
   */
  private async renameFunction(op: RenameFunctionOperation): Promise<AIOperationResult> {
    const functions = this.db.collection('functions')

    // 检查新名称是否已存在
    const existing = await functions.findOne({
      userId: this.userId,
      name: op.newName,
      _id: { $ne: new ObjectId(op.functionId) },
    })

    if (existing) {
      return {
        operation: op,
        success: false,
        error: `函数名 "${op.newName}" 已存在`,
      }
    }

    const fn = await functions.findOne({
      _id: new ObjectId(op.functionId),
      userId: this.userId,
    })

    if (!fn) {
      return {
        operation: op,
        success: false,
        error: '函数不存在或无权限',
      }
    }

    // 更新路径
    const oldName = fn.name as string
    const newPath = (fn.path as string).replace(new RegExp(`/${oldName}$`), `/${op.newName}`)

    await functions.updateOne(
      { _id: new ObjectId(op.functionId) },
      {
        $set: {
          name: op.newName,
          path: newPath,
          updatedAt: new Date(),
        },
      }
    )

    // 记录审计日志
    await logAIAction({
      functionId: op.functionId,
      functionName: op.newName,
      userId: this.userId,
      username: this.username,
      action: 'rename',
      modelName: this.modelName,
      changes: {
        description: `AI 重命名函数: ${oldName} -> ${op.newName}`,
      },
      metadata: {
        oldName,
        newName: op.newName,
      },
    }, this.db)

    return {
      operation: op,
      success: true,
      result: {
        functionId: op.functionId,
        name: op.newName,
      },
    }
  }

  /**
   * 创建文件夹
   */
  private async createFolder(op: CreateFolderOperation): Promise<AIOperationResult> {
    const folders = this.db.collection('folders')

    // 检查名称是否已存在
    const existing = await folders.findOne({
      userId: this.userId,
      name: op.name,
      parentId: op.parentId ? new ObjectId(op.parentId) : null,
    })

    if (existing) {
      return {
        operation: op,
        success: false,
        error: `文件夹 "${op.name}" 已存在`,
      }
    }

    // 计算路径
    let path = `/${op.name}`
    if (op.parentId) {
      const parent = await folders.findOne({
        _id: new ObjectId(op.parentId),
        userId: this.userId,
      })
      if (parent) {
        path = `${parent.path}/${op.name}`
      }
    }

    const result = await folders.insertOne({
      userId: this.userId,
      name: op.name,
      parentId: op.parentId ? new ObjectId(op.parentId) : null,
      path,
      order: Date.now(),
      createdAt: new Date(),
    })

    return {
      operation: op,
      success: true,
      result: {
        folderId: result.insertedId.toString(),
        name: op.name,
      },
    }
  }

  /**
   * 移动函数
   */
  private async moveFunction(op: MoveFunctionOperation): Promise<AIOperationResult> {
    const functions = this.db.collection('functions')
    const folders = this.db.collection('folders')

    const fn = await functions.findOne({
      _id: new ObjectId(op.functionId),
      userId: this.userId,
    })

    if (!fn) {
      return {
        operation: op,
        success: false,
        error: '函数不存在或无权限',
      }
    }

    const oldPath = fn.path as string

    // 计算新路径
    let newPath = `/${fn.name}`
    if (op.targetFolderId) {
      const folder = await folders.findOne({
        _id: new ObjectId(op.targetFolderId),
        userId: this.userId,
      })
      if (folder) {
        newPath = `${folder.path}/${fn.name}`
      }
    }

    await functions.updateOne(
      { _id: new ObjectId(op.functionId) },
      {
        $set: {
          folderId: op.targetFolderId ? new ObjectId(op.targetFolderId) : null,
          path: newPath,
          updatedAt: new Date(),
        },
      }
    )

    // 记录审计日志
    await logAIAction({
      functionId: op.functionId,
      functionName: fn.name as string,
      userId: this.userId,
      username: this.username,
      action: 'move',
      modelName: this.modelName,
      changes: {
        description: `AI 移动函数: ${oldPath} -> ${newPath}`,
      },
      metadata: {
        oldPath,
        newPath,
        targetFolderId: op.targetFolderId || null,
      },
    }, this.db)

    return {
      operation: op,
      success: true,
      result: {
        functionId: op.functionId,
        name: fn.name,
      },
    }
  }

  // ==================== 站点文件操作 ====================

  /**
   * 创建站点文件
   */
  private async siteCreateFile(op: SiteCreateFileOperation): Promise<AIOperationResult> {
    try {
      // 确保站点存在
      const site = await siteService.getOrCreate(this.userId)

      // 创建文件
      await siteFileService.save(
        this.userId,
        op.path,
        op.content,
        site
      )

      return {
        operation: op,
        success: true,
        result: {
          name: op.path,
        },
      }
    } catch (err) {
      return {
        operation: op,
        success: false,
        error: err instanceof Error ? err.message : '创建文件失败',
      }
    }
  }

  /**
   * 更新站点文件
   */
  private async siteUpdateFile(op: SiteUpdateFileOperation): Promise<AIOperationResult> {
    try {
      // 检查文件是否存在
      const existingFile = await siteFileService.get(this.userId, op.path)
      if (!existingFile) {
        return {
          operation: op,
          success: false,
          error: `文件 "${op.path}" 不存在`,
        }
      }

      // 获取站点配置
      const site = await siteService.getOrCreate(this.userId)

      // 更新文件
      await siteFileService.save(
        this.userId,
        op.path,
        op.content,
        site
      )

      return {
        operation: op,
        success: true,
        result: {
          name: op.path,
        },
      }
    } catch (err) {
      return {
        operation: op,
        success: false,
        error: err instanceof Error ? err.message : '更新文件失败',
      }
    }
  }

  /**
   * 删除站点文件
   */
  private async siteDeleteFile(op: SiteDeleteFileOperation): Promise<AIOperationResult> {
    try {
      // 检查文件是否存在
      const existingFile = await siteFileService.get(this.userId, op.path)
      if (!existingFile) {
        return {
          operation: op,
          success: false,
          error: `文件 "${op.path}" 不存在`,
        }
      }

      // 删除文件
      await siteFileService.remove(this.userId, op.path)

      return {
        operation: op,
        success: true,
        result: {
          name: op.path,
        },
      }
    } catch (err) {
      return {
        operation: op,
        success: false,
        error: err instanceof Error ? err.message : '删除文件失败',
      }
    }
  }

  /**
   * 创建站点文件夹
   */
  private async siteCreateFolder(op: SiteCreateFolderOperation): Promise<AIOperationResult> {
    try {
      // 确保站点存在
      await siteService.getOrCreate(this.userId)

      // 创建文件夹
      await siteFileService.createDirectory(this.userId, op.path)

      return {
        operation: op,
        success: true,
        result: {
          name: op.path,
        },
      }
    } catch (err) {
      return {
        operation: op,
        success: false,
        error: err instanceof Error ? err.message : '创建文件夹失败',
      }
    }
  }
}

/**
 * 生成 AI 系统提示，用于生成结构化操作
 */
export function getActionSystemPrompt(context: {
  existingFunctions?: Array<{ id: string; name: string; code: string }>
  folders?: Array<{ id: string; name: string; path: string }>
}): string {
  const existingFunctionsSection = context.existingFunctions?.length
    ? `**现有函数：**\n${context.existingFunctions.map(f => `- ${f.name} (ID: ${f.id})`).join('\n')}\n`
    : '暂无函数'

  const foldersSection = context.folders?.length
    ? `\n**文件夹结构：**\n${context.folders.map(f => `- ${f.name} (ID: ${f.id}, 路径: ${f.path})`).join('\n')}\n`
    : '暂无文件夹'

  return `你是一个云函数开发助手，负责帮助用户管理 Serverless 云函数。

${FUNCTION_CODE_FORMAT}

## 输出格式

你必须以 JSON 格式输出操作计划：

\`\`\`json
{
  "thinking": "你的思考过程（可选）",
  "operations": [
    {
      "type": "createFunction",
      "name": "getUserList",
      "code": "import cloud from '@/cloud-sdk'\\n\\nexport default async function (ctx: FunctionContext) {\\n  const db = cloud.database()\\n  const users = await db.collection('users').find().toArray()\\n  return { data: users }\\n}",
      "description": "创建获取用户列表函数"
    }
  ],
  "summary": "创建了 1 个函数"
}
\`\`\`

## 可用操作类型

### 云函数操作
- \`createFunction\`: 创建新函数 { type, name, code, folderId?, description? }
- \`updateFunction\`: 修改函数 { type, functionId, code, description? }
- \`deleteFunction\`: 删除函数 { type, functionId, description? }
- \`renameFunction\`: 重命名 { type, functionId, newName, description? }
- \`createFolder\`: 创建文件夹 { type, name, parentId?, description? }
- \`moveFunction\`: 移动函数 { type, functionId, targetFolderId?, description? }

### 静态站点操作
- \`siteCreateFile\`: 创建站点文件 { type, path, content, description? }
- \`siteUpdateFile\`: 更新站点文件 { type, path, content, description? }
- \`siteDeleteFile\`: 删除站点文件 { type, path, description? }
- \`siteCreateFolder\`: 创建站点文件夹 { type, path, description? }

${SITE_BEST_PRACTICES}

## 当前环境

${existingFunctionsSection}
${foldersSection}

${CODE_STANDARDS}

## 重要提示

- 只输出 JSON 格式，不要输出其他内容
- code 字段中的换行使用 \\n 转义
- 确保生成的代码可以直接运行`
}

/**
 * 上下文信息接口
 */
export interface ConversationContext {
  existingFunctions?: Array<{ id: string; name: string; code: string; path?: string }>
  folders?: Array<{ id: string; name: string; path: string }>
  referencedFunctions?: Array<{ id: string; name: string; code: string }>
  logSummary?: string
  customPrompt?: string
}

/**
 * 生成灵活的系统提示词
 *
 * 这个提示词允许 AI 根据用户意图自主决定：
 * 1. 直接对话回复（解答问题、解释概念）
 * 2. 使用工具执行操作（创建/修改函数、调试等）
 */
export function getFlexibleSystemPrompt(context: ConversationContext): string {
  const customPromptSection = context.customPrompt
    ? `\n## 用户自定义指令\n\n${context.customPrompt}\n`
    : ''

  const referencedFunctionsSection = context.referencedFunctions?.length
    ? `\n## 用户引用的函数\n\n以下是用户在对话中 @ 引用的函数，请重点关注：\n\n${context.referencedFunctions
        .map((f) => `### ${f.name} (ID: ${f.id})\n\`\`\`typescript\n${f.code}\n\`\`\``)
        .join('\n\n')}\n`
    : ''

  const logSummarySection = context.logSummary
    ? `\n## 执行日志摘要\n\n${context.logSummary}\n`
    : ''

  const existingFunctionsSection = context.existingFunctions?.length
    ? `**现有函数：**\n${context.existingFunctions.map((f) => `- ${f.name} (ID: ${f.id}${f.path ? `, 路径: ${f.path}` : ''})`).join('\n')}`
    : '暂无函数'

  const foldersSection = context.folders?.length
    ? `\n**文件夹结构：**\n${context.folders.map((f) => `- ${f.name} (ID: ${f.id}, 路径: ${f.path})`).join('\n')}`
    : ''

  return `你是一个 Serverless 云函数开发助手。你的任务是帮助用户管理和开发云函数。
${customPromptSection}
## 核心原则

1. **理解用户意图**：仔细分析用户的问题，判断他们需要什么帮助
2. **选择合适的响应方式**：
   - 如果用户只是提问或需要解释，直接用自然语言回答
   - 如果用户需要执行操作（创建/修改/删除函数等），使用工具

## 响应方式

### 方式一：自然语言回复

当用户：
- 询问概念或知识（如"什么是云函数"）
- 请求解释代码（如"解释一下这个函数做什么"）
- 讨论设计方案（如"我应该怎么设计这个功能"）
- 闲聊或打招呼

直接用自然语言回复，不要使用工具。

### 方式二：使用工具

${TOOL_USE_FORMAT}

## 可用工具

${generateToolDescriptions(allTools)}

${FUNCTION_CODE_FORMAT}

## 当前环境

${existingFunctionsSection}
${foldersSection}
${referencedFunctionsSection}
${logSummarySection}

${CODE_STANDARDS}

## 示例

**用户问"什么是云函数"：**
直接回答：云函数是一种 Serverless 计算服务，允许你编写和运行代码而无需管理服务器...

**用户说"帮我创建一个获取用户列表的函数"：**
我来帮你创建一个获取用户列表的函数。

<tool_use>
<tool>create_function</tool>
<arguments>
{
  "name": "getUserList",
  "code": "import cloud from '@/cloud-sdk'\\n\\nexport default async function (ctx: FunctionContext) {\\n  const db = cloud.database()\\n  const users = await db.collection('users').find().toArray()\\n  return { data: users }\\n}",
  "description": "获取用户列表"
}
</arguments>
</tool_use>

**用户说"这个函数有 bug，帮我调试"（引用了某个函数）：**
我来帮你调试这个函数，分析问题并生成修复方案。

<tool_use>
<tool>debug_function</tool>
<arguments>
{
  "functionId": "xxx",
  "issue": "用户反馈有 bug"
}
</arguments>
</tool_use>`
}

/**
 * 生成专用工具的系统提示词（用于特定场景）
 */
export function getSpecializedPrompt(
  type: 'debug' | 'refactor' | 'explain' | 'merge',
  context: ConversationContext
): string {
  const baseContext = `
## 当前环境

${context.existingFunctions?.length ? `**现有函数：**\n${context.existingFunctions.map((f) => `- ${f.name} (ID: ${f.id})`).join('\n')}` : '暂无函数'}
${context.referencedFunctions?.length ? `\n**目标函数：**\n${context.referencedFunctions.map((f) => `### ${f.name}\n\`\`\`typescript\n${f.code}\n\`\`\``).join('\n\n')}` : ''}
`

  switch (type) {
    case 'debug':
      return `${DEBUG_PROMPT}\n${baseContext}`

    case 'refactor':
      return `${REFACTOR_PROMPT}\n${baseContext}`

    case 'explain':
      return `${EXPLAIN_PROMPT}\n${baseContext}`

    case 'merge':
      return `${MERGE_PROMPT}\n${baseContext}`

    default:
      return getFlexibleSystemPrompt(context)
  }
}
