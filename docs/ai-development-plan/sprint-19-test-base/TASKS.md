# Sprint 19: 测试基础 - 任务清单

## 任务概览

| 任务 | 轨道 | 优先级 | 预估 | 依赖 |
|------|------|-------|------|------|
| 19.1.1 测试运行工具 | 后端 | P0 | 3h | 无 |
| 19.1.2 测试用例持久化 | 后端 | P1 | 2h | 无 |
| 19.2.1 覆盖率工具 | 后端 | P1 | 2h | 19.1.1 |
| 19.2.2 覆盖率可视化 | 前端 | P2 | 2h | 19.2.1 |

---

## 19.1 Jest 集成

### 19.1.1 测试运行工具

**文件**：`src/server/services/ai/tools/test.ts`

```typescript
async function runTests(params: {
  pattern?: string,
  testName?: string,
  coverage?: boolean
}): Promise<{
  success: boolean,
  summary: {
    total: number,
    passed: number,
    failed: number,
    skipped: number
  },
  failures: {
    testName: string,
    error: string,
    file: string,
    line: number
  }[],
  duration: number
}> {
  const args = ['--json']

  if (params.pattern) {
    args.push(params.pattern)
  }
  if (params.testName) {
    args.push('-t', params.testName)
  }
  if (params.coverage) {
    args.push('--coverage')
  }

  const { stdout } = await exec(`npx jest ${args.join(' ')}`)
  return parseJestOutput(JSON.parse(stdout))
}
```

**验收**：
- [ ] 测试运行成功
- [ ] 结果解析正确
- [ ] 失败信息清晰

---

### 19.1.2 测试用例持久化

**文件**：`src/server/services/ai/tools/test.ts`

**数据模型**：

```typescript
// test_cases 集合
{
  _id: ObjectId,
  functionId: ObjectId,
  testCode: string,
  description: string,
  createdBy: 'ai' | 'user',
  lastRun?: Date,
  lastResult?: 'pass' | 'fail',
  createdAt: Date
}
```

```typescript
async function saveTestCase(params: {
  functionId: string,
  testCode: string,
  description: string
}): Promise<{ success: boolean, testCaseId: string }>
```

**验收**：
- [ ] 测试用例保存成功
- [ ] 可查询历史用例

---

## 19.2 覆盖率报告

### 19.2.1 覆盖率工具

**文件**：`src/server/services/ai/tools/test.ts`

```typescript
async function getCoverage(params: {
  path?: string
}): Promise<{
  overall: {
    lines: number,
    statements: number,
    functions: number,
    branches: number
  },
  files: {
    path: string,
    lines: number,
    uncoveredLines: number[]
  }[]
}>
```

**验收**：
- [ ] 覆盖率数据正确
- [ ] 文件级别详情

---

### 19.2.2 覆盖率可视化

**文件**：`src/client/components/Test/CoverageView.tsx`

- [ ] 总体覆盖率展示
- [ ] 文件列表带覆盖率
- [ ] 未覆盖行高亮

---

## 并行开发说明

后端和前端可并行开发。
