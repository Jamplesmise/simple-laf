# Sprint 19: 测试基础

## 阶段目标

集成 Jest 测试框架，让 AI 能够运行测试和生成覆盖率报告。

## 功能范围

### 19.1 Jest 集成

**后端**：
- 测试运行 API
- 测试结果解析
- 测试用例持久化

### 19.2 覆盖率报告

**后端**：
- 覆盖率生成
- 覆盖率展示 API

**前端**：
- 覆盖率可视化

## 新增 AI 工具

```typescript
{
  name: 'run_tests',
  description: '运行测试',
  parameters: {
    pattern?: string,      // 测试文件匹配
    testName?: string,     // 特定测试名
    coverage?: boolean     // 是否生成覆盖率
  }
}

{
  name: 'get_coverage',
  description: '获取覆盖率报告',
  parameters: {
    path?: string
  }
}

{
  name: 'save_test_case',
  description: '保存 AI 生成的测试用例',
  parameters: {
    functionId: string,
    testCode: string,
    description: string
  }
}
```

## 验收标准

- [ ] AI 可运行测试
- [ ] 测试结果正确解析
- [ ] 可生成覆盖率报告
- [ ] 测试用例可持久化

## 依赖

- 无前置依赖
