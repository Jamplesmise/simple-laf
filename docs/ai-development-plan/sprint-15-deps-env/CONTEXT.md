# Sprint 15: 依赖与配置

## 阶段目标

让 AI 能够管理 NPM 依赖和环境变量。

## 功能范围

### 15.1 依赖安装工具

**后端**：
- NPM 依赖安装 API
- NPM 依赖更新 API
- 安全审计 API

### 15.2 环境变量管理

**后端**：
- 环境变量 CRUD API
- 敏感信息脱敏

## 新增 AI 工具

```typescript
{
  name: 'install_dependency',
  description: '安装 NPM 依赖（需要用户确认）',
  parameters: {
    packages: string[],
    dev?: boolean
  }
}

{
  name: 'update_dependency',
  description: '更新 NPM 依赖',
  parameters: {
    packages: string[],
    latest?: boolean
  }
}

{
  name: 'audit_dependencies',
  description: '安全审计依赖',
  parameters: {}
}

{
  name: 'set_env_variable',
  description: '设置环境变量',
  parameters: {
    key: string,
    value: string,
    isSecret?: boolean
  }
}

{
  name: 'delete_env_variable',
  description: '删除环境变量',
  parameters: {
    key: string
  }
}
```

## 安全考虑

- 依赖安装需要用户确认
- 敏感环境变量值不返回给 AI
- 记录所有操作到审计日志

## 验收标准

- [ ] AI 可安装依赖（需确认）
- [ ] AI 可更新依赖
- [ ] AI 可进行安全审计
- [ ] AI 可管理环境变量
- [ ] 敏感信息正确脱敏

## 依赖

- 无前置依赖（可与 Sprint 14 并行）
