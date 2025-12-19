import { useState, useEffect } from 'react'
import { Input, message, Spin, Popconfirm, Tag, Tooltip } from 'antd'
import {
  Globe, Plus, Trash2, RefreshCw, Copy, CheckCircle2, XCircle
} from 'lucide-react'
import { customDomainApi, type CustomDomain } from '../api/customDomain'
import { useThemeStore } from '../stores/theme'

export default function CustomDomainManager() {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  const [domains, setDomains] = useState<CustomDomain[]>([])
  const [systemDomain, setSystemDomain] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [verifying, setVerifying] = useState<string | null>(null)

  // 新增表单状态
  const [showAddForm, setShowAddForm] = useState(false)
  const [newDomain, setNewDomain] = useState('')
  const [newTargetPath, setNewTargetPath] = useState('')

  // 加载数据
  const loadData = async () => {
    setLoading(true)
    try {
      const [domainsRes, sysRes] = await Promise.all([
        customDomainApi.list(),
        customDomainApi.getSystemDomain(),
      ])
      setDomains(domainsRes.data.data || [])
      setSystemDomain(sysRes.data.data.systemDomain || '')
    } catch {
      message.error('加载域名列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // 添加域名
  const handleAdd = async () => {
    if (!newDomain.trim()) {
      message.error('请输入域名')
      return
    }

    setAdding(true)
    try {
      await customDomainApi.add(newDomain.trim(), newTargetPath.trim() || undefined)
      message.success('域名添加成功')
      setShowAddForm(false)
      setNewDomain('')
      setNewTargetPath('')
      await loadData()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      message.error(err.response?.data?.error?.message || '添加失败')
    } finally {
      setAdding(false)
    }
  }

  // 删除域名
  const handleDelete = async (id: string) => {
    try {
      await customDomainApi.remove(id)
      message.success('域名已删除')
      await loadData()
    } catch {
      message.error('删除失败')
    }
  }

  // 验证 DNS
  const handleVerify = async (id: string) => {
    setVerifying(id)
    try {
      const res = await customDomainApi.verify(id)
      const { verified, message: msg } = res.data.data
      if (verified) {
        message.success(msg)
      } else {
        message.warning(msg)
      }
      await loadData()
    } catch {
      message.error('验证失败')
    } finally {
      setVerifying(null)
    }
  }

  // 复制到剪贴板
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    message.success('已复制到剪贴板')
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 系统域名提示 */}
      <div style={{
        marginBottom: 16,
        padding: 12,
        borderRadius: 8,
        flexShrink: 0,
        background: isDark ? '#1f2937' : '#f9fafb',
      }}>
        <div style={{ fontSize: 12, marginBottom: 8, color: isDark ? '#9ca3af' : '#6b7280' }}>
          CNAME 目标地址（请将自定义域名指向此地址）：
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <code style={{
            padding: '4px 8px',
            fontSize: 13,
            borderRadius: 4,
            fontFamily: 'monospace',
            background: isDark ? '#374151' : '#e5e7eb',
            color: isDark ? '#e5e7eb' : '#374151',
          }}>
            {systemDomain || 'loading...'}
          </code>
          {systemDomain && (
            <button
              onClick={() => handleCopy(systemDomain)}
              style={{
                padding: 6,
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                background: 'transparent',
                color: isDark ? '#9ca3af' : '#6b7280',
              }}
            >
              <Copy size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 域名列表 */}
      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 8,
        border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
        overflow: 'hidden',
      }}>
        {/* 表头 */}
        <div style={{
          display: 'flex',
          padding: '10px 16px',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          flexShrink: 0,
          background: isDark ? '#1f2937' : '#f9fafb',
          color: isDark ? '#9ca3af' : '#6b7280',
          borderBottom: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
        }}>
          <div style={{ flex: 2 }}>域名</div>
          <div style={{ flex: 1 }}>目标路径</div>
          <div style={{ width: 90, textAlign: 'center' }}>状态</div>
          <div style={{ width: 90, textAlign: 'right' }}>操作</div>
        </div>

        {/* 列表内容 */}
        <div style={{ flex: 1, overflow: 'auto', background: isDark ? '#111827' : '#fff' }}>
          {loading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Spin />
            </div>
          ) : domains.length === 0 ? (
            <div style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 48,
            }}>
              {/* 大尺寸图标 */}
              <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
                background: isDark ? '#1f2937' : '#ecfdf5',
              }}>
                <Globe size={36} color={isDark ? '#4b5563' : '#10b981'} />
              </div>
              {/* 主标题 */}
              <div style={{
                fontSize: 17,
                fontWeight: 500,
                marginBottom: 8,
                color: isDark ? '#e5e7eb' : '#374151',
              }}>
                暂无自定义域名
              </div>
              {/* 副标题 */}
              <div style={{
                fontSize: 13,
                textAlign: 'center',
                maxWidth: 280,
                marginBottom: 20,
                color: isDark ? '#6b7280' : '#9ca3af',
              }}>
                配置域名后，您可以通过该域名直接访问云函数，提供更专业的 API 地址
              </div>
              {/* CTA 按钮 */}
              <button
                onClick={() => setShowAddForm(true)}
                style={{
                  padding: '10px 20px',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#fff',
                  background: '#10b981',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Plus size={18} />
                立即添加
              </button>
            </div>
          ) : (
            domains.map((domain, index) => (
              <div
                key={domain._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderBottom: index < domains.length - 1 ? `1px solid ${isDark ? '#1f2937' : '#f3f4f6'}` : 'none',
                }}
              >
                <div style={{ flex: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: isDark ? '#e5e7eb' : '#1f2937' }}>
                    {domain.domain}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#6b7280' }}>
                    {domain.targetPath || <span style={{ fontStyle: 'italic', color: '#9ca3af' }}>默认</span>}
                  </span>
                </div>
                <div style={{ width: 90, display: 'flex', justifyContent: 'center' }}>
                  {domain.verified ? (
                    <Tag color="success" icon={<CheckCircle2 size={12} />} style={{ margin: 0 }}>
                      已验证
                    </Tag>
                  ) : (
                    <Tag color="warning" icon={<XCircle size={12} />} style={{ margin: 0 }}>
                      未验证
                    </Tag>
                  )}
                </div>
                <div style={{ width: 90, display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                  <Tooltip title="验证 DNS">
                    <button
                      onClick={() => handleVerify(domain._id)}
                      disabled={verifying === domain._id}
                      style={{
                        padding: 6,
                        borderRadius: 4,
                        border: 'none',
                        cursor: 'pointer',
                        background: 'transparent',
                        color: isDark ? '#9ca3af' : '#6b7280',
                      }}
                    >
                      <RefreshCw size={14} style={{ animation: verifying === domain._id ? 'spin 1s linear infinite' : 'none' }} />
                    </button>
                  </Tooltip>
                  <Popconfirm
                    title="确定删除此域名？"
                    onConfirm={() => handleDelete(domain._id)}
                    okText="确定"
                    cancelText="取消"
                    zIndex={1100}
                  >
                    <button style={{
                      padding: 6,
                      borderRadius: 4,
                      border: 'none',
                      cursor: 'pointer',
                      background: 'transparent',
                      color: isDark ? '#9ca3af' : '#6b7280',
                    }}>
                      <Trash2 size={14} />
                    </button>
                  </Popconfirm>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 新增区域 */}
        {showAddForm ? (
          <div style={{
            padding: 16,
            flexShrink: 0,
            background: isDark ? '#1f2937' : '#f9fafb',
            borderTop: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
          }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <Input
                placeholder="域名，如 api.example.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                style={{ flex: 2 }}
                autoFocus
              />
              <Input
                placeholder="目标路径（可选）"
                value={newTargetPath}
                onChange={(e) => setNewTargetPath(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowAddForm(false)
                  setNewDomain('')
                  setNewTargetPath('')
                }}
                style={{
                  padding: '6px 16px',
                  fontSize: 13,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: isDark ? '#374151' : '#e5e7eb',
                  color: isDark ? '#d1d5db' : '#4b5563',
                }}
              >
                取消
              </button>
              <button
                onClick={handleAdd}
                disabled={adding}
                style={{
                  padding: '6px 16px',
                  fontSize: 13,
                  fontWeight: 500,
                  borderRadius: 6,
                  border: 'none',
                  cursor: adding ? 'not-allowed' : 'pointer',
                  background: adding ? '#6ee7b7' : '#10b981',
                  color: '#fff',
                }}
              >
                {adding ? '添加中...' : '添加'}
              </button>
            </div>
          </div>
        ) : domains.length > 0 && (
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '12px 16px',
              fontSize: 13,
              flexShrink: 0,
              border: 'none',
              borderTop: `2px dashed ${isDark ? '#374151' : '#e5e7eb'}`,
              background: isDark ? 'rgba(31, 41, 55, 0.5)' : '#f9fafb',
              color: isDark ? '#6b7280' : '#9ca3af',
              cursor: 'pointer',
            }}
          >
            <Plus size={16} />
            添加自定义域名
          </button>
        )}
      </div>

      {/* 使用说明 */}
      <div style={{
        marginTop: 16,
        padding: 12,
        borderRadius: 8,
        fontSize: 12,
        flexShrink: 0,
        background: isDark ? '#1f2937' : '#f9fafb',
        color: isDark ? '#9ca3af' : '#6b7280',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>使用步骤：</div>
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
          <li>在上方添加您的自定义域名</li>
          <li>在您的 DNS 服务商添加 CNAME 记录，将域名指向 <code style={{
            padding: '2px 4px',
            borderRadius: 3,
            background: isDark ? '#374151' : '#e5e7eb',
          }}>{systemDomain}</code></li>
          <li>点击验证按钮确认 DNS 配置正确</li>
          <li>验证通过后，即可通过自定义域名访问您的函数</li>
        </ol>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
