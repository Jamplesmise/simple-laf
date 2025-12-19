/**
 * useDesignTokens - 设计令牌访问 Hook
 *
 * 统一的主题访问入口，替代分散的 isDark 判断
 * 提供 Ant Design token + 自定义设计令牌
 */

import { theme } from 'antd'
import { useMemo } from 'react'
import { useThemeStore } from '@/stores/theme'
import {
  lightTheme,
  darkTheme,
  colors,
  spacing,
  space,
  radius,
  shadows,
  typography,
  transitions,
  zIndex,
  type Theme,
} from '@/styles/tokens'

export interface DesignTokens {
  /** 当前是否为深色模式 */
  isDark: boolean
  /** 当前主题模式 'light' | 'dark' */
  mode: 'light' | 'dark'
  /** 切换主题 */
  toggleTheme: () => void
  /** 设置主题 */
  setTheme: (mode: 'light' | 'dark') => void
  /** 当前主题的颜色集合 */
  theme: Theme
  /** Ant Design 运行时 token */
  antToken: ReturnType<typeof theme.useToken>['token']
  /** 颜色调色板 */
  colors: typeof colors
  /** 间距数值 */
  spacing: typeof spacing
  /** 语义化间距 */
  space: typeof space
  /** 圆角数值 */
  radius: typeof radius
  /** 阴影 */
  shadows: typeof shadows
  /** 字体 */
  typography: typeof typography
  /** 过渡动画 */
  transitions: typeof transitions
  /** z-index 层级 */
  zIndex: typeof zIndex
}

/**
 * 获取设计令牌的主 Hook
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isDark, theme, colors, space } = useDesignTokens()
 *
 *   return (
 *     <div style={{
 *       background: theme.bgCard,
 *       color: theme.text,
 *       padding: space.md,
 *       borderRadius: radius.md,
 *     }}>
 *       Content
 *     </div>
 *   )
 * }
 * ```
 */
export function useDesignTokens(): DesignTokens {
  const mode = useThemeStore((s) => s.mode)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const { token: antToken } = theme.useToken()

  const isDark = mode === 'dark'
  const currentTheme = isDark ? darkTheme : lightTheme

  return useMemo(
    () => ({
      isDark,
      mode,
      toggleTheme,
      setTheme,
      theme: currentTheme,
      antToken,
      colors,
      spacing,
      space,
      radius,
      shadows,
      typography,
      transitions,
      zIndex,
    }),
    [isDark, mode, toggleTheme, setTheme, currentTheme, antToken]
  )
}

/**
 * 轻量级主题 Hook，仅获取主题色
 * 用于不需要完整设计令牌的简单组件
 *
 * @example
 * ```tsx
 * function SimpleButton() {
 *   const { isDark, t } = useThemeColors()
 *   return <button style={{ background: t.accent }}>Click</button>
 * }
 * ```
 */
export function useThemeColors() {
  const mode = useThemeStore((s) => s.mode)
  const isDark = mode === 'dark'

  return useMemo(
    () => ({
      isDark,
      mode,
      t: isDark ? darkTheme : lightTheme,
    }),
    [isDark, mode]
  )
}

/**
 * 仅获取深色模式状态的 Hook
 * 最轻量级，用于简单的主题判断
 */
export function useIsDark(): boolean {
  return useThemeStore((s) => s.mode) === 'dark'
}

// 导出类型
export type { Theme }
