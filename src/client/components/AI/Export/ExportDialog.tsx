/**
 * 导出对话框组件
 *
 * 支持导出对话为 Markdown 或 JSON 格式
 */

import { useState } from 'react'
import { Modal, Radio, Checkbox, Button, message, Space } from 'antd'
import { DownloadOutlined, FileMarkdownOutlined, FileTextOutlined } from '@ant-design/icons'
import { aiConversationApi } from '@/api/aiConversation'
import styles from './styles.module.css'

interface ExportDialogProps {
  /** 是否显示 */
  open: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 对话 ID */
  conversationId: string
  /** 对话标题 */
  conversationTitle?: string
}

type ExportFormat = 'markdown' | 'json'

interface ExportOptions {
  includeMessages: boolean
  includeCodeBlocks: boolean
  includeToolCalls: boolean
}

export function ExportDialog({
  open,
  onClose,
  conversationId,
  conversationTitle = '对话'
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('markdown')
  const [options, setOptions] = useState<ExportOptions>({
    includeMessages: true,
    includeCodeBlocks: true,
    includeToolCalls: false,
  })
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      if (format === 'markdown') {
        // 导出 Markdown
        const blob = await aiConversationApi.exportAsMarkdown(conversationId)
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${conversationTitle}.md`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        message.success('导出成功')
      } else {
        // 导出 JSON
        const response = await aiConversationApi.exportAsJson(conversationId)
        if (response.data.success) {
          const jsonStr = JSON.stringify(response.data.data, null, 2)
          const blob = new Blob([jsonStr], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `${conversationTitle}.json`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
          message.success('导出成功')
        }
      }
      onClose()
    } catch (err) {
      message.error('导出失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="导出对话"
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
      className={styles.exportModal}
    >
      <div className={styles.exportContent}>
        {/* 格式选择 */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>选择格式</div>
          <Radio.Group
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className={styles.formatGroup}
          >
            <Radio.Button value="markdown" className={styles.formatOption}>
              <div className={styles.formatCard}>
                <FileMarkdownOutlined className={styles.formatIcon} />
                <div className={styles.formatInfo}>
                  <div className={styles.formatName}>Markdown (.md)</div>
                  <div className={styles.formatDesc}>适合阅读和分享</div>
                </div>
              </div>
            </Radio.Button>
            <Radio.Button value="json" className={styles.formatOption}>
              <div className={styles.formatCard}>
                <FileTextOutlined className={styles.formatIcon} />
                <div className={styles.formatInfo}>
                  <div className={styles.formatName}>JSON (.json)</div>
                  <div className={styles.formatDesc}>适合数据处理</div>
                </div>
              </div>
            </Radio.Button>
          </Radio.Group>
        </div>

        {/* 内容选项 */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>包含内容</div>
          <div className={styles.optionsList}>
            <Checkbox
              checked={options.includeMessages}
              onChange={(e) => setOptions({ ...options, includeMessages: e.target.checked })}
              disabled // 消息是必须的
            >
              对话消息
            </Checkbox>
            <Checkbox
              checked={options.includeCodeBlocks}
              onChange={(e) => setOptions({ ...options, includeCodeBlocks: e.target.checked })}
            >
              代码块
            </Checkbox>
            <Checkbox
              checked={options.includeToolCalls}
              onChange={(e) => setOptions({ ...options, includeToolCalls: e.target.checked })}
            >
              工具调用详情
            </Checkbox>
          </div>
        </div>

        {/* 预览信息 */}
        <div className={styles.previewInfo}>
          <div className={styles.previewLabel}>将导出为:</div>
          <div className={styles.previewFilename}>
            {conversationTitle}.{format === 'markdown' ? 'md' : 'json'}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className={styles.actions}>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExport}
              loading={loading}
            >
              导出
            </Button>
          </Space>
        </div>
      </div>
    </Modal>
  )
}

export default ExportDialog
