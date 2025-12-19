/**
 * 参数编辑器组件
 *
 * 支持 Body/Query/Headers 三种参数类型
 * 支持 Form 和 JSON 两种编辑模式
 */

import { useState } from 'react'
import { Input } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useThemeColors } from '@/hooks/useTheme'
import type { FormDataItem } from './utils'
import { codeFont } from './utils'

const { TextArea } = Input

// 分段控制器组件
interface SegmentedControlProps {
  options: { label: string; value: string }[]
  value: string
  onChange: (v: string) => void
}

function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  return (
    <div style={{
      display: 'inline-flex',
      background: '#f3f4f6',
      borderRadius: 8,
      padding: 3,
    }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            border: 'none',
            background: value === opt.value ? '#fff' : 'transparent',
            color: value === opt.value ? '#059669' : '#6b7280',
            fontWeight: value === opt.value ? 600 : 400,
            fontSize: 12,
            padding: '5px 14px',
            borderRadius: 6,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: value === opt.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// 单行输入组件
interface FormRowProps {
  item: FormDataItem
  index: number
  type: 'query' | 'body' | 'headers'
  isLast: boolean
  onUpdate: (type: 'query' | 'body' | 'headers', index: number, field: 'key' | 'value', val: string) => void
  onRemove: (type: 'query' | 'body' | 'headers', index: number) => void
}

function FormRow({ item, index, type, isLast, onUpdate, onRemove }: FormRowProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 40,
        borderBottom: !isLast ? '1px solid #f3f4f6' : 'none',
        background: isHovered ? '#f9fafb' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      {/* Key 输入 */}
      <div style={{
        flex: 1,
        height: '100%',
        borderRight: '1px solid #f3f4f6',
      }}>
        <input
          type="text"
          placeholder="key"
          defaultValue={item.key}
          onBlur={(e) => onUpdate(type, index, 'key', e.target.value)}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            padding: '0 12px',
            fontFamily: codeFont,
            fontSize: 13,
            color: '#374151',
          }}
        />
      </div>

      {/* Value 输入 */}
      <div style={{ flex: 1, height: '100%' }}>
        <input
          type="text"
          placeholder="value"
          defaultValue={item.value}
          onBlur={(e) => onUpdate(type, index, 'value', e.target.value)}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            padding: '0 12px',
            fontFamily: codeFont,
            fontSize: 13,
            color: '#374151',
          }}
        />
      </div>

      {/* 删除按钮 */}
      <div style={{
        width: 32,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span
          onClick={() => onRemove(type, index)}
          style={{
            color: '#ef4444',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.15s',
            borderRadius: 4,
          }}
        >
          <DeleteOutlined style={{ fontSize: 12 }} />
        </span>
      </div>
    </div>
  )
}

// Form 数据编辑器组件
interface FormDataEditorProps {
  type: 'query' | 'body' | 'headers'
  data: FormDataItem[]
  onAdd: (type: 'query' | 'body' | 'headers') => void
  onUpdate: (type: 'query' | 'body' | 'headers', index: number, field: 'key' | 'value', val: string) => void
  onRemove: (type: 'query' | 'body' | 'headers', index: number) => void
}

