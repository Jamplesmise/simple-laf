import type { Db, ObjectId } from 'mongodb'
import type { DebugTestCase, DebugTestResult, DebugFix, DebugStreamMessage } from './types.js'
import { chatStream } from './index.js'
import { getDefaultModel } from './provider.js'
import { compileTypeScript } from '../compiler.js'
import { executeFunction } from '../../engine/executor.js'
import { createCloud } from '../../cloud/index.js'
import * as envService from '../env.js'
import crypto from 'crypto'

/**
 * 构建测试生成 Prompt
 */
export function buildTestGenerationPrompt(code: string, functionName: string): string {
  return `分析以下云函数代码，生成测试用例来验证其功能正确性。

函数名: ${functionName}

代码:
\`\`\`typescript
${code}
\`\`\`

云函数上下文说明:
- ctx.body: 请求体 (可以是任何 JSON 值)
- ctx.query: URL 查询参数 (Record<string, string>)
- ctx.headers: HTTP 请求头 (Record<string, string>)
- ctx.cloud: Cloud SDK (包含 database(), invoke(), env)

请根据代码复杂度自行决定需要生成多少个测试用例（1-10个），应涵盖:
1. 正常输入的基础测试
2. 边界条件测试 (空值、null、undefined)
3. 错误处理测试 (无效输入)
4. 类型验证测试

简单函数可能只需要 2-3 个测试，复杂函数可能需要 7-10 个测试。请根据实际情况合理决定。

以 JSON 格式返回:
\`\`\`json
{
  "testCases": [
    {
      "id": "test-1",
      "name": "测试描述",
      "input": {
        "body": {},
        "query": {},
        "headers": {},
        "method": "POST"
      },
      "expectedBehavior": "期望的行为描述"
    }
  ]
}
\`\`\`

只返回 JSON，不要其他内容。`
}

/**
 * 构建诊断 Prompt
 */
export function buildDiagnosticPrompt(
  code: string,
  functionName: string,
  failedTests: DebugTestResult[]
): string {
  const failedTestsStr = failedTests.map(t => `
测试: ${t.testName}
输入: (见测试用例)
错误: ${t.error || '未知错误'}
日志: ${t.logs.join('\n') || '无'}
`).join('\n---\n')

  return `分析以下云函数的问题并提供修复方案。

函数名: ${functionName}

当前代码:
\`\`\`typescript
${code}
\`\`\`

失败的测试:
${failedTestsStr}

请分析问题并提供修复后的完整代码。

以 JSON 格式返回:
\`\`\`json
{
  "issue": "问题的简洁描述",
  "reason": "为什么需要这样修复的详细解释",
  "fixedCode": "修复后的完整代码 (保持原有的 import 和函数签名格式)"
}
\`\`\`

要求:
1. 保留原有的代码结构和风格
2. 只修复必要的问题
3. fixedCode 必须是完整可运行的代码
4. 确保修复能解决所有失败的测试用例

只返回 JSON，不要其他内容。`
}

/**
 * 解析测试用例 JSON
 */
export function parseTestCases(aiResponse: string): DebugTestCase[] {
  console.log('[DEBUG parseTestCases] 输入长度:', aiResponse.length)
  console.log('[DEBUG parseTestCases] 输入内容前500字符:', aiResponse.slice(0, 500))

  try {
    // 提取 JSON 块
    const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/)
    console.log('[DEBUG parseTestCases] JSON 块匹配结果:', jsonMatch ? '找到' : '未找到')

    const jsonStr = jsonMatch ? jsonMatch[1] : aiResponse
    console.log('[DEBUG parseTestCases] 要解析的 JSON 字符串前300字符:', jsonStr.slice(0, 300))

    const parsed = JSON.parse(jsonStr)
    console.log('[DEBUG parseTestCases] JSON 解析成功, keys:', Object.keys(parsed))

    const testCases = parsed.testCases || parsed
    console.log('[DEBUG parseTestCases] testCases 是数组:', Array.isArray(testCases), '长度:', Array.isArray(testCases) ? testCases.length : 'N/A')

    if (!Array.isArray(testCases)) {
      console.log('[DEBUG parseTestCases] testCases 不是数组，返回空')
      return []
    }

    const result = testCases.map((tc: Record<string, unknown>, index: number) => ({
      id: (tc.id as string) || `test-${index + 1}`,
      name: (tc.name as string) || `测试 ${index + 1}`,
      input: (tc.input as DebugTestCase['input']) || {},
      expectedBehavior: (tc.expectedBehavior as string) || ''
    }))

    console.log('[DEBUG parseTestCases] 解析成功，返回', result.length, '个测试用例')
    return result
  } catch (err) {
    console.log('[DEBUG parseTestCases] 解析异常:', err instanceof Error ? err.message : String(err))
    return []
  }
}

