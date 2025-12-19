import { useState, useEffect, useRef, useCallback } from 'react'
import { Modal, Empty, Spin } from 'antd'
import { SearchOutlined, FileTextOutlined, CodeOutlined } from '@ant-design/icons'
import { useThemeStore } from '../stores/theme'
import { useFunctionStore } from '../stores/function'
import { searchApi, type SearchResult } from '../api/search'

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
}

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'
  const { openTab, functions } = useFunctionStore()

  const [searchText, setSearchText] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // 代码字体
  const codeFont = '"JetBrains Mono", "SF Mono", Monaco, Menlo, Consolas, monospace'

  // 搜索
  const doSearch = useCallback(async (text: string) => {
    if (!text || text.length < 2) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const res = await searchApi.search(text)
      setResults(res.data.data || [])
      setSelectedIndex(0)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      doSearch(searchText)
    }, 200)
    return () => clearTimeout(timer)
  }, [searchText, doSearch])

  // 打开时聚焦输入框
  useEffect(() => {
    if (open) {
      setSearchText('')
      setResults([])
      setSelectedIndex(0)
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [open])

  // 选择结果
  const selectResult = (result: SearchResult) => {
    const fn = functions.find(f => f._id === result._id)
    if (fn) {
      openTab(fn)
      onClose()
    }
  }

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (results[selectedIndex]) {
          selectResult(results[selectedIndex])
        }
        break
      case 'Escape':
        onClose()
        break
    }
  }

  // 高亮文本
  const highlightText = (text: string, keyword: string) => {
    if (!keyword) return text
    const regex = new RegExp(`(${keyword})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} style={{ background: isDark ? '#5a4a00' : '#fff3bf', fontWeight: 500 }}>
          {part}
        </span>
      ) : (
        part
      )
    )
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={600}
      centered
      styles={{
        body: { padding: 0 },
        mask: { background: 'rgba(0,0,0,0.6)' },
      }}
    >
      <div
        style={{
          background: isDark ? '#1a1a1a' : '#fff',
          borderRadius: 8,
          overflow: 'hidden',
        }}
        onKeyDown={handleKeyDown}
      >
        {/* 搜索输入框 */}
        <div style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <SearchOutlined style={{ fontSize: 18, color: isDark ? '#666' : '#999' }} />
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            placeholder="搜索函数..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 16,
              color: isDark ? '#e0e0e0' : '#333',
            }}
          />
          <span style={{
            fontSize: 11,
            color: isDark ? '#666' : '#999',
            padding: '2px 6px',
            borderRadius: 4,
            background: isDark ? '#252525' : '#f0f0f0',
          }}>
            ESC
          </span>
        </div>

        {/* 搜索结果 */}
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Spin />
            </div>
          ) : results.length === 0 ? (
            searchText.length >= 2 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="未找到匹配结果"
                style={{ padding: 40 }}
              />
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: isDark ? '#666' : '#999' }}>
                输入至少 2 个字符开始搜索
              </div>
            )
          ) : (
            <div>
              {results.map((result, index) => (
                <div
                  key={`${result._id}-${result.matchType}-${result.lineNumber || 0}`}
                  onClick={() => selectResult(result)}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    background: index === selectedIndex
                      ? (isDark ? '#2a4a6d' : '#e6f7ff')
                      : 'transparent',
                    borderBottom: `1px solid ${isDark ? '#252525' : '#f5f5f5'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  {/* 图标 */}
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: isDark ? '#252525' : '#f0f0f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {result.matchType === 'name' ? (
                      <FileTextOutlined style={{ color: '#4a9eff' }} />
                    ) : (
                      <CodeOutlined style={{ color: '#722ed1' }} />
                    )}
                  </div>

                  {/* 内容 */}
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{
                      fontFamily: codeFont,
                      fontSize: 13,
                      fontWeight: result.matchType === 'name' ? 500 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {highlightText(result.name, searchText)}
                    </div>
                    {result.matchType === 'code' && result.matchedLine && (
                      <div style={{
                        fontSize: 11,
                        color: isDark ? '#888' : '#999',
                        fontFamily: codeFont,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginTop: 2,
                      }}>
                        <span style={{ color: isDark ? '#666' : '#bbb', marginRight: 4 }}>
                          L{result.lineNumber}:
                        </span>
                        {highlightText(result.matchedLine, searchText)}
                      </div>
                    )}
                  </div>

                  {/* 类型标签 */}
                  <span style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: result.matchType === 'name'
                      ? (isDark ? '#1a3a5c' : '#e6f7ff')
                      : (isDark ? '#2a1a4a' : '#f9f0ff'),
                    color: result.matchType === 'name' ? '#4a9eff' : '#722ed1',
                  }}>
                    {result.matchType === 'name' ? '名称' : '代码'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部提示 */}
        {results.length > 0 && (
          <div style={{
            padding: '8px 16px',
            borderTop: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
            display: 'flex',
            gap: 16,
            fontSize: 11,
            color: isDark ? '#666' : '#999',
          }}>
            <span>
              <span style={{ padding: '1px 4px', background: isDark ? '#252525' : '#f0f0f0', borderRadius: 2, marginRight: 4 }}>↑↓</span>
              导航
            </span>
            <span>
              <span style={{ padding: '1px 4px', background: isDark ? '#252525' : '#f0f0f0', borderRadius: 2, marginRight: 4 }}>↵</span>
              打开
            </span>
          </div>
        )}
      </div>
    </Modal>
  )
}
