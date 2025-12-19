/**
 * 对话列表侧边栏
 */

import { Empty, Spin, Input, Dropdown, Typography } from 'antd'
import {
  PlusOutlined, StarOutlined, StarFilled, InboxOutlined,
  MessageOutlined, EditOutlined, MoreOutlined, DeleteOutlined
} from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import type { AIConversation } from '@/api/aiConversation'
import type { ConversationFilter } from './hooks/useConversations'
import { formatTime } from './utils'
import styles from './styles.module.css'

const { Text } = Typography

interface ConversationSidebarProps {
  conversations: AIConversation[]
  currentId: string | null
  filter: ConversationFilter
  loading: boolean
  editingId: string | null
  editingTitle: string
  onSelect: (id: string) => void
  onFilterChange: (filter: ConversationFilter) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onToggleStar: (conv: AIConversation) => void
  onArchive: (conv: AIConversation) => void
  onStartEdit: (id: string, title: string) => void
  onSaveTitle: (id: string) => void
  onEditingTitleChange: (title: string) => void
}

const FILTER_OPTIONS = [
  { key: 'all' as const, label: '全部', icon: null },
  { key: 'starred' as const, label: '收藏', icon: <StarFilled /> },
  { key: 'archived' as const, label: '归档', icon: <InboxOutlined /> },
]

export function ConversationSidebar({
  conversations,
  currentId,
  filter,
  loading,
  editingId,
  editingTitle,
  onSelect,
  onFilterChange,
  onCreate,
  onDelete,
  onToggleStar,
  onArchive,
  onStartEdit,
  onSaveTitle,
  onEditingTitleChange,
}: ConversationSidebarProps) {
  useThemeColors()

  return (
    <div className={styles.sidebar}>
      {/* 头部 - 全宽新建按钮 */}
      <div className={styles.sidebarHeader}>
        <button className={styles.newChatButton} onClick={onCreate}>
          <PlusOutlined />
          <span>New Chat</span>
        </button>
      </div>

      {/* 筛选标签 */}
      <div className={styles.filterBar}>
        {FILTER_OPTIONS.map(item => (
          <button
            key={item.key}
            className={`${styles.filterTag} ${filter === item.key ? styles.filterTagActive : ''}`}
            onClick={() => onFilterChange(item.key)}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </div>

      {/* 对话列表 */}
      <div className={styles.conversationList}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="small" />
          </div>
        ) : conversations.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无对话"
            style={{ marginTop: 60 }}
          />
        ) : (
          conversations.map(conv => (
            <ConversationItem
              key={conv._id}
              conversation={conv}
              isActive={currentId === conv._id}
              isEditing={editingId === conv._id}
              editingTitle={editingTitle}
              onSelect={() => onSelect(conv._id)}
              onDelete={() => onDelete(conv._id)}
              onToggleStar={() => onToggleStar(conv)}
              onArchive={() => onArchive(conv)}
              onStartEdit={() => onStartEdit(conv._id, conv.title)}
              onSaveTitle={() => onSaveTitle(conv._id)}
              onEditingTitleChange={onEditingTitleChange}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface ConversationItemProps {
  conversation: AIConversation
  isActive: boolean
  isEditing: boolean
  editingTitle: string
  onSelect: () => void
  onDelete: () => void
  onToggleStar: () => void
  onArchive: () => void
  onStartEdit: () => void
  onSaveTitle: () => void
  onEditingTitleChange: (title: string) => void
}

function ConversationItem({
  conversation: conv,
  isActive,
  isEditing,
  editingTitle,
  onSelect,
  onDelete,
  onToggleStar,
  onArchive,
  onStartEdit,
  onSaveTitle,
  onEditingTitleChange,
}: ConversationItemProps) {
  const menuItems = [
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: '重命名',
      onClick: () => onStartEdit(),
    },
    {
      key: 'star',
      icon: conv.starred ? <StarFilled /> : <StarOutlined />,
      label: conv.starred ? '取消收藏' : '收藏',
      onClick: () => onToggleStar(),
    },
    {
      key: 'archive',
      icon: <InboxOutlined />,
      label: conv.archived ? '取消归档' : '归档',
      onClick: () => onArchive(),
    },
    { type: 'divider' as const },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除',
      danger: true,
      onClick: () => onDelete(),
    },
  ]

  return (
    <div
      className={`${styles.conversationItem} ${isActive ? styles.conversationItemActive : ''}`}
      onClick={onSelect}
    >
      <MessageOutlined className={styles.conversationIcon} />
      <div className={styles.conversationContent}>
        {isEditing ? (
          <Input
            size="small"
            value={editingTitle}
            onChange={e => onEditingTitleChange(e.target.value)}
            onBlur={onSaveTitle}
            onPressEnter={onSaveTitle}
            autoFocus
            onClick={e => e.stopPropagation()}
            style={{ borderRadius: 6 }}
          />
        ) : (
          <>
            <Text ellipsis className={styles.conversationTitle}>
              {conv.starred && <StarFilled style={{ color: '#faad14', marginRight: 6, fontSize: 11 }} />}
              {conv.title}
            </Text>
            <span className={styles.conversationTime}>{formatTime(conv.updatedAt)}</span>
          </>
        )}
      </div>
      <Dropdown menu={{ items: menuItems }} trigger={['click']}>
        <button
          className={styles.conversationMoreBtn}
          onClick={e => e.stopPropagation()}
        >
          <MoreOutlined />
        </button>
      </Dropdown>
    </div>
  )
}
