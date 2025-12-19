import axios, { AxiosError, AxiosRequestConfig } from 'axios'
import { message } from 'antd'
import { useAuthStore } from '../stores/auth'

const client = axios.create({
  baseURL: '',
  timeout: 30000,
})

// 重试配置
interface RetryConfig {
  retries?: number
  retryDelay?: number
  retryCondition?: (error: AxiosError) => boolean
}

// 默认重试条件：网络错误或 5xx 错误
const defaultRetryCondition = (error: AxiosError): boolean => {
  // 不重试客户端错误 (4xx)
  if (error.response && error.response.status >= 400 && error.response.status < 500) {
    return false
  }
  // 重试网络错误或服务器错误
  return !error.response || error.response.status >= 500
}

// 带重试的请求函数
export async function requestWithRetry<T>(
  config: AxiosRequestConfig,
  retryConfig: RetryConfig = {}
): Promise<T> {
  const { retries = 3, retryDelay = 1000, retryCondition = defaultRetryCondition } = retryConfig

  let lastError: AxiosError | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await client.request<T>(config)
      return response.data
    } catch (error) {
      lastError = error as AxiosError

      // 如果是最后一次尝试或不满足重试条件，抛出错误
      if (attempt >= retries || !retryCondition(lastError)) {
        throw lastError
      }

      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
    }
  }

  throw lastError
}

// 请求拦截器：添加 token
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 错误消息提取
function getErrorMessage(error: AxiosError): string {
  // 尝试从响应中提取错误消息
  const data = error.response?.data as { error?: { message?: string }; message?: string } | undefined
  if (data?.error?.message) {
    return data.error.message
  }
  if (data?.message) {
    return data.message
  }

  // 根据状态码返回默认消息
  switch (error.response?.status) {
    case 400:
      return '请求参数错误'
    case 401:
      return '登录已过期，请重新登录'
    case 403:
      return '没有权限执行此操作'
    case 404:
      return '请求的资源不存在'
    case 429:
      return '请求过于频繁，请稍后再试'
    case 500:
      return '服务器内部错误'
    case 502:
    case 503:
    case 504:
      return '服务器暂时不可用，请稍后再试'
    default:
      break
  }

  // 网络错误
  if (error.code === 'ECONNABORTED') {
    return '请求超时，请检查网络连接'
  }
  if (error.message === 'Network Error') {
    return '网络连接失败，请检查网络'
  }

  return '请求失败，请稍后再试'
}

// 响应拦截器：处理错误
client.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // 处理 401 未授权错误
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    // 显示错误消息（除非是登录相关页面的请求，让组件自己处理）
    const url = error.config?.url || ''
    const isAuthRequest = url.includes('/api/auth/')
    if (!isAuthRequest) {
      const errorMsg = getErrorMessage(error)
      message.error(errorMsg)
    }

    return Promise.reject(error)
  }
)

export default client
