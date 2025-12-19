import { Tabs, Dropdown } from 'antd'
import { useFunctionStore } from '../stores/function'
import { useThemeStore } from '../stores/theme'
import type { CloudFunction } from '../stores/function'

export default function EditorTabs() {
  // 订阅 lastPublishedCodes 以确保发布后红点状态能及时更新
  const { openTabs, current, openTab, closeTab, closeOtherTabs, closeAllTabs, lastPublishedCodes } = useFunctionStore()
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  const handleTabChange = (activeKey: string) => {
    const fn = openTabs.find((tab) => tab._id === activeKey)
    if (fn) {
      openTab(fn)
    }
  }

  const handleTabEdit = (
    targetKey: React.MouseEvent | React.KeyboardEvent | string,
    action: 'add' | 'remove'
  ) => {
    if (action === 'remove' && typeof targetKey === 'string') {
      closeTab(targetKey)
    }
  }

  const getContextMenuItems = (fn: CloudFunction) => [
    {
      key: 'close',
      label: '关闭',
      onClick: () => closeTab(fn._id),
    },
    {
      key: 'closeOthers',
      label: '关闭其他',
      onClick: () => closeOtherTabs(fn._id),
    },
    {
      key: 'closeAll',
      label: '关闭全部',
      onClick: () => closeAllTabs(),
    },
  ]

  if (openTabs.length === 0) {
    return null
  }

  const items = openTabs.map((fn) => {
    // 直接比较当前代码和最新发布代码
    const lastPublished = lastPublishedCodes[fn._id]
    const hasChanges = lastPublished === undefined || fn.code !== lastPublished
    const isActive = current?._id === fn._id

    return {
      key: fn._id,
      label: (
        <Dropdown
          menu={{ items: getContextMenuItems(fn) }}
          trigger={['contextMenu']}
        >
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '2px 0',
            maxWidth: 120,
          }}>
            <span style={{
              fontSize: 10,
              fontWeight: 500,
              color: '#3178c6',
              flexShrink: 0,
            }}>
              TS
            </span>
            <span
              title={fn.name.split('/').pop()}
              style={{
                color: isActive ? (isDark ? '#e0e0e0' : '#333') : (isDark ? '#999' : '#666'),
                fontWeight: isActive ? 500 : 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {fn.name.split('/').pop()}
            </span>
            {hasChanges && (
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#ff4d4f',
                display: 'inline-block',
                flexShrink: 0,
              }} />
            )}
          </span>
        </Dropdown>
      ),
      closable: true,
    }
  })

  return (
    <Tabs
      type="editable-card"
      hideAdd
      activeKey={current?._id}
      onChange={handleTabChange}
      onEdit={handleTabEdit}
      items={items}
      size="small"
      style={{
        marginBottom: 0,
        background: isDark ? '#1a1a1a' : '#fafafa',
      }}
      tabBarStyle={{
        margin: 0,
        padding: '0 8px',
        borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
        minHeight: 36,
      }}
    />
  )
}
