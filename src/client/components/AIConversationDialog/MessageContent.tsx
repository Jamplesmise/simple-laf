/**
 * 消息内容渲染组件
 *
 * 渲染代码块、操作卡片、思考过程等
 * 支持类似 Claude Artifacts 的可展开代码预览
 */

import { useState } from 'react'
import { Typography, Tooltip } from 'antd'
import {
  CopyOutlined, CheckOutlined, FileAddOutlined, FolderAddOutlined,
  EditFilled, DeleteFilled, BulbOutlined, DownOutlined, RightOutlined,
  SwapOutlined, BugOutlined, QuestionCircleOutlined,
  SplitCellsOutlined, MergeCellsOutlined, ToolOutlined
} from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import { parseAIResponse, codeFont, type AIOperation } from './utils'
import styles from './styles.module.css'

const { Paragraph } = Typography

interface MessageContentProps {
  content: string
  messageId: string
}

export function MessageContent({ content, messageId }: MessageContentProps) {
  const parsed = parseAIResponse(content)

  return (
    <div>
      {/* 思考过程 */}
      {parsed.thinking && (
        <ThinkingBlock content={parsed.thinking} />
      )}

      {/* 操作卡片 */}
      {parsed.operations?.map((op, idx) => (
        <OperationCard key={`${messageId}-op-${idx}`} operation={op} />
      ))}

      {/* 摘要 */}
      {parsed.summary && (
        <Paragraph style={{ marginTop: 8 }}>{parsed.summary}</Paragraph>
      )}

      {/* 普通文本内容 */}
      {parsed.rawContent && (
        <TextContent content={parsed.rawContent} messageId={messageId} />
      )}
    </div>
  )
}

/**
 * 思考过程折叠块
 */
function ThinkingBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)
  const { t } = useThemeColors()

  return (
    <div className={styles.thinkingBlock} style={{ borderColor: t.border }}>
      <div
        className={styles.thinkingHeader}
        onClick={() => setExpanded(!expanded)}
        style={{ background: t.bgMuted }}
      >
        <BulbOutlined className={styles.thinkingIcon} />
        <span className={styles.thinkingLabel}>思考过程</span>
        {expanded ? <DownOutlined /> : <RightOutlined />}
      </div>
      {expanded && (
        <div className={styles.thinkingContent} style={{ background: t.bgCard }}>
          {content}
        </div>
      )}
    </div>
  )
}

/**
 * 操作卡片 - 类似 Claude Artifacts 的可展开预览
 */
