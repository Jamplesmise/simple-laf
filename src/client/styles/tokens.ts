/**
 * Design Tokens - 设计令牌系统
 *
 * 统一的颜色、间距、圆角、阴影、字体定义
 * 所有组件应从此文件导入样式常量，禁止硬编码
 */

// ============================================
// 颜色系统 - 基于 Tailwind Emerald
// ============================================

export const colors = {
  // 主色 - Emerald
  primary: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#10B981',  // 主色
    600: '#059669',
    700: '#047857',
    800: '#065F46',
    900: '#064E3B',
  },
  // 灰度 - Zinc
  gray: {
    50: '#FAFAFA',
    100: '#F4F4F5',
    200: '#E4E4E7',
    300: '#D4D4D8',
    400: '#A1A1AA',
    500: '#71717A',
    600: '#52525B',
    700: '#3F3F46',
    800: '#27272A',
    900: '#18181B',
    950: '#09090B',
  },
  // 语义色
  semantic: {
    success: '#22C55E',
    successLight: '#DCFCE7',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    error: '#EF4444',
    errorLight: '#FEE2E2',
    info: '#3B82F6',
    infoLight: '#DBEAFE',
  },
} as const

// ============================================
// 间距系统
// ============================================

export const spacing = {
  0: 0,
  px: 1,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const

// 语义化间距别名
export const space = {
  xs: spacing[1],    // 4px
  sm: spacing[2],    // 8px
  md: spacing[3],    // 12px
  lg: spacing[4],    // 16px
  xl: spacing[6],    // 24px
  xxl: spacing[8],   // 32px
} as const

// ============================================
// 圆角系统
// ============================================

export const radius = {
  none: 0,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  '3xl': 24,
  full: 9999,
} as const

// ============================================
// 阴影系统
// ============================================

export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  // 深色模式阴影
  darkSm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
  darkMd: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)',
  darkLg: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.4)',
} as const

// ============================================
// 字体系统
// ============================================

export const typography = {
  fontFamily: {
    sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: '"JetBrains Mono", "SF Mono", Monaco, Menlo, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  fontSize: {
    xs: 12,
    sm: 13,
    base: 14,
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 30,
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
} as const

// ============================================
// 过渡动画
// ============================================

export const transitions = {
  fast: '0.1s ease',
  normal: '0.15s ease',
  slow: '0.2s ease',
  slower: '0.3s ease',
} as const

// ============================================
// Z-index 层级
// ============================================

export const zIndex = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
} as const

// ============================================
// 预组合主题
// ============================================

export const lightTheme = {
  // 背景
  bg: colors.gray[50],
  bgCard: '#FFFFFF',
  bgMuted: colors.gray[100],
  bgHover: colors.gray[200],
  bgActive: colors.gray[300],

  // 文本
  text: colors.gray[900],
  textSecondary: colors.gray[500],
  textMuted: colors.gray[400],
  textInverse: '#FFFFFF',

  // 边框
  border: colors.gray[200],
  borderLight: colors.gray[100],
  borderDark: colors.gray[300],

  // 主色
  accent: colors.primary[500],
  accentHover: colors.primary[600],
  accentActive: colors.primary[700],
  accentLight: colors.primary[100],
  accentSurface: 'rgba(16, 185, 129, 0.08)',

  // 语义色
  success: colors.semantic.success,
  successSurface: colors.semantic.successLight,
  warning: colors.semantic.warning,
  warningSurface: colors.semantic.warningLight,
  error: colors.semantic.error,
  errorSurface: colors.semantic.errorLight,
  info: colors.semantic.info,
  infoSurface: colors.semantic.infoLight,

  // 阴影
  shadow: shadows.DEFAULT,
  shadowMd: shadows.md,
  shadowLg: shadows.lg,
} as const

export const darkTheme = {
  // 背景
  bg: colors.gray[900],
  bgCard: colors.gray[800],
  bgMuted: colors.gray[800],
  bgHover: colors.gray[700],
  bgActive: colors.gray[600],

  // 文本
  text: colors.gray[50],
  textSecondary: colors.gray[400],
  textMuted: colors.gray[500],
  textInverse: colors.gray[900],

  // 边框
  border: colors.gray[700],
  borderLight: colors.gray[800],
  borderDark: colors.gray[600],

  // 主色
  accent: colors.primary[500],
  accentHover: colors.primary[400],
  accentActive: colors.primary[300],
  accentLight: colors.primary[900],
  accentSurface: 'rgba(16, 185, 129, 0.15)',

  // 语义色
  success: colors.semantic.success,
  successSurface: 'rgba(34, 197, 94, 0.15)',
  warning: colors.semantic.warning,
  warningSurface: 'rgba(245, 158, 11, 0.15)',
  error: colors.semantic.error,
  errorSurface: 'rgba(239, 68, 68, 0.15)',
  info: colors.semantic.info,
  infoSurface: 'rgba(59, 130, 246, 0.15)',

  // 阴影
  shadow: shadows.darkSm,
  shadowMd: shadows.darkMd,
  shadowLg: shadows.darkLg,
} as const

// 主题类型 (使用接口而非 typeof，以支持 light/dark 主题通用)
export interface Theme {
  // 背景
  bg: string
  bgCard: string
  bgMuted: string
  bgHover: string
  bgActive: string

  // 文本
  text: string
  textSecondary: string
  textMuted: string
  textInverse: string

  // 边框
  border: string
  borderLight: string
  borderDark: string

  // 主色
  accent: string
  accentHover: string
  accentActive: string
  accentLight: string
  accentSurface: string

  // 语义色
  success: string
  successSurface: string
  warning: string
  warningSurface: string
  error: string
  errorSurface: string
  info: string
  infoSurface: string

  // 阴影
  shadow: string
  shadowMd: string
  shadowLg: string
}

// ============================================
// 常用样式对象 (用于内联样式过渡期)
// ============================================

/** 代码字体样式 */
export const codeFont = typography.fontFamily.mono

/** 面板头部公共样式 */
export const panelHeaderBase = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${space.sm}px ${space.md}px ${space.sm}px ${space.lg}px`,
  position: 'relative' as const,
  userSelect: 'none' as const,
}

/** 绿色指示条公共样式 */
export const greenIndicator = {
  position: 'absolute' as const,
  left: 0,
  top: '50%',
  transform: 'translateY(-50%)',
  width: 3,
  height: 16,
  backgroundColor: colors.primary[500],
  borderRadius: '0 2px 2px 0',
}
