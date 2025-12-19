/**
 * AI Skill 注册表
 *
 * 管理所有 AI 技能的注册和查询
 */

import type { AISkill, SkillRegistry } from './types'

class SkillRegistryImpl implements SkillRegistry {
  private _skills: Map<string, AISkill> = new Map()
  private _commandMap: Map<string, string> = new Map()

  get skills(): AISkill[] {
    return Array.from(this._skills.values())
  }

  getSkill(id: string): AISkill | undefined {
    return this._skills.get(id)
  }

  getSkillByCommand(command: string): AISkill | undefined {
    const skillId = this._commandMap.get(command.toLowerCase())
    return skillId ? this._skills.get(skillId) : undefined
  }

  getAvailableSkills(context: { hasFunction: boolean; functionCount: number }): AISkill[] {
    return this.skills.filter(skill => {
      if (!skill.enabled) return false
      if (skill.requiresFunction && !context.hasFunction) return false
      if (skill.requiresMultipleFunctions && context.functionCount < 2) return false
      if (skill.minFunctions && context.functionCount < skill.minFunctions) return false
      return true
    })
  }

  register(skill: AISkill): void {
    this._skills.set(skill.id, skill)
    if (skill.command) {
      this._commandMap.set(skill.command.toLowerCase(), skill.id)
    }
  }

  unregister(id: string): void {
    const skill = this._skills.get(id)
    if (skill?.command) {
      this._commandMap.delete(skill.command.toLowerCase())
    }
    this._skills.delete(id)
  }
}

// 全局单例
export const skillRegistry = new SkillRegistryImpl()

/**
 * 注册技能的装饰器/工厂函数
 */
export function registerSkill(skill: AISkill): AISkill {
  skillRegistry.register(skill)
  return skill
}
