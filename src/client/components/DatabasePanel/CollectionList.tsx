/**
 * 集合列表组件
 *
 * 显示 MongoDB 集合列表，支持搜索、新建、删除
 */

import { useState, useMemo } from 'react'
import { Input, Button, Tooltip, Popconfirm, Spin, Empty, Modal, message } from 'antd'
import { PlusOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import type { CollectionInfo } from '@/api/database'
import styles from './styles.module.css'

interface CollectionListProps {
  collections: CollectionInfo[]
  currentCollection: string | null
  loading: boolean
  searchValue: string
  onSelect: (name: string) => void
  onSearchChange: (value: string) => void
  onRefresh: () => void
  onCreate: (name: string) => Promise<void>
  onDrop: (name: string) => Promise<void>
}

export function CollectionList({
  collections,
  currentCollection,
  loading,
  searchValue,
  onSelect,
  onSearchChange,
  onRefresh,
  onCreate,
  onDrop,
}: CollectionListProps) {
  const { isDark, t } = useThemeColors()
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [hoveredName, setHoveredName] = useState<string | null>(null)

  // 过滤后的集合列表
  const filteredCollections = useMemo(() => {
    if (!searchValue) return collections
    const search = searchValue.toLowerCase()
    return collections.filter(col => col.name.toLowerCase().includes(search))
  }, [collections, searchValue])

  // 处理创建集合
  const handleCreate = async () => {
    if (!newName.trim()) {
      message.warning('请输入集合名称')
      return
    }
    try {
      await onCreate(newName.trim())
      message.success('创建成功')
      setCreateOpen(false)
      setNewName('')
    } catch (err) {
      message.error((err as Error).message || '创建失败')
    }
  }

  // 处理删除集合
  const handleDrop = async (name: string) => {
    try {
      await onDrop(name)
      message.success('删除成功')
    } catch (err) {
      message.error((err as Error).message || '删除失败')
    }
  }

  return (
    <div className={styles.sidebar} style={{ background: t.bg }}>
      {/* 标题栏 */}
      <div className={styles.sidebarHeader}>
        <span className={styles.sidebarTitle} style={{ color: t.text }}>
          Collections
        </span>
        <div className={styles.sidebarActions}>
          <Tooltip title="刷新">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined spin={loading} style={{ fontSize: 13 }} />}
              onClick={onRefresh}
              style={{ color: t.textMuted, width: 26, height: 26 }}
            />
          </Tooltip>
          <Tooltip title="新建集合">
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined style={{ fontSize: 13 }} />}
              onClick={() => setCreateOpen(true)}
              style={{ color: t.textMuted, width: 26, height: 26 }}
            />
          </Tooltip>
        </div>
      </div>

      {/* 搜索框 */}
      <div className={styles.searchBox}>
        <Input
          placeholder="搜索集合..."
          prefix={<SearchOutlined style={{ color: t.textMuted }} />}
          value={searchValue}
          onChange={e => onSearchChange(e.target.value)}
          allowClear
          size="small"
          style={{
            background: t.bgMuted,
            border: 'none',
            borderRadius: 6,
          }}
        />
      </div>

      {/* 集合列表 */}
      <div className={styles.collectionList}>
        {loading && collections.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <Spin size="small" />
          </div>
        ) : filteredCollections.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无集合"
            style={{ marginTop: 40 }}
          />
        ) : (
          filteredCollections.map(col => {
            const isSelected = currentCollection === col.name
            const isHovered = hoveredName === col.name

            return (
              <div
                key={col.name}
                className={`${styles.collectionItem} ${isSelected ? styles.collectionItemActive : ''}`}
                style={{
                  background: isSelected
                    ? `linear-gradient(90deg, ${t.accentLight} 0%, ${t.accentSurface} 100%)`
                    : isHovered
                      ? t.bgHover
                      : 'transparent',
                }}
                onClick={() => onSelect(col.name)}
                onMouseEnter={() => setHoveredName(col.name)}
                onMouseLeave={() => setHoveredName(null)}
              >
                <span
                  className={styles.collectionName}
                  style={{ color: isSelected ? t.accent : t.text }}
                >
                  {col.name}
                </span>
                <div className={styles.collectionMeta}>
                  <span
                    className={styles.collectionCount}
                    style={{
                      color: t.textMuted,
                      background: isDark ? t.bgMuted : '#F3F4F6',
                    }}
                  >
                    {col.documentCount}
                  </span>
                  <div style={{ opacity: isHovered ? 1 : 0, transition: 'opacity 0.15s', marginLeft: -4 }}>
                    <Popconfirm
                      title={`确定删除集合 "${col.name}" 吗？`}
                      description="此操作不可恢复"
                      onConfirm={e => {
                        e?.stopPropagation()
                        handleDrop(col.name)
                      }}
                      onCancel={e => e?.stopPropagation()}
                    >
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                        onClick={e => e.stopPropagation()}
                        style={{ color: t.textMuted, width: 22, height: 22, minWidth: 22 }}
                      />
                    </Popconfirm>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 创建集合弹窗 */}
      <Modal
        title="新建集合"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateOpen(false)
          setNewName('')
        }}
        okButtonProps={{
          style: { background: t.accent, borderColor: t.accent },
        }}
        okText="创建"
        cancelText="取消"
      >
        <Input
          placeholder="集合名称"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onPressEnter={handleCreate}
          style={{ marginTop: 8 }}
        />
        <div style={{ marginTop: 8, fontSize: 12, color: t.textMuted }}>
          只能包含字母、数字和下划线
        </div>
      </Modal>
    </div>
  )
}
