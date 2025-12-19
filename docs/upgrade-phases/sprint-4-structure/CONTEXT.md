# Sprint 4: 结构与同步

## 阶段目标

实现文件夹结构化管理函数和 Git 仓库同步功能，支持 laf 函数格式兼容。

## 功能范围

### 后端

- 文件夹 CRUD API
- 函数移动/排序 API
- 路径联动更新
- 多级路径公开调用
- Git 配置管理 API
- Git 拉取/推送操作
- laf 函数格式转换

### 前端

- 文件树组件 (拖拽支持)
- 右键菜单
- 路径显示更新
- Git 配置弹窗
- Git 同步面板

### 不包含

- 多用户协作
- 分支管理
- 合并冲突处理

## 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| Git 操作 | simple-git | 成熟库，API 简洁 |
| 树组件 | Ant Design Tree | 内置拖拽支持 |
| 右键菜单 | Ant Design Dropdown | 统一风格 |

## 数据模型

### folders 集合 (新增)

```typescript
{
  _id: ObjectId,
  name: string,              // 文件夹名
  parentId?: ObjectId,       // 父文件夹 (null 为根目录)
  path: string,              // 完整路径 (如 "api/user")
  userId: ObjectId,
  order: number,             // 排序序号
  createdAt: Date
}

// 索引
{ userId: 1, path: 1 }       // 唯一复合索引
{ userId: 1, parentId: 1 }
```

### git_config 集合 (新增)

```typescript
{
  _id: ObjectId,
  repoUrl: string,           // https://github.com/user/repo.git
  branch: string,            // main
  token?: string,            // 访问令牌 (加密)
  functionsPath: string,     // 函数目录路径 (如 "functions/")
  lastSyncAt?: Date,
  userId: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### functions 集合 (扩展)

```typescript
{
  // ... 现有字段
  folderId?: ObjectId,       // 新增：所属文件夹
  path: string,              // 新增：完整路径 (如 "api/user/login")
  order: number              // 新增：排序序号
}
```

## API 设计

### 文件夹 API

```
GET    /api/folders              # 获取文件夹树
POST   /api/folders              # 创建文件夹
PATCH  /api/folders/:id          # 重命名
DELETE /api/folders/:id          # 删除 (需为空)
POST   /api/folders/:id/move     # 移动文件夹
```

### 函数扩展 API

```
POST   /api/functions/:id/move       # 移动函数
POST   /api/functions/batch-move     # 批量移动
POST   /api/functions/reorder        # 调整排序
```

### Git API

```
GET    /api/git/config           # 获取配置
PUT    /api/git/config           # 设置配置
POST   /api/git/pull             # 从 Git 拉取
POST   /api/git/push             # 推送到 Git
GET    /api/git/status           # 同步状态
```

### 公开调用路由更新

```
ALL    /*                        # 支持多级路径匹配
```

## 目录结构变更

```
src/
├── services/
│   ├── folder.ts          # 新增：文件夹服务
│   ├── path.ts            # 新增：路径管理服务
│   └── git.ts             # 新增：Git 操作服务
├── routes/
│   ├── folders.ts         # 新增：文件夹路由
│   ├── functions.ts       # 修改：添加移动 API
│   ├── git.ts             # 新增：Git 路由
│   └── public.ts          # 修改：支持多级路径

web/src/
├── components/
│   ├── FunctionTree.tsx   # 新增：文件树组件
│   ├── GitPanel.tsx       # 新增：Git 面板
│   └── GitConfigModal.tsx # 新增：Git 配置弹窗
```

## 验收标准

### 后端

- [ ] 创建/重命名/删除文件夹
- [ ] 移动函数到文件夹
- [ ] 拖拽调整排序
- [ ] 路径自动更新
- [ ] 多级路径公开访问 (如 /api/user/login)
- [ ] Git 配置保存
- [ ] Git 拉取函数
- [ ] Git 推送函数
- [ ] laf 格式正确转换

### 前端

- [ ] 文件树显示文件夹和函数
- [ ] 拖拽移动功能
- [ ] 右键菜单操作
- [ ] 发布 URL 显示完整路径
- [ ] Git 配置弹窗
- [ ] Git 拉取/推送按钮
- [ ] 同步状态显示

## 依赖

- Sprint 1 完成 (发布功能)
- Sprint 2 完成 (布局)
- Sprint 3 完成 (版本管理)

## 完成标志

本 Sprint 完成后，Simple IDE 升级全部完成。
