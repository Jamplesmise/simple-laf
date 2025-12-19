# Sprint 1: 基础架构

## 阶段目标

替换 Dify Sandbox 为 Node.js VM 本地执行，实现函数发布功能，改造前端为 laf 风格三栏布局。

## 功能范围

### 后端

- Node.js VM 执行引擎
- 函数发布/取消发布 API
- 公开调用端点 (无需认证)
- 删除 Sandbox 相关代码

### 前端

- laf 风格三栏布局框架
- 左侧函数列表组件
- 左侧依赖面板骨架
- 发布按钮和 URL 复制

### 不包含

- NPM 依赖管理 (Sprint 2)
- 历史版本管理 (Sprint 3)
- 文件夹结构 (Sprint 4)

## 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| 代码执行 | Node.js VM | 无外部依赖，性能好 |
| 超时控制 | vm.Script timeout | 内置支持 |
| 布局 | Flexbox | 简单高效 |
| 组件库 | Ant Design | 统一风格 |

## 数据模型变更

### functions 集合 (扩展)

```typescript
{
  _id: ObjectId,
  name: string,
  code: string,
  compiled: string,
  userId: ObjectId,
  // 新增字段
  published: boolean,        // 是否已发布
  publishedAt?: Date,        // 发布时间
  createdAt: Date,
  updatedAt: Date
}
```

## API 变更

### 新增 API

```
POST   /api/functions/:id/publish    # 发布函数
POST   /api/functions/:id/unpublish  # 取消发布
ALL    /:name                        # 公开调用 (无需认证)
```

### 修改 API

```
GET    /api/functions        # 返回中增加 published 字段
GET    /api/functions/:id    # 返回中增加 published 字段
```

## 目录结构变更

```
src/
├── services/
│   ├── executor.ts    # 新增：Node.js VM 执行引擎
│   └── sandbox.ts     # 删除
├── routes/
│   ├── functions.ts   # 修改：添加发布 API
│   ├── invoke.ts      # 修改：使用本地执行
│   └── public.ts      # 新增：公开调用路由
└── config.ts          # 修改：移除 SANDBOX 配置

web/src/
├── layouts/
│   └── IDELayout.tsx  # 新增：三栏布局
├── components/
│   ├── FunctionList.tsx      # 新增：函数列表
│   └── DependencyPanel.tsx   # 新增：依赖面板骨架
└── pages/
    └── IDE/
        └── index.tsx  # 修改：使用新布局
```

## 验收标准

### 后端

- [ ] 函数通过 Node.js VM 执行成功
- [ ] console.log 输出正确返回
- [ ] 执行超时保护正常 (30秒)
- [ ] POST /api/functions/:id/publish 发布成功
- [ ] 已发布函数通过 /:name 可公开访问
- [ ] 未发布函数 /:name 返回 404
- [ ] 删除 SANDBOX_URL, SANDBOX_API_KEY 环境变量

### 前端

- [ ] 三栏布局显示正常
- [ ] 左侧函数列表可搜索
- [ ] 左侧依赖面板显示骨架
- [ ] 发布按钮点击后显示公开 URL
- [ ] URL 可复制到剪贴板

## 依赖

- 无前置依赖

## 下一阶段

完成本阶段后，进入 Sprint 2：依赖与调试
