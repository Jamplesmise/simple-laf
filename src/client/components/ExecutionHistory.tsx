import { useState, useEffect } from 'react'
import { Button, Table, Tag, Tooltip, Modal, Empty, Spin, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined,
  ClockCircleOutlined, PlayCircleOutlined, CloudOutlined,
  ScheduleOutlined, ApiOutlined, EyeOutlined
} from '@ant-design/icons'
import { useThemeStore } from '../stores/theme'
import { useFunctionStore } from '../stores/function'
import { executionLogsApi, type ExecutionLog, type ExecutionStats } from '../api/executionLogs'

interface ExecutionHistoryProps {
  functionId?: string  // 如果传入则只显示该函数的历史
}

export default function ExecutionHistory({ functionId }: ExecutionHistoryProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'
  const { current } = useFunctionStore()

  const [logs, setLogs] = useState<ExecutionLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [stats, setStats] = useState<ExecutionStats | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedLog, setSelectedLog] = useState<ExecutionLog | null>(null)

  // 实际使用的 functionId
  const activeFunctionId = functionId || current?._id

  // 代码字体
  const codeFont = '"JetBrains Mono", "SF Mono", Monaco, Menlo, Consolas, monospace'

  // 加载执行历史
  const loadLogs = async () => {
    setLoading(true)
    try {
      const res = activeFunctionId
        ? await executionLogsApi.listByFunction(activeFunctionId, {
            limit: pageSize,
            offset: (page - 1) * pageSize,
          })
        : await executionLogsApi.list({
            limit: pageSize,
            offset: (page - 1) * pageSize,
          })
      setLogs(res.data.data.logs || [])
      setTotal(res.data.data.total || 0)
    } catch {
      message.error('加载执行历史失败')
    } finally {
      setLoading(false)
    }
  }

  // 加载统计
  const loadStats = async () => {
    if (!activeFunctionId) return
    try {
      const res = await executionLogsApi.getStats(activeFunctionId)
      setStats(res.data.data)
    } catch {
      // 忽略错误
    }
  }

  useEffect(() => {
    loadLogs()
    loadStats()
  }, [activeFunctionId, page])

  // 查看详情
  const handleViewDetail = (log: ExecutionLog) => {
    setSelectedLog(log)
    setDetailModalOpen(true)
  }

  // 触发来源图标
  const getTriggerIcon = (trigger: string) => {
    switch (trigger) {
      case 'manual':
        return <PlayCircleOutlined style={{ color: '#1890ff' }} />
      case 'scheduler':
        return <ScheduleOutlined style={{ color: '#722ed1' }} />
      case 'webhook':
        return <ApiOutlined style={{ color: '#fa8c16' }} />
      case 'public':
        return <CloudOutlined style={{ color: '#52c41a' }} />
      default:
        return <ClockCircleOutlined />
    }
  }

  // 触发来源文字
  const getTriggerText = (trigger: string) => {
    switch (trigger) {
      case 'manual': return '手动调试'
      case 'scheduler': return '定时任务'
      case 'webhook': return 'Webhook'
      case 'public': return '公开调用'
      default: return trigger
    }
  }

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  // 格式化 JSON
  const formatJson = (data: unknown) => {
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }

  // 渲染日志详情
  const renderLogDetail = (log: ExecutionLog): React.ReactNode => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 基本信息 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        padding: 12,
        background: isDark ? '#1a1a1a' : '#fafafa',
        borderRadius: 8,
      }}>
        <div>
          <div style={{ fontSize: 11, color: isDark ? '#888' : '#999' }}>来源</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            {getTriggerIcon(log.trigger)}
            <span>{getTriggerText(log.trigger)}</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: isDark ? '#888' : '#999' }}>方法</div>
          <div style={{ marginTop: 4 }}>{log.request.method}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: isDark ? '#888' : '#999' }}>耗时</div>
          <div style={{ marginTop: 4 }}>{log.duration}ms</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: isDark ? '#888' : '#999' }}>时间</div>
          <div style={{ marginTop: 4 }}>{formatTime(log.createdAt)}</div>
        </div>
      </div>

      {/* 请求参数 */}
      {Boolean(log.request.body && typeof log.request.body === 'object' && Object.keys(log.request.body).length > 0) && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>请求参数</div>
          <pre style={{
            fontFamily: codeFont,
            fontSize: 12,
            padding: 12,
            background: isDark ? '#1a1a1a' : '#f5f5f5',
            borderRadius: 6,
            overflow: 'auto',
            maxHeight: 150,
            margin: 0,
          }}>
            {formatJson(log.request.body)}
          </pre>
        </div>
      )}

      {/* 返回结果 */}
      {Boolean(log.success && log.data !== undefined) && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8, color: '#52c41a' }}>
            返回结果
          </div>
          <pre style={{
            fontFamily: codeFont,
            fontSize: 12,
            padding: 12,
            background: isDark ? '#1a1a1a' : '#f5f5f5',
            borderRadius: 6,
            overflow: 'auto',
            maxHeight: 200,
            margin: 0,
          }}>
            {formatJson(log.data)}
          </pre>
        </div>
      )}

      {/* 错误信息 */}
      {!log.success && log.error && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8, color: '#ff4d4f' }}>
            错误信息
          </div>
          <pre style={{
            fontFamily: codeFont,
            fontSize: 12,
            padding: 12,
            background: isDark ? '#2a1a1a' : '#fff0f0',
            borderRadius: 6,
            overflow: 'auto',
            maxHeight: 150,
            margin: 0,
            color: '#ff4d4f',
          }}>
            {log.error}
          </pre>
        </div>
      )}

      {/* 控制台日志 */}
      {log.logs && log.logs.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>控制台输出</div>
          <div style={{
            fontFamily: codeFont,
            fontSize: 12,
            padding: 12,
            background: isDark ? '#1a1a1a' : '#f5f5f5',
            borderRadius: 6,
            maxHeight: 150,
            overflow: 'auto',
          }}>
            {log.logs.map((logEntry, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                {logEntry.args.map((arg, j) => (
                  <span key={j}>{String(arg)} </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const columns: ColumnsType<ExecutionLog> = [
    {
      title: '状态',
      dataIndex: 'success',
      key: 'success',
      width: 60,
      render: (success) => (
        success ? (
          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
        ) : (
          <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
        )
      ),
    },
    {
      title: '函数',
      dataIndex: 'functionName',
      key: 'functionName',
      ellipsis: true,
      render: (name) => (
        <span style={{ fontFamily: codeFont, fontSize: 12 }}>{name}</span>
      ),
    },
    {
      title: '来源',
      dataIndex: 'trigger',
      key: 'trigger',
      width: 100,
      render: (trigger) => (
        <Tooltip title={getTriggerText(trigger)}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {getTriggerIcon(trigger)}
            <span style={{ fontSize: 12 }}>{getTriggerText(trigger)}</span>
          </span>
        </Tooltip>
      ),
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 80,
      render: (duration) => (
        <Tag color={Number(duration) > 1000 ? 'orange' : 'default'} style={{ fontSize: 11 }}>
          {duration}ms
        </Tag>
      ),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (time) => (
        <span style={{ fontSize: 12, color: isDark ? '#888' : '#666' }}>
          {formatTime(String(time))}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 60,
      render: (_, record) => (
        <span
          onClick={() => handleViewDetail(record)}
          style={{
            color: isDark ? '#888' : '#666',
            cursor: 'pointer',
            padding: 4,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#00a9a6' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = isDark ? '#888' : '#666' }}
        >
          <EyeOutlined />
        </span>
      ),
    },
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 统计信息 */}
      {stats && (
        <div style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
          display: 'flex',
          gap: 24,
          background: isDark ? '#1a1a1a' : '#fafafa',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: isDark ? '#888' : '#666' }}>总执行</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: isDark ? '#e0e0e0' : '#333' }}>
              {stats.totalCount}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#52c41a' }}>成功</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#52c41a' }}>
              {stats.successCount}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#ff4d4f' }}>失败</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#ff4d4f' }}>
              {stats.failCount}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: isDark ? '#888' : '#666' }}>平均耗时</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: isDark ? '#e0e0e0' : '#333' }}>
              {stats.avgDuration}ms
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: isDark ? '#888' : '#666' }}>24h</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: isDark ? '#e0e0e0' : '#333' }}>
              {stats.last24hCount}
            </span>
          </div>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined style={{ fontSize: 12 }} />}
            onClick={() => { loadLogs(); loadStats() }}
            style={{ marginLeft: 'auto', color: isDark ? '#888' : '#666' }}
          />
        </div>
      )}

      {/* 列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : logs.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无执行记录"
            style={{ padding: 40 }}
          />
        ) : (
          <Table
            dataSource={logs}
            columns={columns}
            rowKey="_id"
            size="small"
            pagination={{
              current: page,
              pageSize,
              total,
              onChange: setPage,
              showSizeChanger: false,
              showTotal: (t) => `共 ${t} 条`,
            }}
            style={{ padding: '0 8px' }}
          />
        )}
      </div>

      {/* 详情弹窗 */}
      <Modal
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {selectedLog?.success ? (
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            ) : (
              <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
            )}
            执行详情 - {selectedLog?.functionName}
          </span>
        }
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        width={700}
        footer={null}
        transitionName=""
        maskTransitionName=""
      >
        {selectedLog ? renderLogDetail(selectedLog) : null}
      </Modal>
    </div>
  )
}
