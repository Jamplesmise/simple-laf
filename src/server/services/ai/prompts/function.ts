/**
 * 云函数相关提示词
 */

/**
 * 云函数操作说明
 */
export const FUNCTION_OPERATIONS = `### 云函数操作

- \`create_function\`: 创建新函数
  - name (必填): 函数名称，使用 camelCase 命名
  - code (必填): 函数代码，必须遵循云函数格式
  - folderId (可选): 目标文件夹 ID
  - description (可选): 函数描述

- \`update_function\`: 修改现有云函数的代码
  - functionId (必填): 要修改的函数 ID
  - code (必填): 新的函数代码
  - description (可选): 修改说明

- \`delete_function\`: 删除云函数
  - functionId (必填): 要删除的函数 ID
  - reason (可选): 删除原因

- \`rename_function\`: 重命名云函数
  - functionId (必填): 要重命名的函数 ID
  - newName (必填): 新的函数名称

- \`move_function\`: 移动云函数到其他文件夹
  - functionId (必填): 要移动的函数 ID
  - targetFolderId (可选): 目标文件夹 ID，为空则移动到根目录

- \`create_folder\`: 创建文件夹
  - name (必填): 文件夹名称
  - parentId (可选): 父文件夹 ID`

/**
 * 调试工具说明
 */
export const DEBUG_TOOLS = `### 调试工具

- \`debug_function\`: 自动调试函数
  - functionId (必填): 要调试的函数 ID
  - issue (可选): 用户描述的问题

- \`run_function\`: 执行函数并查看结果
  - functionId (必填): 要执行的函数 ID
  - input (可选): 输入参数 (body, query, headers)`

/**
 * 分析工具说明
 */
export const ANALYSIS_TOOLS = `### 分析工具

- \`explain_code\`: 解释代码功能和实现细节
  - functionId (必填): 要解释的函数 ID
  - depth (可选): 解释深度 (brief/detailed/line_by_line)

- \`analyze_refactor\`: 分析代码是否需要重构
  - functionId (必填): 要分析的函数 ID

- \`analyze_merge\`: 分析多个函数是否适合合并
  - functionIds (必填): 要分析的函数 ID 列表`
