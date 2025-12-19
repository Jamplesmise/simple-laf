import client from './client'

export interface EnvVariable {
  key: string
  value: string
  description?: string
}

interface ListResponse {
  success: boolean
  data: EnvVariable[]
}

export const envApi = {
  list: () => client.get<ListResponse>('/api/env'),

  set: (key: string, value: string, description?: string) =>
    client.put<{ success: boolean }>(`/api/env/${key}`, { value, description }),

  remove: (key: string) =>
    client.delete<{ success: boolean }>(`/api/env/${key}`),

  bulkUpdate: (variables: Array<{ key: string; value: string }>) =>
    client.post<{ success: boolean }>('/api/env/bulk', { variables }),
}
