import { useState, useEffect } from 'react'
import { Button, Space, Modal, Input, Form, message, Tooltip, Tabs, Alert } from 'antd'
import {
  GithubOutlined,
  CloudDownloadOutlined,
  CloudUploadOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons'
import { gitApi, type GitConfig, type SyncChange } from '../api/git'
import { useThemeStore } from '../stores/theme'
import GitSyncDialog from './GitSyncDialog'

// 格式化日期
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hours}:${minutes}`
}

interface GitPanelProps {
  onSynced?: () => void
}

export default function GitPanel({ onSynced }: GitPanelProps) {
  const [config, setConfig] = useState<GitConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [repoType, setRepoType] = useState<'public' | 'private'>('public')
  const [form] = Form.useForm()
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  // 同步对话框状态
  const [syncDialogOpen, setSyncDialogOpen] = useState(false)
  const [syncMode, setSyncMode] = useState<'pull' | 'push'>('pull')
  const [syncChanges, setSyncChanges] = useState<SyncChange[]>([])
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncHasConflicts, setSyncHasConflicts] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // 加载配置
  const loadConfig = async () => {
    try {
      const res = await gitApi.getConfig()
      if (res.data.success) {
        setConfig(res.data.data)
      }
    } catch {
      // 忽略错误
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfig()
  }, [])

  // 保存配置
  const handleSaveConfig = async () => {
    try {
      const values = await form.validateFields()

      // 私有仓库必须填写 token（除非已有 token 保存）
      if (repoType === 'private' && !values.token && !config?.hasToken) {
        message.error('私有仓库必须填写访问令牌')
        return
      }

      await gitApi.saveConfig({
        ...values,
        // 切换到公开仓库时，明确要求清除 Token
        clearToken: repoType === 'public'
      })
      message.success('配置已保存')
      setConfigModalOpen(false)
      loadConfig()
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown; response?: { data?: { error?: { message?: string } } } }
      if (err.errorFields) return
      message.error(err.response?.data?.error?.message || '保存失败')
    }
  }

  // 打开拉取预览
  const handlePull = async () => {
    setSyncMode('pull')
    setSyncDialogOpen(true)
    setSyncLoading(true)
    setSyncChanges([])
    setSyncHasConflicts(false)

    try {
      const res = await gitApi.previewPull()
      if (res.data.success) {
        setSyncChanges(res.data.data.changes)
        setSyncHasConflicts(res.data.data.hasConflicts)
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      message.error(err.response?.data?.error?.message || '获取预览失败')
      setSyncDialogOpen(false)
    } finally {
      setSyncLoading(false)
    }
  }

  // 打开推送预览
  const handlePush = async () => {
    setSyncMode('push')
    setSyncDialogOpen(true)
    setSyncLoading(true)
    setSyncChanges([])
    setSyncHasConflicts(false)

    try {
      const res = await gitApi.previewPush()
      if (res.data.success) {
        setSyncChanges(res.data.data.changes)
        setSyncHasConflicts(res.data.data.hasConflicts)
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      message.error(err.response?.data?.error?.message || '获取预览失败')
      setSyncDialogOpen(false)
    } finally {
      setSyncLoading(false)
    }
  }

  // 确认同步
  const handleConfirmSync = async (selectedFunctions: string[], commitMessage?: string) => {
    console.log('[GitPanel] handleConfirmSync 开始', { syncMode, selectedFunctions, commitMessage })
    setSyncing(true)
    try {
      if (syncMode === 'pull') {
        console.log('[GitPanel] 开始拉取', { functions: selectedFunctions })
        const res = await gitApi.pull(selectedFunctions)
        console.log('[GitPanel] 拉取响应', res.data)
        if (res.data.success) {
          const { added, updated } = res.data.data
          message.success(`拉取成功：新增 ${added.length} 个，更新 ${updated.length} 个`)
        }
      } else {
        console.log('[GitPanel] 开始推送', { message: commitMessage, functions: selectedFunctions })
        const res = await gitApi.push(commitMessage, selectedFunctions)
        console.log('[GitPanel] 推送响应', res)
        message.success('推送成功')
      }
      setSyncDialogOpen(false)
      loadConfig()
      onSynced?.()
    } catch (error: unknown) {
      console.error('[GitPanel] 同步失败', error)
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      message.error(err.response?.data?.error?.message || (syncMode === 'pull' ? '拉取失败' : '推送失败'))
    } finally {
      setSyncing(false)
    }
  }

  if (loading) return null

  return (
    <div style={{ padding: 16 }}>
      {/* 标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <GithubOutlined style={{ fontSize: 18, color: isDark ? '#888' : '#666' }} />
        <span style={{ fontWeight: 500, fontSize: 15, color: isDark ? '#e0e0e0' : '#333' }}>
          Git 仓库同步
        </span>
        {config?.configured && (
          <Tooltip title="已配置">
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 14 }} />
          </Tooltip>
        )}
      </div>

      <div>
        {config?.configured ? (
          <>
            {/* 仓库信息 */}
            <div style={{
              fontSize: 13,
              color: isDark ? '#aaa' : '#666',
              marginBottom: 16,
              padding: '12px 16px',
              background: isDark ? '#141414' : '#f5f5f5',
              borderRadius: 8,
              border: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
            }}>
              <div
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: 8,
                  fontFamily: 'monospace',
                  color: isDark ? '#e0e0e0' : '#333',
                }}
                title={config.repoUrl}
              >
                {config.repoUrl}
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                <span>分支: <strong>{config.branch}</strong></span>
                <span>路径: <strong>{config.functionsPath}</strong></span>
              </div>
              {config.lastSyncAt && (
                <div style={{ marginTop: 8, fontSize: 12, color: isDark ? '#666' : '#999' }}>
                  上次同步: {formatDate(config.lastSyncAt)}
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <Space size={12}>
              <Button
                onClick={handlePull}
                style={{ borderRadius: 6 }}
              >
                <CloudDownloadOutlined />
                拉取
              </Button>
              <Button
                onClick={handlePush}
                style={{ borderRadius: 6 }}
              >
                <CloudUploadOutlined />
                推送
              </Button>
              <Button
                onClick={() => {
                  form.setFieldsValue({
                    repoUrl: config.repoUrl,
                    branch: config.branch,
                    functionsPath: config.functionsPath,
                  })
                  // 根据是否有 Token 设置仓库类型
                  setRepoType(config.hasToken ? 'private' : 'public')
                  setConfigModalOpen(true)
                }}
                style={{ borderRadius: 6 }}
              >
                <SettingOutlined />
                修改配置
              </Button>
            </Space>
          </>
        ) : (
          <Button
            type="dashed"
            block
            style={{ borderRadius: 6, height: 40 }}
            onClick={() => {
              form.setFieldsValue({
                branch: 'main',
                functionsPath: 'functions',
              })
              setConfigModalOpen(true)
            }}
          >
            <SettingOutlined />
            配置 Git 仓库
          </Button>
        )}
      </div>

      {/* 配置弹窗 */}
      <Modal
        title="Git 仓库配置"
        open={configModalOpen}
        onOk={handleSaveConfig}
        onCancel={() => setConfigModalOpen(false)}
        okText="保存"
        cancelText="取消"
        destroyOnClose
        zIndex={1100}
        width={520}
      >
        <Tabs
          activeKey={repoType}
          onChange={(key) => setRepoType(key as 'public' | 'private')}
          items={[
            {
              key: 'public',
              label: (
                <span>
                  <UnlockOutlined style={{ marginRight: 6 }} />
                  公开仓库
                </span>
              ),
            },
            {
              key: 'private',
              label: (
                <span>
                  <LockOutlined style={{ marginRight: 6 }} />
                  私有仓库
                </span>
              ),
            },
          ]}
          style={{ marginBottom: 8 }}
        />

        {repoType === 'private' && (
          <Alert
            type="info"
            showIcon
            message="私有仓库认证说明"
            description={
              <div style={{ fontSize: 12 }}>
                <div><strong>GitHub:</strong> 使用 Personal Access Token (ghp_xxx)</div>
                <div><strong>GitLab:</strong> 使用 Personal Access Token (glpat-xxx)，需要 api 和 read_repository 权限</div>
                <div><strong>私有部署:</strong> 填写完整 HTTPS URL，如 https://gitlab.company.com/group/repo.git</div>
              </div>
            }
            style={{ marginBottom: 16 }}
          />
        )}

        <Form form={form} layout="vertical">
          <Form.Item
            name="repoUrl"
            label="仓库地址"
            rules={[
              { required: true, message: '请输入仓库地址' },
              { type: 'url', message: '请输入有效的 URL' },
            ]}
          >
            <Input
              prefix={<GithubOutlined style={{ color: '#999' }} />}
              placeholder={repoType === 'private'
                ? "https://gitlab.company.com/group/repo.git"
                : "https://github.com/username/repo.git"
              }
            />
          </Form.Item>

          <Form.Item
            name="branch"
            label="分支"
            rules={[{ required: true, message: '请输入分支名' }]}
          >
            <Input placeholder="main" />
          </Form.Item>

          {repoType === 'private' && (
            <Form.Item
              name="token"
              label="访问令牌"
              rules={config?.hasToken ? [] : [{ required: true, message: '私有仓库必须填写访问令牌' }]}
              extra={config?.hasToken
                ? "已保存 Token，留空则保留原有 Token，填写则更新为新 Token"
                : "Personal Access Token，用于克隆和推送代码"
              }
            >
              <Input.Password placeholder={config?.hasToken ? "留空保留原有 Token" : "ghp_xxx 或 glpat-xxx"} />
            </Form.Item>
          )}

          <Form.Item
            name="functionsPath"
            label="函数目录"
            rules={[{ required: true, message: '请输入函数目录' }]}
            extra="仓库中存放函数文件的目录路径"
          >
            <Input placeholder="functions" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 同步预览对话框 */}
      <GitSyncDialog
        open={syncDialogOpen}
        onClose={() => setSyncDialogOpen(false)}
        mode={syncMode}
        changes={syncChanges}
        loading={syncLoading}
        hasConflicts={syncHasConflicts}
        onConfirm={handleConfirmSync}
        confirming={syncing}
      />
    </div>
  )
}
