import { useState } from 'react'
import { Button, Input, Tabs, Space, message, Typography } from 'antd'
import { PlayCircleOutlined, SaveOutlined, ClearOutlined } from '@ant-design/icons'
import { useFunctionStore } from '../stores/function'
import { useThemeStore } from '../stores/theme'
import { functionApi } from '../api/functions'
import { invokeApi } from '../api/invoke'
import type { InvokeResult } from '../api/invoke'

const { TextArea } = Input
const { Text } = Typography

export default function DebugPanel() {
  const { current } = useFunctionStore()
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'
  const [requestBody, setRequestBody] = useState('{}')
  const [result, setResult] = useState<InvokeResult | null>(null)
  const [running, setRunning] = useState(false)
  const [compiling, setCompiling] = useState(false)

  const handleRun = async () => {
    if (!current) {
      message.warning('请先选择一个函数')
      return
    }

    // 先编译
    setCompiling(true)
    try {
      const compileRes = await functionApi.compile(current._id)
      if (!compileRes.data.success) {
        message.error('编译失败')
        setCompiling(false)
        return
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      message.error(err.response?.data?.error?.message || '编译失败')
      setCompiling(false)
      return
    }
    setCompiling(false)

    // 执行函数
    setRunning(true)
    try {
      let body = {}
      try {
        body = JSON.parse(requestBody)
      } catch {
        message.warning('请求体不是有效的 JSON')
        setRunning(false)
        return
      }

      const invokeResult = await invokeApi.run(current.name, body)
      setResult(invokeResult)
    } catch {
      message.error('执行失败')
    } finally {
      setRunning(false)
    }
  }

  const handleSave = async () => {
    if (!current) return
    try {
      await functionApi.update(current._id, current.code)
      message.success('保存成功')
    } catch {
      message.error('保存失败')
    }
  }

  const clearResult = () => {
    setResult(null)
  }

  const tabItems = [
    {
      key: 'params',
      label: '请求参数',
      children: (
        <TextArea
          value={requestBody}
          onChange={(e) => setRequestBody(e.target.value)}
          placeholder='{"key": "value"}'
          style={{
            fontFamily: 'monospace',
            height: 200,
          }}
        />
      ),
    },
    {
      key: 'response',
      label: '返回结果',
      children: result ? (
        <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
          <div style={{ marginBottom: 8 }}>
            <Text type={result.success ? 'success' : 'danger'}>
              {result.success ? '执行成功' : '执行失败'}
            </Text>
            <Text type="secondary" style={{ marginLeft: 16 }}>
              耗时: {result.time}ms
            </Text>
          </div>
          <pre style={{
            background: isDark ? '#252525' : '#f5f5f5',
            padding: 8,
            borderRadius: 4,
            overflow: 'auto',
            maxHeight: 300,
            color: result.error ? '#ff4d4f' : (isDark ? '#98c379' : '#52c41a'),
            border: `1px solid ${isDark ? '#404040' : '#d9d9d9'}`,
          }}>
            {result.error || JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      ) : (
        <Text type="secondary">运行函数后查看结果</Text>
      ),
    },
    {
      key: 'logs',
      label: '控制台',
      children: result?.logs?.length ? (
        <div style={{
          fontFamily: 'monospace',
          fontSize: 12,
          background: isDark ? '#0d0d0d' : '#fafafa',
          color: isDark ? '#d4d4d4' : '#333',
          padding: 8,
          borderRadius: 4,
          minHeight: 200,
          maxHeight: 400,
          overflow: 'auto',
          border: `1px solid ${isDark ? '#404040' : '#d9d9d9'}`,
        }}>
          {result.logs.map((log, index) => (
            <div key={index} style={{ whiteSpace: 'pre-wrap', marginBottom: 2 }}>
              <span style={{ color: '#999', marginRight: 8 }}>{`[${index}]`}</span>
              {log}
            </div>
          ))}
        </div>
      ) : (
        <Text type="secondary">运行函数后查看日志</Text>
      ),
    },
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 标题栏 */}
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
        fontSize: 14,
        fontWeight: 500,
      }}>
        调试
      </div>

      {/* 操作按钮 */}
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
      }}>
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleRun}
            loading={running || compiling}
            disabled={!current}
          >
            {compiling ? '编译中' : running ? '运行中' : '运行'}
          </Button>
          <Button
            icon={<SaveOutlined />}
            onClick={handleSave}
            disabled={!current}
          >
            保存
          </Button>
          <Button
            icon={<ClearOutlined />}
            onClick={clearResult}
            disabled={!result}
          >
            清除
          </Button>
        </Space>
      </div>

      {/* Tabs 内容 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 8px' }}>
        <Tabs
          items={tabItems}
          size="small"
          style={{ height: '100%' }}
        />
      </div>
    </div>
  )
}
