/**
 * 树节点组件
 */

import { DragEvent } from 'react'
import { Tooltip } from 'antd'
import {
  FolderOutlined,
  FolderOpenOutlined,
  CheckCircleOutlined,
  RightOutlined,
  DownOutlined,
} from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import type { TreeNode as TreeNodeType } from '@/api/folders'

interface TreeNodeProps {
  node: TreeNodeType
  level: number
  isExpanded: boolean
  isSelected: boolean
  hasChanges: boolean
  isDragOver: boolean
  onDragStart: (e: DragEvent<HTMLDivElement>, node: TreeNodeType) => void
  onDragOver: (e: DragEvent<HTMLDivElement>, node: TreeNodeType) => void
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
  onDrop: (e: DragEvent<HTMLDivElement>, node: TreeNodeType) => void
  onClick: (node: TreeNodeType) => void
  onContextMenu: (e: React.MouseEvent, node: TreeNodeType) => void
  children?: React.ReactNode
}

export function TreeNodeItem({
  node,
  level,
  isExpanded,
  isSelected,
  hasChanges,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDragEnd,
  onDrop,
  onClick,
  onContextMenu,
  children,
}: TreeNodeProps) {
  const { isDark, t } = useThemeColors()

  return (
    <div>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, node)}
        onDragOver={(e) => onDragOver(e, node)}
        onDragLeave={onDragLeave}
        onDragEnd={onDragEnd}
        onDrop={(e) => onDrop(e, node)}
        onClick={() => onClick(node)}
        onContextMenu={(e) => onContextMenu(e, node)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 8px',
          paddingLeft: 12 + level * 16,
          cursor: 'pointer',
          borderRadius: 4,
          margin: '1px 4px',
          backgroundColor: isDragOver
            ? (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)')
            : isSelected
              ? (isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.12)')
              : 'transparent',
          border: isDragOver ? `1px dashed ${t.accent}` : '1px solid transparent',
          color: t.text,
          fontSize: 13,
          transition: 'background-color 0.15s, border-color 0.15s',
        }}
        onMouseEnter={(e) => {
          if (!isDragOver && !isSelected) {
            e.currentTarget.style.backgroundColor = isDark ? '#2a2a2a' : '#f5f5f5'
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragOver && !isSelected) {
            e.currentTarget.style.backgroundColor = 'transparent'
          }
        }}
      >
        {/* 展开/折叠图标 */}
        {node.isFolder ? (
          <span style={{
            width: 14,
            display: 'flex',
            justifyContent: 'center',
            color: isDark ? '#666' : '#999',
          }}>
            {isExpanded ? (
              <DownOutlined style={{ fontSize: 9 }} />
            ) : (
              <RightOutlined style={{ fontSize: 9 }} />
            )}
          </span>
        ) : (
          <span style={{ width: 14 }} />
        )}

        {/* 文件/文件夹图标 */}
        {node.isFolder ? (
          isExpanded ? (
            <FolderOpenOutlined style={{ color: '#f5a623', fontSize: 14 }} />
          ) : (
            <FolderOutlined style={{ color: '#f5a623', fontSize: 14 }} />
          )
        ) : (
          <span style={{ fontSize: 10, fontWeight: 500, color: '#3178c6' }}>
            TS
          </span>
        )}

        {/* 标题 */}
        <span style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: isSelected ? 500 : 400,
        }}>
          {node.title}
        </span>

        {/* 未发布更改指示器 */}
        {hasChanges && (
          <Tooltip title="有未发布的更改">
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: '#ff4d4f',
              display: 'inline-block',
              flexShrink: 0,
            }} />
          </Tooltip>
        )}

        {/* 已发布指示器 */}
        {!node.isFolder && node.published && !hasChanges && (
          <Tooltip title="已发布">
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 11, flexShrink: 0 }} />
          </Tooltip>
        )}
      </div>

      {/* 子节点 */}
      {node.isFolder && isExpanded && children}
    </div>
  )
}
