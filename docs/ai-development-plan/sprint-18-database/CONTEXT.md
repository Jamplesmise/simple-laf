# Sprint 18: 数据库增强

## 阶段目标

让 AI 能够分析数据库集合结构，提供索引优化建议。

## 功能范围

### 18.1 集合分析

**后端**：
- 集合结构分析 API
- 数据分布统计 API
- 查询执行 API（只读）

### 18.2 查询优化建议

**后端**：
- 索引分析服务
- 索引建议生成

## 新增 AI 工具

```typescript
{
  name: 'analyze_collection',
  description: '分析 MongoDB 集合结构和数据分布',
  parameters: {
    collection: string
  }
}

{
  name: 'suggest_indexes',
  description: '建议集合索引优化',
  parameters: {
    collection: string
  }
}

{
  name: 'execute_query',
  description: '执行 MongoDB 查询（只读）',
  parameters: {
    collection: string,
    query: object,
    limit?: number
  }
}
```

## 安全考虑

- 查询只能是只读操作
- 限制返回结果数量
- 敏感字段自动脱敏

## 验收标准

- [ ] AI 可分析集合结构
- [ ] AI 可获取数据分布
- [ ] AI 可执行只读查询
- [ ] AI 可提供索引建议

## 依赖

- 无前置依赖（可与 Sprint 17 并行）
