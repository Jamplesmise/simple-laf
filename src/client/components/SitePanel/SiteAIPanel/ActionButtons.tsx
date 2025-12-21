import { Button } from 'antd'
import type { SiteAIAction } from './types'
import { ACTION_BUTTONS } from './constants'

interface ActionButtonsProps {
  isDark: boolean
  currentAction: SiteAIAction
  onActionChange: (action: SiteAIAction) => void
}

export default function ActionButtons({
  isDark,
  currentAction,
  onActionChange,
}: ActionButtonsProps) {
  return (
    <div style={{
      padding: '12px 16px',
      borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
    }}>
      {ACTION_BUTTONS.map(btn => (
        <Button
          key={btn.key}
          type={currentAction === btn.key ? 'primary' : 'default'}
          size="small"
          icon={btn.icon}
          onClick={() => onActionChange(btn.key)}
          style={{
            borderRadius: 16,
            background: currentAction === btn.key ? '#00a9a6' : undefined,
            borderColor: currentAction === btn.key ? '#00a9a6' : undefined,
          }}
        >
          {btn.label}
        </Button>
      ))}
    </div>
  )
}
