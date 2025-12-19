/**
 * 请求参数状态管理 Hook
 */

import { useState, useEffect, useCallback } from 'react'
import type { FormDataItem, RequestParamsState } from '../utils'
import { getDefaultRequestParams, loadRequestParams, saveRequestParams, formDataToObject } from '../utils'

interface UseRequestParamsOptions {
  functionId: string | undefined
}

export function useRequestParams({ functionId }: UseRequestParamsOptions) {
  // 基础状态
  const [method, setMethod] = useState('POST')
  const [queryType, setQueryType] = useState<'text' | 'form'>('form')
  const [queryParams, setQueryParams] = useState('')
  const [queryFormData, setQueryFormData] = useState<FormDataItem[]>([{ key: '', value: '' }])
  const [bodyType, setBodyType] = useState<'json' | 'form'>('json')
  const [requestBody, setRequestBody] = useState('{}')
  const [bodyFormData, setBodyFormData] = useState<FormDataItem[]>([{ key: '', value: '' }])
  const [headersType, setHeadersType] = useState<'json' | 'form'>('json')
  const [headers, setHeaders] = useState('{}')
  const [headersFormData, setHeadersFormData] = useState<FormDataItem[]>([{ key: '', value: '' }])

  // 从 localStorage 加载或重置参数
  useEffect(() => {
    if (!functionId) return

    const saved = loadRequestParams(functionId)
    if (saved) {
      setMethod(saved.method)
      setQueryType(saved.queryType)
      setQueryParams(saved.queryParams)
      setQueryFormData(saved.queryFormData)
      setBodyType(saved.bodyType)
      setRequestBody(saved.requestBody)
      setBodyFormData(saved.bodyFormData)
      setHeadersType(saved.headersType)
      setHeaders(saved.headers)
      setHeadersFormData(saved.headersFormData)
    } else {
      const defaults = getDefaultRequestParams()
      setMethod(defaults.method)
      setQueryType(defaults.queryType)
      setQueryParams(defaults.queryParams)
      setQueryFormData(defaults.queryFormData)
      setBodyType(defaults.bodyType)
      setRequestBody(defaults.requestBody)
      setBodyFormData(defaults.bodyFormData)
      setHeadersType(defaults.headersType)
      setHeaders(defaults.headers)
      setHeadersFormData(defaults.headersFormData)
    }
  }, [functionId])

  // 保存参数
  const save = useCallback(() => {
    if (!functionId) return

    const params: RequestParamsState = {
      method,
      queryType,
      queryParams,
      queryFormData,
      bodyType,
      requestBody,
      bodyFormData,
      headersType,
      headers,
      headersFormData,
    }
    saveRequestParams(functionId, params)
  }, [functionId, method, queryType, queryParams, queryFormData, bodyType, requestBody, bodyFormData, headersType, headers, headersFormData])

  // 获取请求体对象
  const getBodyObject = useCallback((): Record<string, unknown> | null => {
    if (bodyType === 'json') {
      try {
        return JSON.parse(requestBody)
      } catch {
        return null
      }
    }
    return formDataToObject(bodyFormData)
  }, [bodyType, requestBody, bodyFormData])

  // 添加表单项
  const addFormItem = useCallback((type: 'query' | 'body' | 'headers') => {
    if (type === 'query') {
      setQueryFormData(prev => [...prev, { key: '', value: '' }])
    } else if (type === 'body') {
      setBodyFormData(prev => [...prev, { key: '', value: '' }])
    } else {
      setHeadersFormData(prev => [...prev, { key: '', value: '' }])
    }
  }, [])

  // 删除表单项
  const removeFormItem = useCallback((type: 'query' | 'body' | 'headers', index: number) => {
    const removeItem = (prev: FormDataItem[]) => {
      const newData = prev.filter((_, i) => i !== index)
      return newData.length ? newData : [{ key: '', value: '' }]
    }

    if (type === 'query') {
      setQueryFormData(removeItem)
    } else if (type === 'body') {
      setBodyFormData(removeItem)
    } else {
      setHeadersFormData(removeItem)
    }
  }, [])

  // 更新表单项
  const updateFormItem = useCallback((type: 'query' | 'body' | 'headers', index: number, field: 'key' | 'value', val: string) => {
    const updateItem = (prev: FormDataItem[]) => {
      const newData = [...prev]
      newData[index] = { ...newData[index], [field]: val }
      return newData
    }

    if (type === 'query') {
      setQueryFormData(updateItem)
    } else if (type === 'body') {
      setBodyFormData(updateItem)
    } else {
      setHeadersFormData(updateItem)
    }
  }, [])

  return {
    // 状态
    method,
    queryType,
    queryParams,
    queryFormData,
    bodyType,
    requestBody,
    bodyFormData,
    headersType,
    headers,
    headersFormData,
    // 设置方法
    setMethod,
    setQueryType,
    setQueryParams,
    setQueryFormData,
    setBodyType,
    setRequestBody,
    setBodyFormData,
    setHeadersType,
    setHeaders,
    setHeadersFormData,
    // 操作方法
    save,
    getBodyObject,
    addFormItem,
    removeFormItem,
    updateFormItem,
  }
}