function FormDataEditor({ type, data, onAdd, onUpdate, onRemove }: FormDataEditorProps) {
  const placeholderText = type === 'headers' ? 'Add header...' : type === 'query' ? 'Add param...' : 'Add field...'

  return (
    <div style={{
      background: '#fff',
      borderRadius: 8,
      border: '1px solid #e5e7eb',
      overflow: 'hidden',
    }}>
      {/* 表头 */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #f3f4f6',
        padding: '8px 0',
        background: '#f9fafb',
      }}>
        <div style={{
          flex: 1,
          paddingLeft: 12,
          fontSize: 11,
          fontWeight: 600,
          color: '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Key
        </div>
        <div style={{
          flex: 1,
          paddingLeft: 12,
          fontSize: 11,
          fontWeight: 600,
          color: '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Value
        </div>
        <div style={{ width: 32 }} />
      </div>

      {/* 数据行 */}
      {data.map((item, index) => (
        <FormRow
          key={`${type}-${index}`}
          item={item}
          index={index}
          type={type}
          isLast={index === data.length - 1}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      ))}

      {/* 添加按钮 */}
      <div
        onClick={() => onAdd(type)}
        style={{
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          borderTop: '1px dashed #e5e7eb',
          color: '#9ca3af',
          fontSize: 12,
          transition: 'color 0.15s, background 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#059669'
          e.currentTarget.style.background = '#f0fdf4'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#9ca3af'
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <PlusOutlined style={{ marginRight: 4, fontSize: 11 }} />
        {placeholderText}
      </div>
    </div>
  )
}

// Tab 导航组件
interface TabNavigationProps {
  activeTab: string
  onChange: (tab: string) => void
}

function TabNavigation({ activeTab, onChange }: TabNavigationProps) {
  return (
    <div style={{
      display: 'flex',
      gap: 4,
      borderBottom: '1px solid #e5e7eb',
      marginBottom: 16,
    }}>
      {['body', 'query', 'headers'].map(tab => {
        const isActive = activeTab === tab
        const label = tab.charAt(0).toUpperCase() + tab.slice(1)
        return (
          <div
            key={tab}
            onClick={() => onChange(tab)}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#059669' : '#6b7280',
              position: 'relative',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = '#374151'
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.color = '#6b7280'
            }}
          >
            {label}
            {/* Active Bar */}
            {isActive && (
              <div style={{
                position: 'absolute',
                bottom: -1,
                left: 8,
                right: 8,
                height: 2,
                background: '#10B981',
                borderRadius: 1,
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// 参数编辑器主组件
interface ParamsEditorProps {
  paramsTab: string
  onParamsTabChange: (tab: string) => void
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

export function ParamsEditor({
  paramsTab,
  onParamsTabChange,
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
}: ParamsEditorProps) {
  useThemeColors() // for theme consistency

  const jsonTextAreaStyle = {
    fontFamily: codeFont,
    fontSize: 13,
    lineHeight: 1.6,
    padding: 12,
    background: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 8,
    resize: 'vertical' as const,
    color: '#374151',
  }

  return (
    <div style={{
      background: '#fff',
      borderRadius: 10,
      border: '1px solid #e5e7eb',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      overflow: 'hidden',
    }}>
      {/* Tab 导航 */}
      <div style={{ padding: '12px 16px 0' }}>
        <TabNavigation activeTab={paramsTab} onChange={onParamsTabChange} />
      </div>

      {/* Tab 内容 */}
      <div style={{ padding: '0 16px 16px' }}>
        {/* Query 内容 */}
        {paramsTab === 'query' && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <SegmentedControl
                options={[
                  { label: 'Form', value: 'form' },
                  { label: 'Text', value: 'text' },
                ]}
                value={queryType}
                onChange={(v) => onQueryTypeChange(v as 'form' | 'text')}
              />
            </div>
            {queryType === 'text' ? (
              <TextArea
                value={queryParams}
                onChange={(e) => onQueryParamsChange(e.target.value)}
                placeholder="key=value&#10;name=test"
                style={{ ...jsonTextAreaStyle, height: 120 }}
              />
            ) : (
              <FormDataEditor
                type="query"
                data={queryFormData}
                onAdd={onAddFormItem}
                onUpdate={onUpdateFormItem}
                onRemove={onRemoveFormItem}
              />
            )}
          </div>
        )}

        {/* Body 内容 */}
        {paramsTab === 'body' && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <SegmentedControl
                options={[
                  { label: 'Form', value: 'form' },
                  { label: 'JSON', value: 'json' },
                ]}
                value={bodyType}
                onChange={(v) => onBodyTypeChange(v as 'form' | 'json')}
              />
            </div>
            {bodyType === 'json' ? (
              <TextArea
                value={requestBody}
                onChange={(e) => onRequestBodyChange(e.target.value)}
                placeholder='{"key": "value"}'
                style={{ ...jsonTextAreaStyle, height: 120 }}
              />
            ) : (
              <FormDataEditor
                type="body"
                data={bodyFormData}
                onAdd={onAddFormItem}
                onUpdate={onUpdateFormItem}
                onRemove={onRemoveFormItem}
              />
            )}
          </div>
        )}

        {/* Headers 内容 */}
        {paramsTab === 'headers' && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <SegmentedControl
                options={[
                  { label: 'Form', value: 'form' },
                  { label: 'JSON', value: 'json' },
                ]}
                value={headersType}
                onChange={(v) => onHeadersTypeChange(v as 'form' | 'json')}
              />
            </div>
            {headersType === 'json' ? (
              <TextArea
                value={headers}
                onChange={(e) => onHeadersChange(e.target.value)}
                placeholder='{"Content-Type": "application/json"}'
                style={{ ...jsonTextAreaStyle, height: 120 }}
              />
            ) : (
              <FormDataEditor
                type="headers"
                data={headersFormData}
                onAdd={onAddFormItem}
                onUpdate={onUpdateFormItem}
                onRemove={onRemoveFormItem}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
