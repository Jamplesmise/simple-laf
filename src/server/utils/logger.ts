/**
 * Simple logger utility that respects NODE_ENV
 * - In production: only errors and warnings are logged
 * - In development: all logs are shown
 */

const isProduction = process.env.NODE_ENV === 'production'
const isDebug = process.env.DEBUG === 'true'

export const logger = {
  // Always log errors
  error: (...args: unknown[]) => {
    console.error(...args)
  },

  // Always log warnings
  warn: (...args: unknown[]) => {
    console.warn(...args)
  },

  // Log info in non-production or when DEBUG=true
  info: (...args: unknown[]) => {
    if (!isProduction || isDebug) {
      console.log(...args)
    }
  },

  // Log debug only in development or when DEBUG=true
  debug: (...args: unknown[]) => {
    if (!isProduction || isDebug) {
      console.log('[DEBUG]', ...args)
    }
  },

  // Log startup messages (always, but could be configured)
  startup: (...args: unknown[]) => {
    console.log(...args)
  },
}

export default logger
