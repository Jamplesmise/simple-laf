/**
 * 请求面板组件
 *
 * 接口调试面板，支持测试输入持久化
 * Sprint 19: 测试基础
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button, Input, Tabs, Select, Space, message, Tooltip } from 'antd'
import { PlayCircleOutlined, SaveOutlined, CloudUploadOutlined } from '@ant-design/icons'
import { useFunctionStore } from '../stores/function'
import { useThemeStore } from '../stores/theme'
import { functionApi } from '../api/functions'
import { invokeApi } from '../api/invoke'
import type { InvokeResult } from '../api/invoke'

const { TextArea } = Input

interface RequestPanelProps {
  onResult: (result: InvokeResult) => void
}

export default function RequestPanel({ onResult }: RequestPanelProps) {
  const { current } = useFunctionStore()
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  const [method, setMethod] = useState<string>('POST')
  const [requestBody, setRequestBody] = useState('{}')
  const [queryParams, setQueryParams] = useState('')
  const [headers, setHeaders] = useState('{}')
  const [running, setRunning] = useState(false)
  const [compiling, setCompiling] = useState(false)
  const [saving, setSaving] = useState(false)

  // 跟踪是否有未保存的更改
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const lastLoadedRef = useRef<string | null>(null)

  // 加载函数的测试输入
  const loadTestInput = useCallback(async (functionId: string) => {
    try {
      const res = await functionApi.getTestInput(functionId)
      if (res.data.data) {
        const input = res.data.data
        setMethod(input.method || 'POST')
        setRequestBody(input.body || '{}')
        setQueryParams(input.query || '')
        setHeaders(input.headers || '{}')
        lastLoadedRef.current = functionId
        setHasUnsavedChanges(false)
      } else {
        // 没有保存的测试输入，使用默认值
        setMethod('POST')
        setRequestBody('{}')
        setQueryParams('')
        setHeaders('{}')
        lastLoadedRef.current = functionId
        setHasUnsavedChanges(false)
      }
    } catch {
      // 加载失败时使用默认值
      setMethod('POST')
      setRequestBody('{}')
      setQueryParams('')
      setHeaders('{}')
    }
  }, [])

  // 当选中的函数变化时加载测试输入
  useEffect(() => {
    if (current && current._id !== lastLoadedRef.current) {
      loadTestInput(current._id)
    }
  }, [current, loadTestInput])

  // 保存测试输入
  const handleSaveTestInput = useCallback(async () => {
    if (!current) return

    setSaving(true)
    try {
      await functionApi.saveTestInput(current._id, {
        method,
        body: requestBody,
        query: queryParams,
        headers,
      })
      setHasUnsavedChanges(false)
      message.success('测试输入已保存')
    } catch {
      message.error('保存测试输入失败')
    } finally {
      setSaving(false)
    }
  }, [current, method, requestBody, queryParams, headers])

  // 标记有未保存的更改
  const handleInputChange = useCallback((
    setter: React.Dispatch<React.SetStateAction<string>>,
    value: string
  ) => {
    setter(value)
    setHasUnsavedChanges(true)
  }, [])

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

      const invokeResult = await invokeApi.run(current.path || current.name, body)
      onResult(invokeResult)

      // 运行成功后自动保存测试输入（如果有更改）
      if (hasUnsavedChanges) {
        handleSaveTestInput()
      }
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
      message.success('代码保存成功')
    } catch {
      message.error('保存失败')
    }
  }

  const tabItems = [
    {
      key: 'query',
      label: 'Query',
      children: (
        <TextArea
          value={queryParams}
          onChange={(e) => handleInputChange(setQueryParams, e.target.value)}
          placeholder="key=value&#10;key2=value2"
          style={{ fontFamily: 'monospace', height: 120 }}
        />
      ),
    },
    {
      key: 'body',
      label: 'Body',
      children: (
        <TextArea
          value={requestBody}
          onChange={(e) => handleInputChange(setRequestBody, e.target.value)}
          placeholder='{"key": "value"}'
          style={{ fontFamily: 'monospace', height: 120 }}
        />
      ),
    },
    {
      key: 'headers',
      label: 'Headers',
      children: (
        <TextArea
          value={headers}
          onChange={(e) => handleInputChange(setHeaders, e.target.value)}
          placeholder='{"Content-Type": "application/json"}'
          style={{ fontFamily: 'monospace', height: 120 }}
        />
      ),
    },
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 标题栏 */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
          fontSize: 13,
          fontWeight: 500,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>接口调试</span>
        {hasUnsavedChanges && (
          <span style={{ fontSize: 11, color: '#faad14' }}>未保存</span>
        )}
      </div>

      {/* 请求方法和运行按钮 */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
        }}
      >
        <Space style={{ width: '100%' }}>
          <Select
            value={method}
            onChange={(v) => handleInputChange(setMethod, v)}
            style={{ width: 90 }}
            size="small"
            options={[
              { value: 'GET', label: 'GET' },
              { value: 'POST', label: 'POST' },
              { value: 'PUT', label: 'PUT' },
              { value: 'DELETE', label: 'DELETE' },
              { value: 'PATCH', label: 'PATCH' },
            ]}
          />
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleRun}
            loading={running || compiling}
            disabled={!current}
            size="small"
          >
            运行
          </Button>
          <Button
            icon={<SaveOutlined />}
            onClick={handleSave}
            disabled={!current}
            size="small"
          >
            保存
          </Button>
          <Tooltip title="保存测试输入">
            <Button
              icon={<CloudUploadOutlined />}
              onClick={handleSaveTestInput}
              loading={saving}
              disabled={!current || !hasUnsavedChanges}
              size="small"
            />
          </Tooltip>
        </Space>
      </div>

      {/* 参数设置 Tabs */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 8px' }}>
        <Tabs items={tabItems} size="small" />
      </div>
    </div>
  )
}
