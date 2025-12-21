/**
 * Plan 模式组件 (Sprint 16.2)
 *
 * 功能：
 * - 计划展示（分析结果、执行步骤、影响分析）
 * - 步骤可勾选
 * - 执行进度实时显示
 * - 暂停/恢复/停止控制
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  Modal,
  Button,
  Space,
  message,
  Spin,
  Typography,
  Tag,
  Divider,
  Checkbox,
  List,
  Progress,
  Alert,
  Tooltip,
  Steps,
} from 'antd'
import {
  AimOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ExclamationCircleOutlined,
  FileAddOutlined,
  EditOutlined,
  DeleteOutlined,
  ExperimentOutlined,
  SearchOutlined,
  ToolOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import {
  aiConversationApi,
  type ExecutionPlan,
  type PlanStep,
  type StepType,
  type StepStatus,
  type PlanModeState,
} from '../../../api/aiConversation'

const { Text, Title, Paragraph } = Typography

// 步骤类型图标配置
const STEP_TYPE_ICONS: Record<StepType, React.ReactNode> = {
  analyze: <SearchOutlined />,
  create: <FileAddOutlined />,
  update: <EditOutlined />,
  delete: <DeleteOutlined />,
  test: <ExperimentOutlined />,
  refactor: <ToolOutlined />,
}

// 步骤类型标签配置
const STEP_TYPE_LABELS: Record<StepType, { label: string; color: string }> = {
  analyze: { label: '分析', color: 'blue' },
  create: { label: '创建', color: 'green' },
  update: { label: '更新', color: 'orange' },
  delete: { label: '删除', color: 'red' },
  test: { label: '测试', color: 'purple' },
  refactor: { label: '重构', color: 'cyan' },
}

// 风险等级配置
const RISK_LEVEL_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: '低风险', color: 'green' },
  medium: { label: '中等风险', color: 'orange' },
  high: { label: '高风险', color: 'red' },
}

// 状态图标配置
const STATUS_ICONS: Record<StepStatus, React.ReactNode> = {
  pending: null,
  running: <LoadingOutlined spin />,
  completed: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  failed: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
  skipped: <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
}

interface PlanModeProps {
  conversationId: string
  plan: ExecutionPlan | null
  visible: boolean
  onClose: () => void
  onPlanUpdated?: (plan: ExecutionPlan) => void
  onExecutionComplete?: () => void
}

export const PlanMode: React.FC<PlanModeProps> = ({
  conversationId,
  plan: initialPlan,
  visible,
  onClose,
  onPlanUpdated,
  onExecutionComplete,
}) => {
  const [plan, setPlan] = useState<ExecutionPlan | null>(initialPlan)
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [selectedStepIds, setSelectedStepIds] = useState<string[]>([])

  // 初始化选中状态
  useEffect(() => {
    if (initialPlan) {
      setPlan(initialPlan)
      setSelectedStepIds(
        initialPlan.steps.filter((s) => s.selected).map((s) => s.id)
      )
    }
  }, [initialPlan])

  // 切换步骤选择
  const toggleStepSelection = useCallback(
    async (stepId: string) => {
      if (!plan) return

      const isSelected = selectedStepIds.includes(stepId)
      const newSelectedIds = isSelected
        ? selectedStepIds.filter((id) => id !== stepId)
        : [...selectedStepIds, stepId]

      setSelectedStepIds(newSelectedIds)

      // 更新服务端
      try {
        const response = await aiConversationApi.updatePlanSteps(
          plan.id,
          [stepId],
          !isSelected
        )
        if (response.data.success) {
          setPlan(response.data.data)
          onPlanUpdated?.(response.data.data)
        }
      } catch (err) {
        message.error('更新步骤选择失败')
      }
    },
    [plan, selectedStepIds, onPlanUpdated]
  )

  // 全选/取消全选
  const toggleSelectAll = useCallback(async () => {
    if (!plan) return

    const allSelected = selectedStepIds.length === plan.steps.length
    const newSelectedIds = allSelected ? [] : plan.steps.map((s) => s.id)

    setSelectedStepIds(newSelectedIds)

    try {
      const response = await aiConversationApi.updatePlanSteps(
        plan.id,
        plan.steps.map((s) => s.id),
        !allSelected
      )
      if (response.data.success) {
        setPlan(response.data.data)
        onPlanUpdated?.(response.data.data)
      }
    } catch (err) {
      message.error('更新步骤选择失败')
    }
  }, [plan, selectedStepIds, onPlanUpdated])

  // 执行计划
  const handleExecute = useCallback(async () => {
    if (!plan || selectedStepIds.length === 0) {
      message.warning('请至少选择一个步骤')
      return
    }

    setExecuting(true)

    try {
      for await (const event of aiConversationApi.executePlan(
        plan.id,
        selectedStepIds
      )) {
        if (event.type === 'step') {
          // 更新步骤状态
          setPlan((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              steps: prev.steps.map((step) =>
                step.id === event.stepId
                  ? { ...step, status: event.status! as StepStatus }
                  : step
              ),
            }
          })
        } else if (event.type === 'done') {
          message.success('计划执行完成')
          onExecutionComplete?.()
        } else if (event.type === 'error') {
          message.error(event.error || '执行失败')
        }
      }

      // 刷新计划状态
      const response = await aiConversationApi.getPlan(plan.id)
      if (response.data.success) {
        setPlan(response.data.data)
        onPlanUpdated?.(response.data.data)
      }
    } catch (err) {
      message.error('执行计划失败')
    } finally {
      setExecuting(false)
    }
  }, [plan, selectedStepIds, onPlanUpdated, onExecutionComplete])

  // 暂停执行
  const handlePause = useCallback(async () => {
    if (!plan) return

    try {
      await aiConversationApi.pausePlan(plan.id)
      message.info('已暂停执行')
    } catch (err) {
      message.error('暂停失败')
    }
  }, [plan])

  // 停止执行
  const handleStop = useCallback(async () => {
    if (!plan) return

    try {
      await aiConversationApi.stopPlan(plan.id)
      setExecuting(false)
      message.info('已停止执行')

      // 刷新状态
      const response = await aiConversationApi.getPlan(plan.id)
      if (response.data.success) {
        setPlan(response.data.data)
        onPlanUpdated?.(response.data.data)
      }
    } catch (err) {
      message.error('停止失败')
    }
  }, [plan, onPlanUpdated])

  // 计算进度
  const getProgress = useCallback(() => {
    if (!plan) return 0
    const completed = plan.steps.filter((s) => s.status === 'completed').length
    return Math.round((completed / plan.steps.length) * 100)
  }, [plan])

  // 渲染分析结果
  const renderAnalysis = () => {
    if (!plan) return null

    return (
      <div style={{ marginBottom: 16 }}>
        <Title level={5}>
          <SearchOutlined /> 分析结果
        </Title>
        <div
          style={{
            background: '#f5f5f5',
            padding: 12,
            borderRadius: 4,
          }}
        >
          <Paragraph style={{ margin: 0 }}>
            <Text strong>当前状态：</Text>
            {plan.analysis.currentState}
          </Paragraph>
          {plan.analysis.issues.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <Text strong>发现问题：</Text>
              <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
                {plan.analysis.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          {plan.analysis.goals.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <Text strong>目标：</Text>
              <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
                {plan.analysis.goals.map((goal, i) => (
                  <li key={i}>{goal}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 渲染步骤列表
  const renderSteps = () => {
    if (!plan) return null

    return (
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <Title level={5} style={{ margin: 0 }}>
            <AimOutlined /> 执行步骤
          </Title>
          <Checkbox
            checked={selectedStepIds.length === plan.steps.length}
            indeterminate={
              selectedStepIds.length > 0 &&
              selectedStepIds.length < plan.steps.length
            }
            onChange={toggleSelectAll}
            disabled={executing}
          >
            全选
          </Checkbox>
        </div>

        <List
          size="small"
          bordered
          dataSource={plan.steps}
          renderItem={(step) => {
            const typeConfig = STEP_TYPE_LABELS[step.type]
            const isSelected = selectedStepIds.includes(step.id)

            return (
              <List.Item
                style={{
                  background:
                    step.status === 'running'
                      ? '#e6f7ff'
                      : step.status === 'completed'
                      ? '#f6ffed'
                      : step.status === 'failed'
                      ? '#fff2f0'
                      : 'transparent',
                }}
              >
                <Space style={{ width: '100%' }}>
                  <Checkbox
                    checked={isSelected}
                    onChange={() => toggleStepSelection(step.id)}
                    disabled={
                      executing ||
                      step.status === 'completed' ||
                      step.status === 'running'
                    }
                  />
                  {STATUS_ICONS[step.status]}
                  <Tag
                    color={typeConfig.color}
                    icon={STEP_TYPE_ICONS[step.type]}
                  >
                    {typeConfig.label}
                  </Tag>
                  <Text
                    style={{
                      flex: 1,
                      textDecoration:
                        step.status === 'skipped' ? 'line-through' : 'none',
                    }}
                  >
                    {step.title}
                  </Text>
                  {step.estimatedTokens && (
                    <Tooltip title="预估 Token 消耗">
                      <Tag>{step.estimatedTokens} tokens</Tag>
                    </Tooltip>
                  )}
                  {step.result?.duration && (
                    <Text type="secondary">
                      {(step.result.duration / 1000).toFixed(1)}s
                    </Text>
                  )}
                </Space>
              </List.Item>
            )
          }}
        />
      </div>
    )
  }

  // 渲染影响分析
  const renderImpact = () => {
    if (!plan) return null

    const riskConfig = RISK_LEVEL_CONFIG[plan.impact.riskLevel]

    return (
      <Alert
        type={
          plan.impact.riskLevel === 'high'
            ? 'error'
            : plan.impact.riskLevel === 'medium'
            ? 'warning'
            : 'info'
        }
        showIcon
        icon={<WarningOutlined />}
        message={
          <Space split={<Divider type="vertical" />}>
            {plan.impact.newFiles.length > 0 && (
              <Text>
                <FileAddOutlined /> 新增 {plan.impact.newFiles.length} 文件
              </Text>
            )}
            {plan.impact.modifiedFiles.length > 0 && (
              <Text>
                <EditOutlined /> 修改 {plan.impact.modifiedFiles.length} 文件
              </Text>
            )}
            {plan.impact.deletedFiles.length > 0 && (
              <Text>
                <DeleteOutlined /> 删除 {plan.impact.deletedFiles.length} 文件
              </Text>
            )}
            <Tag color={riskConfig.color}>{riskConfig.label}</Tag>
          </Space>
        }
        description={
          plan.impact.riskFactors.length > 0 && (
            <Text type="secondary">
              风险因素：{plan.impact.riskFactors.join('、')}
            </Text>
          )
        }
        style={{ marginBottom: 16 }}
      />
    )
  }

  // 渲染进度条
  const renderProgress = () => {
    if (!plan || plan.state === 'reviewing') return null

    const progress = getProgress()

    return (
      <div style={{ marginBottom: 16 }}>
        <Progress
          percent={progress}
          status={
            plan.state === 'failed'
              ? 'exception'
              : plan.state === 'completed'
              ? 'success'
              : 'active'
          }
          format={() => `${progress}%`}
        />
      </div>
    )
  }

  return (
    <Modal
      title={
        <Space>
          <AimOutlined />
          <span>执行计划</span>
          {plan && (
            <Tag
              color={
                plan.state === 'completed'
                  ? 'green'
                  : plan.state === 'failed'
                  ? 'red'
                  : plan.state === 'executing'
                  ? 'blue'
                  : 'default'
              }
            >
              {plan.state}
            </Tag>
          )}
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={700}
      footer={
        <Space>
          <Button onClick={onClose}>关闭</Button>
          {executing ? (
            <>
              <Button icon={<PauseCircleOutlined />} onClick={handlePause}>
                暂停
              </Button>
              <Button
                danger
                icon={<StopOutlined />}
                onClick={handleStop}
              >
                停止
              </Button>
            </>
          ) : (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleExecute}
              disabled={
                !plan ||
                selectedStepIds.length === 0 ||
                plan.state === 'completed'
              }
              loading={executing}
            >
              执行选中 ({selectedStepIds.length})
            </Button>
          )}
        </Space>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin tip="加载中..." />
        </div>
      ) : plan ? (
        <>
          {/* 计划标题 */}
          <Title level={4} style={{ marginBottom: 16 }}>
            {plan.title}
          </Title>

          {/* 进度条 */}
          {renderProgress()}

          {/* 分析结果 */}
          {renderAnalysis()}

          <Divider style={{ margin: '16px 0' }} />

          {/* 步骤列表 */}
          {renderSteps()}

          <Divider style={{ margin: '16px 0' }} />

          {/* 影响分析 */}
          {renderImpact()}
        </>
      ) : (
        <Text type="secondary">暂无计划</Text>
      )}
    </Modal>
  )
}

// ==================== Plan 模式触发提示组件 ====================

interface PlanModeTriggerProps {
  visible: boolean
  reason?: string
  onConfirm: () => void
  onSkip: () => void
}

export const PlanModeTrigger: React.FC<PlanModeTriggerProps> = ({
  visible,
  reason,
  onConfirm,
  onSkip,
}) => {
  if (!visible) return null

  return (
    <Alert
      type="info"
      showIcon
      icon={<AimOutlined />}
      message="建议使用 Plan 模式"
      description={
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>{reason || '检测到复杂任务，建议先生成执行计划再逐步执行'}</Text>
          <Space>
            <Button type="primary" size="small" onClick={onConfirm}>
              生成计划
            </Button>
            <Button size="small" onClick={onSkip}>
              直接执行
            </Button>
          </Space>
        </Space>
      }
      style={{ marginBottom: 16 }}
    />
  )
}

export default PlanMode
