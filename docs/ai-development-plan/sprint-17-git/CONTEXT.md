# Sprint 17: Git 操作增强

## 阶段目标

让 AI 能够查看 Git 状态、提交代码、管理分支。

## 功能范围

### 17.1 状态查看

**后端**：
- Git 状态 API
- Git Diff API
- Git 日志 API

### 17.2 提交与同步

**后端**：
- Git Commit API（需确认）
- Git Pull/Push API（需确认）
- Git Branch API

## 新增 AI 工具

```typescript
{
  name: 'git_status',
  description: '获取 Git 仓库状态',
  parameters: {}
}

{
  name: 'git_diff',
  description: '查看代码变更',
  parameters: {
    ref?: string,
    path?: string
  }
}

{
  name: 'git_commit',
  description: '提交代码更改（需要用户确认）',
  parameters: {
    message: string,
    files?: string[]
  }
}

{
  name: 'git_sync',
  description: '同步远程仓库（pull/push）',
  parameters: {
    action: 'pull' | 'push',
    remote?: string,
    branch?: string
  }
}

{
  name: 'git_branch',
  description: '管理分支',
  parameters: {
    action: 'list' | 'create' | 'checkout' | 'delete',
    name?: string
  }
}
```

## 安全考虑

- Commit 和 Push 需要用户确认
- 禁止 force push
- 记录所有操作到审计日志

## 验收标准

- [ ] AI 可查看 Git 状态
- [ ] AI 可查看代码变更
- [ ] AI 可提交代码（需确认）
- [ ] AI 可同步仓库（需确认）
- [ ] AI 可管理分支

## 依赖

- 无前置依赖（可与 Sprint 18 并行）
