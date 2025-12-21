import type { CloudFunction } from '../../stores/function'

export interface FolderNode {
  name: string
  path: string
  children: FolderNode[]
  functions: CloudFunction[]
}
