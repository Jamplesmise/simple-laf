/**
 * 函数控制台 - 捕获函数内的 console 输出
 */
export class FunctionConsole {
  private logs: string[] = []

  private formatArgs(args: unknown[]): string {
    return args
      .map((a) => {
        if (a === undefined) return 'undefined'
        if (a === null) return 'null'
        if (typeof a === 'object') {
          try {
            return JSON.stringify(a, null, 2)
          } catch {
            return String(a)
          }
        }
        return String(a)
      })
      .join(' ')
  }

  log(...args: unknown[]): void {
    this.logs.push(this.formatArgs(args))
  }

  info(...args: unknown[]): void {
    this.logs.push('[INFO] ' + this.formatArgs(args))
  }

  warn(...args: unknown[]): void {
    this.logs.push('[WARN] ' + this.formatArgs(args))
  }

  error(...args: unknown[]): void {
    this.logs.push('[ERROR] ' + this.formatArgs(args))
  }

  debug(...args: unknown[]): void {
    this.logs.push('[DEBUG] ' + this.formatArgs(args))
  }

  getLogs(): string[] {
    return [...this.logs]
  }

  clear(): void {
    this.logs = []
  }
}
