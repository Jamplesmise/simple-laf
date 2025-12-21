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
 * 项目文件操作工具 (Sprint 14)
 *
 * 让 AI 能够读取和修改项目源代码
 */
export const projectTools: AITool[] = [
  {
    name: 'read_project_file',
    description: '读取项目文件内容。可以指定行范围只读取部分内容',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件路径（相对于项目根目录），如 "src/server/index.ts"',
        },
        lineStart: {
          type: 'number',
          description: '起始行号（可选，从1开始）',
        },
        lineEnd: {
          type: 'number',
          description: '结束行号（可选）',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_project_file',
    description: '写入项目文件（需要用户确认）。可以选择是否创建备份',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件路径（相对于项目根目录）',
        },
        content: {
          type: 'string',
          description: '要写入的文件内容',
        },
        createBackup: {
          type: 'boolean',
          description: '是否创建备份（默认 true）',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'get_file_tree',
    description: '获取项目文件树结构。可以指定目录和深度',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '起始目录路径（可选，默认为项目根目录）',
        },
        depth: {
          type: 'number',
          description: '遍历深度（可选，默认 3）',
        },
        exclude: {
          type: 'array',
          description: '要排除的目录或文件模式',
          items: { type: 'string' },
        },
      },
      required: [],
    },
  },
  {
    name: 'search_code',
    description: '在项目中搜索代码。支持正则表达式和文件类型过滤',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索内容（支持正则表达式）',
        },
        filePattern: {
          type: 'string',
          description: '文件模式（可选，如 "**/*.ts"）',
        },
        caseSensitive: {
          type: 'boolean',
          description: '是否区分大小写（默认 false）',
        },
      },
      required: ['query'],
    },
  },
]

/**
 * 依赖管理工具 (Sprint 15)
 */
export const dependencyTools: AITool[] = [
  {
    name: 'install_dependency',
    description: '安装 NPM 依赖包（需要用户确认）。当用户要求安装新的依赖库时使用',
    parameters: {
      type: 'object',
      properties: {
        packages: {
          type: 'array',
          description: '要安装的包名列表，如 ["lodash", "axios"]',
          items: { type: 'string' },
        },
        dev: {
          type: 'boolean',
          description: '是否安装为开发依赖（默认 false）',
        },
      },
      required: ['packages'],
    },
  },
  {
    name: 'update_dependency',
    description: '更新 NPM 依赖包。当用户要求更新依赖版本时使用',
    parameters: {
      type: 'object',
      properties: {
        packages: {
          type: 'array',
          description: '要更新的包名列表',
          items: { type: 'string' },
        },
        latest: {
          type: 'boolean',
          description: '是否更新到最新版本（默认 false，只更新到兼容版本）',
        },
      },
      required: ['packages'],
    },
  },
  {
    name: 'audit_dependencies',
    description: '安全审计依赖包。检查项目依赖是否存在安全漏洞',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'list_dependencies',
    description: '列出项目已安装的依赖包及版本',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
]

/**
 * Git 工具 (Sprint 17)
 *
 * 提供 Git 状态查看、Diff 查看、提交、同步和分支管理功能
 */
export const gitTools: AITool[] = [
  {
    name: 'git_status',
    description: '获取 Git 仓库状态。显示当前分支、暂存的文件、修改的文件、未跟踪的文件等',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'git_diff',
    description: '查看代码变更。可以查看工作区或暂存区的变更，也可以与特定提交比较',
    parameters: {
      type: 'object',
      properties: {
        ref: {
          type: 'string',
          description: '参考点（默认 HEAD），如 "HEAD~1" 或提交 hash',
        },
        path: {
          type: 'string',
          description: '指定文件路径，只查看该文件的变更',
        },
        staged: {
          type: 'boolean',
          description: '是否查看暂存区的变更（默认 false）',
        },
      },
      required: [],
    },
  },
  {
    name: 'git_commit',
    description: '提交代码更改（需要用户确认）。可以指定要提交的文件，或提交所有更改',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: '提交信息',
        },
        files: {
          type: 'array',
          description: '要暂存并提交的文件列表（不指定则提交所有更改）',
          items: { type: 'string' },
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'git_sync',
    description: '同步远程仓库（pull/push）。需要用户确认，禁止 force push',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: '同步操作类型',
          enum: ['pull', 'push'],
        },
        remote: {
          type: 'string',
          description: '远程仓库名（默认 origin）',
        },
        branch: {
          type: 'string',
          description: '分支名（默认当前分支）',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'git_branch',
    description: '管理 Git 分支。支持列出、创建、切换和删除分支',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: '分支操作类型',
          enum: ['list', 'create', 'checkout', 'delete'],
        },
        name: {
          type: 'string',
          description: '分支名（create/checkout/delete 时必填）',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'git_log',
    description: '获取提交历史记录',
    parameters: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description: '显示的提交数量（默认 10）',
        },
        path: {
          type: 'string',
          description: '指定文件路径，只显示该文件的提交历史',
        },
      },
      required: [],
    },
  },
]

/**
 * 环境变量工具 (Sprint 15)
 */
