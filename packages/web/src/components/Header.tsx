import { useState } from 'react'
import { Button, Switch, Tooltip, Avatar, Dropdown } from 'antd'
import { SunOutlined, MoonOutlined, SettingOutlined, UserOutlined, LogoutOutlined } from '@ant-design/icons'
import { useAuthStore } from '../stores/auth'
import { useThemeStore } from '../stores/theme'
import { useNavigate } from 'react-router-dom'
import SettingsModal from './SettingsModal'

// Emerald Green 主题色
const emerald = {
  primary: '#10B981',
  light: '#34D399',
  gradient: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
}

export default function Header() {
  const { user, logout } = useAuthStore()
  const { mode, toggleTheme } = useThemeStore()
  const navigate = useNavigate()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const isDark = mode === 'dark'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const userMenuItems = [
    {
      key: 'user',
      label: (
        <div style={{ padding: '4px 0' }}>
          <div style={{ fontWeight: 500 }}>{user?.username}</div>
          <div style={{ fontSize: 11, color: '#888' }}>已登录</div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ]

  return (
    <>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 16px',
        height: '100%',
        background: isDark ? '#141414' : '#fff',
        borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: emerald.gradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
          }}>
            S
          </div>
          <span style={{
            fontWeight: 600,
            fontSize: 15,
            color: isDark ? '#e0e0e0' : '#111827',
            letterSpacing: '-0.3px',
          }}>
            Simple IDE
          </span>
        </div>

        {/* 右侧操作区 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tooltip title="设置">
            <Button
              type="text"
              size="small"
              onClick={() => setSettingsOpen(true)}
              style={{
                color: isDark ? '#888' : '#666',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
              }}
            >
              <SettingOutlined style={{ fontSize: 15 }} />
            </Button>
          </Tooltip>

          <Tooltip title={isDark ? '浅色模式' : '深色模式'}>
            <Switch
              checked={isDark}
              onChange={toggleTheme}
              checkedChildren={<MoonOutlined style={{ fontSize: 11 }} />}
              unCheckedChildren={<SunOutlined style={{ fontSize: 11 }} />}
              size="small"
              style={{ marginLeft: 4 }}
            />
          </Tooltip>

          <div style={{ width: 1, height: 20, background: isDark ? '#303030' : '#e8e8e8', margin: '0 8px' }} />

          <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 6,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = isDark ? '#303030' : '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Avatar
                size={26}
                style={{
                  background: emerald.gradient,
                  fontSize: 12,
                }}
                icon={<UserOutlined />}
              >
                {user?.username?.[0]?.toUpperCase()}
              </Avatar>
              <span style={{
                fontSize: 13,
                color: isDark ? '#e0e0e0' : '#333',
                maxWidth: 100,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {user?.username}
              </span>
            </div>
          </Dropdown>
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