/**
 * 解析修复建议 JSON
 */
export function parseDebugFix(aiResponse: string, originalCode: string): DebugFix | null {
  try {
    // 提取 JSON 块
    const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/)
    const jsonStr = jsonMatch ? jsonMatch[1] : aiResponse

    const parsed = JSON.parse(jsonStr)

    if (!parsed.issue || !parsed.fixedCode) {
      return null
    }

    return {
      issue: parsed.issue,
      reason: parsed.reason || '',
      originalCode,
      fixedCode: parsed.fixedCode
    }
  } catch {
    return null
  }
}

/**
 * 执行单个测试用例
 */
export async function runTestCase(
  db: Db,
  userId: ObjectId,
  code: string,
  functionName: string,
  testCase: DebugTestCase
): Promise<DebugTestResult> {
  const startTime = Date.now()

  try {
    // 编译代码
    const compiled = compileTypeScript(code)
    const hash = crypto.createHash('md5').update(code).digest('hex')

    // 获取用户环境变量
    const userEnv = await envService.getEnvVariables(userId)
    const cloud = createCloud(userId.toString(), userEnv)

    // 构建上下文
    const ctx = {
      body: testCase.input.body,
      query: testCase.input.query || {},
      headers: testCase.input.headers || {},
      cloud,
      userId: userId.toString(),
    }

    // 执行函数
    const result = await executeFunction(functionName, compiled, hash, ctx)

    return {
      testCaseId: testCase.id,
      testName: testCase.name,
      success: !result.error,
      data: result.data,
      error: result.error,
      logs: result.logs,
      duration: Date.now() - startTime
    }
  } catch (err) {
    return {
      testCaseId: testCase.id,
      testName: testCase.name,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      logs: [],
      duration: Date.now() - startTime
    }
  }
}

/**
 * AI Debug 流式处理
 */
