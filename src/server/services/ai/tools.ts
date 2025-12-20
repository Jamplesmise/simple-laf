/**
 * AI 工具定义
 *
 * 定义 AI 可用的工具，让 AI 根据用户意图自主决定使用哪些工具
 */

/**
 * 工具定义接口
 */
export interface AITool {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, {
      type: string
      description: string
      enum?: string[]
      items?: { type: string }
    }>
    required: string[]
  }
}

/**
 * 工具调用结果
 */
export interface ToolCall {
  tool: string
  arguments: Record<string, unknown>
}

/**
 * AI 响应类型
 */
export interface AIResponse {
  type: 'message' | 'tool_use'
  content?: string
  toolCalls?: ToolCall[]
}

/**
 * 函数管理工具
 */
export const functionTools: AITool[] = [
  {
    name: 'create_function',
    description: '创建新的云函数。当用户要求创建新功能、新接口时使用',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '函数名称，使用 camelCase 命名（如 getUserList）',
        },
        code: {
          type: 'string',
          description: '函数代码，必须遵循云函数格式',
        },
        folderId: {
          type: 'string',
          description: '目标文件夹 ID（可选）',
        },
        description: {
          type: 'string',
          description: '函数描述',
        },
      },
      required: ['name', 'code'],
    },
  },
  {
    name: 'update_function',
    description: '修改现有云函数的代码。当用户要求修改、优化、修复某个函数时使用',
    parameters: {
      type: 'object',
      properties: {
        functionId: {
          type: 'string',
          description: '要修改的函数 ID',
        },
        code: {
          type: 'string',
          description: '新的函数代码',
        },
        description: {
          type: 'string',
          description: '修改说明',
        },
      },
      required: ['functionId', 'code'],
    },
  },
  {
    name: 'delete_function',
    description: '删除云函数。当用户明确要求删除某个函数时使用',
    parameters: {
      type: 'object',
      properties: {
        functionId: {
          type: 'string',
          description: '要删除的函数 ID',
        },
        reason: {
          type: 'string',
          description: '删除原因',
        },
      },
      required: ['functionId'],
    },
  },
  {
    name: 'rename_function',
    description: '重命名云函数',
    parameters: {
      type: 'object',
      properties: {
        functionId: {
          type: 'string',
          description: '要重命名的函数 ID',
        },
        newName: {
          type: 'string',
          description: '新的函数名称',
        },
      },
      required: ['functionId', 'newName'],
    },
  },
  {
    name: 'move_function',
    description: '移动云函数到其他文件夹',
    parameters: {
      type: 'object',
      properties: {
        functionId: {
          type: 'string',
          description: '要移动的函数 ID',
        },
        targetFolderId: {
          type: 'string',
          description: '目标文件夹 ID，为空则移动到根目录',
        },
      },
      required: ['functionId'],
    },
  },
  {
    name: 'create_folder',
    description: '创建文件夹',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '文件夹名称',
        },
        parentId: {
          type: 'string',
          description: '父文件夹 ID（可选）',
        },
      },
      required: ['name'],
    },
  },
]

/**
 * 分析工具
 */
export const analysisTools: AITool[] = [
  {
    name: 'explain_code',
    description: '解释代码功能和实现细节。当用户问"这个函数做什么"、"解释一下这段代码"时使用',
    parameters: {
      type: 'object',
      properties: {
        functionId: {
          type: 'string',
          description: '要解释的函数 ID',
        },
        depth: {
          type: 'string',
          description: '解释深度',
          enum: ['brief', 'detailed', 'line_by_line'],
        },
      },
      required: ['functionId'],
    },
  },
  {
    name: 'analyze_refactor',
    description: '分析代码是否需要重构，提供优化建议。当用户问"这个函数需要优化吗"、"怎么改进这段代码"时使用',
    parameters: {
      type: 'object',
      properties: {
        functionId: {
          type: 'string',
          description: '要分析的函数 ID',
        },
      },
      required: ['functionId'],
    },
  },
  {
    name: 'analyze_merge',
    description: '分析多个函数是否适合合并。当用户选择多个函数并询问是否可以合并时使用',
    parameters: {
      type: 'object',
      properties: {
        functionIds: {
          type: 'array',
          description: '要分析合并的函数 ID 列表',
          items: { type: 'string' },
        },
      },
      required: ['functionIds'],
    },
  },
]

/**
 * 调试工具
 */
export const debugTools: AITool[] = [
  {
    name: 'debug_function',
    description: '自动调试函数：生成测试用例、运行测试、诊断问题、生成修复方案。当用户说"帮我调试"、"这个函数有问题"时使用',
    parameters: {
      type: 'object',
      properties: {
        functionId: {
          type: 'string',
          description: '要调试的函数 ID',
        },
        issue: {
          type: 'string',
          description: '用户描述的问题（可选）',
        },
      },
      required: ['functionId'],
    },
  },
  {
    name: 'run_function',
    description: '执行函数并查看结果。当用户说"运行一下"、"测试这个函数"时使用',
    parameters: {
      type: 'object',
      properties: {
        functionId: {
          type: 'string',
          description: '要执行的函数 ID',
        },
        input: {
          type: 'object',
          description: '输入参数（body, query, headers）',
        },
      },
      required: ['functionId'],
    },
  },
]

