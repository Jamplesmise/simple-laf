/**
 * 右侧面板
 *
 * 包含 API 链接、接口调试、版本历史
 */

import { useState, useEffect, useCallback } from 'react'
import { Tabs, Button, Modal, Space, message } from 'antd'
import { useFunctionStore } from '@/stores/function'
import { useThemeColors } from '@/hooks/useTheme'
import { functionApi, type FunctionVersion } from '@/api/functions'
import { invokeApi } from '@/api/invoke'
import type { InvokeResult } from '@/api/invoke'
import DiffViewer from '../DiffViewer'
import PublishModal from '../PublishModal'
import { DebugPanel } from './DebugPanel'
import { VersionHistory } from './VersionHistory'
import { useRequestParams } from './hooks/useRequestParams'
import { codeFont, formatDate } from './utils'

interface RightPanelProps {
  onResult: (result: InvokeResult) => void
}

export default function RightPanel({ onResult }: RightPanelProps) {
  const { current, refreshCurrent } = useFunctionStore()
  const { t } = useThemeColors()

  // 请求参数状态
  const requestParams = useRequestParams({ functionId: current?._id })

  // 运行状态
  const [running, setRunning] = useState(false)
  const [compiling, setCompiling] = useState(false)

  // 版本历史状态
  const [versions, setVersions] = useState<FunctionVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [activeTab, setActiveTab] = useState('debug')

  // 版本对比弹窗
  const [diffModalOpen, setDiffModalOpen] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<FunctionVersion | null>(null)
  const [currentCode, setCurrentCode] = useState('')

  // 复制状态
  const [copied, setCopied] = useState(false)

  // 发版弹窗
  const [publishModalOpen, setPublishModalOpen] = useState(false)

  // 加载版本历史
  const loadVersions = useCallback(async () => {
    if (!current) return
    setLoadingVersions(true)
    try {
      const res = await functionApi.getVersions(current._id)
      setVersions(res.data.data || [])
    } catch {
      message.error('加载版本历史失败')
    } finally {
      setLoadingVersions(false)
    }
  }, [current])

  useEffect(() => {
    if (activeTab === 'history' && current) {
      loadVersions()
    }
  }, [activeTab, current?._id, loadVersions])

  // 运行函数
  const handleRun = async () => {
    if (!current) {
      message.warning('请先选择一个函数')
      return
    }

    setCompiling(true)
    try {
      const compileRes = await functionApi.compile(current._id)
      if (!compileRes.data.success) {
        message.error('编译失败')
        setCompiling(false)
        return
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      message.error(err.response?.data?.error?.message || '编译失败')
      setCompiling(false)
      return
    }
    setCompiling(false)

    setRunning(true)
    try {
      const body = requestParams.getBodyObject()
      if (body === null) {
        message.warning('请求体不是有效的 JSON')
        setRunning(false)
        return
      }
      const invokeResult = await invokeApi.run(current.path || current.name, body)
      onResult(invokeResult)
      requestParams.save()
    } catch {
      message.error('执行失败')
    } finally {
      setRunning(false)
    }
  }

  // 复制 API 链接
  const handleCopy = async () => {
    if (!current) return
    const url = `${window.location.origin}/${current.path || current.name}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textArea = document.createElement('textarea')
      textArea.value = url
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // 查看版本对比
  const handleViewVersion = async (version: FunctionVersion) => {
    if (!current) return
    try {
      const res = await functionApi.getVersion(current._id, version.version)
      setSelectedVersion(res.data.data)
      setCurrentCode(current.code || '')
      setDiffModalOpen(true)
    } catch {
      message.error('加载版本详情失败')
    }
  }

  // 回滚
  const handleRollback = (version: number) => {
    Modal.confirm({
      title: '确认回滚',
      content: `确定要回滚到 v${version} 吗？这将创建一个新版本。`,
      okText: '确认',
      cancelText: '取消',
      okButtonProps: { shape: 'round' },
      cancelButtonProps: { shape: 'round' },
      onOk: async () => {
        try {
          await functionApi.rollback(current!._id, version)
          message.success(`已回滚到 v${version}`)
          loadVersions()
          refreshCurrent()
        } catch {
          message.error('回滚失败')
        }
      }
    })
  }

  // 发版成功
  const handlePublished = (version: number) => {
    message.success(`发版成功，版本 v${version}`)
    loadVersions()
  }

  const publicUrl = current ? `${window.location.origin}/${current.path || current.name}` : ''

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: t.bgCard,
      borderLeft: `1px solid ${t.border}`,
    }}>
      {/* API 链接 + 发布按钮 */}
      <div style={{
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: `1px solid ${t.border}`,
        background: t.bgCard,
      }}>
        <div
          onClick={handleCopy}
          style={{
            flex: 1,
            padding: '6px 10px',
            background: t.bgCard,
            border: `1px solid ${t.border}`,
            borderRadius: 6,
            fontFamily: codeFont,
            fontSize: 12,
            color: current ? t.text : t.textMuted,
            cursor: current ? 'pointer' : 'default',
            position: 'relative',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={(e) => {
            if (current) e.currentTarget.style.borderColor = t.accent
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = t.border
          }}
        >
          {publicUrl || '选择函数后显示'}
          {copied && (
            <span style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 11,
              color: t.accent,
              background: t.bgCard,
              padding: '0 4px',
            }}>
              已复制
            </span>
          )}
        </div>
        <Button
          type="primary"
          size="small"
          onClick={() => setPublishModalOpen(true)}
          disabled={!current}
          style={{
            background: current ? '#059669' : undefined,
            borderColor: current ? '#059669' : undefined,
            fontWeight: 500,
            paddingLeft: 16,
            paddingRight: 16,
          }}
        >
          发布
        </Button>
      </div>

      {/* Tab 切换 */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        size="small"
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        tabBarStyle={{
          margin: 0,
          padding: '4px 12px 0',
          background: t.bgCard,
          borderBottom: `1px solid ${t.border}`,
        }}
        items={[
          {
            key: 'debug',
            label: '接口调试',
            children: (
              <DebugPanel
                method={requestParams.method}
                running={running}
                compiling={compiling}
                disabled={!current}
                onMethodChange={requestParams.setMethod}
                onRun={handleRun}
                queryType={requestParams.queryType}
                queryParams={requestParams.queryParams}
                queryFormData={requestParams.queryFormData}
                onQueryTypeChange={requestParams.setQueryType}
                onQueryParamsChange={requestParams.setQueryParams}
                bodyType={requestParams.bodyType}
                requestBody={requestParams.requestBody}
                bodyFormData={requestParams.bodyFormData}
                onBodyTypeChange={requestParams.setBodyType}
                onRequestBodyChange={requestParams.setRequestBody}
                headersType={requestParams.headersType}
                headers={requestParams.headers}
                headersFormData={requestParams.headersFormData}
                onHeadersTypeChange={requestParams.setHeadersType}
                onHeadersChange={requestParams.setHeaders}
                onAddFormItem={requestParams.addFormItem}
                onUpdateFormItem={requestParams.updateFormItem}
                onRemoveFormItem={requestParams.removeFormItem}
              />
            ),
          },
          {
            key: 'history',
            label: '版本历史',
            children: (
              <VersionHistory
                versions={versions}
                loading={loadingVersions}
                onViewVersion={handleViewVersion}
                onRollback={handleRollback}
              />
            ),
          },
        ]}
      />

      {/* 版本对比弹窗 */}
      <Modal
        title={`版本对比 - v${selectedVersion?.version} vs 当前代码`}
        open={diffModalOpen}
        onCancel={() => setDiffModalOpen(false)}
        width="80vw"
        centered
        styles={{ body: { padding: '16px 0' } }}
        footer={
          <Space>
            <Button shape="round" onClick={() => setDiffModalOpen(false)}>
              关闭
            </Button>
            <Button
              type="primary"
              shape="round"
              onClick={() => {
                if (selectedVersion) {
                  handleRollback(selectedVersion.version)
                  setDiffModalOpen(false)
                }
              }}
            >
              回滚到此版本
            </Button>
          </Space>
        }
      >
        {selectedVersion && (
          <>
            <div style={{ marginBottom: 12, padding: '0 24px', color: t.textSecondary }}>
              <span>修改时间：{formatDate(selectedVersion.createdAt)}</span>
              {selectedVersion.changelog && (
                <span style={{ marginLeft: 16 }}>描述：{selectedVersion.changelog}</span>
              )}
            </div>
            <div style={{ margin: '0 24px' }}>
              <DiffViewer
                oldCode={selectedVersion.code || ''}
                newCode={currentCode}
                oldTitle={`v${selectedVersion.version}`}
                newTitle="当前代码"
                height={Math.max(400, Math.floor(window.innerHeight * 0.6))}
              />
            </div>
          </>
        )}
      </Modal>

      {/* 发版弹窗 */}
      {current && (
        <PublishModal
          open={publishModalOpen}
          functionId={current._id}
          functionName={current.name}
          currentCode={current.code}
          onClose={() => setPublishModalOpen(false)}
          onPublished={handlePublished}
        />
      )}
    </div>
  )
}
