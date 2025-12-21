import { FolderOutlined, FolderOpenOutlined } from '@ant-design/icons'
import FunctionItem from './FunctionItem'
import type { FolderNode } from './types'
import type { CloudFunction } from '../../stores/function'

interface FolderTreeProps {
  folder: FolderNode
  indent: number
  isDark: boolean
  expandedFolders: Set<string>
  currentFunctionId?: string
  onToggleFolder: (path: string) => void
  onSelectFunction: (fn: CloudFunction) => void
  onDeleteFunction: (fn: CloudFunction) => void
}

export default function FolderTree({
  folder,
  indent,
  isDark,
  expandedFolders,
  currentFunctionId,
  onToggleFolder,
  onSelectFunction,
  onDeleteFunction,
}: FolderTreeProps) {
  const isExpanded = expandedFolders.has(folder.path)

  return (
    <div>
      <div
        style={{
          padding: '6px 12px',
          paddingLeft: 12 + indent * 16,
          cursor: 'pointer',
          background: 'transparent',
          borderBottom: `1px solid ${isDark ? '#252525' : '#f5f5f5'}`,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
        }}
        onClick={() => onToggleFolder(folder.path)}
      >
        {isExpanded ? (
          <FolderOpenOutlined style={{ color: '#faad14', fontSize: 12 }} />
        ) : (
          <FolderOutlined style={{ color: '#faad14', fontSize: 12 }} />
        )}
        <span style={{ fontWeight: 500 }}>{folder.name}</span>
        <span style={{ color: '#888', fontSize: 11 }}>
          ({folder.functions.length + folder.children.reduce((acc, c) => acc + c.functions.length, 0)})
        </span>
      </div>
      {isExpanded && (
        <>
          {folder.children.map((child) => (
            <FolderTree
              key={child.path}
              folder={child}
              indent={indent + 1}
              isDark={isDark}
              expandedFolders={expandedFolders}
              currentFunctionId={currentFunctionId}
              onToggleFolder={onToggleFolder}
              onSelectFunction={onSelectFunction}
              onDeleteFunction={onDeleteFunction}
            />
          ))}
          {folder.functions.map((fn) => (
            <FunctionItem
              key={fn._id}
              fn={fn}
              indent={indent + 1}
              isDark={isDark}
              isActive={currentFunctionId === fn._id}
              onSelect={onSelectFunction}
              onDelete={onDeleteFunction}
            />
          ))}
        </>
      )}
    </div>
  )
}
