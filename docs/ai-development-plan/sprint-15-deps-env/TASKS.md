# Sprint 15: 依赖与配置 - 任务清单

## 任务概览

| 任务 | 轨道 | 优先级 | 预估 | 依赖 | 状态 |
|------|------|-------|------|------|------|
| 15.1.1 依赖安装工具 | 后端 | P0 | 2h | 无 | ✅ 完成 |
| 15.1.2 依赖更新工具 | 后端 | P1 | 2h | 无 | ✅ 完成 |
| 15.1.3 安全审计工具 | 后端 | P1 | 2h | 无 | ✅ 完成 |
| 15.2.1 环境变量工具 | 后端 | P0 | 2h | 无 | ✅ 完成 |

---

## 15.1 依赖安装工具

### 15.1.1 依赖安装工具

**文件**：`src/server/services/ai/tools/dependency.ts`

```typescript
async function installDependency(params: {
  packages: string[],
  dev?: boolean
}): Promise<{ success: boolean, installed: string[], failed: string[] }>
```

**验收**：
- [x] 安装命令正确生成
- [x] 需要用户确认
- [x] 安装结果正确返回

---

### 15.1.2 依赖更新工具

**文件**：`src/server/services/ai/tools/dependency.ts`

```typescript
async function updateDependency(params: {
  packages: string[],
  latest?: boolean
}): Promise<{ success: boolean, updated: { name: string, from: string, to: string }[] }>
```

**验收**：
- [x] 更新正确执行
- [x] 版本变更正确返回

---

### 15.1.3 安全审计工具

**文件**：`src/server/services/ai/tools/dependency.ts`

```typescript
async function auditDependencies(): Promise<{
  vulnerabilities: {
    severity: 'low' | 'moderate' | 'high' | 'critical',
    package: string,
    title: string,
    fixAvailable: boolean
  }[],
  summary: string
}>
```

**验收**：
- [x] 审计结果正确解析
- [x] 修复建议正确

---

## 15.2 环境变量管理

### 15.2.1 环境变量工具

**文件**：`src/server/services/ai/tools/env.ts`

```typescript
// 设置环境变量
async function setEnvVariable(params: {
  key: string,
  value: string,
  isSecret?: boolean,
  description?: string
}, userId: ObjectId): Promise<{ success: boolean, key: string }>

// 删除环境变量
async function deleteEnvVariable(params: {
  key: string
}, userId: ObjectId): Promise<{ success: boolean, key: string }>

// 获取环境变量列表（敏感值脱敏）
async function listEnvVariables(userId: ObjectId): Promise<{
  variables: { key: string, value: string, isSecret: boolean, description?: string }[],
  count: number
}>
```

**脱敏规则**：

```typescript
function maskValue(value: string, isSecret: boolean): string {
  if (!isSecret) return value
  if (value.length <= 4) return '****'
  return value.slice(0, 2) + '****' + value.slice(-2)
}
```

**验收**：
- [x] 设置成功
- [x] 删除成功
- [x] 敏感值正确脱敏
- [x] 自动检测敏感信息

---

## 实现详情

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/server/services/ai/tools/dependency.ts` | 依赖管理工具 |
| `src/server/services/ai/tools/env.ts` | 环境变量管理工具 |
| `src/server/services/ai/executor/operations/dependency.ts` | 依赖操作执行器 |
| `src/server/services/ai/executor/operations/env.ts` | 环境变量操作执行器 |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `src/server/services/npm.ts` | 添加 updatePackage, updatePackages, auditPackages |
| `src/server/services/ai/tools.ts` | 添加 dependencyTools, envTools |
| `src/server/services/ai/types.ts` | 添加 7 种新操作类型 |
| `src/server/services/ai/executor/executor.ts` | 添加新操作处理分支 |
| `src/server/services/ai/tools/index.ts` | 导出新模块 |
| `src/server/services/ai/executor/operations/index.ts` | 导出新操作 |

### AI 工具清单

| 工具名称 | 描述 | 权限级别 |
|----------|------|----------|
| `install_dependency` | 安装 NPM 依赖包 | Level 2 (需确认) |
| `update_dependency` | 更新 NPM 依赖包 | Level 1 |
| `audit_dependencies` | 安全审计依赖包 | Level 1 |
| `list_dependencies` | 列出已安装依赖 | Level 1 |
| `set_env_variable` | 设置环境变量 | Level 1 |
| `delete_env_variable` | 删除环境变量 | Level 1 |
| `list_env_variables` | 列出环境变量 | Level 1 |

---

## 完成时间

- 开始时间: 2025-12-21
- 完成时间: 2025-12-21
- 实际耗时: ~1h
