/**
 * 基础提示词模板
 */

/**
 * 云函数代码格式说明
 */
export const FUNCTION_CODE_FORMAT = `## 云函数代码格式

所有云函数必须遵循以下格式：

\`\`\`typescript
import cloud from '@/cloud-sdk'

export default async function (ctx: FunctionContext) {
  // 你的代码
  return { data: 'result' }
}
\`\`\`

**FunctionContext 包含：**
- \`ctx.body\`: 请求体 (POST/PUT 请求的 JSON 数据)
- \`ctx.query\`: URL 查询参数 (如 ?id=123)
- \`ctx.headers\`: 请求头
- \`ctx.method\`: HTTP 方法 (GET/POST/PUT/DELETE 等)

**cloud SDK 提供：**
- \`cloud.database()\`: 获取 MongoDB 数据库实例
- \`cloud.fetch(url, options)\`: 发起 HTTP 请求

**导入其他云函数：**
使用 \`@/函数名\` 或 \`@/函数路径\` 直接导入：
\`\`\`typescript
import { someHelper } from '@/utils/helpers'
import validateInput from '@/validators/inputValidator'
\`\`\``

/**
 * 代码规范说明
 */
export const CODE_STANDARDS = `## 代码规范

1. 使用 \`import cloud from '@/cloud-sdk'\` 导入云 SDK（数据库、HTTP 请求）
2. 使用 \`import { xxx } from '@/函数路径'\` 导入其他云函数
3. 使用 \`export default async function (ctx: FunctionContext)\` 导出主函数
4. 可以使用命名导出 \`export function xxx()\` 供其他函数导入
5. 函数名使用 camelCase 命名（如 getUserList, createOrder）
6. 使用 TypeScript，添加必要的类型注解
7. 包含基础错误处理（try-catch）
8. 返回格式统一为 \`{ data: ... }\` 或 \`{ error: ... }\``

/**
 * 工具使用格式说明
 */
export const TOOL_USE_FORMAT = `## 工具使用格式

当需要执行操作时，使用以下格式调用工具：

<tool_use>
<tool>工具名称</tool>
<arguments>
{
  "参数名": "参数值"
}
</arguments>
</tool_use>

你可以在一次回复中：
- 只进行自然语言回复
- 只使用工具
- 混合使用：先解释你要做什么，然后调用工具`
