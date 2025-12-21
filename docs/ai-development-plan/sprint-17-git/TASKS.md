# Sprint 17: Git 操作增强 - 任务清单

## 任务概览

| 任务 | 轨道 | 优先级 | 预估 | 依赖 | 状态 |
|------|------|-------|------|------|------|
| 17.1.1 Git 状态工具 | 后端 | P0 | 1h | 无 | ✅ 完成 |
| 17.1.2 Git Diff 工具 | 后端 | P0 | 2h | 无 | ✅ 完成 |
| 17.2.1 Git Commit 工具 | 后端 | P0 | 2h | 无 | ✅ 完成 |
| 17.2.2 Git Sync 工具 | 后端 | P1 | 2h | 无 | ✅ 完成 |
| 17.2.3 Git Branch 工具 | 后端 | P1 | 2h | 无 | ✅ 完成 |
| 17.2.4 Git Log 工具 | 后端 | P1 | 1h | 无 | ✅ 完成 |

---

## 17.1 状态查看

### 17.1.1 Git 状态工具

**文件**：`src/server/services/ai/tools/git.ts`

```typescript
async function gitStatus(): Promise<{
  branch: string,
  ahead: number,
  behind: number,
  staged: string[],
  modified: string[],
  untracked: string[],
  deleted: string[],
  renamed: Array<{ from: string; to: string }>
}> {
  const { stdout } = await exec('git status --porcelain -b')
  return parseGitStatus(stdout)
}
```

**验收**：
- [x] 分支信息正确
- [x] 文件状态正确分类

---

### 17.1.2 Git Diff 工具

**文件**：`src/server/services/ai/tools/git.ts`

```typescript
async function gitDiff(params: {
  ref?: string,
  path?: string,
  staged?: boolean
}): Promise<{
  files: { path: string, additions: number, deletions: number }[],
  diff: string,
  summary: { filesChanged: number, insertions: number, deletions: number }
}>
```

**验收**：
- [x] Diff 输出正确
- [x] 文件变更统计正确
- [x] 支持暂存区 diff

---

## 17.2 提交与同步

### 17.2.1 Git Commit 工具

**文件**：`src/server/services/ai/tools/git.ts`

```typescript
async function gitCommit(params: {
  message: string,
  files?: string[]
}): Promise<{ success: boolean, commitHash: string, message: string, filesCommitted: number }>
```

**验收**：
- [x] 提交需要确认（Level 2 权限）
- [x] 提交成功返回 hash
- [x] 可指定文件提交

---

### 17.2.2 Git Sync 工具

**文件**：`src/server/services/ai/tools/git.ts`

```typescript
async function gitSync(params: {
  action: 'pull' | 'push',
  remote?: string,
  branch?: string
}): Promise<{ success: boolean, message: string, details?: string }>
```

**验收**：
- [x] Pull 正常工作
- [x] Push 正常工作
- [x] 禁止 force push

---

### 17.2.3 Git Branch 工具

**文件**：`src/server/services/ai/tools/git.ts`

```typescript
async function gitBranch(params: {
  action: 'list' | 'create' | 'checkout' | 'delete',
  name?: string
}): Promise<{ success: boolean, branches?: string[], current?: string, message?: string }>
```

**验收**：
- [x] 列出分支正确
- [x] 创建分支成功
- [x] 切换分支成功
- [x] 删除分支成功（使用 -d 防止删除未合并分支）

---

### 17.2.4 Git Log 工具（新增）

**文件**：`src/server/services/ai/tools/git.ts`

```typescript
async function gitLog(params: {
  count?: number,
  path?: string
}): Promise<{
  entries: Array<{
    hash: string,
    shortHash: string,
    author: string,
    email: string,
    date: string,
    message: string
  }>
}>
```

**验收**：
- [x] 日志输出正确
- [x] 支持指定数量
- [x] 支持指定文件路径

---

## 实现文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/server/services/ai/tools/git.ts` | 新增 | Git 工具核心实现 |
| `src/server/services/ai/tools/index.ts` | 修改 | 导出 git 模块 |
| `src/server/services/ai/tools.ts` | 修改 | 添加 gitTools 定义 |
| `src/server/services/ai/types.ts` | 修改 | 添加 Git 操作类型 |
| `src/server/services/ai/executor/operations/git.ts` | 新增 | Git 操作执行器 |
| `src/server/services/ai/executor/operations/index.ts` | 修改 | 导出 git 模块 |
| `src/server/services/ai/executor/executor.ts` | 修改 | 注册 Git 操作 |

---

## 安全措施

- [x] Commit 和 Sync 操作设计为需要用户确认（Level 2 权限）
- [x] 禁止 force push（只使用普通 push）
- [x] 分支删除使用 `-d` 而非 `-D`，防止删除未合并分支
- [x] 命令参数做了基本的安全过滤，防止命令注入

---

## 并行开发说明

所有任务为纯后端，可完全并行开发。

**完成时间**：2025-12-21
