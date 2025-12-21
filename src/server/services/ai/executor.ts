/**
 * AI 执行器模块
 *
 * 此文件保留用于向后兼容，实际实现已拆分到 executor/ 目录
 *
 * 模块结构:
 * executor/
 * ├── index.ts              # 主入口
 * ├── executor.ts           # AIExecutor 类
 * ├── prompts.ts            # 系统提示词函数
 * └── operations/           # 操作执行器
 *     ├── function.ts       # 函数操作
 *     ├── site.ts           # 站点操作
 *     └── project.ts        # 项目文件操作
 */

// 重新导出所有内容
export {
  AIExecutor,
  type AIExecutorOptions,
  getActionSystemPrompt,
  getFlexibleSystemPrompt,
  getSpecializedPrompt,
  type ConversationContext,
} from './executor/index.js'
