/**
 * 文件夹树组件
 */

import { useState } from 'react'
import { Button, Spin, Tooltip } from 'antd'
import {
  FolderOutlined,
  ReloadOutlined,
  FolderAddOutlined,
  RightOutlined,
  HomeOutlined,
} from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import { getFileName } from './utils'
import type { ObjectInfo } from '@/api/storage'

interface FolderTreeProps {
  folders: ObjectInfo[]
  currentPath: string
  loading: boolean
  onNavigate: (path: string) => void
  onRefresh: () => void
  onCreateFolder: () => void
}

export function FolderTree({
  folders,
  currentPath,
  loading,
  onNavigate,
  onRefresh,
  onCreateFolder,
}: FolderTreeProps) {
  const { isDark, t } = useThemeColors()

  const [hoveredFolder, setHoveredFolder] = useState<string | null>(null)

  return (
    <div
      style={{
        width: 220,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: t.bgCard,
        borderRight: `1px solid ${t.borderLight}`,
      }}
    >
      {/* 标题栏 */}
      <div
        style={{
          height: 40,
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${t.borderLight}`,
        }}
      >
        <span style={{ fontWeight: 600, color: t.text, fontSize: 13 }}>文件夹</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <Tooltip title="刷新">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined spin={loading} style={{ fontSize: 13 }} />}
              onClick={onRefresh}
              style={{ color: t.textMuted, width: 26, height: 26 }}
            />
          </Tooltip>
          <Tooltip title="新建文件夹">
            <Button
              type="text"
              size="small"
              icon={<FolderAddOutlined style={{ fontSize: 13 }} />}
              onClick={onCreateFolder}
              style={{ color: t.textMuted, width: 26, height: 26 }}
            />
          </Tooltip>
        </div>
      </div>

      {/* 文件夹列表 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* 根目录 */}
        <div
          style={{
            height: 38,
            padding: '0 10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            background: currentPath === ''
              ? `linear-gradient(90deg, ${isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5'} 0%, ${t.accentSurface} 100%)`
              : hoveredFolder === '/'
              ? t.bgMuted
              : 'transparent',
            borderLeft: currentPath === '' ? `3px solid ${t.accent}` : '3px solid transparent',
            transition: 'all 0.15s ease',
          }}
          onClick={() => onNavigate('')}
          onMouseEnter={() => setHoveredFolder('/')}
          onMouseLeave={() => setHoveredFolder(null)}
        >
          <HomeOutlined style={{ color: currentPath === '' ? t.accent : t.textMuted, fontSize: 14, marginRight: 8 }} />
          <span style={{ color: currentPath === '' ? t.accent : t.text, fontWeight: 500, fontSize: 13 }}>
            根目录
          </span>
        </div>

        {/* 子文件夹 */}
        {loading && folders.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <Spin size="small" />
          </div>
        ) : (
          folders.map((folder) => {
            const folderName = getFileName(folder.key.replace(/\/$/, ''))
            const isSelected = currentPath === folder.key
            const isHovered = hoveredFolder === folder.key
            return (
              <div
                key={folder.key}
                style={{
                  height: 38,
                  padding: '0 10px 0 28px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  background: isSelected
                    ? `linear-gradient(90deg, ${isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5'} 0%, ${t.accentSurface} 100%)`
                    : isHovered
                    ? t.bgMuted
                    : 'transparent',
                  borderLeft: isSelected ? `3px solid ${t.accent}` : '3px solid transparent',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => onNavigate(folder.key)}
                onMouseEnter={() => setHoveredFolder(folder.key)}
                onMouseLeave={() => setHoveredFolder(null)}
              >
                <FolderOutlined style={{ color: '#FBBF24', fontSize: 14, marginRight: 8 }} />
                <span
                  style={{
                    color: isSelected ? t.accent : t.text,
                    fontWeight: 500,
                    fontSize: 13,
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {folderName}
                </span>
                <RightOutlined style={{ color: t.textMuted, fontSize: 10 }} />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
