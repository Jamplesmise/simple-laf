/**
 * AIDebugModal 工具函数和类型定义
 */

export type DebugPhase =
  | 'selecting'
  | 'analyzing'
  | 'generating'
  | 'running'
  | 'diagnosing'
  | 'fix_ready'
  | 'applying'
  | 'done'
  | 'error'

// 计算当前步骤
export function getCurrentStep(phase: DebugPhase): number {
  switch (phase) {
    case 'selecting':
      return -1
    case 'analyzing':
      return 0
    case 'generating':
      return 1
    case 'running':
      return 2
    case 'diagnosing':
      return 3
    case 'fix_ready':
    case 'applying':
    case 'done':
      return 4
    case 'error':
      return -1
    default:
      return 0
  }
}

// 判断是否在加载中
export function isLoading(phase: DebugPhase): boolean {
  return ['analyzing', 'generating', 'running', 'diagnosing', 'applying'].includes(phase)
}
