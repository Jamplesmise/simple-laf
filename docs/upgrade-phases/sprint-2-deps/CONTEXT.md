# Sprint 2: 依赖与调试

## 阶段目标

实现 NPM 依赖动态管理，完成调试面板和 Console 日志输出。

## 功能范围

### 后端

- NPM 依赖 CRUD API
- 包安装/卸载服务
- 启动时依赖恢复
- 部署配置优化 (持久卷)

### 前端

- 多标签编辑器
- Console 日志面板
- 右侧调试面板
  - 请求方法选择
  - Query/Body/Headers 编辑
  - 运行结果展示
- 依赖面板交互

### 不包含

- 历史版本管理 (Sprint 3)
- 环境变量管理 (Sprint 3)
- 文件夹结构 (Sprint 4)

## 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| 包管理 | npm CLI | 直接调用，简单可靠 |
| 版本查询 | npm view | 官方命令 |
| 持久化 | Docker Volume | 标准方案 |
| JSON 编辑 | Monaco Editor | 统一编辑器 |

## 数据模型

### dependencies 集合 (新增)

```typescript
{
  _id: ObjectId,
  name: string,              // 包名 (如 lodash)
  version: string,           // 版本 (如 4.17.21)
  status: 'pending' | 'installing' | 'installed' | 'failed',
  error?: string,            // 失败原因
  userId: ObjectId,
  createdAt: Date,
  installedAt?: Date
}

// 索引
{ userId: 1, name: 1 }  // 唯一复合索引
```

## API 设计

### 新增 API

```
GET    /api/dependencies              # 获取依赖列表
POST   /api/dependencies              # 添加依赖
DELETE /api/dependencies/:name        # 删除依赖
GET    /api/dependencies/:name/versions  # 获取可用版本
```

## 目录结构变更

```
src/
├── services/
│   └── npm.ts             # 新增：NPM 操作服务
├── routes/
│   └── dependencies.ts    # 新增：依赖管理路由
└── index.ts               # 修改：启动时恢复依赖

web/src/
├── components/
│   ├── EditorTabs.tsx     # 新增：多标签编辑器
│   ├── ConsolePanel.tsx   # 新增：Console 面板
│   ├── DebugPanel.tsx     # 新增：调试面板
│   └── DependencyPanel.tsx # 修改：添加交互
└── pages/IDE/
    └── index.tsx          # 修改：集成新组件

docker-compose.yml         # 新增：编排配置
Dockerfile                 # 修改：添加 VOLUME
.env.example               # 修改：更新配置
```

## 验收标准

### 后端

- [ ] POST /api/dependencies 添加依赖成功
- [ ] 依赖安装状态实时更新
- [ ] 函数中 require 新依赖成功
- [ ] DELETE /api/dependencies/:name 删除成功
- [ ] 容器重启后依赖自动恢复
- [ ] docker-compose up 一键启动

### 前端

- [ ] 多标签显示多个打开的函数
- [ ] Console 显示函数执行日志
- [ ] 调试面板可切换请求方法
- [ ] Query/Body/Headers 可编辑
- [ ] 运行按钮执行函数
- [ ] 依赖面板可添加/删除依赖
- [ ] 安装状态实时显示

## 依赖

- Sprint 1 完成

## 下一阶段

完成本阶段后，进入 Sprint 3：版本与环境
