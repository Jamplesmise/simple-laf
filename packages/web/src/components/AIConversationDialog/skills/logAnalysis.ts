/**
 * 日志分析技能
 *
 * 分析执行日志，提供问题诊断和优化建议
 */

import React from 'react'
import { FileSearchOutlined } from '@ant-design/icons'
import type { AISkill, SkillContext, SkillResult } from './types'
import { BuiltinSkillIds } from './types'
import { registerSkill } from './registry'

/**
 * 日志分析命令定义
 */
export const LogAnalysisCommands = {
  '/log': { days: 3, label: '分析日志 (3天)' },
  '/log7': { days: 7, label: '分析日志 (7天)' },
  '/log15': { days: 15, label: '分析日志 (15天)' },
  '/log30': { days: 30, label: '分析日志 (30天)' },
} as const

export type LogAnalysisCommand = keyof typeof LogAnalysisCommands

/**
 * 检查是否是日志分析命令
 */
export function isLogAnalysisCommand(input: string): input is LogAnalysisCommand {
  return input.toLowerCase() in LogAnalysisCommands
}

/**
 * 获取日志分析天数
 */
export function getLogAnalysisDays(command: LogAnalysisCommand): number {
  return LogAnalysisCommands[command].days
}

/**
 * 日志分析技能
 */
export const logAnalysisSkill: AISkill = registerSkill({
  id: BuiltinSkillIds.LOG_ANALYSIS,
  name: '日志分析',
  description: '分析执行日志，发现错误和性能问题',
  command: '/log',
  icon: React.createElement(FileSearchOutlined),
  enabled: true,
  requiresFunction: false,

  async execute(context: SkillContext): Promise<SkillResult> {
    const { extra } = context
    const days = (extra?.days as number) || 7

    // 实际执行逻辑在 API 层处理
    // 这里返回技能配置信息
    return {
      success: true,
      message: `将分析最近 ${days} 天的执行日志`,
    }
  },
})

/**
 * 获取日志分析的斜杠命令菜单项
 */
export function getLogAnalysisMenuItems() {
  return Object.entries(LogAnalysisCommands).map(([command, config]) => ({
    command,
    label: config.label,
    description: `分析最近 ${config.days} 天的执行日志，发现问题和优化机会`,
    days: config.days,
  }))
}
