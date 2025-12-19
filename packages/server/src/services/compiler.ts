import ts from 'typescript'

export function compileTypeScript(code: string): string {
  const result = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      strict: false,
      esModuleInterop: true,
      skipLibCheck: true
    }
  })

  return result.outputText
}

export interface CompileResult {
  success: boolean
  compiled?: string
  error?: string
}

export function safeCompile(code: string): CompileResult {
  try {
    const compiled = compileTypeScript(code)
    return { success: true, compiled }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown compile error'
    return { success: false, error: message }
  }
}
