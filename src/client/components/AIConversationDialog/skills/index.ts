/**
 * AI Skills 模块
 *
 * 导出所有技能相关的类型、注册表和内置技能
 */

// 类型
export * from './types'

// 注册表
export { skillRegistry, registerSkill } from './registry'

// 内置技能
export {
  logAnalysisSkill,
  LogAnalysisCommands,
  isLogAnalysisCommand,
  getLogAnalysisDays,
  getLogAnalysisMenuItems,
} from './logAnalysis'
