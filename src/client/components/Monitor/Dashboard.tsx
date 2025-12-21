import { useState, useEffect, useCallback } from 'react'
import { Card, Row, Col, Statistic, Select, Table, Spin, Progress, message } from 'antd'
import {
  ThunderboltOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FireOutlined,
} from '@ant-design/icons'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import * as monitorApi from '../../api/monitor'
import type { MonitorStats, TopFunction } from '../../api/monitor'
import styles from './Dashboard.module.css'

type Period = '1h' | '24h' | '7d'

interface Props {
  functionId?: string
}

export default function Dashboard({ functionId }: Props) {
  const [period, setPeriod] = useState<Period>('24h')
  const [stats, setStats] = useState<MonitorStats | null>(null)
  const [topFunctions, setTopFunctions] = useState<TopFunction[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsData, topData] = await Promise.all([
        monitorApi.getStats(period, functionId),
        functionId ? Promise.resolve([]) : monitorApi.getTopFunctions(period, 10),
      ])
      setStats(statsData)
      setTopFunctions(topData)
    } catch {
      message.error('加载监控数据失败')
    } finally {
      setLoading(false)
    }
  }, [period, functionId])

  useEffect(() => {
    loadData()
    // 自动刷新（每30秒）
    const timer = setInterval(loadData, 30000)
    return () => clearInterval(timer)
  }, [loadData])

  const columns = [
    {
      title: '函数名',
      dataIndex: 'functionName',
      key: 'functionName',
      ellipsis: true,
    },
    {
      title: '调用次数',
      dataIndex: 'count',
      key: 'count',
      width: 100,
      sorter: (a: TopFunction, b: TopFunction) => a.count - b.count,
    },
    {
      title: '成功率',
      dataIndex: 'successRate',
      key: 'successRate',
      width: 120,
      render: (rate: number) => (
        <Progress
          percent={rate}
          size="small"
          status={rate >= 90 ? 'success' : rate >= 70 ? 'normal' : 'exception'}
        />
      ),
      sorter: (a: TopFunction, b: TopFunction) => a.successRate - b.successRate,
    },
    {
      title: '平均延迟',
      dataIndex: 'avgDuration',
      key: 'avgDuration',
      width: 100,
      render: (ms: number) => `${ms}ms`,
      sorter: (a: TopFunction, b: TopFunction) => a.avgDuration - b.avgDuration,
    },
  ]

  if (loading && !stats) {
    return (
      <div className={styles.loading}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h2>实时监控</h2>
        <Select value={period} onChange={setPeriod} style={{ width: 120 }}>
          <Select.Option value="1h">最近1小时</Select.Option>
          <Select.Option value="24h">最近24小时</Select.Option>
          <Select.Option value="7d">最近7天</Select.Option>
        </Select>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总调用量"
              value={stats?.callCount || 0}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="成功率"
              value={stats?.successRate || 0}
              suffix="%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{
                color: (stats?.successRate || 0) >= 90 ? '#52c41a' : '#faad14',
              }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="平均延迟"
              value={stats?.avgLatency || 0}
              suffix="ms"
              prefix={<ClockCircleOutlined />}
              valueStyle={{
                color: (stats?.avgLatency || 0) <= 100 ? '#52c41a' : '#faad14',
              }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="热门函数"
              value={topFunctions.length}
              prefix={<FireOutlined />}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="调用趋势" className={styles.chartCard}>
        {stats?.timeline && stats.timeline.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.timeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="count"
                name="总调用"
                stroke="#1890ff"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="successCount"
                name="成功"
                stroke="#52c41a"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className={styles.noData}>暂无数据</div>
        )}
      </Card>

      {!functionId && topFunctions.length > 0 && (
        <Card title="热门函数" className={styles.tableCard}>
          <Table
            dataSource={topFunctions}
            columns={columns}
            rowKey="functionId"
            pagination={false}
            size="small"
          />
        </Card>
      )}
    </div>
  )
}
