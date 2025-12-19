# Sprint 3: 版本与环境

## 阶段目标

实现函数历史版本管理和环境变量功能，发布时记录版本并支持 Diff 对比。

## 功能范围

### 后端

- 函数版本管理 API
- 发布流程改造 (保存版本+变更日志)
- 版本回滚功能
- 环境变量 CRUD API
- 执行时环境变量注入

### 前端

- 发布弹窗 (Diff 对比 + 变更日志编辑)
- 版本历史面板
- 版本对比查看器
- 环境变量管理页面

### 不包含

- 文件夹结构 (Sprint 4)
- Git 同步 (Sprint 4)

## 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| Diff 显示 | react-diff-viewer-continued | 成熟库，支持多种模式 |
| 值加密 | crypto-js | 环境变量安全存储 |
| 编辑器 | Monaco Editor | 统一风格 |

## 数据模型

### function_versions 集合 (新增)

```typescript
{
  _id: ObjectId,
  functionId: ObjectId,      // 所属函数
  version: number,           // 版本号 (自增)
  code: string,              // 源码
  compiled: string,          // 编译后代码
  changelog: string,         // 变更日志
  userId: ObjectId,
  createdAt: Date
}

// 索引
{ functionId: 1, version: -1 }
```

### env_variables 集合 (新增)

```typescript
{
  _id: ObjectId,
  key: string,               // 变量名
  value: string,             // 变量值 (加密)
  description?: string,      // 描述
  userId: ObjectId,
  createdAt: Date,
  updatedAt: Date
}

// 索引
{ userId: 1, key: 1 }  // 唯一复合索引
```

### functions 集合 (扩展)

```typescript
{
  // ... 现有字段
  currentVersion: number,    // 新增：当前版本号
  publishedVersion?: number  // 新增：已发布的版本号
}
```

## API 设计

### 版本 API

```
GET    /api/functions/:id/versions           # 获取版本列表
GET    /api/functions/:id/versions/:version  # 获取指定版本
GET    /api/functions/:id/versions/diff      # 版本对比
POST   /api/functions/:id/publish            # 发布 (带 changelog)
POST   /api/functions/:id/rollback           # 回滚到指定版本
```

### 环境变量 API

```
GET    /api/env              # 获取列表 (值隐藏)
PUT    /api/env/:key         # 添加/更新
DELETE /api/env/:key         # 删除
```

## 目录结构变更

```
src/
├── services/
│   ├── version.ts         # 新增：版本管理服务
│   └── env.ts             # 新增：环境变量服务
├── routes/
│   ├── functions.ts       # 修改：版本相关 API
│   └── env.ts             # 新增：环境变量路由
└── services/
    └── executor.ts        # 修改：注入环境变量

web/src/
├── components/
│   ├── PublishModal.tsx   # 新增：发布弹窗
│   ├── VersionHistory.tsx # 新增：版本历史面板
│   ├── DiffViewer.tsx     # 新增：代码对比组件
│   └── EnvManager.tsx     # 新增：环境变量管理
└── pages/
    └── Settings/
        └── EnvVariables.tsx
```

## 验收标准

### 后端

- [ ] 发布函数时自动创建版本记录
- [ ] 版本号自增 (1, 2, 3...)
- [ ] GET /api/functions/:id/versions 返回版本列表
- [ ] GET /api/functions/:id/versions/diff 返回两版本代码
- [ ] POST /api/functions/:id/rollback 回滚成功
- [ ] 环境变量 CRUD 正常
- [ ] 函数执行时 cloud.env.XXX 可读取
- [ ] 函数执行时 process.env.XXX 可读取

### 前端

- [ ] 点击发布弹出 Diff 对比窗口
- [ ] 可编辑变更日志
- [ ] 确认发布后版本号增加
- [ ] 版本历史面板显示版本列表
- [ ] 可查看任意版本代码
- [ ] 可对比任意两个版本
- [ ] 可回滚到历史版本
- [ ] 环境变量管理页面正常
- [ ] 环境变量值隐藏显示

## 依赖

- Sprint 1 完成 (发布功能)
- Sprint 2 完成 (调试面板)

## 下一阶段

完成本阶段后，进入 Sprint 4：结构与同步
