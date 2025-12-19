import client from './client'

export interface TreeNode {
  key: string
  title: string
  isFolder: boolean
  path: string
  published?: boolean
  children?: TreeNode[]
}

export interface Folder {
  _id: string
  name: string
  parentId?: string
  path: string
  order: number
  createdAt: string
}

interface TreeResponse {
  success: boolean
  data: TreeNode[]
}

interface FolderResponse {
  success: boolean
  data: Folder
}

interface MoveResponse {
  success: boolean
  data: { newPath: string; newUrl?: string }
}

export const folderApi = {
  // 获取文件夹树 (包含文件夹和函数)
  getTree: () => client.get<TreeResponse>('/api/folders'),

  // 创建文件夹
  create: (name: string, parentId?: string) =>
    client.post<FolderResponse>('/api/folders', { name, parentId }),

  // 重命名文件夹
  rename: (id: string, name: string) =>
    client.patch<{ success: boolean }>(`/api/folders/${id}`, { name }),

  // 删除文件夹
  remove: (id: string) =>
    client.delete<{ success: boolean }>(`/api/folders/${id}`),

  // 移动文件夹
  moveFolder: (id: string, parentId?: string) =>
    client.post<MoveResponse>(`/api/folders/${id}/move`, { parentId }),

  // 移动函数到文件夹
  moveFunction: (functionId: string, folderId?: string) =>
    client.post<MoveResponse>(`/api/functions/${functionId}/move`, { folderId }),

  // 批量移动函数
  batchMoveFunctions: (functionIds: string[], folderId?: string) =>
    client.post<{ success: boolean }>('/api/functions/batch-move', { functionIds, folderId }),

  // 调整排序
  reorder: (orders: Array<{ id: string; order: number; isFolder: boolean }>) =>
    client.post<{ success: boolean }>('/api/functions/reorder', { orders }),
}
