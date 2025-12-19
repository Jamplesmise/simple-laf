import { useState, useEffect, useCallback } from 'react'
import {
  Tabs, Button, Modal, Input, Select, message, Spin, Tag, Tooltip
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, ReloadOutlined,
  CheckCircleOutlined, LoadingOutlined, CloseCircleOutlined
} from '@ant-design/icons'
import { useThemeStore } from '../stores/theme'
import { dependencyApi, type Dependency, type PackageVersions } from '../api/dependencies'

interface DependencyPanelProps {
  collapsed?: boolean
  onToggle?: () => void
}

export default function DependencyPanel({ collapsed, onToggle }: DependencyPanelProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  // 依赖列表状态
  const [deps, setDeps] = useState<Dependency[]>([])
  const [loading, setLoading] = useState(true)

  // 添加依赖弹窗状态
  const [modalOpen, setModalOpen] = useState(false)
  const [packageName, setPackageName] = useState('')
  const [packageVersion, setPackageVersion] = useState<string>('')
  const [versions, setVersions] = useState<PackageVersions | null>(null)
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [installing, setInstalling] = useState(false)

  // 内置依赖
  const builtinDeps = [
    { name: 'lodash', version: '4.17.21' },
    { name: 'axios', version: '1.6.0' },
    { name: 'dayjs', version: '1.11.10' },
  ]

  // 加载依赖列表
  const loadDeps = useCallback(async () => {
    try {
      const res = await dependencyApi.list()
      setDeps(res.data.data)
    } catch {
      message.error('加载依赖失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDeps()
  }, [loadDeps])

  // 轮询更新安装中的依赖状态
  useEffect(() => {
    const hasInstalling = deps.some(d => d.status === 'installing')
    if (!hasInstalling) return

    const interval = setInterval(() => {
      loadDeps()
    }, 2000)

    return () => clearInterval(interval)
  }, [deps, loadDeps])

  // 输入包名后查询版本
  const handlePackageNameBlur = async () => {
    const name = packageName.trim()
    if (!name || name.length < 2) {
      setVersions(null)
      return
    }

    setLoadingVersions(true)
    try {
      const res = await dependencyApi.getVersions(name)
      setVersions(res.data.data)
      // 默认选择 latest
      setPackageVersion('')
    } catch {
      setVersions(null)
      message.warning(`包 ${name} 不存在或网络错误`)
    } finally {
      setLoadingVersions(false)
    }
  }

  // 添加依赖
  const handleAdd = async () => {
    const name = packageName.trim()
    if (!name) {
      message.error('请输入包名')
      return
    }

    setInstalling(true)
    try {
      await dependencyApi.add(name, packageVersion || undefined)
      message.success(`正在安装 ${name}...`)
      setModalOpen(false)
      setPackageName('')
      setPackageVersion('')
      setVersions(null)
      loadDeps()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      message.error(err.response?.data?.error?.message || '添加失败')
    } finally {
      setInstalling(false)
    }
  }

  // 删除依赖
  const handleDelete = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation()
    e.preventDefault()
    try {
      await dependencyApi.remove(name)
      message.success('已删除')
      loadDeps()
    } catch {
      message.error('删除失败')
    }
  }

  // 状态图标 - 使用 Emerald 绿色主题
  const getStatusIcon = (status: string, error?: string) => {
    switch (status) {
      case 'installed':
        return <CheckCircleOutlined style={{ color: '#10B981', fontSize: 13 }} />
      case 'installing':
        return <LoadingOutlined style={{ color: '#059669', fontSize: 13 }} spin />
      case 'failed':
        return (
          <Tooltip title={error || '安装失败'}>
            <CloseCircleOutlined style={{ color: '#ef4444', fontSize: 13 }} />
          </Tooltip>
        )
      default:
        return <LoadingOutlined style={{ color: '#f59e0b', fontSize: 13 }} />
    }
  }

  // 状态标签 - 简化风格
  const getStatusTag = (status: string) => {
    switch (status) {
      case 'installed':
        return <Tag style={{ background: '#ecfdf5', color: '#059669', border: 'none', fontSize: 10 }}>已安装</Tag>
      case 'installing':
        return <Tag style={{ background: '#eff6ff', color: '#3b82f6', border: 'none', fontSize: 10 }}>安装中</Tag>
      case 'failed':
        return <Tag style={{ background: '#fef2f2', color: '#ef4444', border: 'none', fontSize: 10 }}>失败</Tag>
      default:
        return <Tag style={{ background: '#f3f4f6', color: '#6b7280', border: 'none', fontSize: 10 }}>等待中</Tag>
    }
  }

  // 面板标题样式 - 简洁现代风格
  const panelHeaderStyle = {
    padding: '10px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: isDark ? '#1a1a1a' : '#fff',
    cursor: onToggle ? 'pointer' : 'default',
    userSelect: 'none' as const,
    borderBottom: isDark ? '1px solid #303030' : '1px solid #e5e7eb',
  }

  // 依赖列表项组件 - 支持 hover 显示删除按钮
  const DependencyItem = ({ dep }: { dep: Dependency }) => {
    const [isHovered, setIsHovered] = useState(false)
    return (
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          padding: '10px 8px',
          borderBottom: isDark ? '1px solid #303030' : '1px solid #f3f4f6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: isHovered ? (isDark ? '#252525' : '#f9fafb') : 'transparent',
          transition: 'background 0.15s',
          borderRadius: 4,
          margin: '0 -4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          {getStatusIcon(dep.status, dep.error)}
          <span style={{
            color: isDark ? '#d4d4d4' : '#374151',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 12,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>{dep.name}</span>
          <span style={{
            color: isDark ? '#666' : '#9ca3af',
            fontSize: 11,
            fontFamily: '"JetBrains Mono", monospace',
            marginLeft: 'auto',
            flexShrink: 0,
            background: isDark ? '#2a2a2a' : '#f3f4f6',
            padding: '2px 6px',
            borderRadius: 4,
          }}>
            {dep.version}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
          {dep.status === 'failed' && getStatusTag(dep.status)}
          <button
            onClick={(e) => handleDelete(e, dep.name)}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#ef4444',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isHovered ? 1 : 0,
              transition: 'opacity 0.15s',
            }}
          >
            <DeleteOutlined style={{ fontSize: 12 }} />
          </button>
        </div>
      </div>
    )
  }

  // 依赖子标签页 - 现代 Pill 风格
  const depTabItems = [
    {
      key: 'custom',
      label: (
        <span style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 500,
        }}>
          自定义
          <span style={{
            background: isDark ? '#3a3a3a' : '#f3f4f6',
            color: isDark ? '#999' : '#6b7280',
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 10,
            fontWeight: 600,
          }}>
            {deps.length}
          </span>
        </span>
      ),
      children: loading ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <Spin size="small" />
        </div>
      ) : deps.length === 0 ? (
        <div style={{
          height: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isDark ? '#666' : '#9ca3af',
          fontSize: 12,
        }}>
          暂无自定义依赖
        </div>
      ) : (
        <div style={{ padding: '4px 0' }}>
          {deps.map(dep => (
            <DependencyItem key={dep.name} dep={dep} />
          ))}
        </div>
      ),
    },
    {
      key: 'builtin',
      label: (
        <span style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 500,
        }}>
          内置
          <span style={{
            background: isDark ? '#3a3a3a' : '#f3f4f6',
            color: isDark ? '#999' : '#6b7280',
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 10,
            fontWeight: 600,
          }}>
            {builtinDeps.length}
          </span>
        </span>
      ),
      children: (
        <div style={{ padding: '4px 0' }}>
          {builtinDeps.map(dep => (
            <div
              key={dep.name}
              style={{
                padding: '10px 8px',
                borderBottom: isDark ? '1px solid #303030' : '1px solid #f3f4f6',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <CheckCircleOutlined style={{ color: '#10B981', fontSize: 13 }} />
              <span style={{
                color: isDark ? '#d4d4d4' : '#374151',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 12,
              }}>{dep.name}</span>
              <span style={{
                color: isDark ? '#666' : '#9ca3af',
                fontSize: 11,
                fontFamily: '"JetBrains Mono", monospace',
                marginLeft: 'auto',
                background: isDark ? '#2a2a2a' : '#f3f4f6',
                padding: '2px 6px',
                borderRadius: 4,
              }}>
                {dep.version}
              </span>
            </div>
          ))}
        </div>
      ),
    },
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: isDark ? '#1a1a1a' : '#fff' }}>
      {/* 标题栏 */}
      <div style={panelHeaderStyle} onClick={onToggle}>
        <span style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#e0e0e0' : '#1f2937' }}>
          依赖
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setLoading(true); loadDeps() }}
            style={{
              border: 'none',
              background: 'transparent',
              color: isDark ? '#666' : '#9ca3af',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#059669' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = isDark ? '#666' : '#9ca3af' }}
          >
            <ReloadOutlined style={{ fontSize: 12 }} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setModalOpen(true) }}
            style={{
              border: 'none',
              background: 'transparent',
              color: isDark ? '#666' : '#9ca3af',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#059669' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = isDark ? '#666' : '#9ca3af' }}
          >
            <PlusOutlined style={{ fontSize: 12 }} />
          </button>
          {onToggle && (
            <Button
              type="text"
              size="small"
              onClick={(e) => { e.stopPropagation(); onToggle() }}
              style={{ fontSize: 10, padding: '0 4px', color: isDark ? '#666' : '#9ca3af' }}
            >
              {collapsed ? '展开' : '收起'}
            </Button>
          )}
        </div>
      </div>

      {/* 内容区 - 只显示依赖 */}
      {!collapsed && (
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 8px 0' }}>
          <Tabs
            size="small"
            items={depTabItems}
            tabBarStyle={{ marginBottom: 8 }}
          />
        </div>
      )}

      {/* 添加依赖弹窗 */}
      <Modal
        title="添加依赖"
        open={modalOpen}
        onOk={handleAdd}
        onCancel={() => {
          setModalOpen(false)
          setPackageName('')
          setPackageVersion('')
          setVersions(null)
        }}
        confirmLoading={installing}
        okText="安装"
        cancelText="取消"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>包名</label>
            <Input
              placeholder="输入包名后按 Tab 或点击外部查询版本"
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              onBlur={handlePackageNameBlur}
              onPressEnter={handlePackageNameBlur}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>版本</label>
            <Select
              style={{ width: '100%' }}
              placeholder={loadingVersions ? '查询版本中...' : '选择版本 (默认 latest)'}
              value={packageVersion || undefined}
              onChange={setPackageVersion}
              loading={loadingVersions}
              disabled={loadingVersions || !versions}
              allowClear
              showSearch
              optionFilterProp="label"
              options={[
                {
                  value: '',
                  label: versions ? `latest (${versions.latest})` : 'latest (最新)',
                },
                ...(versions?.versions.map((v) => ({
                  value: v,
                  label: v === versions.latest ? `${v} (latest)` : v,
                })) || []),
              ]}
            />
            {versions && (
              <div style={{ marginTop: 4, fontSize: 12, color: isDark ? '#666' : '#999' }}>
                共 {versions.versions.length} 个版本可选
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
