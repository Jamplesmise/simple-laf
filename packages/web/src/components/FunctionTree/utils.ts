/**
 * FunctionTree 工具函数和常量
 */

import type { TreeNode } from '@/api/folders'

// 默认函数代码模板
export const DEFAULT_CODE = `import cloud from '@simple-ide/cloud'

export default async function (ctx: FunctionContext) {
  // 获取请求参数
  const { body, query } = ctx

  // 在这里编写你的业务逻辑
  console.log('Hello from cloud function!')

  return {
    message: 'Hello, World!',
    body,
    query
  }
}
`

// 查找节点
export function findNode(nodes: TreeNode[], key: string): TreeNode | null {
  for (const node of nodes) {
    if (node.key === key) return node
    if (node.children) {
      const found = findNode(node.children, key)
      if (found) return found
    }
  }
  return null
}

// 查找节点的父文件夹 ID
export function findParentFolderId(
  nodes: TreeNode[],
  key: string,
  parentId: string | null = null
): string | null {
  for (const node of nodes) {
    if (node.key === key) return parentId
    if (node.children) {
      const found = findParentFolderId(
        node.children,
        key,
        node.isFolder ? node.key : parentId
      )
      if (found !== undefined) return found
    }
  }
  return null
}

// 查找第一个函数节点（非文件夹）
export function findFirstFunction(nodes: TreeNode[]): TreeNode | null {
  for (const node of nodes) {
    if (!node.isFolder) return node
    if (node.children) {
      const found = findFirstFunction(node.children)
      if (found) return found
    }
  }
  return null
}