export const envTools: AITool[] = [
  {
    name: 'set_env_variable',
    description: '设置环境变量。当用户要求配置环境变量时使用',
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: '变量名（大写字母和下划线，如 API_KEY）',
        },
        value: {
          type: 'string',
          description: '变量值',
        },
        isSecret: {
          type: 'boolean',
          description: '是否为敏感信息（自动检测，可手动指定）',
        },
        description: {
          type: 'string',
          description: '变量描述（可选）',
        },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'delete_env_variable',
    description: '删除环境变量。当用户要求移除某个环境变量时使用',
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: '要删除的变量名',
        },
      },
      required: ['key'],
    },
  },
  {
    name: 'list_env_variables',
    description: '列出所有环境变量（敏感值脱敏显示）',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
]

/**
 * 数据库工具 (Sprint 18)
 *
 * 提供 MongoDB 集合分析、查询执行、索引建议功能
 */
export const databaseTools: AITool[] = [
  {
    name: 'analyze_collection',
    description: '分析 MongoDB 集合结构和数据分布。获取字段 Schema、索引信息、文档统计',
    parameters: {
      type: 'object',
      properties: {
        collection: {
          type: 'string',
          description: '要分析的集合名称',
        },
      },
      required: ['collection'],
    },
  },
  {
    name: 'execute_query',
    description: '执行 MongoDB 查询（只读）。支持查询、投影、排序、分页。结果自动脱敏',
    parameters: {
      type: 'object',
      properties: {
        collection: {
          type: 'string',
          description: '要查询的集合名称',
        },
        query: {
          type: 'object',
          description: 'MongoDB 查询条件，如 { "status": "active" }',
        },
        projection: {
          type: 'object',
          description: '字段投影，如 { "name": 1, "email": 1 }（可选）',
        },
        sort: {
          type: 'object',
          description: '排序条件，如 { "createdAt": -1 }（可选）',
        },
        limit: {
          type: 'number',
          description: '返回数量限制，最大 100（默认 10）',
        },
        skip: {
          type: 'number',
          description: '跳过的文档数量（可选）',
        },
      },
      required: ['collection', 'query'],
    },
  },
  {
    name: 'suggest_indexes',
    description: '分析集合并建议索引优化。基于字段类型和常见查询模式给出建议',
    parameters: {
      type: 'object',
      properties: {
        collection: {
          type: 'string',
          description: '要分析索引的集合名称',
        },
      },
      required: ['collection'],
    },
  },
]

/**
 * 测试工具 (Sprint 19)
 *
 * 提供云函数测试执行和测试输入持久化功能
 */
export const testTools: AITool[] = [
  {
    name: 'test_function',
    description: '测试云函数。执行函数并返回结果、控制台日志和执行时间。可以指定测试输入（body, query, headers）',
    parameters: {
      type: 'object',
      properties: {
        functionId: {
          type: 'string',
          description: '要测试的函数 ID',
        },
        input: {
          type: 'object',
          description: '测试输入，包含 body（请求体）、query（查询参数）、headers（请求头）',
        },
      },
      required: ['functionId'],
    },
  },
  {
    name: 'batch_test_function',
    description: '批量测试云函数。使用多个测试用例测试同一个函数，返回汇总结果',
    parameters: {
      type: 'object',
      properties: {
        functionId: {
          type: 'string',
          description: '要测试的函数 ID',
        },
        testCases: {
          type: 'array',
          description: '测试用例列表，每个包含 name（测试名称）和 input（测试输入）',
          items: { type: 'object' },
        },
      },
      required: ['functionId', 'testCases'],
    },
  },
  {
    name: 'save_test_input',
    description: '保存函数的默认测试输入。下次打开函数时会自动加载',
    parameters: {
      type: 'object',
      properties: {
        functionId: {
          type: 'string',
          description: '函数 ID',
        },
        input: {
          type: 'object',
          description: '测试输入，包含 method、body、query、headers',
        },
      },
      required: ['functionId', 'input'],
    },
  },
  {
    name: 'get_test_input',
    description: '获取函数保存的默认测试输入',
    parameters: {
      type: 'object',
      properties: {
        functionId: {
          type: 'string',
          description: '函数 ID',
        },
      },
      required: ['functionId'],
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
  ...projectTools,
  ...dependencyTools,
  ...envTools,
  ...gitTools,
  ...databaseTools,
  ...testTools,
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
  // 项目文件操作
  read_project_file: 'readProjectFile',
  write_project_file: 'writeProjectFile',
  get_file_tree: 'getFileTree',
  search_code: 'searchCode',
  // 依赖管理操作 (Sprint 15)
  install_dependency: 'installDependency',
  update_dependency: 'updateDependency',
  audit_dependencies: 'auditDependencies',
  list_dependencies: 'listDependencies',
  // 环境变量操作 (Sprint 15)
  set_env_variable: 'setEnvVariable',
  delete_env_variable: 'deleteEnvVariable',
  list_env_variables: 'listEnvVariables',
  // Git 操作 (Sprint 17)
  git_status: 'gitStatus',
  git_diff: 'gitDiff',
  git_commit: 'gitCommit',
  git_sync: 'gitSync',
  git_branch: 'gitBranch',
  git_log: 'gitLog',
  // 数据库操作 (Sprint 18)
  analyze_collection: 'analyzeCollection',
  execute_query: 'executeQuery',
  suggest_indexes: 'suggestIndexes',
  // 测试操作 (Sprint 19)
  test_function: 'testFunction',
  batch_test_function: 'batchTestFunction',
  save_test_input: 'saveTestInput',
  get_test_input: 'getTestInput',
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