/**
 * 站点文件工具
 *
 * 最佳实践：
 * 1. 默认使用单文件 HTML（内联 CSS 和 JS），避免文件联动问题
 * 2. 如果需要分离文件，先创建文件夹，再将相关文件放入
 * 3. 页面主文件命名为 index.html
 */
export const siteTools: AITool[] = [
  {
    name: 'site_create_file',
    description: '创建站点文件。默认使用单文件 HTML（CSS 放 <style>，JS 放 <script>）。如需分离文件，先用 site_create_folder 创建文件夹，再将文件放入该文件夹',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件路径。单页面用 "/index.html"；多页面用 "/页面名/index.html"（如 "/login/index.html"）',
        },
        content: {
          type: 'string',
          description: '文件内容。HTML 文件应包含完整的 DOCTYPE、head、body，CSS/JS 默认内联',
        },
        description: {
          type: 'string',
          description: '文件描述',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'site_update_file',
    description: '更新站点文件内容。当用户要求修改现有的静态文件时使用',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '要更新的文件路径',
        },
        content: {
          type: 'string',
          description: '新的文件内容',
        },
        description: {
          type: 'string',
          description: '修改说明',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'site_delete_file',
    description: '删除站点文件。当用户明确要求删除某个静态文件时使用',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '要删除的文件路径',
        },
        reason: {
          type: 'string',
          description: '删除原因',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'site_create_folder',
    description: '创建站点文件夹。当用户要求创建目录来组织静态文件时使用',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件夹路径，如 "/css"、"/js/lib"',
        },
      },
      required: ['path'],
    },
  },
]

/**
 * 日志分析工具
 */
export const logTools: AITool[] = [
  {
    name: 'analyze_logs',
    description: '分析执行日志，发现问题和优化点。当用户使用 /log 命令或问"最近有什么错误"时使用',
    parameters: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: '分析最近多少天的日志',
        },
        functionId: {
          type: 'string',
          description: '指定函数 ID（可选，不指定则分析所有）',
        },
        focus: {
          type: 'string',
          description: '分析重点',
          enum: ['errors', 'performance', 'usage', 'all'],
        },
      },
      required: ['days'],
    },
  },
]

/**
 * 所有工具
 */
export const allTools: AITool[] = [
  ...functionTools,
  ...analysisTools,
  ...debugTools,
  ...logTools,
  ...siteTools,
]

/**
 * 工具名称到操作类型的映射
 */
export const toolToOperationType: Record<string, string> = {
  create_function: 'createFunction',
  update_function: 'updateFunction',
  delete_function: 'deleteFunction',
  rename_function: 'renameFunction',
  move_function: 'moveFunction',
  create_folder: 'createFolder',
  // 站点文件操作
  site_create_file: 'siteCreateFile',
  site_update_file: 'siteUpdateFile',
  site_delete_file: 'siteDeleteFile',
  site_create_folder: 'siteCreateFolder',
}

/**
 * 生成工具描述（用于 System Prompt）
 */
export function generateToolDescriptions(tools: AITool[]): string {
  return tools
    .map((tool) => {
      const params = Object.entries(tool.parameters.properties)
        .map(([name, prop]) => {
          const required = tool.parameters.required.includes(name) ? '(必填)' : '(可选)'
          return `    - ${name} ${required}: ${prop.description}`
        })
        .join('\n')

      return `### ${tool.name}
${tool.description}

参数:
${params}`
    })
    .join('\n\n')
}

/**
 * 解析 AI 响应中的工具调用
 */
export function parseToolCalls(response: string): AIResponse {
  // 尝试解析 <tool_use> 标签格式
  const toolUseMatches = response.matchAll(/<tool_use>\s*<tool>([\w_]+)<\/tool>\s*<arguments>([\s\S]*?)<\/arguments>\s*<\/tool_use>/g)

  const toolCalls: ToolCall[] = []
  for (const match of toolUseMatches) {
    try {
      const tool = match[1]
      const args = JSON.parse(match[2].trim())
      toolCalls.push({ tool, arguments: args })
    } catch {
      // 解析失败，跳过
    }
  }

  if (toolCalls.length > 0) {
    // 提取非工具调用的文本内容
    const content = response
      .replace(/<tool_use>[\s\S]*?<\/tool_use>/g, '')
      .trim()

    return {
      type: 'tool_use',
      content: content || undefined,
      toolCalls,
    }
  }

  // 尝试解析 JSON 格式的工具调用（兼容旧格式）
  try {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)```/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1].trim())
      if (parsed.operations && Array.isArray(parsed.operations)) {
        // 转换旧格式到新格式
        const calls = parsed.operations.map((op: Record<string, unknown>) => ({
          tool: toolToOperationType[op.type as string] ? op.type as string : `${op.type}`,
          arguments: op,
        }))

        return {
          type: 'tool_use',
          content: parsed.thinking || parsed.summary,
          toolCalls: calls,
        }
      }
    }
  } catch {
    // 解析失败
  }

  // 纯文本响应
  return {
    type: 'message',
    content: response,
  }
}
