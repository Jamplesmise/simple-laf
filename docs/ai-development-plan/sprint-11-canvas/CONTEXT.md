# Sprint 11: Canvas 模式

## 阶段目标

实现 ChatGPT Canvas 风格的分屏代码协作编辑，AI 修改实时同步到编辑器。

## 功能范围

### 11.1 分屏布局（可独立开发）

**前端**：
- Canvas 模式开关
- 左右分屏布局（对话 + 编辑器）
- 响应式适配
- 面板大小可拖拽

### 11.2 代码同步（可独立开发）

**后端**：
- AI 输出代码解析
- 代码 Diff 计算
- 版本快照保存

**前端**：
- 实时代码同步到 Monaco
- Diff 对比视图
- 版本历史切换

### 11.3 快捷操作（可独立开发）

**前端**：
- 快捷操作按钮栏
- 预设 Prompt 触发
- 操作结果展示

### 不包含

- HTML/React 预览（Sprint 12）
- 文件上传（Sprint 12）

## 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| 编辑器 | Monaco Editor（现有） | 复用现有组件 |
| Diff 计算 | diff-match-patch | 轻量高效 |
| 分屏布局 | react-split | 可拖拽分割 |
| 版本存储 | MongoDB | 复用现有架构 |

## 数据模型变更

### ai_code_snapshots 集合（新增）

```typescript
{
  _id: ObjectId,
  conversationId: ObjectId,
  messageId: ObjectId,
  functionId: ObjectId,
  version: number,
  code: string,
  description?: string,
  createdAt: Date
}
```

## API 变更

### 新增 API

```
GET    /api/ai/canvas/:conversationId/snapshots    # 获取代码快照列表
POST   /api/ai/canvas/:conversationId/snapshot     # 创建快照
GET    /api/ai/canvas/snapshot/:id                 # 获取快照详情
POST   /api/ai/canvas/apply                        # 应用代码到函数
```

## 目录结构变更

```
src/client/components/AI/
├── Canvas/                      # 新增：Canvas 模式
│   ├── index.tsx               # Canvas 容器
│   ├── CanvasLayout.tsx        # 分屏布局
│   ├── CodePane.tsx            # 代码编辑面板
│   ├── DiffView.tsx            # Diff 对比视图
│   ├── QuickActions.tsx        # 快捷操作栏
│   └── VersionHistory.tsx      # 版本历史
└── ChatPanel/                  # 修改：适配 Canvas 模式
```

## 验收标准

### 11.1 分屏布局

- [ ] Canvas 开关可切换模式
- [ ] 左右分屏显示正常
- [ ] 分割线可拖拽调整比例
- [ ] 移动端自动切换为全屏模式

### 11.2 代码同步

- [ ] AI 输出代码自动同步到右侧编辑器
- [ ] 可查看 Diff 对比（修改前后）
- [ ] 版本历史可回溯
- [ ] 应用按钮可将代码保存到函数

### 11.3 快捷操作

- [x] 显示 6 个快捷操作按钮
- [x] 点击触发对应 Prompt
- [x] 操作结果正确展示

## 依赖

- Sprint 10（AI 状态可视化用于展示操作进度）
- 现有 Monaco Editor 组件

## 下一阶段

完成本阶段后，进入 Sprint 12：Artifacts 增强
