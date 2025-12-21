/**
 * 工具调用卡片组件 (Sprint 10.1)
 */

import { Space, Tag, Typography, Descriptions } from 'antd'
import {
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  CodeOutlined,
} from '@ant-design/icons'
import type { ToolCallCardProps } from './types'
import styles from './styles.module.css'

const { Text } = Typography

// 工具名称映射
const toolNames: Record<string, string> = {
  create_function: '创建函数',
  createFunction: '创建函数',
  update_function: '修改函数',
  updateFunction: '修改函数',
  delete_function: '删除函数',
  deleteFunction: '删除函数',
  rename_function: '重命名函数',
  renameFunction: '重命名函数',
  create_folder: '创建文件夹',
  createFolder: '创建文件夹',
  move_function: '移动函数',
  moveFunction: '移动函数',
  explain_code: '解释代码',
  analyze_refactor: '重构分析',
  analyze_merge: '合并分析',
  analyze_logs: '日志分析',
  debug_function: '调试函数',
  run_function: '运行函数',
  siteCreateFile: '创建站点文件',
  siteUpdateFile: '更新站点文件',
  siteDeleteFile: '删除站点文件',
  siteCreateFolder: '创建站点文件夹',
}

// 状态图标
const statusIcons: Record<string, React.ReactNode> = {
  pending: <ClockCircleOutlined style={{ color: '#faad14' }} />,
  running: <LoadingOutlined spin style={{ color: '#1890ff' }} />,
  success: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  error: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
}

// 状态标签颜色
const statusColors: Record<string, string> = {
  pending: 'warning',
  running: 'processing',
  success: 'success',
  error: 'error',
}

export function ToolCallCard({ record, showParams = false }: ToolCallCardProps) {
  const { tool, params, status, result, error, duration } = record
  const displayName = toolNames[tool] || tool

  // 简洁视图（用于折叠标题）
  if (!showParams) {
    return (
      <Space>
        {statusIcons[status]}
        <Text strong>{displayName}</Text>
        <Tag color={statusColors[status]}>
          {status === 'pending' && '等待中'}
          {status === 'running' && '执行中'}
          {status === 'success' && '成功'}
          {status === 'error' && '失败'}
        </Tag>
        {duration !== undefined && (
          <Text type="secondary" className={styles.duration}>
            {duration}ms
          </Text>
        )}
      </Space>
    )
  }

  // 详细视图
  return (
    <div className={styles.toolCallDetail}>
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="工具">
          <Space>
            <CodeOutlined />
            <Text code>{tool}</Text>
          </Space>
        </Descriptions.Item>

        {Object.keys(params).length > 0 && (
          <Descriptions.Item label="参数">
            <pre className={styles.jsonPre}>
              {JSON.stringify(params, null, 2)}
            </pre>
          </Descriptions.Item>
        )}

        {status === 'success' && result !== undefined && (
          <Descriptions.Item label="结果">
            <pre className={styles.jsonPre}>
              {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
            </pre>
          </Descriptions.Item>
        )}

        {status === 'error' && error && (
          <Descriptions.Item label="错误">
            <Text type="danger">{error}</Text>
          </Descriptions.Item>
        )}

        {duration !== undefined && (
          <Descriptions.Item label="耗时">
            {duration}ms
          </Descriptions.Item>
        )}
      </Descriptions>
    </div>
  )
}
