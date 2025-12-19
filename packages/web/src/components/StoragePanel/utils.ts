/**
 * StoragePanel 工具函数
 */

import { FileOutlined, FolderOutlined } from '@ant-design/icons'
import React from 'react'

// 格式化文件大小
export function formatSize(bytes: number): string {
  if (bytes === 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

// 格式化日期
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 获取文件图标
export function getFileIcon(key: string, isFolder: boolean): React.ReactElement {
  if (isFolder) return React.createElement(FolderOutlined, { style: { color: '#FBBF24' } })

  const ext = key.split('.').pop()?.toLowerCase()
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico']
  const codeExts = ['js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'md']
  const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']

  if (imageExts.includes(ext || '')) return React.createElement(FileOutlined, { style: { color: '#10B981' } })
  if (codeExts.includes(ext || '')) return React.createElement(FileOutlined, { style: { color: '#3B82F6' } })
  if (docExts.includes(ext || '')) return React.createElement(FileOutlined, { style: { color: '#EF4444' } })

  return React.createElement(FileOutlined, { style: { color: '#6B7280' } })
}

// 获取文件名
export function getFileName(key: string): string {
  const parts = key.split('/')
  return parts[parts.length - 1] || parts[parts.length - 2] || key
}

// 检查是否为图片
export function isImageFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico']
  return imageExts.includes(ext || '')
}

// 检查是否为文本文件
export function isTextFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const textExts = ['txt', 'json', 'md', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'xml', 'yaml', 'yml', 'log']
  return textExts.includes(ext || '')
}
