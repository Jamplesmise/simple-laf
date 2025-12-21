import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Table,
  Select,
  Tag,
  Statistic,
  Row,
  Col,
  Spin,
  Empty,
  message,
  Typography,
} from 'antd'
import { WarningOutlined, ClockCircleOutlined } from '@ant-design/icons'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import * as monitorApi from '../../api/monitor'
import type { ErrorSummary, ErrorGroup } from '../../api/monitor'
import styles from './ErrorList.module.css'

const { Text, Paragraph } = Typography

type Period = '24h' | '7d'

export default function ErrorList() {
  const [period, setPeriod] = useState<Period>('24h')
  const [summary, setSummary] = useState<ErrorSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await monitorApi.getErrorSummary(period)
      setSummary(data)
    } catch {
      message.error('加载错误数据失败')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    loadData()
  }, [loadData])

  const columns = [
    {
      title: '错误类型',
      dataIndex: 'errorType',
      key: 'errorType',
      width: 200,
      render: (type: string) => (
        <Tag color="error" icon={<WarningOutlined />}>
          {type}
        </Tag>
      ),
    },
    {
      title: '次数',
      dataIndex: 'count',
      key: 'count',
      width: 80,
      sorter: (a: ErrorGroup, b: ErrorGroup) => a.count - b.count,
    },
    {
      title: '影响函数',
      dataIndex: 'affectedFunctions',
      key: 'affectedFunctions',
      render: (funcs: string[]) => (
        <span>
          {funcs.slice(0, 3).map((f) => (
            <Tag key={f}>{f}</Tag>
          ))}
          {funcs.length > 3 && <Tag>+{funcs.length - 3}</Tag>}
        </span>
      ),
    },
    {
      title: '最后发生',
      dataIndex: 'lastOccurrence',
      key: 'lastOccurrence',
      width: 180,
      render: (time: string) => (
        <span>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          {new Date(time).toLocaleString()}
        </span>
      ),
    },
  ]

  const expandedRowRender = (record: ErrorGroup) => (
    <div className={styles.expandedRow}>
      <Text strong>错误示例:</Text>
      <Paragraph
        code
        copyable
        ellipsis={{ rows: 3, expandable: true }}
        className={styles.errorSample}
      >
        {record.sampleError}
      </Paragraph>
    </div>
  )

  if (loading && !summary) {
    return (
      <div className={styles.loading}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  return (
    <div className={styles.errorList}>
      <div className={styles.header}>
        <h2>错误分析</h2>
        <Select value={period} onChange={setPeriod} style={{ width: 120 }}>
          <Select.Option value="24h">最近24小时</Select.Option>
          <Select.Option value="7d">最近7天</Select.Option>
        </Select>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic
              title="总错误数"
              value={summary?.totalErrors || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic
              title="错误率"
              value={summary?.errorRate || 0}
              suffix="%"
              valueStyle={{
                color: (summary?.errorRate || 0) <= 5 ? '#52c41a' : '#ff4d4f',
              }}
            />
          </Card>
        </Col>
      </Row>

      {summary?.trend && summary.trend.length > 0 && (
        <Card title="错误趋势" className={styles.chartCard}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={summary.trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" name="错误数" fill="#ff4d4f" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card title="错误详情" className={styles.tableCard}>
        {summary?.topErrors && summary.topErrors.length > 0 ? (
          <Table
            dataSource={summary.topErrors}
            columns={columns}
            rowKey="errorType"
            pagination={false}
            size="small"
            expandable={{
              expandedRowRender,
              rowExpandable: (record) => !!record.sampleError,
            }}
          />
        ) : (
          <Empty description="暂无错误" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>
    </div>
  )
}
