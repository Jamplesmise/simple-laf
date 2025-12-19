/**
 * RightPanel 工具函数和类型定义
 */

// Form data 项类型
export interface FormDataItem {
  key: string
  value: string
}

// 请求参数状态
export interface RequestParamsState {
  method: string
  queryType: 'text' | 'form'
  queryParams: string
  queryFormData: FormDataItem[]
  bodyType: 'json' | 'form'
  requestBody: string
  bodyFormData: FormDataItem[]
  headersType: 'json' | 'form'
  headers: string
  headersFormData: FormDataItem[]
}

// HTTP 方法对应的颜色
export const methodColors: Record<string, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  DELETE: '#f93e3e',
}

// 代码字体
export const codeFont = '"JetBrains Mono", "SF Mono", Monaco, Menlo, Consolas, monospace'

// 格式化日期
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 将 form data 转为对象
export function formDataToObject(items: FormDataItem[]): Record<string, string> {
  const obj: Record<string, string> = {}
  items.forEach(item => {
    if (item.key.trim()) {
      obj[item.key.trim()] = item.value
    }
  })
  return obj
}

// 获取存储 key
export function getStorageKey(fnId: string): string {
  return `simple-ide-request-${fnId}`
}

// 默认请求参数
export function getDefaultRequestParams(): RequestParamsState {
  return {
    method: 'POST',
    queryType: 'form',
    queryParams: '',
    queryFormData: [{ key: '', value: '' }],
    bodyType: 'json',
    requestBody: '{}',
    bodyFormData: [{ key: '', value: '' }],
    headersType: 'json',
    headers: '{}',
    headersFormData: [{ key: '', value: '' }],
  }
}

// 从 localStorage 加载请求参数
export function loadRequestParams(fnId: string): RequestParamsState | null {
  const saved = localStorage.getItem(getStorageKey(fnId))
  if (!saved) return null

  try {
    const data = JSON.parse(saved)
    return {
      method: data.method || 'POST',
      queryType: data.queryType || 'form',
      queryParams: data.queryParams ?? '',
      queryFormData: data.queryFormData || [{ key: '', value: '' }],
      bodyType: data.bodyType || 'json',
      requestBody: data.requestBody ?? '{}',
      bodyFormData: data.bodyFormData || [{ key: '', value: '' }],
      headersType: data.headersType || 'json',
      headers: data.headers ?? '{}',
      headersFormData: data.headersFormData || [{ key: '', value: '' }],
    }
  } catch {
    return null
  }
}

// 保存请求参数到 localStorage
export function saveRequestParams(fnId: string, params: RequestParamsState): void {
  localStorage.setItem(getStorageKey(fnId), JSON.stringify(params))
}
