/**
 * 上下文管理器组件 (Sprint 10.3)
 *
 * 功能：
 * - 显示上下文使用量百分比
 * - 超过 70% 显示蓝色提示
 * - 点击可查看上下文详情（分类展示）
 * - 可手动删除非必需上下文项
 * - 支持智能压缩，目标压缩到 50%
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Modal, Button, Space, message, Spin, Typography, Divider } from 'antd'
import {
  ThunderboltOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CompressOutlined,
} from '@ant-design/icons'
import { UsageBar } from './UsageBar'
import { ContextList } from './ContextList'
import {
  aiConversationApi,
  type ContextStats,
  type CompressResult,
} from '../../../api/aiConversation'

const { Text, Title } = Typography

interface ContextManagerProps {
  conversationId: string | null
  modelName?: string
  compact?: boolean // 紧凑模式（只显示 UsageBar）
}

export const ContextManager: React.FC<ContextManagerProps> = ({
  conversationId,
  modelName,
  compact = false,
}) => {
  const [stats, setStats] = useState<ContextStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [compressing, setCompressing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 加载上下文统计
  const loadStats = useCallback(async () => {
    if (!conversationId) return

    setLoading(true)
    try {
      const response = await aiConversationApi.getContextStats(conversationId, modelName)
      if (response.data.success) {
        setStats(response.data.data)
      }
    } catch (err) {
      console.error('Failed to load context stats:', err)
    } finally {
      setLoading(false)
    }
  }, [conversationId, modelName])

  // 首次加载和 conversationId 变化时加载
  useEffect(() => {
    loadStats()
  }, [loadStats])

  // 智能压缩
  const handleSmartCompress = async () => {
    if (!conversationId) return

    setCompressing(true)
    try {
      const response = await aiConversationApi.compressContext(conversationId, {
        mode: 'smart',
        targetPercentage: 50,
      })

      if (response.data.success) {
        const result = response.data.data as CompressResult
        message.success(result.message || `已压缩 ${result.saved} tokens`)
        await loadStats()
        setSelectedIds([])
      }
    } catch (err) {
      message.error('压缩失败')
    } finally {
      setCompressing(false)
    }
  }

  // 压缩选中项
  const handleCompressSelected = async () => {
    if (!conversationId || selectedIds.length === 0) return

    setCompressing(true)
    try {
      const response = await aiConversationApi.compressContext(conversationId, {
        mode: 'manual',
        itemIds: selectedIds,
      })

      if (response.data.success) {
        const result = response.data.data as CompressResult
        message.success(result.message || `已压缩 ${result.saved} tokens`)
        await loadStats()
        setSelectedIds([])
      }
    } catch (err) {
      message.error('压缩失败')
    } finally {
      setCompressing(false)
    }
  }

  // 删除选中项
  const handleDeleteSelected = async () => {
    if (!conversationId || selectedIds.length === 0) return

    setDeleting(true)
    try {
      const response = await aiConversationApi.deleteContextItems(conversationId, selectedIds)

      if (response.data.success) {
        const result = response.data.data
        message.success(`已删除 ${result.deleted} 项，节省 ${result.tokensSaved} tokens`)
        await loadStats()
        setSelectedIds([])
      }
    } catch (err) {
      message.error('删除失败')
    } finally {
      setDeleting(false)
    }
  }

  // 格式化 token 数量
  const formatTokens = (tokens: number) => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`
    }
    return tokens.toString()
  }

  // 如果没有对话 ID，不显示
  if (!conversationId) {
    return null
  }

  // 紧凑模式
  if (compact) {
    if (loading || !stats) {
      return (
        <div style={{ padding: '8px 12px' }}>
          <Spin size="small" />
        </div>
      )
    }

    return (
      <UsageBar
        usage={stats.usage}
        warningThreshold={stats.warningThreshold}
        isWarning={stats.isWarning}
        onClick={() => setModalOpen(true)}
      />
    )
  }

  return (
    <>
      {/* 使用量指示器 */}
      {stats && (
        <UsageBar
          usage={stats.usage}
          warningThreshold={stats.warningThreshold}
          isWarning={stats.isWarning}
          onClick={() => setModalOpen(true)}
        />
      )}

      {/* 详情弹窗 */}
      <Modal
        title={
          <Space>
            <CompressOutlined />
            <span>上下文管理</span>
          </Space>
        }
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setSelectedIds([])
        }}
        width={600}
        footer={null}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : stats ? (
          <>
            {/* 使用量概览 */}
            <div style={{ marginBottom: 16 }}>
              <Title level={5} style={{ marginBottom: 8 }}>
                使用量: {formatTokens(stats.usage.used)} / {formatTokens(stats.usage.total)} tokens ({stats.usage.percentage}%)
              </Title>
              <UsageBar
                usage={stats.usage}
                warningThreshold={stats.warningThreshold}
                isWarning={stats.isWarning}
              />
            </div>

            <Divider style={{ margin: '16px 0' }} />

            {/* 上下文列表 */}
            <ContextList
              items={stats.items}
              categories={stats.categories}
              selectedIds={selectedIds}
              onSelectChange={setSelectedIds}
            />

            <Divider style={{ margin: '16px 0' }} />

            {/* 操作按钮 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadStats}
                  loading={loading}
                >
                  刷新
                </Button>
              </Space>

              <Space>
                <Button
                  icon={<DeleteOutlined />}
                  danger
                  disabled={selectedIds.length === 0}
                  loading={deleting}
                  onClick={handleDeleteSelected}
                >
                  删除选中 ({selectedIds.length})
                </Button>

                <Button
                  icon={<CompressOutlined />}
                  disabled={selectedIds.length === 0}
                  loading={compressing}
                  onClick={handleCompressSelected}
                >
                  压缩选中
                </Button>

                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  loading={compressing}
                  onClick={handleSmartCompress}
                >
                  智能压缩
                </Button>
              </Space>
            </div>

            {stats.isWarning && (
              <Text
                type="secondary"
                style={{ display: 'block', marginTop: 12, fontSize: 12 }}
              >
                提示：上下文已超过 {stats.warningThreshold}%，建议使用"智能压缩"将使用量降至 50%
              </Text>
            )}
          </>
        ) : (
          <Text type="secondary">暂无数据</Text>
        )}
      </Modal>
    </>
  )
}

export default ContextManager
