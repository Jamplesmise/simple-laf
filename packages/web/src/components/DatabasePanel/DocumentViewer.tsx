/**
 * 文档视图组件
 *
 * 支持列表、表格、JSON 三种视图模式
 */

import { Button, Tooltip, Popconfirm, Spin, Empty, Table, Pagination, Input, Segmented } from 'antd'
import {
  EditOutlined, DeleteOutlined, PlusOutlined, ReloadOutlined, KeyOutlined,
  SearchOutlined, UnorderedListOutlined, TableOutlined, CodeOutlined,
} from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import type { Document } from '@/api/database'
import type { DocumentViewMode } from '@/stores/database'
import { getDocumentSummary } from './utils'
import styles from './styles.module.css'

interface DocumentViewerProps {
  documents: Document[]
  currentDocument: Document | null
  loading: boolean
  viewMode: DocumentViewMode
  total: number
  page: number
  pageSize: number
  queryInput: string
  showIndexes: boolean
  onSelect: (doc: Document) => void
  onDelete: (id: string) => Promise<void>
  onCreate: () => void
  onRefresh: () => void
  onViewModeChange: (mode: DocumentViewMode) => void
  onQueryChange: (query: string) => void
  onQuerySubmit: () => void
  onPageChange: (page: number, pageSize: number) => void
  onToggleIndexes: () => void
  indexPanel?: React.ReactNode
}

export function DocumentViewer({
  documents,
  currentDocument,
  loading,
  viewMode,
  total,
  page,
  pageSize,
  queryInput,
  showIndexes,
  onSelect,
  onDelete,
  onCreate,
  onRefresh,
  onViewModeChange,
  onQueryChange,
  onQuerySubmit,
  onPageChange,
  onToggleIndexes,
  indexPanel,
}: DocumentViewerProps) {
  const { t } = useThemeColors()

  // 渲染文档视图
  const renderView = () => {
    if (loading) {
      return (
        <div className={styles.loadingState}>
          <Spin />
        </div>
      )
    }

    if (documents.length === 0) {
      return (
        <div className={styles.emptyState}>
          <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      )
    }

    switch (viewMode) {
      case 'list':
        return <ListView documents={documents} currentDocument={currentDocument} onSelect={onSelect} onDelete={onDelete} />
      case 'table':
        return <TableView documents={documents} currentDocument={currentDocument} loading={loading} onSelect={onSelect} onDelete={onDelete} />
      case 'json':
        return <JsonView documents={documents} />
      default:
        return <ListView documents={documents} currentDocument={currentDocument} onSelect={onSelect} onDelete={onDelete} />
    }
  }

  return (
    <div className={styles.main} style={{ background: t.bg }}>
      {/* 工具栏 */}
      <div className={styles.toolbar} style={{ background: t.bg }}>
        <div className={styles.searchInput}>
          <Input
            placeholder="筛选 JSON 数据 (例如 id:123)..."
            value={queryInput}
            onChange={e => onQueryChange(e.target.value)}
            onPressEnter={onQuerySubmit}
            prefix={<SearchOutlined style={{ color: t.textMuted }} />}
            style={{
              background: t.bgMuted,
              border: 'none',
              borderRadius: 6,
            }}
          />
        </div>

        <div className={styles.toolbarSpacer} />

        <Tooltip title="添加文档">
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            onClick={onCreate}
            style={{ color: t.textMuted }}
          />
        </Tooltip>
        <Tooltip title="刷新">
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={onRefresh}
            style={{ color: t.textMuted }}
          />
        </Tooltip>
        <Tooltip title="索引管理">
          <Button
            type="text"
            size="small"
            icon={<KeyOutlined />}
            onClick={onToggleIndexes}
            style={{ color: showIndexes ? t.accent : t.textMuted }}
          />
        </Tooltip>

        <Segmented
          size="small"
          value={viewMode}
          onChange={v => onViewModeChange(v as DocumentViewMode)}
          options={[
            { value: 'list', icon: <UnorderedListOutlined /> },
            { value: 'table', icon: <TableOutlined /> },
            { value: 'json', icon: <CodeOutlined /> },
          ]}
          style={{
            background: t.bgMuted,
            borderRadius: 8,
            padding: 2,
          }}
        />
      </div>

      {/* 索引面板 */}
      {showIndexes && indexPanel}

      {/* 文档视图 */}
      {renderView()}

      {/* 分页 */}
      <div className={styles.pagination} style={{ background: t.bg }}>
        <span className={styles.paginationTotal} style={{ color: t.textMuted }}>
          共 {total} 条
        </span>
        <Pagination
          current={page}
          pageSize={pageSize}
          total={total}
          size="small"
          showSizeChanger
          showQuickJumper
          onChange={onPageChange}
        />
      </div>
    </div>
  )
}

