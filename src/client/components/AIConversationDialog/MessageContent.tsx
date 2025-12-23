/**
 * 消息内容渲染组件
 *
 * 渲染代码块、操作卡片、思考过程等
 * 支持类似 Claude Artifacts 的可展开代码预览
 *
 * 改进：
 * - 画布风格代码展示
 * - 明确的文件名标注
 * - 可展开详细内容
 * - 流式输出正确换行
 * - 便捷复制选项
 */

import { useState } from 'react'
import { Typography, Tooltip, message } from 'antd'
import {
  CopyOutlined, CheckOutlined, FileAddOutlined, FolderAddOutlined,
  EditFilled, DeleteFilled, BulbOutlined, DownOutlined, RightOutlined,
  SwapOutlined, BugOutlined, QuestionCircleOutlined,
  SplitCellsOutlined, MergeCellsOutlined, ToolOutlined, EyeOutlined,
  FileOutlined, CodeOutlined, GlobalOutlined
} from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import { parseAIResponse, codeFont, type AIOperation } from './utils'
import { HTMLPreview, ReactPreview, MermaidPreview, SVGPreview } from '../AI/Artifacts'
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
 * 操作卡片 - 画布风格可展开预览
 */
function OperationCard({ operation }: { operation: AIOperation }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
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
      label: '创建',
      colorClass: styles.operationIconCreate,
      color: '#22C55E',
    },
    update: {
      icon: <EditFilled />,
      label: '修改',
      colorClass: styles.operationIconUpdate,
      color: '#3B82F6',
    },
    delete: {
      icon: <DeleteFilled />,
      label: '删除',
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
      label: '文件夹',
      colorClass: styles.operationIconCreate,
      color: '#F59E0B',
    },
    debug: {
      icon: <BugOutlined />,
      label: '调试',
      colorClass: styles.operationIconDebug,
      color: '#EC4899',
    },
    explain: {
      icon: <QuestionCircleOutlined />,
      label: '解释',
      colorClass: styles.operationIconExplain,
      color: '#06B6D4',
    },
    refactor: {
      icon: <SplitCellsOutlined />,
      label: '重构',
      colorClass: styles.operationIconRefactor,
      color: '#8B5CF6',
    },
    merge: {
      icon: <MergeCellsOutlined />,
      label: '合并',
      colorClass: styles.operationIconMerge,
      color: '#F97316',
    },
    // 站点文件操作
    site_create: {
      icon: <GlobalOutlined />,
      label: '创建站点文件',
      colorClass: styles.operationIconCreate,
      color: '#10B981',
    },
    site_update: {
      icon: <GlobalOutlined />,
      label: '更新站点文件',
      colorClass: styles.operationIconUpdate,
      color: '#3B82F6',
    },
    site_delete: {
      icon: <GlobalOutlined />,
      label: '删除站点文件',
      colorClass: styles.operationIconDelete,
      color: '#EF4444',
    },
    site_folder: {
      icon: <FolderAddOutlined />,
      label: '创建站点文件夹',
      colorClass: styles.operationIconCreate,
      color: '#F59E0B',
    },
  }

  const config = operationConfig[operation.type] || {
    icon: <ToolOutlined />,
    label: operation.type,
    colorClass: styles.operationIconDefault,
    color: '#71717A',
  }

  const hasCode = !!operation.code

  // 获取文件名/函数名
  const fileName = operation.name || (operation.functionId ? `函数 ${operation.functionId.slice(-6)}` : null)

  // 判断是否为可预览的站点文件
  const isSiteOperation = operation.type.startsWith('site_')
  const isHTMLFile = fileName?.toLowerCase().endsWith('.html') || fileName?.toLowerCase().endsWith('.htm')
  const isPreviewable = isSiteOperation && isHTMLFile && hasCode

  // 代码预览（前5行）
  const getCodePreview = () => {
    if (!operation.code) return ''
    const lines = operation.code.split('\n')
    const preview = lines.slice(0, 5).join('\n')
    return lines.length > 5 ? preview + '\n...' : preview
  }

  // 统计代码行数
  const getLineCount = () => {
    if (!operation.code) return 0
    return operation.code.split('\n').length
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (operation.code) {
      await navigator.clipboard.writeText(operation.code)
      setCopied(true)
      message.success('已复制到剪贴板')
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
      {/* 卡片头部 - 画布风格 */}
      <div
        className={styles.artifactHeader}
        onClick={handleToggle}
        style={{ background: isDark ? '#1a1a2e' : '#f8fafc' }}
      >
        {/* 文件图标 */}
        <div
          className={styles.artifactIcon}
          style={{ background: `${config.color}15`, color: config.color }}
        >
          {hasCode ? <CodeOutlined /> : config.icon}
        </div>

        {/* 文件信息 */}
        <div className={styles.artifactInfo}>
          <div className={styles.artifactTitle}>
            {/* 文件名 */}
            {fileName && (
              <span className={styles.artifactName} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileOutlined style={{ fontSize: 12, opacity: 0.6 }} />
                {fileName}
              </span>
            )}
            {/* 操作标签 */}
            <span
              className={styles.artifactLabel}
              style={{
                color: config.color,
                background: `${config.color}15`,
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 11,
              }}
            >
              {config.label}
            </span>
          </div>
          {operation.description && (
            <div className={styles.artifactDesc}>{operation.description}</div>
          )}
          {hasCode && (
            <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 4 }}>
              {getLineCount()} 行代码
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className={styles.artifactActions}>
          {hasCode && (
            <>
              {isPreviewable && (
                <Tooltip title={showPreview ? '查看代码' : '预览'}>
                  <button
                    className={styles.artifactAction}
                    onClick={(e) => { e.stopPropagation(); setShowPreview(!showPreview) }}
                    style={{
                      background: showPreview ? `${config.color}20` : undefined,
                      color: showPreview ? config.color : undefined,
                    }}
                  >
                    {showPreview ? <CodeOutlined /> : <EyeOutlined />}
                  </button>
                </Tooltip>
              )}
              <Tooltip title={copied ? '已复制' : '复制代码'}>
                <button
                  className={styles.artifactAction}
                  onClick={handleCopy}
                  style={{
                    background: copied ? `${config.color}20` : undefined,
                    color: copied ? config.color : undefined,
                  }}
                >
                  {copied ? <CheckOutlined /> : <CopyOutlined />}
                </button>
              </Tooltip>
              <Tooltip title={expanded ? '收起' : '展开'}>
                <button
                  className={styles.artifactAction}
                  onClick={(e) => { e.stopPropagation(); handleToggle() }}
                >
                  {expanded ? <DownOutlined /> : <RightOutlined />}
                </button>
              </Tooltip>
            </>
          )}
        </div>
      </div>

      {/* HTML 预览区域 */}
      {showPreview && isPreviewable && (
        <div style={{ padding: 12 }}>
          <HTMLPreview html={operation.code!} height={350} />
        </div>
      )}

      {/* 代码预览区域 */}
      {hasCode && !expanded && !showPreview && (
        <div
          className={styles.artifactPreview}
          onClick={handleToggle}
          style={{ background: isDark ? '#0d1117' : '#f6f8fa' }}
        >
          <pre style={{ fontFamily: codeFont, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            <code>{getCodePreview()}</code>
          </pre>
          <div
            className={styles.artifactPreviewFade}
            style={{ background: isDark ? 'linear-gradient(to bottom, transparent, #0d1117)' : undefined }}
          />
        </div>
      )}

      {/* 完整代码区域 */}
      {hasCode && expanded && !showPreview && (
        <div
          className={styles.artifactCode}
          style={{ background: isDark ? '#0d1117' : '#f6f8fa' }}
        >
          <pre style={{ fontFamily: codeFont, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
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
              fileName={part.fileName}
            />
          )
        }
        // 文本内容保留换行
        return (
          <span
            key={`${messageId}-text-${idx}`}
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {part.content}
          </span>
        )
      })}
    </div>
  )
}

interface TextPart {
  type: 'text' | 'code'
  content: string
  language?: string
  fileName?: string
}

function parseCodeBlocks(content: string): TextPart[] {
  const parts: TextPart[] = []
  // 支持 ```language:filename 格式提取文件名
  const codeBlockRegex = /```(\w*)(?::([^\n]+))?\n([\s\S]*?)```/g
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
      fileName: match[2]?.trim(),
      content: match[3]
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
 * 代码块 - 画布风格
 */
function CodeBlock({ code, language, fileName }: { code: string; language?: string; fileName?: string }) {
  const [copied, setCopied] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const { isDark, t } = useThemeColors()

  // 判断是否为可预览的代码
  const lang = language?.toLowerCase()
  const isHTMLPreviewable = lang === 'html'
  const isReactPreviewable = lang === 'jsx' || lang === 'tsx' || lang === 'react'
  const isMermaidPreviewable = lang === 'mermaid'
  const isSVGPreviewable = lang === 'svg'
  const isPreviewable = isHTMLPreviewable || isReactPreviewable || isMermaidPreviewable || isSVGPreviewable

  // 统计行数
  const lineCount = code.split('\n').length

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    message.success('已复制到剪贴板')
    setTimeout(() => setCopied(false), 2000)
  }

  const togglePreview = () => {
    setShowPreview(!showPreview)
  }

  // 根据语言类型选择预览组件
  const renderPreviewComponent = () => {
    if (isHTMLPreviewable) {
      return <HTMLPreview html={code} height={350} />
    }
    if (isReactPreviewable) {
      return <ReactPreview code={code} height={350} />
    }
    if (isMermaidPreviewable) {
      return <MermaidPreview code={code} height={350} />
    }
    if (isSVGPreviewable) {
      return <SVGPreview svg={code} height={350} />
    }
    return null
  }

  // 如果正在预览，根据类型显示对应的预览组件
  if (showPreview && isPreviewable) {
    return (
      <div className={styles.codeBlockWithPreview}>
        {renderPreviewComponent()}
        <div className={styles.previewToggleBar} style={{ background: t.bgMuted, borderColor: t.border }}>
          <button className={styles.copyButton} onClick={handleCopy}>
            {copied ? <CheckOutlined /> : <CopyOutlined />}
            {copied ? '已复制' : '复制'}
          </button>
          <button className={styles.copyButton} onClick={togglePreview}>
            <CodeOutlined />
            查看代码
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.codeBlock} style={{ borderColor: t.border }}>
      {/* 头部 - 显示语言和文件名 */}
      <div className={styles.codeHeader} style={{ background: isDark ? '#161b22' : '#f6f8fa', borderColor: t.border }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {fileName && (
            <>
              <FileOutlined style={{ fontSize: 12, color: t.textSecondary }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{fileName}</span>
              <span style={{ color: t.textSecondary }}>·</span>
            </>
          )}
          <span className={styles.codeLanguage}>{language}</span>
          <span style={{ fontSize: 11, color: t.textSecondary }}>
            {lineCount} 行
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={styles.copyButton}
            onClick={handleCopy}
            style={{
              background: copied ? 'rgba(34, 197, 94, 0.1)' : undefined,
              color: copied ? '#22C55E' : undefined,
            }}
          >
            {copied ? <CheckOutlined /> : <CopyOutlined />}
            {copied ? '已复制' : '复制'}
          </button>
          {isPreviewable && (
            <button className={styles.copyButton} onClick={togglePreview}>
              <EyeOutlined />
              预览
            </button>
          )}
        </div>
      </div>
      <pre
        className={styles.codeContent}
        style={{
          background: isDark ? '#0d1117' : '#f6f8fa',
          color: t.text,
          fontFamily: codeFont,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  )
}
