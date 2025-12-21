/**
 * 思考过程视图组件 (Sprint 10.1)
 */

import { useState } from 'react'
import { Typography, Button } from 'antd'
import { BulbOutlined, DownOutlined, UpOutlined } from '@ant-design/icons'
import type { ThinkingViewProps } from './types'
import styles from './styles.module.css'

const { Text, Paragraph } = Typography

export function ThinkingView({
  content,
  expanded: propExpanded,
  onToggle,
}: ThinkingViewProps) {
  const [localExpanded, setLocalExpanded] = useState(false)
  const expanded = propExpanded !== undefined ? propExpanded : localExpanded

  const handleToggle = () => {
    if (onToggle) {
      onToggle()
    } else {
      setLocalExpanded(!localExpanded)
    }
  }

  if (!content) return null

  // 处理思考内容，移除可能的 markdown 代码块标记
  const cleanContent = content
    .replace(/^```[\w]*\n?/gm, '')
    .replace(/\n?```$/gm, '')
    .trim()

  const isLong = cleanContent.length > 200
  const displayContent = expanded || !isLong
    ? cleanContent
    : cleanContent.slice(0, 200) + '...'

  return (
    <div className={styles.thinkingView}>
      <div className={styles.thinkingHeader}>
        <BulbOutlined className={styles.thinkingIcon} />
        <Text type="secondary">AI 思考过程</Text>
        {isLong && (
          <Button
            type="link"
            size="small"
            onClick={handleToggle}
            icon={expanded ? <UpOutlined /> : <DownOutlined />}
          >
            {expanded ? '收起' : '展开'}
          </Button>
        )}
      </div>
      <div className={styles.thinkingContent}>
        <Paragraph
          className={styles.thinkingText}
          ellipsis={!expanded && isLong ? { rows: 3 } : false}
        >
          {displayContent}
        </Paragraph>
      </div>
    </div>
  )
}
