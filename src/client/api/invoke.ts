import axios from 'axios'
import pako from 'pako'
import { useAuthStore } from '../stores/auth'

// invoke 使用独立的 axios 实例，不自动跳转登录
const invokeClient = axios.create({
  baseURL: '',
  timeout: 30000,
})

invokeClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

interface InvokeResponse {
  success: boolean
  data: unknown
  error?: {
    code: string
    message: string
  }
}

export interface InvokeResult {
  success: boolean
  data: unknown
  logs: string[]
  time: number
  error?: string
}

export const invokeApi = {
  run: async (name: string, body: unknown): Promise<InvokeResult> => {
    try {
      const response = await invokeClient.post<InvokeResponse>(
        `/invoke/${name}`,
        body
      )

      // 解析日志
      const logsHeader = response.headers['x-function-logs']
      let logs: string[] = []
      if (logsHeader) {
        try {
          const compressed = Uint8Array.from(atob(logsHeader), (c) =>
            c.charCodeAt(0)
          )
          const decompressed = pako.ungzip(compressed, { to: 'string' })
          logs = JSON.parse(decompressed)
        } catch {
          // 日志解析失败
        }
      }

      // 执行时间
      const time = parseInt(response.headers['x-execution-time'] || '0', 10)

      return {
        success: response.data.success,
        data: response.data.data,
        logs,
        time,
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } }; message?: string }
      return {
        success: false,
        data: null,
        logs: [],
        time: 0,
        error: err.response?.data?.error?.message || err.message || '执行失败',
      }
    }
  },
}
