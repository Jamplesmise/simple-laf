/**
 * 接口调试面板
 *
 * 包含方法选择、运行按钮和参数编辑器
 */

import { useState } from 'react'
import { Select, Button } from 'antd'
import { useThemeColors } from '@/hooks/useTheme'
import { ParamsEditor } from './ParamsEditor'
import type { FormDataItem } from './utils'
import { methodColors } from './utils'

interface DebugPanelProps {
  // 状态
  method: string
  running: boolean
  compiling: boolean
  disabled: boolean
  // 方法
  onMethodChange: (method: string) => void
  onRun: () => void
  // Query
  queryType: 'text' | 'form'
  queryParams: string
  queryFormData: FormDataItem[]
  onQueryTypeChange: (type: 'text' | 'form') => void
  onQueryParamsChange: (value: string) => void
  // Body
  bodyType: 'json' | 'form'
  requestBody: string
  bodyFormData: FormDataItem[]
  onBodyTypeChange: (type: 'json' | 'form') => void
  onRequestBodyChange: (value: string) => void
  // Headers
  headersType: 'json' | 'form'
  headers: string
  headersFormData: FormDataItem[]
  onHeadersTypeChange: (type: 'json' | 'form') => void
  onHeadersChange: (value: string) => void
  // Form 操作
  onAddFormItem: (type: 'query' | 'body' | 'headers') => void
  onUpdateFormItem: (type: 'query' | 'body' | 'headers', index: number, field: 'key' | 'value', val: string) => void
  onRemoveFormItem: (type: 'query' | 'body' | 'headers', index: number) => void
}

export function DebugPanel({
  method,
  running,
  compiling,
  disabled,
  onMethodChange,
  onRun,
  queryType,
  queryParams,
  queryFormData,
  onQueryTypeChange,
  onQueryParamsChange,
  bodyType,
  requestBody,
  bodyFormData,
  onBodyTypeChange,
  onRequestBodyChange,
  headersType,
  headers,
  headersFormData,
  onHeadersTypeChange,
  onHeadersChange,
  onAddFormItem,
  onUpdateFormItem,
  onRemoveFormItem,
}: DebugPanelProps) {
  useThemeColors() // for theme consistency
  const [paramsTab, setParamsTab] = useState('body')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      {/* 请求方法和按钮 */}
      <div style={{
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: '1px solid #e5e7eb',
        background: '#fff',
      }}>
        <Select
          value={method}
          onChange={onMethodChange}
          style={{ width: 110 }}
          options={[
            { value: 'GET', label: <span style={{ color: methodColors.GET, fontWeight: 600 }}>GET</span> },
            { value: 'POST', label: <span style={{ color: methodColors.POST, fontWeight: 600 }}>POST</span> },
            { value: 'PUT', label: <span style={{ color: methodColors.PUT, fontWeight: 600 }}>PUT</span> },
            { value: 'DELETE', label: <span style={{ color: methodColors.DELETE, fontWeight: 600 }}>DELETE</span> },
          ]}
        />
        <Button
          type="primary"
          onClick={onRun}
          loading={running || compiling}
          disabled={disabled}
          style={{
            background: disabled ? undefined : '#059669',
            borderColor: disabled ? undefined : '#059669',
            fontWeight: 600,
            paddingLeft: 20,
            paddingRight: 20,
            height: 32,
            borderRadius: 6,
          }}
        >
          运行
        </Button>
      </div>

      {/* 参数设置 */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: 12,
        background: '#f9fafb',
      }}>
        <ParamsEditor
          paramsTab={paramsTab}
          onParamsTabChange={setParamsTab}
          queryType={queryType}
          queryParams={queryParams}
          queryFormData={queryFormData}
          onQueryTypeChange={onQueryTypeChange}
          onQueryParamsChange={onQueryParamsChange}
          bodyType={bodyType}
          requestBody={requestBody}
          bodyFormData={bodyFormData}
          onBodyTypeChange={onBodyTypeChange}
          onRequestBodyChange={onRequestBodyChange}
          headersType={headersType}
          headers={headers}
          headersFormData={headersFormData}
          onHeadersTypeChange={onHeadersTypeChange}
          onHeadersChange={onHeadersChange}
          onAddFormItem={onAddFormItem}
          onUpdateFormItem={onUpdateFormItem}
          onRemoveFormItem={onRemoveFormItem}
        />
      </div>
    </div>
  )
}
