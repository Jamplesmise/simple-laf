import { useState, useEffect } from 'react'
import {
  Modal, Button, Select, InputNumber, Switch, message, Popconfirm, Tooltip, Empty, Spin
} from 'antd'
import {
  DeleteOutlined, PlayCircleOutlined, ClockCircleOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined
} from '@ant-design/icons'
import { useThemeStore } from '../stores/theme'
import { useFunctionStore } from '../stores/function'
import { schedulerApi, type ScheduledTask, type IntervalConfig } from '../api/scheduler'

interface SchedulerPanelProps {
  open: boolean
  onClose: () => void
}

export default function SchedulerPanel({ open, onClose }: SchedulerPanelProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'
  const { functions } = useFunctionStore()

  const [tasks, setTasks] = useState<ScheduledTask[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  // 新建任务表单
  const [selectedFunction, setSelectedFunction] = useState<string>('')
  const [days, setDays] = useState(0)
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(1)
  const [seconds, setSeconds] = useState(0)

  // 代码字体
  const codeFont = '"JetBrains Mono", "SF Mono", Monaco, Menlo, Consolas, monospace'

  // 加载任务列表
  const loadTasks = async () => {
    setLoading(true)
    try {
      const res = await schedulerApi.list()
      setTasks(res.data.data || [])
    } catch {
      message.error('加载定时任务失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadTasks()
    }
  }, [open])

  // 创建任务
  const handleCreate = async () => {
    if (!selectedFunction) {
      message.warning('请选择函数')
      return
    }

    const totalSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds
    if (totalSeconds < 1) {
      message.warning('间隔时间至少为 1 秒')
      return
    }

    setCreating(true)
    try {
      await schedulerApi.create(selectedFunction, { days, hours, minutes, seconds })
      message.success('创建成功')
      setSelectedFunction('')
      setDays(0)
      setHours(0)
      setMinutes(1)
      setSeconds(0)
      loadTasks()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      message.error(err.response?.data?.error?.message || '创建失败')
    } finally {
      setCreating(false)
    }
  }

  // 切换启用状态
  const handleToggle = async (task: ScheduledTask, enabled: boolean) => {
    try {
      await schedulerApi.update(task._id, { enabled })
      message.success(enabled ? '已启用' : '已暂停')
      loadTasks()
    } catch {
      message.error('操作失败')
    }
  }

  // 删除任务
  const handleDelete = async (taskId: string) => {
    try {
      await schedulerApi.remove(taskId)
      message.success('已删除')
      loadTasks()
    } catch {
      message.error('删除失败')
    }
  }

  // 手动执行
  const handleRunOnce = async (taskId: string) => {
    try {
      message.loading({ content: '执行中...', key: 'run' })
      await schedulerApi.runOnce(taskId)
      message.success({ content: '执行完成', key: 'run' })
      loadTasks()
    } catch {
      message.error({ content: '执行失败', key: 'run' })
    }
  }

  // 格式化间隔显示
  const formatInterval = (config: IntervalConfig) => {
    const parts = []
    if (config.days > 0) parts.push(`${config.days}天`)
    if (config.hours > 0) parts.push(`${config.hours}时`)
    if (config.minutes > 0) parts.push(`${config.minutes}分`)
    if (config.seconds > 0) parts.push(`${config.seconds}秒`)
    return parts.join(' ') || '0秒'
  }

  // 格式化时间
  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  // 过滤已有定时任务的函数
  const availableFunctions = functions.filter(
    fn => !tasks.some(t => t.functionId === fn._id)
  )

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      width={640}
      centered
      footer={null}
      styles={{
        body: { padding: 0 },
        content: { borderRadius: 12 },
      }}
      closeIcon={
        <span style={{ fontSize: 20, color: isDark ? '#888' : '#666' }}>×</span>
      }
    >
      <div style={{ padding: 20 }}>
        {/* 标题 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
        }}>
          <ClockCircleOutlined style={{ fontSize: 18, color: '#00a9a6' }} />
          <span style={{ fontSize: 16, fontWeight: 500, color: isDark ? '#e0e0e0' : '#333' }}>
            定时执行器
          </span>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined style={{ fontSize: 12 }} />}
            onClick={loadTasks}
            style={{ marginLeft: 'auto', color: isDark ? '#888' : '#666' }}
          />
        </div>

        {/* 新建任务 */}
        <div style={{
          background: isDark ? '#1a1a1a' : '#fafafa',
          borderRadius: 8,
          padding: 16,
          marginBottom: 20,
          border: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
        }}>
          <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 500, color: isDark ? '#ccc' : '#666' }}>
            新建定时任务
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 12, color: isDark ? '#888' : '#999', marginBottom: 4 }}>选择函数</div>
              <Select
                value={selectedFunction || undefined}
                onChange={setSelectedFunction}
                placeholder="选择要定时执行的函数"
                style={{ width: '100%' }}
                size="small"
                options={availableFunctions.map(fn => ({
                  value: fn._id,
                  label: fn.name,
                }))}
                showSearch
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: isDark ? '#888' : '#999', marginBottom: 4 }}>执行间隔</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <InputNumber
                  size="small"
                  min={0}
                  max={365}
                  value={days}
                  onChange={v => setDays(v || 0)}
                  style={{ width: 50 }}
                />
                <span style={{ fontSize: 12, color: isDark ? '#888' : '#666' }}>天</span>
                <InputNumber
                  size="small"
                  min={0}
                  max={23}
                  value={hours}
                  onChange={v => setHours(v || 0)}
                  style={{ width: 50 }}
                />
                <span style={{ fontSize: 12, color: isDark ? '#888' : '#666' }}>时</span>
                <InputNumber
                  size="small"
                  min={0}
                  max={59}
                  value={minutes}
                  onChange={v => setMinutes(v || 0)}
                  style={{ width: 50 }}
                />
                <span style={{ fontSize: 12, color: isDark ? '#888' : '#666' }}>分</span>
                <InputNumber
                  size="small"
                  min={0}
                  max={59}
                  value={seconds}
                  onChange={v => setSeconds(v || 0)}
                  style={{ width: 50 }}
                />
                <span style={{ fontSize: 12, color: isDark ? '#888' : '#666' }}>秒</span>
              </div>
            </div>
            <Button
              type="primary"
              size="small"
              onClick={handleCreate}
              loading={creating}
              style={{
                background: '#00a9a6',
                borderColor: '#00a9a6',
                borderRadius: 14,
                paddingLeft: 16,
                paddingRight: 16,
              }}
            >
              创建
            </Button>
          </div>
        </div>

        {/* 任务列表 */}
        <div style={{
          maxHeight: 320,
          overflow: 'auto',
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin size="small" />
            </div>
          ) : tasks.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无定时任务"
              style={{ padding: 40 }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tasks.map(task => (
                <div
                  key={task._id}
                  style={{
                    background: isDark ? '#1a1a1a' : '#fff',
                    border: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Switch
                      size="small"
                      checked={task.enabled}
                      onChange={(checked) => handleToggle(task, checked)}
                      style={{ background: task.enabled ? '#00a9a6' : undefined }}
                    />
                    <span style={{
                      fontFamily: codeFont,
                      fontSize: 13,
                      fontWeight: 500,
                      color: isDark ? '#e0e0e0' : '#333',
                      flex: 1,
                    }}>
                      {task.functionName}
                    </span>
                    <span style={{
                      fontSize: 11,
                      color: isDark ? '#888' : '#999',
                      background: isDark ? '#2a2a2a' : '#f5f5f5',
                      padding: '2px 8px',
                      borderRadius: 10,
                    }}>
                      每 {formatInterval(task.intervalConfig)}
                    </span>
                    <Tooltip title="立即执行">
                      <Button
                        type="text"
                        size="small"
                        icon={<PlayCircleOutlined style={{ fontSize: 14 }} />}
                        onClick={() => handleRunOnce(task._id)}
                        style={{ color: '#00a9a6' }}
                      />
                    </Tooltip>
                    <Popconfirm
                      title="确定删除此定时任务？"
                      onConfirm={() => handleDelete(task._id)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined style={{ fontSize: 14 }} />}
                        style={{ color: isDark ? '#666' : '#999' }}
                      />
                    </Popconfirm>
                  </div>
                  {/* 执行状态 */}
                  <div style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
                    display: 'flex',
                    gap: 16,
                    fontSize: 11,
                    color: isDark ? '#888' : '#999',
                  }}>
                    <span>执行次数: {task.runCount}</span>
                    <span>上次执行: {formatTime(task.lastRunAt)}</span>
                    {task.lastResult && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        上次结果:
                        {task.lastResult.success ? (
                          <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        ) : (
                          <Tooltip title={task.lastResult.error}>
                            <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                          </Tooltip>
                        )}
                        <span>({task.lastResult.duration}ms)</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
