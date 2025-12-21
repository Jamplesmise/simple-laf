/**
 * VersionHistory - 版本历史组件
 *
 * 显示代码快照版本列表，支持切换和对比
 */

import { useState, useEffect, useCallback } from 'react'
import { Dropdown, Spin, Empty } from 'antd'
import {
  HistoryOutlined,
  DownOutlined,
  CheckOutlined,
  DiffOutlined,
} from '@ant-design/icons'
import { aiConversationApi } from '@/api/aiConversation'
import type { SnapshotListItem } from '@/api/aiConversation'
import styles from './styles.module.css'

interface VersionHistoryProps {
  /** 对话 ID */
  conversationId: string
  /** 当前选中的快照 ID */
  selectedSnapshotId?: string
  /** 选择快照回调 */
  onSelectSnapshot?: (snapshot: SnapshotListItem | null) => void
  /** 对比快照回调 */
  onCompareSnapshot?: (snapshotId: string) => void
}

export function VersionHistory({
  conversationId,
  selectedSnapshotId,
  onSelectSnapshot,
  onCompareSnapshot,
}: VersionHistoryProps) {
  const [snapshots, setSnapshots] = useState<SnapshotListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  // 加载快照列表
  const loadSnapshots = useCallback(async () => {
    if (!conversationId) return
    setLoading(true)
    try {
      const res = await aiConversationApi.getSnapshots(conversationId, 20)
      if (res.data.success) {
        setSnapshots(res.data.data || [])
      }
    } catch {
      // 静默处理错误
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  // 初始加载
  useEffect(() => {
    if (open) {
      loadSnapshots()
    }
  }, [open, loadSnapshots])

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
    return date.toLocaleDateString()
  }

  // 选中的快照
  const selectedSnapshot = snapshots.find(s => s.id === selectedSnapshotId)

  // 下拉菜单内容
  const dropdownContent = (
    <div className={styles.versionDropdown}>
      <div className={styles.versionDropdownHeader}>
        <HistoryOutlined />
        <span>版本历史</span>
      </div>

      {loading ? (
        <div className={styles.versionDropdownLoading}>
          <Spin size="small" />
        </div>
      ) : snapshots.length === 0 ? (
        <div className={styles.versionDropdownEmpty}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无版本"
          />
        </div>
      ) : (
        <div className={styles.versionList}>
          {/* 当前版本选项 */}
          <div
            className={`${styles.versionItem} ${!selectedSnapshotId ? styles.versionItemActive : ''}`}
            onClick={() => {
              onSelectSnapshot?.(null)
              setOpen(false)
            }}
          >
            <div className={styles.versionItemMain}>
              <span className={styles.versionItemLabel}>当前版本</span>
              <span className={styles.versionItemTime}>未保存</span>
            </div>
            {!selectedSnapshotId && (
              <CheckOutlined className={styles.versionItemCheck} />
            )}
          </div>

          {/* 快照列表 */}
          {snapshots.map((snapshot) => (
            <div
              key={snapshot.id}
              className={`${styles.versionItem} ${selectedSnapshotId === snapshot.id ? styles.versionItemActive : ''}`}
              onClick={() => {
                onSelectSnapshot?.(snapshot)
                setOpen(false)
              }}
            >
              <div className={styles.versionItemMain}>
                <span className={styles.versionItemLabel}>
                  v{snapshot.version}
                  {snapshot.description && (
                    <span className={styles.versionItemDesc}>
                      {' - '}{snapshot.description}
                    </span>
                  )}
                </span>
                <span className={styles.versionItemTime}>
                  {formatTime(snapshot.createdAt)}
                </span>
              </div>

              <div className={styles.versionItemActions}>
                {selectedSnapshotId === snapshot.id && (
                  <CheckOutlined className={styles.versionItemCheck} />
                )}
                <button
                  className={styles.versionItemAction}
                  onClick={(e) => {
                    e.stopPropagation()
                    onCompareSnapshot?.(snapshot.id)
                  }}
                  title="对比版本"
                >
                  <DiffOutlined />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <Dropdown
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
    >
      <button className={styles.versionSelect}>
        <span>
          {selectedSnapshot ? `v${selectedSnapshot.version}` : '当前版本'}
        </span>
        <DownOutlined style={{ fontSize: 10 }} />
      </button>
    </Dropdown>
  )
}
