import { Button, Tooltip } from 'antd'
import {
  RobotOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  BulbOutlined,
} from '@ant-design/icons'

interface HeaderBarProps {
  isDark: boolean
  modelName: string
  enableThinking: boolean
  onConfigOpen: () => void
}

export default function HeaderBar({
  isDark,
  modelName,
  enableThinking,
  onConfigOpen,
}: HeaderBarProps) {
  return (
    <div style={{
      padding: '12px 16px',
      borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <RobotOutlined style={{ fontSize: 16, color: '#00a9a6' }} />
        <span style={{ fontWeight: 500, fontSize: 14, color: isDark ? '#e0e0e0' : '#333' }}>
          AI 建站助手
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* 当前模型显示 */}
        {modelName && (
          <Tooltip title="当前模型">
            <span style={{
              fontSize: 11,
              color: isDark ? '#888' : '#666',
              background: isDark ? '#262626' : '#f5f5f5',
              padding: '2px 8px',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <ThunderboltOutlined style={{ fontSize: 10 }} />
              {modelName}
            </span>
          </Tooltip>
        )}
        {/* 思考模式指示 */}
        {enableThinking && (
          <Tooltip title="深度思考已启用">
            <span style={{
              fontSize: 11,
              color: '#faad14',
              background: isDark ? '#3d3012' : '#fffbe6',
              padding: '2px 8px',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <BulbOutlined style={{ fontSize: 10 }} />
              思考
            </span>
          </Tooltip>
        )}
        {/* 配置按钮 */}
        <Tooltip title="AI 配置">
          <Button
            type="text"
            size="small"
            icon={<SettingOutlined />}
            onClick={onConfigOpen}
            style={{ color: isDark ? '#888' : '#666' }}
          />
        </Tooltip>
      </div>
    </div>
  )
}
