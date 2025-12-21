# Sprint 16: 上下文精准控制

## 阶段目标

实现精准更新操作（只加载修改点周围代码）和 Plan 模式（大任务先规划后执行）。

## 功能范围

### 16.1 精准更新操作

**后端**：
- 修改范围检测
- 部分代码加载策略
- 上下文复用机制

**前端**：
- 精准更新请求封装
- 修改预览

### 16.2 Plan 模式

**后端**：
- 计划生成 API
- 计划执行 API
- 步骤状态管理

**前端**：
- Plan 模式对话框
- 步骤选择与执行
- 实时进度展示

## 技术设计

### 精准更新策略

```typescript
interface PreciseUpdateRequest {
  functionId: string
  range: {
    startLine: number
    endLine: number
  }
  minimalContext: boolean  // 只加载 ±N 行
  contextLines: number     // 默认 10 行
}
```

### Plan 模式状态机

```
off → planning → reviewing → executing → completed
                     ↑           │
                     └─ paused ──┘
```

## 验收标准

### 16.1 精准更新

- [ ] 修改小范围代码时只加载相关部分
- [ ] Token 消耗减少 80%+
- [ ] 修改结果正确

### 16.2 Plan 模式

- [ ] 大任务自动触发 Plan 模式
- [ ] 计划可预览和修改
- [ ] 步骤可选择性执行
- [ ] 支持暂停/恢复/停止

## 依赖

- Sprint 10（上下文管理基础）
