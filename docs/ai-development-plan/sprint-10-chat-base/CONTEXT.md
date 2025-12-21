# Sprint 10: Chat 基础增强

## 阶段目标

让用户清晰了解 AI 正在做什么，能够控制对话上下文，实现消息编辑和分支功能。

## 功能范围

### 10.1 AI 状态可视化（可独立开发）

**后端**：
- SSE 状态推送增强
- 工具调用状态通知
- Token 消耗实时统计

**前端**：
- 高层状态展示（正在分析/执行中/等待确认）
- 工具调用详情面板
- 思考过程可展开视图
- Token 消耗实时显示

### 10.2 消息编辑与分支（可独立开发）

**后端**：
- 消息编辑 API
- 分支对话 API
- 消息反馈 API

**前端**：
- 消息编辑弹窗
- 分支对话视图
- 反馈按钮（点赞/踩）
- 消息复制按钮

### 10.3 上下文可视化管理（可独立开发）

**后端**：
- 上下文统计 API
- 上下文删除 API
- 智能压缩 API

**前端**：
- 上下文使用量指示器（70% 阈值提醒）
- 上下文详情面板（分类展示）
- 手动删除/压缩操作
- 智能压缩按钮

### 不包含

- Canvas 分屏模式（Sprint 11）
- Artifacts 预览（Sprint 12）
- 文件上传（Sprint 12）

## 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| 状态推送 | SSE（现有） | 复用现有架构 |
| 分支存储 | MongoDB | 复用现有数据库 |
| 状态管理 | Zustand | 复用现有状态管理 |
| Token 计算 | tiktoken | 精确计算 |

## 数据模型变更

### ai_messages 集合（扩展）

```typescript
{
  _id: ObjectId,
  conversationId: ObjectId,
  role: 'user' | 'assistant',
  content: string,
  // 新增字段
  parentMessageId?: ObjectId,    // 分支：父消息 ID
  version: number,               // 版本号（编辑后递增）
  feedback?: 'like' | 'dislike',
  feedbackNote?: string,
  createdAt: Date,
  updatedAt: Date
}
```

### ai_conversations 集合（扩展）

```typescript
{
  _id: ObjectId,
  userId: ObjectId,
  title: string,
  // 新增字段
  rootMessageIds: ObjectId[],    // 分支树的根消息
  contextStats?: {
    totalTokens: number,
    systemTokens: number,
    messageTokens: number,
    codeTokens: number,
    toolResultTokens: number
  },
  createdAt: Date,
  updatedAt: Date
}
```

## API 变更

### 新增 API

```
PATCH  /api/ai/messages/:id              # 编辑消息
POST   /api/ai/messages/:id/branch       # 从消息创建分支
POST   /api/ai/messages/:id/feedback     # 消息反馈
GET    /api/ai/conversations/:id/context # 获取上下文详情
DELETE /api/ai/conversations/:id/context # 删除指定上下文
POST   /api/ai/conversations/:id/compress # 压缩上下文
```

### SSE 状态事件（增强）

```typescript
type AIStatusEvent =
  | { type: 'status', data: AIStatus }
  | { type: 'tool_call', data: { tool: string, params: any } }
  | { type: 'tool_result', data: { tool: string, result: any } }
  | { type: 'thinking', data: { content: string } }
  | { type: 'token_usage', data: { input: number, output: number, cost: number } }
```

## 目录结构变更

```
src/server/services/ai/
├── context/                    # 新增：上下文管理
│   ├── index.ts
│   ├── calculator.ts           # Token 计算
│   ├── compressor.ts           # 压缩逻辑
│   └── types.ts
└── index.ts                    # 修改：集成上下文管理

src/client/components/AI/
├── StatusPanel/                # 新增：状态面板
│   ├── index.tsx
│   ├── ToolCallCard.tsx
│   └── ThinkingView.tsx
├── ContextManager/             # 新增：上下文管理器
│   ├── index.tsx
│   ├── UsageBar.tsx
│   ├── ContextList.tsx
│   └── CompressDialog.tsx
└── MessageActions/             # 新增：消息操作
    ├── index.tsx
    ├── EditDialog.tsx
    ├── BranchButton.tsx
    └── FeedbackButtons.tsx
```

## 验收标准

### 10.1 AI 状态可视化

- [ ] 实时显示 AI 当前状态（思考中/调用工具/执行操作）
- [ ] 展示正在调用的工具名称和参数
- [ ] 可展开查看 AI 思考过程
- [ ] 实时显示 Token 消耗和预估成本

### 10.2 消息编辑与分支

- [ ] 用户消息可编辑，编辑后重新生成 AI 回复
- [ ] 可从任意消息处创建分支对话
- [ ] 消息可点赞/踩
- [ ] 一键复制消息内容

### 10.3 上下文可视化管理

- [ ] 显示上下文使用量百分比
- [ ] 超过 70% 显示蓝色提示链接
- [ ] 点击可查看上下文详情（分类展示）
- [ ] 可手动删除非必需上下文项
- [ ] 支持智能压缩，目标压缩到 50%

## 依赖

- 无前置 Sprint 依赖
- 复用现有 AI 服务架构

## 下一阶段

完成本阶段后，可并行进入：
- Sprint 11：Canvas 模式
- Sprint 12：Artifacts 增强
