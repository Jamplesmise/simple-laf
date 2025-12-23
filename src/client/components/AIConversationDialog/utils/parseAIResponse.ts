/**
 * AI 响应解析工具
 *
 * 支持解析:
 * - 新格式: <tool_use> 标签
 * - 旧格式: JSON 操作计划
 * - 思考标签: <think>, <thinking> 等
 */

// AI 操作类型
export interface AIOperation {
  type: string
  name?: string
  description?: string
  code?: string
  functionId?: string
}

// 工具调用
export interface ToolCall {
  tool: string
  arguments: Record<string, unknown>
}

// 解析后的 AI 响应
export interface ParsedAIResponse {
  thinking?: string
  operations?: AIOperation[]
  toolCalls?: ToolCall[]
  summary?: string
  rawContent?: string
}

/**
 * 解析 AI 响应内容
 */
export function parseAIResponse(content: string): ParsedAIResponse {
  let thinking: string | undefined
  let processedContent = content
  const operations: AIOperation[] = []
  const toolCalls: ToolCall[] = []

  // 1. 提取思考标签
  const thinkPatterns = [
    /<think>([\s\S]*?)<\/think>/g,
    /<thinking>([\s\S]*?)<\/thinking>/g,
    /<thought>([\s\S]*?)<\/thought>/g,
    /<reasoning>([\s\S]*?)<\/reasoning>/g,
  ]

  for (const pattern of thinkPatterns) {
    const match = content.match(pattern)
    if (match) {
      // 提取第一个匹配作为思考内容
      const innerMatch = match[0].match(/<\w+>([\s\S]*?)<\/\w+>/)
      if (innerMatch) {
        thinking = innerMatch[1].trim()
      }
      // 从内容中移除所有思考标签
      processedContent = processedContent.replace(pattern, '')
      break
    }
  }

  // 2. 解析 <tool_use> 标签 (新格式)
  const toolUsePattern = /<tool_use>\s*<tool>([\w_]+)<\/tool>\s*<arguments>([\s\S]*?)<\/arguments>\s*<\/tool_use>/g
  let toolMatch
  while ((toolMatch = toolUsePattern.exec(processedContent)) !== null) {
    try {
      const tool = toolMatch[1]
      const args = JSON.parse(toolMatch[2].trim())
      toolCalls.push({ tool, arguments: args })

      // 转换为操作显示
      const op = convertToolCallToOperation(tool, args)
      if (op) {
        operations.push(op)
      }
    } catch {
      // 解析失败，跳过
    }
  }

  // 移除 tool_use 标签
  processedContent = processedContent.replace(toolUsePattern, '')

  // 3. 尝试解析 JSON 格式 (旧格式)
  if (operations.length === 0) {
    try {
      // 查找 JSON 代码块
      const jsonMatch = processedContent.match(/```json\s*([\s\S]*?)```/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1].trim())
        if (parsed.operations && Array.isArray(parsed.operations)) {
          for (const op of parsed.operations) {
            operations.push({
              type: mapOperationType(op.type),
              name: op.name,
              description: op.description,
              code: op.code,
              functionId: op.functionId,
            })
          }
          // 移除 JSON 块
          processedContent = processedContent.replace(/```json\s*[\s\S]*?```/, '')

          // 提取思考和摘要
          if (parsed.thinking && !thinking) {
            thinking = parsed.thinking
          }
        }
      }
    } catch {
      // 不是有效的 JSON
    }

    // 尝试直接解析整个内容为 JSON
    if (operations.length === 0) {
      try {
        const trimmed = processedContent.trim()
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          const parsed = JSON.parse(trimmed)
          if (parsed.operations && Array.isArray(parsed.operations)) {
            for (const op of parsed.operations) {
              operations.push({
                type: mapOperationType(op.type),
                name: op.name,
                description: op.description,
                code: op.code,
                functionId: op.functionId,
              })
            }
            // 如果整个内容都是 JSON，清空 rawContent
            processedContent = ''

            if (parsed.thinking && !thinking) {
              thinking = parsed.thinking
            }
          }
        }
      } catch {
        // 不是 JSON
      }
    }
  }

  // 4. 清理残留内容
  processedContent = processedContent
    .replace(/<\/?think>/g, '')
    .replace(/<\/?thinking>/g, '')
    .replace(/<\/?thought>/g, '')
    .replace(/<\/?reasoning>/g, '')
    .replace(/<\/?tool_use>/g, '')
    .replace(/<\/?tool>/g, '')
    .replace(/<\/?arguments>/g, '')
    .trim()

  return {
    thinking,
    operations: operations.length > 0 ? operations : undefined,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    rawContent: processedContent || undefined,
  }
}

/**
 * 将工具调用转换为操作显示
 */
function convertToolCallToOperation(tool: string, args: Record<string, unknown>): AIOperation | null {
  switch (tool) {
    case 'create_function':
    case 'createFunction':
      return {
        type: 'create',
        name: args.name as string,
        description: args.description as string,
        code: args.code as string,
      }
    case 'update_function':
    case 'updateFunction':
      return {
        type: 'update',
        name: `更新函数`,
        description: args.description as string,
        code: args.code as string,
        functionId: args.functionId as string,
      }
    case 'delete_function':
    case 'deleteFunction':
      return {
        type: 'delete',
        name: `删除函数`,
        description: args.reason as string,
        functionId: args.functionId as string,
      }
    case 'rename_function':
    case 'renameFunction':
      return {
        type: 'rename',
        name: args.newName as string,
        description: `重命名函数`,
        functionId: args.functionId as string,
      }
    case 'create_folder':
    case 'createFolder':
      return {
        type: 'folder',
        name: args.name as string,
        description: `创建文件夹`,
      }
    case 'debug_function':
      return {
        type: 'debug',
        name: '调试函数',
        description: args.issue as string,
        functionId: args.functionId as string,
      }
    case 'explain_code':
      return {
        type: 'explain',
        name: '解释代码',
        functionId: args.functionId as string,
      }
    case 'analyze_refactor':
      return {
        type: 'refactor',
        name: '重构分析',
        functionId: args.functionId as string,
      }
    // 站点文件操作
    case 'site_create_file':
    case 'siteCreateFile':
      return {
        type: 'site_create',
        name: args.path as string,
        description: `创建站点文件`,
        code: args.content as string,
      }
    case 'site_update_file':
    case 'siteUpdateFile':
      return {
        type: 'site_update',
        name: args.path as string,
        description: `更新站点文件`,
        code: args.content as string,
      }
    case 'site_delete_file':
    case 'siteDeleteFile':
      return {
        type: 'site_delete',
        name: args.path as string,
        description: `删除站点文件`,
      }
    case 'site_create_folder':
    case 'siteCreateFolder':
      return {
        type: 'site_folder',
        name: args.path as string,
        description: `创建站点文件夹`,
      }
    default:
      return {
        type: tool,
        name: tool,
        description: JSON.stringify(args),
      }
  }
}

/**
 * 映射旧的操作类型到新的显示类型
 */
function mapOperationType(type: string): string {
  const mapping: Record<string, string> = {
    createFunction: 'create',
    updateFunction: 'update',
    deleteFunction: 'delete',
    renameFunction: 'rename',
    createFolder: 'folder',
    moveFunction: 'move',
  }
  return mapping[type] || type
}
