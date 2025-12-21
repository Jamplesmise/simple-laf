import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, App as AntdApp, theme } from 'antd'
import type { ThemeConfig } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useAuthStore } from './stores/auth'
import { useThemeStore } from './stores/theme'
import { colors, typography } from './styles/tokens'
import Login from './pages/Login'
import Register from './pages/Register'
import IDE from './pages/IDE'
import { AIFloatingBall } from './components/AIFloatingBall'
import { AIConversationDialog } from './components/AIConversationDialog'

// Ant Design 主题配置
const getThemeConfig = (isDark: boolean): ThemeConfig => ({
  algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
  token: {
    // 主色 - Emerald
    colorPrimary: colors.primary[500],
    colorSuccess: colors.semantic.success,
    colorWarning: colors.semantic.warning,
    colorError: colors.semantic.error,
    colorInfo: colors.semantic.info,

    // 圆角
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    borderRadiusXS: 2,

    // 字体
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.base,
    fontSizeSM: typography.fontSize.sm,
    fontSizeLG: typography.fontSize.lg,

    // 间距
    marginXS: 8,
    marginSM: 12,
    margin: 16,
    marginMD: 20,
    marginLG: 24,
    marginXL: 32,

    paddingXS: 8,
    paddingSM: 12,
    padding: 16,
    paddingMD: 20,
    paddingLG: 24,
    paddingXL: 32,

    // 控件尺寸
    controlHeight: 32,
    controlHeightSM: 24,
    controlHeightLG: 40,
  },
  components: {
    Button: {
      borderRadius: 6,
      controlHeight: 32,
      controlHeightSM: 24,
      controlHeightLG: 40,
    },
    Input: {
      borderRadius: 6,
      controlHeight: 32,
    },
    Select: {
      borderRadius: 6,
      controlHeight: 32,
    },
    Modal: {
      borderRadiusLG: 12,
    },
    Dropdown: {
      borderRadiusSM: 6,
    },
    Tabs: {
      itemSelectedColor: colors.primary[500],
      inkBarColor: colors.primary[500],
    },
    Tag: {
      borderRadiusSM: 4,
    },
    Table: {
      borderRadius: 8,
    },
    Card: {
      borderRadiusLG: 8,
    },
  },
})

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((state) => state.token)
  return token ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((state) => state.token)
  return !token ? children : <Navigate to="/" replace />
}

export default function App() {
  const themeMode = useThemeStore((state) => state.mode)
  const token = useAuthStore((state) => state.token)
  const [aiDialogOpen, setAiDialogOpen] = useState(false)

  return (
    <ConfigProvider
      locale={zhCN}
      theme={getThemeConfig(themeMode === 'dark')}
    >
      <AntdApp>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              }
            />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <IDE />
                </PrivateRoute>
              }
            />
          </Routes>
        </BrowserRouter>

        {/* 全局 AI 悬浮球 - 登录后显示 */}
        {token && (
          <AIFloatingBall
            onClick={() => setAiDialogOpen(true)}
          />
        )}

        {/* 全局 AI 对话框 */}
        {token && (
          <AIConversationDialog
            open={aiDialogOpen}
            onClose={() => setAiDialogOpen(false)}
          />
        )}
      </AntdApp>
    </ConfigProvider>
  )
}
