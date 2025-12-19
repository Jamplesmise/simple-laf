/**
 * 索引管理面板
 *
 * 显示和管理集合索引
 */

import { Button, Tag, Spin, Modal, Input, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import type { IndexInfo } from '@/api/database'
import styles from './styles.module.css'

interface IndexPanelProps {
  indexes: IndexInfo[]
  loading: boolean
  onCreate: (keys: Record<string, 1 | -1>) => Promise<void>
  onDrop: (name: string) => Promise<void>
}

export function IndexPanel({
  indexes,
  loading,
  onCreate,
  onDrop,
}: IndexPanelProps) {
  const { t } = useThemeColors()

  // 处理创建索引
  const handleCreate = () => {
    Modal.confirm({
      title: '创建索引',
      content: (
        <div style={{ marginTop: 16 }}>
          <Input
            id="index-field-input"
            placeholder="字段名，多个用逗号分隔"
          />
          <div style={{ marginTop: 8, fontSize: 12, color: t.textSecondary }}>
            示例: name 或 name,createdAt
          </div>
        </div>
      ),
      onOk: async () => {
        const input = document.getElementById('index-field-input') as HTMLInputElement
        const fields = input?.value.trim()
        if (!fields) return

        try {
          const keys: Record<string, 1 | -1> = {}
          fields.split(',').forEach(f => {
            const field = f.trim()
            if (field) keys[field] = 1
          })

          await onCreate(keys)
          message.success('索引创建成功')
        } catch (err) {
          message.error((err as Error).message || '创建失败')
        }
      },
    })
  }

  // 处理删除索引
  const handleDrop = async (name: string) => {
    try {
      await onDrop(name)
      message.success('索引删除成功')
    } catch (err) {
      message.error((err as Error).message || '删除失败')
    }
  }

  return (
    <div className={styles.indexPanel} style={{ background: t.bgHover, borderColor: t.border }}>
      <div className={styles.indexHeader}>
        <span className={styles.indexTitle} style={{ color: t.textSecondary }}>
          索引
        </span>
        <Button
          size="small"
          type="text"
          icon={<PlusOutlined />}
          onClick={handleCreate}
          style={{ color: t.accent }}
        >
          创建
        </Button>
      </div>

      {loading ? (
        <Spin size="small" />
      ) : indexes.length === 0 ? (
        <span style={{ color: t.textMuted, fontSize: 12 }}>暂无索引</span>
      ) : (
        <div className={styles.indexList}>
          {indexes.map(idx => (
            <Tag
              key={idx.name}
              closable={idx.name !== '_id_'}
              onClose={() => handleDrop(idx.name)}
              color={idx.unique ? 'blue' : undefined}
              style={{ fontSize: 11, margin: 0 }}
            >
              {idx.name}
              {idx.unique && ' (unique)'}
            </Tag>
          ))}
        </div>
      )}
    </div>
  )
}
