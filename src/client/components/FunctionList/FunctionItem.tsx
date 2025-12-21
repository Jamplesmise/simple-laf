import { Popconfirm, Tooltip } from 'antd'
import { DeleteOutlined, FileTextOutlined, CheckCircleOutlined } from '@ant-design/icons'
import type { CloudFunction } from '../../stores/function'

interface FunctionItemProps {
  fn: CloudFunction
  indent: number
  isDark: boolean
  isActive: boolean
  onSelect: (fn: CloudFunction) => void
  onDelete: (fn: CloudFunction) => void
}

export default function FunctionItem({
  fn,
  indent,
  isDark,
  isActive,
  onSelect,
  onDelete,
}: FunctionItemProps) {
  return (
    <div
      style={{
        padding: '6px 12px',
        paddingLeft: 12 + indent * 16,
        cursor: 'pointer',
        background: isActive ? (isDark ? '#2a4a6d' : '#e6f7ff') : 'transparent',
        borderBottom: `1px solid ${isDark ? '#252525' : '#f5f5f5'}`,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 13,
      }}
      onClick={() => onSelect(fn)}
    >
      {fn.methods?.[0] && (
        <span
          style={{
            fontSize: 9,
            padding: '1px 4px',
            borderRadius: 2,
            background: isDark ? '#3b5998' : '#e6f7ff',
            color: isDark ? '#fff' : '#1890ff',
            fontWeight: 500,
          }}
        >
          {fn.methods[0]}
        </span>
      )}
      <FileTextOutlined style={{ color: '#4a9eff', fontSize: 12 }} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {fn.name.split('/').pop()}
      </span>
      {fn.published && (
        <Tooltip title="已发布">
          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 11 }} />
        </Tooltip>
      )}
      <Popconfirm
        title="确定删除该函数？"
        onConfirm={(e) => {
          e?.stopPropagation()
          onDelete(fn)
        }}
        onCancel={(e) => e?.stopPropagation()}
      >
        <DeleteOutlined
          style={{ color: isDark ? '#666' : '#999', fontSize: 11, opacity: 0.6 }}
          onClick={(e) => e.stopPropagation()}
        />
      </Popconfirm>
    </div>
  )
}
