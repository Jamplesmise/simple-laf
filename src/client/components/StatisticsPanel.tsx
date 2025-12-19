import { useState, useEffect } from 'react'
import { Spin, Empty, Progress, Tooltip } from 'antd'
import {
  CheckCircleOutlined, CloseCircleOutlined, ThunderboltOutlined,
  ClockCircleOutlined, PlayCircleOutlined, CloudOutlined,
  ScheduleOutlined, ApiOutlined, FireOutlined,
} from '@ant-design/icons'
import { useThemeStore } from '../stores/theme'
import { executionLogsApi, type OverallStats, type ExecutionTrend } from '../api/executionLogs'

export default function StatisticsPanel() {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  const [stats, setStats] = useState<OverallStats | null>(null)
  const [trend, setTrend] = useState<ExecutionTrend | null>(null)
  const [loading, setLoading] = useState(true)

  // 代码字体
  const codeFont = '"JetBrains Mono", "SF Mono", Monaco, Menlo, Consolas, monospace'

  // 加载数据
  const loadData = async () => {
    setLoading(true)
    try {
      const [statsRes, trendRes] = await Promise.all([
        executionLogsApi.getOverallStats(),
        executionLogsApi.getTrend(7),
      ])
      setStats(statsRes.data.data)
      setTrend(trendRes.data.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

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

  // 简单的柱状图渲染
  const renderBarChart = (data: { label: string; count: number; successCount: number }[], maxCount: number) => {
    if (data.length === 0) return null
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
        {data.map((item, i) => {
          const height = maxCount > 0 ? Math.max((item.count / maxCount) * 70, 4) : 4
          const successRate = item.count > 0 ? (item.successCount / item.count) : 1
          return (
            <Tooltip key={i} title={`${item.label}: ${item.count} 次执行, ${item.successCount} 成功`}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div
                  style={{
                    width: '100%',
                    maxWidth: 24,
                    height,
                    borderRadius: 2,
                    background: `linear-gradient(to top, #52c41a ${successRate * 100}%, #ff4d4f ${successRate * 100}%)`,
                  }}
                />
                <span style={{ fontSize: 9, color: isDark ? '#666' : '#999', marginTop: 4 }}>
                  {item.label}
                </span>
              </div>
            </Tooltip>
          )
        })}
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin />
      </div>
    )
  }

  if (!stats || stats.totalExecutions === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无统计数据"
        style={{ padding: 40 }}
      />
    )
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 16 }}>
      {/* 概览卡片 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        marginBottom: 20,
      }}>
        {/* 总执行次数 */}
        <div style={{
          padding: 16,
          borderRadius: 8,
          background: isDark ? '#1a1a1a' : '#fafafa',
          border: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
        }}>
          <div style={{ fontSize: 11, color: isDark ? '#888' : '#999', marginBottom: 8 }}>
            <ThunderboltOutlined style={{ marginRight: 4 }} />
            总执行
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, fontFamily: codeFont }}>
            {stats.totalExecutions.toLocaleString()}
          </div>
        </div>

        {/* 成功率 */}
        <div style={{
          padding: 16,
          borderRadius: 8,
          background: isDark ? '#1a1a1a' : '#fafafa',
          border: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
        }}>
          <div style={{ fontSize: 11, color: isDark ? '#888' : '#999', marginBottom: 8 }}>
            <CheckCircleOutlined style={{ marginRight: 4, color: '#52c41a' }} />
            成功率
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24, fontWeight: 600, fontFamily: codeFont, color: '#52c41a' }}>
              {stats.successRate}%
            </span>
            <Progress
              type="circle"
              percent={stats.successRate}
              size={32}
              strokeWidth={10}
              showInfo={false}
              strokeColor="#52c41a"
              trailColor={isDark ? '#303030' : '#e8e8e8'}
            />
          </div>
        </div>

        {/* 平均耗时 */}
        <div style={{
          padding: 16,
          borderRadius: 8,
          background: isDark ? '#1a1a1a' : '#fafafa',
          border: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
        }}>
          <div style={{ fontSize: 11, color: isDark ? '#888' : '#999', marginBottom: 8 }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            平均耗时
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, fontFamily: codeFont }}>
            {stats.avgDuration}<span style={{ fontSize: 12, fontWeight: 400 }}>ms</span>
          </div>
        </div>

        {/* 24小时执行 */}
        <div style={{
          padding: 16,
          borderRadius: 8,
          background: isDark ? '#1a1a1a' : '#fafafa',
          border: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
        }}>
          <div style={{ fontSize: 11, color: isDark ? '#888' : '#999', marginBottom: 8 }}>
            <FireOutlined style={{ marginRight: 4, color: '#fa8c16' }} />
            24h 执行
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, fontFamily: codeFont }}>
            {stats.last24hCount.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 成功/失败统计 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        marginBottom: 20,
      }}>
        <div style={{
          padding: 16,
          borderRadius: 8,
          background: isDark ? '#1a2a1a' : '#f6ffed',
          border: `1px solid ${isDark ? '#274916' : '#b7eb8f'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircleOutlined style={{ fontSize: 20, color: '#52c41a' }} />
            <div>
              <div style={{ fontSize: 11, color: isDark ? '#7cb305' : '#389e0d' }}>成功执行</div>
              <div style={{ fontSize: 20, fontWeight: 600, fontFamily: codeFont, color: '#52c41a' }}>
                {stats.successCount.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
        <div style={{
          padding: 16,
          borderRadius: 8,
          background: isDark ? '#2a1a1a' : '#fff2f0',
          border: `1px solid ${isDark ? '#5c1f1f' : '#ffccc7'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CloseCircleOutlined style={{ fontSize: 20, color: '#ff4d4f' }} />
            <div>
              <div style={{ fontSize: 11, color: isDark ? '#a8071a' : '#cf1322' }}>失败执行</div>
              <div style={{ fontSize: 20, fontWeight: 600, fontFamily: codeFont, color: '#ff4d4f' }}>
                {stats.failCount.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 执行趋势 */}
      {trend && trend.daily.length > 0 && (
        <div style={{
          padding: 16,
          borderRadius: 8,
          background: isDark ? '#1a1a1a' : '#fafafa',
          border: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
          marginBottom: 20,
        }}>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 12 }}>
            最近 7 天执行趋势
          </div>
          {renderBarChart(
            trend.daily.map(d => ({ label: d.date, count: d.count, successCount: d.successCount })),
            Math.max(...trend.daily.map(d => d.count))
          )}
        </div>
      )}

      {/* 触发来源分布 */}
      {stats.triggerBreakdown.length > 0 && (
        <div style={{
          padding: 16,
          borderRadius: 8,
          background: isDark ? '#1a1a1a' : '#fafafa',
          border: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
          marginBottom: 20,
        }}>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 12 }}>
            触发来源分布
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.triggerBreakdown.map((item) => {
              const percent = Math.round((item.count / stats.totalExecutions) * 100)
              return (
                <div key={item.trigger} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 80, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {getTriggerIcon(item.trigger)}
                    <span style={{ fontSize: 11 }}>{getTriggerText(item.trigger)}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      height: 8,
                      borderRadius: 4,
                      background: isDark ? '#303030' : '#e8e8e8',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${percent}%`,
                        background: '#1890ff',
                        borderRadius: 4,
                      }} />
                    </div>
                  </div>
                  <div style={{ width: 60, textAlign: 'right', fontFamily: codeFont, fontSize: 11 }}>
                    {item.count} ({percent}%)
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top 函数 */}
      {stats.topFunctions.length > 0 && (
        <div style={{
          padding: 16,
          borderRadius: 8,
          background: isDark ? '#1a1a1a' : '#fafafa',
          border: `1px solid ${isDark ? '#303030' : '#e8e8e8'}`,
        }}>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 12 }}>
            <FireOutlined style={{ marginRight: 4, color: '#fa8c16' }} />
            热门函数 Top 10
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stats.topFunctions.map((fn, index) => (
              <div
                key={fn.functionId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 4,
                  background: isDark ? '#252525' : '#fff',
                }}
              >
                <span style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: index < 3 ? ['#f5222d', '#fa8c16', '#faad14'][index] : (isDark ? '#303030' : '#e8e8e8'),
                  color: index < 3 ? '#fff' : (isDark ? '#888' : '#666'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 500,
                }}>
                  {index + 1}
                </span>
                <span style={{
                  flex: 1,
                  fontFamily: codeFont,
                  fontSize: 12,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {fn.functionName}
                </span>
                <span style={{ fontSize: 11, color: isDark ? '#888' : '#999', fontFamily: codeFont }}>
                  {fn.count} 次
                </span>
                <span style={{ fontSize: 11, color: isDark ? '#666' : '#bbb', fontFamily: codeFont }}>
                  {fn.avgDuration}ms
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
