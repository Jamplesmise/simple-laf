export {
  setupMonitorWebSocket,
  broadcastExecutionEvent,
  broadcastErrorEvent,
  getIO,
  getConnectionStats,
  type MonitorEvent,
} from './websocket.js'

export {
  getErrorSummary,
  getFunctionErrors,
  getErrorSummaryForAI,
  type ErrorGroup,
  type ErrorTrend,
  type ErrorSummary,
} from './errorAggregator.js'
