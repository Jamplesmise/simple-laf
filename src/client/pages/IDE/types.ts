export interface ResizableState {
  leftWidth: number
  rightWidth: number
  bottomHeight: number
  leftBottomHeight: number
  rightBottomHeight: number
  isResizing: string | null
  bottomCollapsed: boolean
  leftBottomCollapsed: boolean
  rightBottomCollapsed: boolean
  prevBottomHeight: number
  prevLeftBottomHeight: number
  prevRightBottomHeight: number
}

export interface ResizableHandlers {
  handleMouseDown: (type: string) => void
  handleMouseMove: (e: React.MouseEvent) => void
  handleMouseUp: () => void
  toggleBottomCollapse: () => void
  toggleLeftBottomCollapse: () => void
  toggleRightBottomCollapse: () => void
}

export interface NavItem {
  key: string
  icon: React.ReactNode
  label: string
}

export interface ToolItem extends NavItem {
  onClick: () => void
}