export async function* debugStream(
  db: Db,
  userId: ObjectId,
  functionId: ObjectId,
  modelId?: ObjectId
): AsyncGenerator<DebugStreamMessage, void, unknown> {
  // 获取函数信息
  const func = await db.collection('functions').findOne({
    _id: functionId,
    userId
  })

  if (!func) {
    yield { status: 'error', error: '函数不存在' }
    return
  }

  const functionName = func.name as string
  const code = func.code as string

  if (!code) {
    yield { status: 'error', error: '函数代码为空' }
    return
  }

  // 如果没有指定 modelId，尝试获取默认模型
  let effectiveModelId = modelId
  if (!effectiveModelId) {
    const defaultModel = await getDefaultModel(db, userId)
    if (defaultModel) {
      effectiveModelId = defaultModel._id
    }
  }

  // 阶段 1: 分析代码
  yield { status: 'analyzing', message: '正在分析函数代码...' }

  // 阶段 2: 生成测试用例
  yield { status: 'generating_tests', message: '正在生成测试用例...' }

  const testPrompt = buildTestGenerationPrompt(code, functionName)
  let testCasesResponse = ''

  console.log('[DEBUG debugStream] 开始生成测试用例')
  console.log('[DEBUG debugStream] effectiveModelId:', effectiveModelId?.toString())
  console.log('[DEBUG debugStream] functionName:', functionName)
  console.log('[DEBUG debugStream] code 长度:', code.length)

  try {
    let chunkCount = 0
    for await (const chunk of chatStream(
      userId,
      [
        { role: 'system', content: '你是一个云函数测试专家，擅长生成全面的测试用例。' },
        { role: 'user', content: testPrompt }
      ],
      { temperature: 0.3 },
      effectiveModelId
    )) {
      chunkCount++
      testCasesResponse += chunk
      if (chunkCount <= 3) {
        console.log('[DEBUG debugStream] chunk', chunkCount, ':', chunk.slice(0, 100))
      }
      yield { status: 'generating_tests', content: chunk }
    }
    console.log('[DEBUG debugStream] 共收到', chunkCount, '个 chunk')
    console.log('[DEBUG debugStream] 完整响应长度:', testCasesResponse.length)
    console.log('[DEBUG debugStream] 完整响应:', testCasesResponse)
  } catch (err) {
    console.log('[DEBUG debugStream] chatStream 异常:', err)
    yield { status: 'error', error: `生成测试用例失败: ${err instanceof Error ? err.message : String(err)}` }
    return
  }

  // 解析测试用例
  const testCases = parseTestCases(testCasesResponse)

  if (testCases.length === 0) {
    console.log('[DEBUG debugStream] 解析失败，testCasesResponse 完整内容:')
    console.log(testCasesResponse)
    yield { status: 'error', error: '无法解析测试用例' }
    return
  }

  yield { status: 'tests_generated', testCases, message: `已生成 ${testCases.length} 个测试用例` }

  // 阶段 3: 运行测试
  yield { status: 'running_tests', message: '正在运行测试...' }

  const testResults: DebugTestResult[] = []

  for (const testCase of testCases) {
    const result = await runTestCase(db, userId, code, functionName, testCase)
    testResults.push(result)
    yield { status: 'test_result', testResult: result }
  }

  // 检查是否有失败的测试
  const failedTests = testResults.filter(r => !r.success)

  if (failedTests.length === 0) {
    yield {
      status: 'all_tests_passed',
      testResults,
      message: '所有测试通过！'
    }
    yield { status: 'done', message: '调试完成，未发现问题' }
    return
  }

  // 阶段 4: 诊断问题
  yield {
    status: 'diagnosing',
    testResults,
    message: `${failedTests.length} 个测试失败，正在分析问题...`
  }

  const diagnosticPrompt = buildDiagnosticPrompt(code, functionName, failedTests)
  let diagnosticResponse = ''

  try {
    for await (const chunk of chatStream(
      userId,
      [
        { role: 'system', content: '你是一个云函数调试专家，擅长分析错误并提供精准的修复方案。' },
        { role: 'user', content: diagnosticPrompt }
      ],
      { temperature: 0.2 },
      effectiveModelId
    )) {
      diagnosticResponse += chunk
      yield { status: 'diagnosing', content: chunk }
    }
  } catch (err) {
    yield { status: 'error', error: `诊断失败: ${err instanceof Error ? err.message : String(err)}` }
    return
  }

  // 解析修复建议
  const fix = parseDebugFix(diagnosticResponse, code)

  if (!fix) {
    yield { status: 'error', error: '无法解析修复建议' }
    return
  }

  // 阶段 5: 提出修复
  yield {
    status: 'fix_proposed',
    fix,
    testResults,
    message: '已生成修复建议'
  }

  yield { status: 'done', message: '调试完成' }
}

/**
 * 应用修复
 */
export async function applyDebugFix(
  db: Db,
  userId: ObjectId,
  functionId: ObjectId,
  fixedCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 验证代码可以编译
    compileTypeScript(fixedCode)

    // 更新函数代码
    const result = await db.collection('functions').updateOne(
      { _id: functionId, userId },
      {
        $set: {
          code: fixedCode,
          updatedAt: new Date()
        }
      }
    )

    if (result.matchedCount === 0) {
      return { success: false, error: '函数不存在' }
    }

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '应用修复失败'
    }
  }
}
