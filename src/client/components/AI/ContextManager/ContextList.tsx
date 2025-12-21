/**
 * 上下文列表组件 (Sprint 10.3)
 */

import React from 'react'
import { List, Checkbox, Tag, Typography, Space, Tooltip } from 'antd'
import {
  FileTextOutlined,
  MessageOutlined,
  CodeOutlined,
  ToolOutlined,
  DeleteOutlined,
  CompressOutlined,
} from '@ant-design/icons'
import type { ContextItem, ContextItemType, ContextCategoryStats } from '../../../api/aiConversation'

const { Text } = Typography

// 类型图标映射
const typeIcons: Record<ContextItemType, React.ReactNode> = {
  system: <FileTextOutlined style={{ color: '#722ed1' }} />,
  message: <MessageOutlined style={{ color: '#1890ff' }} />,
  code: <CodeOutlined style={{ color: '#52c41a' }} />,
  tool_result: <ToolOutlined style={{ color: '#fa8c16' }} />,
}

// 类型标签颜色
const typeColors: Record<ContextItemType, string> = {
  system: 'purple',
  message: 'blue',
  code: 'green',
  tool_result: 'orange',
}

// 类型中文名
const typeNames: Record<ContextItemType, string> = {
  system: '系统提示词',
  message: '对话消息',
  code: '代码',
  tool_result: '工具结果',
}

interface ContextListProps {
  items: ContextItem[]
  categories: ContextCategoryStats
  selectedIds: string[]
  onSelectChange: (ids: string[]) => void
}

export const ContextList: React.FC<ContextListProps> = ({
  items,
  categories,
  selectedIds,
  onSelectChange,
}) => {
  // 按类型分组
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.type]) {
      acc[item.type] = []
    }
    acc[item.type].push(item)
    return acc
  }, {} as Record<ContextItemType, ContextItem[]>)

  // 处理选中变化
  const handleCheckChange = (itemId: string, checked: boolean) => {
    if (checked) {
      onSelectChange([...selectedIds, itemId])
    } else {
      onSelectChange(selectedIds.filter(id => id !== itemId))
    }
  }

  // 格式化 token 数量
  const formatTokens = (tokens: number) => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`
    }
    return tokens.toString()
  }

  // 渲染分类统计
  const renderCategoryStats = () => (
    <div style={{ marginBottom: 16 }}>
      <Space wrap>
        <Tag icon={typeIcons.system} color={typeColors.system}>
          系统: {formatTokens(categories.system)}
        </Tag>
        <Tag icon={typeIcons.message} color={typeColors.message}>
          消息: {formatTokens(categories.messages)}
        </Tag>
        <Tag icon={typeIcons.code} color={typeColors.code}>
          代码: {formatTokens(categories.code)}
        </Tag>
        <Tag icon={typeIcons.tool_result} color={typeColors.tool_result}>
          工具: {formatTokens(categories.toolResults)}
        </Tag>
      </Space>
    </div>
  )

  // 渲染单个项目
  const renderItem = (item: ContextItem) => (
    <List.Item
      key={item.id}
      style={{
        padding: '8px 12px',
        background: selectedIds.includes(item.id) ? 'rgba(24, 144, 255, 0.1)' : 'transparent',
        borderRadius: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%', gap: 8 }}>
        {(item.removable || item.compressible) && (
          <Checkbox
            checked={selectedIds.includes(item.id)}
            onChange={(e) => handleCheckChange(item.id, e.target.checked)}
          />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {typeIcons[item.type]}
            <Text strong style={{ fontSize: 13 }}>{item.source}</Text>
            <Tag style={{ marginLeft: 'auto', fontSize: 11 }}>
              {formatTokens(item.tokens)} tokens
            </Tag>
          </div>

          <Text
            type="secondary"
            style={{
              fontSize: 12,
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.content}
          </Text>

          <Space size={4} style={{ marginTop: 4 }}>
            {item.removable && (
              <Tooltip title="可删除">
                <DeleteOutlined style={{ fontSize: 11, color: '#ff4d4f' }} />
              </Tooltip>
            )}
            {item.compressible && (
              <Tooltip title="可压缩">
                <CompressOutlined style={{ fontSize: 11, color: '#1890ff' }} />
              </Tooltip>
            )}
          </Space>
        </div>
      </div>
    </List.Item>
  )

  // 渲染分类
  const renderCategory = (type: ContextItemType) => {
    const categoryItems = groupedItems[type]
    if (!categoryItems || categoryItems.length === 0) return null

    return (
      <div key={type} style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
            padding: '4px 0',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          {typeIcons[type]}
          <Text strong>{typeNames[type]}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ({categoryItems.length} 项)
          </Text>
        </div>

        <List
          size="small"
          dataSource={categoryItems}
          renderItem={renderItem}
          split={false}
        />
      </div>
    )
  }

  return (
    <div style={{ maxHeight: 400, overflow: 'auto' }}>
      {renderCategoryStats()}

      {(['system', 'message', 'code', 'tool_result'] as ContextItemType[]).map(renderCategory)}

      {items.length === 0 && (
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: 24 }}>
          暂无上下文内容
        </Text>
      )}
    </div>
  )
}

export default ContextList