/**
 * 列表视图
 */
interface ListViewProps {
  documents: Document[]
  currentDocument: Document | null
  onSelect: (doc: Document) => void
  onDelete: (id: string) => Promise<void>
}

function ListView({ documents, currentDocument, onSelect, onDelete }: ListViewProps) {
  const { isDark, t } = useThemeColors()

  return (
    <div className={styles.documentList} style={{ background: t.bg }}>
      {documents.map(doc => {
        const isSelected = currentDocument?._id === doc._id
        const summary = getDocumentSummary(doc)

        return (
          <div
            key={doc._id}
            className={`${styles.documentItem} ${isSelected ? styles.documentItemActive : ''}`}
            onClick={() => onSelect(doc)}
          >
            <div className={styles.documentContent}>
              {summary && (
                <p className={styles.documentSummary} style={{ color: t.text }}>
                  <span style={{ color: t.accent }}>{summary.key}:</span>
                  <span style={{ marginLeft: 4 }}>"{summary.value}"</span>
                </p>
              )}
              <p className={styles.documentMeta} style={{ color: t.textMuted }}>
                <span>_id: {doc._id.slice(0, 12)}...{doc._id.slice(-5)}</span>
                <span
                  className={styles.documentTypeBadge}
                  style={{ background: isDark ? t.bgMuted : '#F3F4F6', color: t.textMuted }}
                >
                  Object
                </span>
              </p>
            </div>

            <div className={styles.documentActions}>
              <Tooltip title="编辑">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={e => {
                    e.stopPropagation()
                    onSelect(doc)
                  }}
                  style={{ color: t.textMuted }}
                />
              </Tooltip>
              <Popconfirm
                title="确定删除这条文档吗？"
                onConfirm={e => {
                  e?.stopPropagation()
                  onDelete(doc._id)
                }}
                onCancel={e => e?.stopPropagation()}
              >
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={e => e.stopPropagation()}
                  style={{ color: t.textMuted }}
                />
              </Popconfirm>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * 表格视图
 */
interface TableViewProps {
  documents: Document[]
  currentDocument: Document | null
  loading: boolean
  onSelect: (doc: Document) => void
  onDelete: (id: string) => Promise<void>
}

function TableView({ documents, currentDocument, loading, onSelect, onDelete }: TableViewProps) {
  const { t } = useThemeColors()

  const columns = [
    {
      title: '_id',
      dataIndex: '_id',
      key: '_id',
      width: 180,
      ellipsis: true,
      render: (id: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: t.textMuted }}>{id}</span>
      ),
    },
    ...getTableColumns(documents, t),
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: Document) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onSelect(record)}
              style={{ color: t.textSecondary }}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除这条文档吗？"
            onConfirm={() => onDelete(record._id)}
          >
            <Button type="text" size="small" icon={<DeleteOutlined />} style={{ color: t.textMuted }} />
          </Popconfirm>
        </div>
      ),
    },
  ]

  return (
    <div className={styles.tableView}>
      <Table
        dataSource={documents}
        columns={columns}
        rowKey="_id"
        loading={loading}
        pagination={false}
        size="small"
        scroll={{ x: 'max-content' }}
        onRow={record => ({
          onClick: () => onSelect(record),
          style: {
            cursor: 'pointer',
            background: currentDocument?._id === record._id ? t.accentLight : undefined,
          },
        })}
      />
    </div>
  )
}

// 动态生成表格列
function getTableColumns(documents: Document[], t: ReturnType<typeof useThemeColors>['t']) {
  if (documents.length === 0) return []

  const firstDoc = documents[0]
  const fields = Object.keys(firstDoc).filter(k => k !== '_id').slice(0, 3)

  return fields.map(field => ({
    title: field,
    dataIndex: field,
    key: field,
    width: 140,
    ellipsis: true,
    render: (value: unknown) => {
      if (value === null) return <span style={{ color: t.textMuted }}>null</span>
      if (value === undefined) return <span style={{ color: t.textMuted }}>-</span>
      if (typeof value === 'object') {
        return (
          <Tooltip title={JSON.stringify(value, null, 2)}>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: t.textSecondary }}>
              {JSON.stringify(value).slice(0, 20)}...
            </span>
          </Tooltip>
        )
      }
      return <span style={{ color: t.text }}>{String(value)}</span>
    },
  }))
}

/**
 * JSON 视图
 */
function JsonView({ documents }: { documents: Document[] }) {
  const { t } = useThemeColors()

  return (
    <div className={styles.jsonView}>
      <pre
        className={styles.jsonContent}
        style={{
          background: t.bgHover,
          color: t.text,
          borderColor: t.border,
        }}
      >
        {JSON.stringify(documents, null, 2)}
      </pre>
    </div>
  )
}