function OperationCard({ operation }: { operation: AIOperation }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const { isDark, t } = useThemeColors()

  // 操作类型配置
  const operationConfig: Record<string, {
    icon: React.ReactNode
    label: string
    colorClass: string
    color: string
  }> = {
    create: {
      icon: <FileAddOutlined />,
      label: '创建函数',
      colorClass: styles.operationIconCreate,
      color: '#22C55E',
    },
    update: {
      icon: <EditFilled />,
      label: '修改函数',
      colorClass: styles.operationIconUpdate,
      color: '#3B82F6',
    },
    delete: {
      icon: <DeleteFilled />,
      label: '删除函数',
      colorClass: styles.operationIconDelete,
      color: '#EF4444',
    },
    rename: {
      icon: <SwapOutlined />,
      label: '重命名',
      colorClass: styles.operationIconUpdate,
      color: '#8B5CF6',
    },
    folder: {
      icon: <FolderAddOutlined />,
      label: '创建文件夹',
      colorClass: styles.operationIconCreate,
      color: '#F59E0B',
    },
    debug: {
      icon: <BugOutlined />,
      label: '调试分析',
      colorClass: styles.operationIconDebug,
      color: '#EC4899',
    },
    explain: {
      icon: <QuestionCircleOutlined />,
      label: '代码解释',
      colorClass: styles.operationIconExplain,
      color: '#06B6D4',
    },
    refactor: {
      icon: <SplitCellsOutlined />,
      label: '重构建议',
      colorClass: styles.operationIconRefactor,
      color: '#8B5CF6',
    },
    merge: {
      icon: <MergeCellsOutlined />,
      label: '合并分析',
      colorClass: styles.operationIconMerge,
      color: '#F97316',
    },
  }

  const config = operationConfig[operation.type] || {
    icon: <ToolOutlined />,
    label: operation.type,
    colorClass: styles.operationIconDefault,
    color: '#71717A',
  }

  const hasCode = !!operation.code

  // 代码预览（前5行）
  const getCodePreview = () => {
    if (!operation.code) return ''
    const lines = operation.code.split('\n')
    const preview = lines.slice(0, 5).join('\n')
    return lines.length > 5 ? preview + '\n...' : preview
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (operation.code) {
      await navigator.clipboard.writeText(operation.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleToggle = () => {
    if (hasCode) {
      setExpanded(!expanded)
    }
  }

  return (
    <div
      className={`${styles.artifactCard} ${hasCode ? styles.artifactClickable : ''}`}
      style={{
        borderColor: t.border,
        '--artifact-color': config.color,
      } as React.CSSProperties}
    >
      {/* 卡片头部 */}
      <div className={styles.artifactHeader} onClick={handleToggle}>
        <div
          className={styles.artifactIcon}
          style={{ background: `${config.color}15`, color: config.color }}
        >
          {config.icon}
        </div>
        <div className={styles.artifactInfo}>
          <div className={styles.artifactTitle}>
            <span className={styles.artifactLabel} style={{ color: config.color }}>
              {config.label}
            </span>
            {operation.name && (
              <span className={styles.artifactName}>{operation.name}</span>
            )}
          </div>
          {operation.description && (
            <div className={styles.artifactDesc}>{operation.description}</div>
          )}
        </div>
        <div className={styles.artifactActions}>
          {hasCode && (
            <>
              <Tooltip title={copied ? '已复制' : '复制代码'}>
                <button className={styles.artifactAction} onClick={handleCopy}>
                  {copied ? <CheckOutlined /> : <CopyOutlined />}
                </button>
              </Tooltip>
              <span className={styles.artifactExpand}>
                {expanded ? <DownOutlined /> : <RightOutlined />}
              </span>
            </>
          )}
        </div>
      </div>

      {/* 代码预览区域 */}
      {hasCode && !expanded && (
        <div
          className={styles.artifactPreview}
          onClick={handleToggle}
          style={{ background: isDark ? '#1a1a1a' : '#f5f5f5' }}
        >
          <pre style={{ fontFamily: codeFont }}>
            <code>{getCodePreview()}</code>
          </pre>
          <div className={styles.artifactPreviewFade} />
        </div>
      )}

      {/* 完整代码区域 */}
      {hasCode && expanded && (
        <div
          className={styles.artifactCode}
          style={{ background: isDark ? '#1e1e1e' : '#fafafa' }}
        >
          <pre style={{ fontFamily: codeFont }}>
            <code>{operation.code}</code>
          </pre>
        </div>
      )}
    </div>
  )
}

/**
 * 文本内容（含代码块解析）
 */
function TextContent({ content, messageId }: { content: string; messageId: string }) {
  // 解析代码块
  const parts = parseCodeBlocks(content)

  return (
    <div className={styles.messageText}>
      {parts.map((part, idx) => {
        if (part.type === 'code') {
          return (
            <CodeBlock
              key={`${messageId}-code-${idx}`}
              code={part.content}
              language={part.language}
            />
          )
        }
        return <span key={`${messageId}-text-${idx}`}>{part.content}</span>
      })}
    </div>
  )
}

interface TextPart {
  type: 'text' | 'code'
  content: string
  language?: string
}

function parseCodeBlocks(content: string): TextPart[] {
  const parts: TextPart[] = []
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g
  let lastIndex = 0
  let match

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // 代码块之前的文本
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex, match.index)
      })
    }

    // 代码块
    parts.push({
      type: 'code',
      language: match[1] || 'plaintext',
      content: match[2]
    })

    lastIndex = match.index + match[0].length
  }

  // 最后的文本
  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.slice(lastIndex)
    })
  }

  return parts
}

/**
 * 代码块
 */
function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)
  const { isDark, t } = useThemeColors()

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={styles.codeBlock} style={{ borderColor: t.border }}>
      <div className={styles.codeHeader} style={{ background: t.bgMuted, borderColor: t.border }}>
        <span className={styles.codeLanguage}>{language}</span>
        <button className={styles.copyButton} onClick={handleCopy}>
          {copied ? <CheckOutlined /> : <CopyOutlined />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre
        className={styles.codeContent}
        style={{
          background: isDark ? '#1e1e1e' : '#fafafa',
          color: t.text,
          fontFamily: codeFont,
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  )
}
