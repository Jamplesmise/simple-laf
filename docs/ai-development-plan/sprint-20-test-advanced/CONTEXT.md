# Sprint 20: 高级测试（可选）

## 阶段目标

集成 E2E 测试和性能测试能力。

> 注：本 Sprint 为可选功能，可根据项目优先级跳过

## 功能范围

### 20.1 E2E 测试

**后端**：
- Playwright 集成
- E2E 测试运行 API

### 20.2 性能测试

**后端**：
- 基准测试运行
- 性能报告生成

## 新增 AI 工具

```typescript
{
  name: 'run_e2e_tests',
  description: '运行端到端测试',
  parameters: {
    spec?: string,
    browser?: 'chromium' | 'firefox' | 'webkit'
  }
}

{
  name: 'run_benchmark',
  description: '运行性能基准测试',
  parameters: {
    functionId: string,
    iterations?: number
  }
}
```

## 验收标准

- [ ] E2E 测试可运行
- [ ] 性能测试可运行
- [ ] 报告格式清晰

## 依赖

- Sprint 19（测试基础）
