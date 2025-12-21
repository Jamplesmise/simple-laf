import type { CloudFunction } from '../../stores/function'
import type { FolderNode } from './types'

export function buildFolderTree(functions: CloudFunction[]): FolderNode {
  const root: FolderNode = { name: '', path: '', children: [], functions: [] }

  functions.forEach((fn) => {
    const parts = fn.name.split('/')
    let current = root

    if (parts.length === 1) {
      root.functions.push(fn)
    } else {
      // 遍历路径创建文件夹节点
      for (let i = 0; i < parts.length - 1; i++) {
        const folderName = parts[i]
        const folderPath = parts.slice(0, i + 1).join('/')
        let folder = current.children.find((c) => c.name === folderName)
        if (!folder) {
          folder = { name: folderName, path: folderPath, children: [], functions: [] }
          current.children.push(folder)
        }
        current = folder
      }
      current.functions.push(fn)
    }
  })

  return root
}
