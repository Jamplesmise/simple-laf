import FunctionTree from '../../components/FunctionTree'
import DependencyPanel from '../../components/DependencyPanel'
import Editor from '../../components/Editor'
import EditorTabs from '../../components/EditorTabs'
import RightPanel from '../../components/RightPanel'
import ResultPanel from '../../components/ResultPanel'
import ConsolePanel from '../../components/ConsolePanel'
import { useThemeStore } from '../../stores/theme'
import { emerald } from './constants'
import type { InvokeResult } from '../../api/invoke'
import type { ResizableState, ResizableHandlers } from './types'

interface FunctionsViewProps extends ResizableState, ResizableHandlers {
  result: InvokeResult | null
  logs: string[]
  onResult: (res: InvokeResult) => void
  onClearLogs: () => void
}

export default function FunctionsView({
  leftWidth,
  rightWidth,
  bottomHeight,
  leftBottomHeight,
  rightBottomHeight,
  isResizing,
  bottomCollapsed,
  leftBottomCollapsed,
  rightBottomCollapsed,
  result,
  logs,
  handleMouseDown,
  toggleBottomCollapse,
  toggleLeftBottomCollapse,
  toggleRightBottomCollapse,
  onResult,
  onClearLogs,
}: FunctionsViewProps) {
  const mode = useThemeStore((state) => state.mode)
  const isDark = mode === 'dark'

  // 拖拽手柄样式
  const resizeHandle = (direction: 'vertical' | 'horizontal', key: string) => ({
    width: direction === 'vertical' ? 4 : '100%',
    height: direction === 'horizontal' ? 4 : '100%',
    cursor: direction === 'vertical' ? 'col-resize' : 'row-resize',
    background: isResizing === key ? emerald.primary : 'transparent',
    transition: 'background 0.15s',
    flexShrink: 0,
  })

  return (
    <>
      {/* 左侧边栏：函数列表 + 依赖 */}
      <div
        id="left-panel"
        style={{
          width: leftWidth,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: isDark ? '#1a1a1a' : '#fff',
          borderRight: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
        }}
      >
        {/* 函数树 */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <FunctionTree />
        </div>

        {/* 左侧依赖面板拖拽手柄 */}
        <div
          style={resizeHandle('horizontal', 'left-bottom')}
          onMouseDown={() => handleMouseDown('left-bottom')}
          onMouseEnter={(e) => (e.currentTarget.style.background = emerald.primary)}
          onMouseLeave={(e) => {
            if (isResizing !== 'left-bottom') e.currentTarget.style.background = 'transparent'
          }}
        />

        {/* 依赖面板 */}
        <div
          style={{
            height: leftBottomHeight,
            flexShrink: 0,
            overflow: 'auto',
            borderTop: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
          }}
        >
          <DependencyPanel collapsed={leftBottomCollapsed} onToggle={toggleLeftBottomCollapse} />
        </div>
      </div>

      {/* 左侧拖拽手柄 */}
      <div
        style={resizeHandle('vertical', 'left')}
        onMouseDown={() => handleMouseDown('left')}
        onMouseEnter={(e) => (e.currentTarget.style.background = emerald.primary)}
        onMouseLeave={(e) => {
          if (isResizing !== 'left') e.currentTarget.style.background = 'transparent'
        }}
      />

      {/* 中间：编辑器 + Console */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* 编辑器标签页 */}
        <EditorTabs />

        {/* 编辑器 */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <Editor />
        </div>

        {/* 底部拖拽手柄 */}
        <div
          style={resizeHandle('horizontal', 'bottom')}
          onMouseDown={() => handleMouseDown('bottom')}
          onMouseEnter={(e) => (e.currentTarget.style.background = emerald.primary)}
          onMouseLeave={(e) => {
            if (isResizing !== 'bottom') e.currentTarget.style.background = 'transparent'
          }}
        />

        {/* Console */}
        <div
          style={{
            height: bottomHeight,
            flexShrink: 0,
            background: isDark ? '#1a1a1a' : '#fff',
          }}
        >
          <ConsolePanel logs={logs} onClear={onClearLogs} collapsed={bottomCollapsed} onToggle={toggleBottomCollapse} />
        </div>
      </div>

      {/* 右侧拖拽手柄 */}
      <div
        style={resizeHandle('vertical', 'right')}
        onMouseDown={() => handleMouseDown('right')}
        onMouseEnter={(e) => (e.currentTarget.style.background = emerald.primary)}
        onMouseLeave={(e) => {
          if (isResizing !== 'right') e.currentTarget.style.background = 'transparent'
        }}
      />

      {/* 右侧：调试面板 + 运行结果 */}
      <div
        id="right-panel"
        style={{
          width: rightWidth,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: isDark ? '#1a1a1a' : '#fff',
          borderLeft: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
        }}
      >
        {/* 接口调试 / 版本历史 */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <RightPanel onResult={onResult} />
        </div>

        {/* 右侧中间拖拽手柄 */}
        <div
          style={resizeHandle('horizontal', 'right-middle')}
          onMouseDown={() => handleMouseDown('right-middle')}
          onMouseEnter={(e) => (e.currentTarget.style.background = emerald.primary)}
          onMouseLeave={(e) => {
            if (isResizing !== 'right-middle') e.currentTarget.style.background = 'transparent'
          }}
        />

        {/* 运行结果 */}
        <div
          style={{
            height: rightBottomHeight,
            flexShrink: 0,
            overflow: 'hidden',
            borderTop: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
          }}
        >
          <ResultPanel result={result} collapsed={rightBottomCollapsed} onToggle={toggleRightBottomCollapse} />
        </div>
      </div>
    </>
  )
}
