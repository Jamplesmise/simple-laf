import { Button, Tooltip } from 'antd'
import {
  PlusOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  CodeOutlined,
  ApiOutlined,
} from '@ant-design/icons'

interface HeaderProps {
  functionsCount: number
  isDark: boolean
  onCreateFunction: () => void
  onOpenScheduler: () => void
  onOpenStatistics: () => void
  onOpenWebhook: () => void
  onOpenSnippets: () => void
}

export default function Header({
  functionsCount,
  isDark,
  onCreateFunction,
  onOpenScheduler,
  onOpenStatistics,
  onOpenWebhook,
  onOpenSnippets,
}: HeaderProps) {
  return (
    <div
      style={{
        padding: '8px 12px',
        borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 500 }}>
        函数列表 <span style={{ color: '#888', fontWeight: 400 }}>{functionsCount}</span>
      </span>
      <div style={{ display: 'flex', gap: 2 }}>
        <Tooltip title="执行统计">
          <Button
            type="text"
            size="small"
            icon={<BarChartOutlined style={{ fontSize: 12 }} />}
            onClick={onOpenStatistics}
          />
        </Tooltip>
        <Tooltip title="代码片段">
          <Button
            type="text"
            size="small"
            icon={<CodeOutlined style={{ fontSize: 12 }} />}
            onClick={onOpenSnippets}
          />
        </Tooltip>
        <Tooltip title="Webhook">
          <Button
            type="text"
            size="small"
            icon={<ApiOutlined style={{ fontSize: 12 }} />}
            onClick={onOpenWebhook}
          />
        </Tooltip>
        <Tooltip title="定时执行器">
          <Button
            type="text"
            size="small"
            icon={<ClockCircleOutlined style={{ fontSize: 12 }} />}
            onClick={onOpenScheduler}
          />
        </Tooltip>
        <Tooltip title="新建函数">
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined style={{ fontSize: 12 }} />}
            onClick={onCreateFunction}
          />
        </Tooltip>
      </div>
    </div>
  )
}
