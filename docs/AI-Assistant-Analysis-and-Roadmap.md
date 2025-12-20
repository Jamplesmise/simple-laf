# AI 全能助手 - 现状分析与开发路线图

> 文档版本：v1.2
> 基于项目版本：v2.0.0
> 更新日期：2025-12-20
>
> **v1.2 更新**:
> - 新增 5.4 GOI (Goal-Oriented Interface) 设计原则 - 三原语模型提升 AI 操作效率
> - 新增 5.5 SKILL 技能系统架构 - 渐进式披露、按需加载上下文
> - Sprint 10 新增 AI 状态可视化设计 - 让用户清晰了解 AI 当前操作
> - 移除容器管理规划，精简 Phase 3 为 Git + 数据库
>
> **v1.1 更新**: 调整 Phase 1 为 Chat 功能增强（参考 Claude/ChatGPT 网页端），移除 RAG 知识库

---

## 目录

1. [需求愿景](#1-需求愿景)
2. [现有 AI 功能分析](#2-现有-ai-功能分析)
3. [差距分析](#3-差距分析)
4. [开发路线图](#4-开发路线图)
5. [技术架构设计](#5-技术架构设计)
6. [优先级评估](#6-优先级评估)
7. [风险与挑战](#7-风险与挑战)

---

## 1. 需求愿景

### 1.1 目标

构建一个能够 **操控整个平台** 的 AI 助手，涵盖以下六大核心能力：

| 能力模块 | 描述 | 预期场景 |
|---------|------|---------|
| **开发** | 前后端联合开发/优化 | AI 理解整体架构，自动编写/优化前后端代码 |
| **测试** | 自动化测试 | 生成测试用例、运行测试、分析覆盖率 |
| **运维** | 部署与运维操作 | 环境配置、依赖管理、Docker 操作、健康检查 |
| **监控** | 日志与调用分析 | 实时监控函数调用、错误追踪、性能分析 |
| **答疑** | 纯 Chat 功能 | 回答平台使用问题、技术咨询 |
| **找寻** | 平台向导 | 引导用户找到功能、配置、文档 |

### 1.2 愿景定位

```
┌─────────────────────────────────────────────────────────────────┐
│                      AI 全能助手愿景                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   用户 ──────► AI 助手 ──────► 平台所有功能                       │
│                  │                                              │
│                  ├── 理解需求                                    │
│                  ├── 规划方案                                    │
│                  ├── 执行操作                                    │
│                  └── 反馈结果                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 现有 AI 功能分析

### 2.1 已实现功能清单（Sprint 5-9）

#### 2.1.1 核心架构

| 模块 | 文件位置 | 功能 |
|------|---------|------|
| AI 服务入口 | `src/server/services/ai/index.ts` | 配置管理、流式聊天 |
| Provider 管理 | `src/server/services/ai/provider.ts` | 多供应商/模型管理 |
| 对话系统 | `src/server/services/ai/conversation.ts` | 多对话、消息历史 |
| Debug 系统 | `src/server/services/ai/debug.ts` | 自动测试生成与诊断 |
| 执行器 | `src/server/services/ai/executor.ts` | AI 操作解析与执行 |
| 工具系统 | `src/server/services/ai/tools.ts` | 16 个 AI 工具定义 |
| 系统提示词 | `src/server/services/ai/systemPrompt.ts` | 提示词版本管理 |

#### 2.1.2 功能矩阵

| 功能 | 描述 | 实现状态 | 成熟度 |
|------|------|---------|-------|
| **AI 配置管理** | 多供应商、多模型、API Key 加密 | ✅ 完成 | ⭐⭐⭐⭐⭐ |
| **代码生成** | 自然语言 → 云函数代码 | ✅ 完成 | ⭐⭐⭐⭐ |
| **多函数生成** | 模块描述 → 多个相关函数 | ✅ 完成 | ⭐⭐⭐⭐ |
| **解耦分析** | 分析函数拆分建议 | ✅ 完成 | ⭐⭐⭐⭐ |
| **合并分析** | 分析多函数合并可行性 | ✅ 完成 | ⭐⭐⭐⭐ |
| **错误诊断** | 分析报错并提供修复 | ✅ 完成 | ⭐⭐⭐⭐ |
| **AI Debug** | 自动生成测试 → 运行 → 诊断 → 修复 | ✅ 完成 | ⭐⭐⭐⭐ |
| **对话系统** | 多对话、星标、归档、搜索 | ✅ 完成 | ⭐⭐⭐⭐ |
| **系统提示词** | 版本控制、回滚 | ✅ 完成 | ⭐⭐⭐⭐ |
| **日志分析** | 分析执行日志 | ✅ 完成 | ⭐⭐⭐ |
| **@ 引用函数** | 对话中引用函数上下文 | ✅ 完成 | ⭐⭐⭐⭐ |
| **深度思考模式** | 显示 AI 思考过程 | ✅ 完成 | ⭐⭐⭐⭐ |
| **AI 建站** | 创建/编辑站点文件 | ✅ 完成 | ⭐⭐⭐ |
| **审计日志** | 记录 AI 操作 | ✅ 完成 | ⭐⭐⭐⭐⭐ |
| **成本追踪** | Token 消耗与成本统计 | ✅ 完成 | ⭐⭐⭐ |

#### 2.1.3 已实现的 AI 工具（16 个）

**函数管理类（6 个）**：
- `create_function` - 创建云函数
- `update_function` - 修改函数代码
- `delete_function` - 删除函数
- `rename_function` - 重命名函数
- `move_function` - 移动函数
- `create_folder` - 创建文件夹

**分析类（4 个）**：
- `explain_code` - 代码解释
- `analyze_refactor` - 重构分析
- `analyze_merge` - 合并分析
- `analyze_code_quality` - 质量分析

**调试类（2 个）**：
- `debug_function` - 自动调试
- `run_function` - 运行函数

**站点类（4 个）**：
- `site_create_file` - 创建站点文件
- `site_update_file` - 更新站点文件
- `site_delete_file` - 删除站点文件
- `site_create_folder` - 创建站点文件夹

---

### 2.2 技术栈现状

```
┌──────────────────────────────────────────────────────────────┐
│                        AI 技术栈                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   OpenAI    │  │  Anthropic  │  │   Ollama    │   ...    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│         └────────────────┼────────────────┘                  │
│                          │                                   │
│                   ┌──────▼──────┐                            │
│                   │  Provider   │  ← AES-256 加密 API Key     │
│                   │   Adapter   │                            │
│                   └──────┬──────┘                            │
│                          │                                   │
│    ┌─────────────────────┼─────────────────────┐            │
│    │                     │                     │            │
│    ▼                     ▼                     ▼            │
│ ┌──────┐            ┌──────┐             ┌──────┐           │
│ │ Chat │            │ Tool │             │Debug │           │
│ │System│            │System│             │System│           │
│ └──────┘            └──────┘             └──────┘           │
│                                                              │
│  流式输出 (SSE)  │  对话管理  │  操作执行  │  审计日志         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. 差距分析

### 3.1 六大能力模块差距评估

#### 3.1.1 开发能力

| 需求项 | 现有能力 | 差距 | 完成度 |
|-------|---------|------|-------|
| 云函数开发 | ✅ 生成、修改、删除函数 | - | 95% |
| 前端代码修改 | ❌ 无 | 需要新增工具操作前端源码 | 0% |
| 后端服务修改 | ❌ 无 | 需要新增工具操作服务器源码 | 0% |
| 依赖管理 | ⚠️ 仅查看 | 缺少 AI 安装/更新依赖工具 | 30% |
| 环境变量管理 | ⚠️ 仅查看 | 缺少 AI 管理环境变量工具 | 30% |
| 代码重构 | ✅ 解耦/合并分析 | - | 80% |
| 代码补全 | ❌ 无 | Copilot 式实时补全（复杂度高） | 0% |

**开发能力综合完成度：约 35%**

#### 3.1.2 测试能力

| 需求项 | 现有能力 | 差距 | 完成度 |
|-------|---------|------|-------|
| 测试用例生成 | ✅ AI Debug 自动生成 | - | 90% |
| 测试执行 | ✅ AI Debug 自动运行 | - | 80% |
| 覆盖率分析 | ❌ 无 | 需要集成覆盖率工具 | 0% |
| 端到端测试 | ❌ 无 | 需要 E2E 测试框架集成 | 0% |
| 性能测试 | ❌ 无 | 需要性能测试工具 | 0% |
| 回归测试 | ❌ 无 | 需要测试用例持久化和批量运行 | 0% |

**测试能力综合完成度：约 30%**

#### 3.1.3 运维能力

| 需求项 | 现有能力 | 差距 | 完成度 |
|-------|---------|------|-------|
| 健康检查 | ⚠️ 仅 /health 端点 | 需要 AI 解读健康状态 | 40% |
| 依赖安装 | ❌ 无 AI 操作 | 需要 AI 工具执行 pnpm 命令 | 0% |
| 数据库操作 | ⚠️ 基础 CRUD | 需要 AI 工具执行数据库操作 | 30% |
| Docker 管理 | ❌ 无 | 需要 AI 工具管理容器 | 0% |
| Git 操作 | ⚠️ 基础同步 | 需要 AI 工具执行 Git 操作 | 20% |
| 定时任务管理 | ⚠️ 仅 CRUD | 需要 AI 理解并管理调度 | 40% |
| 日志清理 | ❌ 无 | 需要日志轮转和清理工具 | 0% |

**运维能力综合完成度：约 20%**

#### 3.1.4 监控能力

| 需求项 | 现有能力 | 差距 | 完成度 |
|-------|---------|------|-------|
| 执行日志分析 | ✅ `/log` 命令分析 | 需要增强实时性 | 70% |
| 调用统计 | ⚠️ 基础统计 | 需要可视化和趋势分析 | 40% |
| 错误追踪 | ✅ 执行日志记录错误 | 需要错误聚合和告警 | 50% |
| 性能监控 | ⚠️ 执行时间记录 | 需要 APM 级别监控 | 30% |
| 实时监控 | ❌ 无 | 需要 WebSocket 推送 | 0% |
| 告警通知 | ❌ 无 | 需要告警规则和通知渠道 | 0% |
| 审计追踪 | ✅ 完整审计日志 | - | 95% |

**监控能力综合完成度：约 45%**

#### 3.1.5 答疑能力（Chat）

| 需求项 | 现有能力 | 差距 | 完成度 |
|-------|---------|------|-------|
| 多轮对话 | ✅ 完整对话系统 | - | 95% |
| 上下文理解 | ✅ @ 引用函数 | 可扩展引用更多上下文 | 80% |
| 系统提示词 | ✅ 版本控制 | - | 95% |
| 知识库问答 | ❌ 无 | 需要 RAG 集成 | 0% |
| 文档引用 | ❌ 无 | 需要文档索引 | 0% |
| 历史搜索 | ⚠️ 基础 | 需要全文搜索增强 | 50% |

**答疑能力综合完成度：约 55%**

#### 3.1.6 找寻能力（向导）

| 需求项 | 现有能力 | 差距 | 完成度 |
|-------|---------|------|-------|
| 功能导航 | ❌ 无 | 需要功能图谱和导航系统 | 0% |
| 配置查找 | ❌ 无 | 需要配置索引 | 0% |
| 文档检索 | ❌ 无 | 需要文档搜索 | 0% |
| 使用教程 | ❌ 无 | 需要交互式教程 | 0% |
| 智能推荐 | ❌ 无 | 需要用户行为分析 | 0% |

**找寻能力综合完成度：约 0%**

### 3.2 综合完成度

```
┌─────────────────────────────────────────────────────────────┐
│                    能力完成度可视化                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  开发  ████████░░░░░░░░░░░░░░░░░░░░  35%                    │
│                                                             │
│  测试  ██████░░░░░░░░░░░░░░░░░░░░░░  30%                    │
│                                                             │
│  运维  ████░░░░░░░░░░░░░░░░░░░░░░░░  20%                    │
│                                                             │
│  监控  █████████░░░░░░░░░░░░░░░░░░░  45%                    │
│                                                             │
│  答疑  ███████████░░░░░░░░░░░░░░░░░  55%                    │
│                                                             │
│  找寻  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░   0%                    │
│                                                             │
│  ─────────────────────────────────────                      │
│  综合  ███████░░░░░░░░░░░░░░░░░░░░░  31%                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 开发路线图

### 4.1 阶段规划

```
Phase 1: Chat 功能增强（参考 Claude/ChatGPT 网页端）
    │
    ▼
Phase 2: 扩展开发能力（前后端操作 + 依赖管理）
    │
    ▼
Phase 3: 运维自动化（部署、容器、Git）
    │
    ▼
Phase 4: 测试增强（覆盖率、E2E、性能）
    │
    ▼
Phase 5: 智能向导（功能导航、推荐）
```

---

### 4.2 Phase 1: Chat 功能增强（建议 Sprint 10-12）

**目标**：对标 Claude/ChatGPT 网页端，打造一流的 AI 对话体验

> 参考来源：
> - [Claude Artifacts](https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them)
> - [ChatGPT Canvas](https://openai.com/index/introducing-canvas/)

#### 4.2.1 现有 Chat 功能

| 功能 | 状态 | 备注 |
|------|------|------|
| 多对话管理 | ✅ | 创建、切换、删除、星标、归档 |
| 流式输出 | ✅ | SSE 实时显示 |
| @ 引用函数 | ✅ | 树形选择器 |
| / 斜杠命令 | ✅ | 日志分析 |
| 系统提示词 | ✅ | 版本控制、回滚 |
| 模型选择 | ✅ | 多供应商、多模型 |
| 深度思考模式 | ✅ | 显示思考过程 |
| 操作卡片 | ✅ | 类似 Artifacts 的代码预览 |
| 标题编辑 | ✅ | 对话标题修改 |

#### 4.2.2 对标功能分析

**Claude 网页端特色功能**：
- **Artifacts** - 独立窗口展示代码/HTML，支持实时预览和执行
- **Projects** - 项目管理，添加文件作为上下文
- **分支对话** - 从某条消息重新开始
- **编辑历史消息** - 修改后重新生成
- **MCP 集成** - Model Context Protocol 扩展能力

**ChatGPT 网页端特色功能**：
- **Canvas** - 左右分屏，代码协作编辑
- **版本历史** - Show changes，代码对比
- **代码快捷操作** - Review code、Add logs、Add comments、Fix bugs
- **多格式导出** - PDF、Markdown、Word、代码文件
- **文件上传** - 上传文件作为上下文分析

---

#### Sprint 10: 消息操作与体验优化

| 任务 | 优先级 | 工作量 | 描述 |
|------|-------|-------|------|
| **AI 状态可视化** | P0 | 3 天 | 详细展示 AI 当前正在做什么 |
| 消息编辑重新生成 | P0 | 3 天 | 编辑用户消息后重新生成 AI 回复 |
| 分支对话 | P0 | 3 天 | 从任意消息处创建新分支 |
| 消息复制 | P0 | 0.5 天 | 一键复制消息内容 |
| 消息反馈 | P1 | 2 天 | 点赞/踩，收集反馈数据 |
| 快捷键支持 | P1 | 2 天 | Cmd+Enter 发送、Cmd+K 新对话等 |
| 对话全文搜索 | P1 | 2 天 | 搜索历史对话内容 |

**AI 状态可视化设计**：

让用户清晰了解 AI 当前正在做什么，提升信任感和可控性。

```
┌─────────────────────────────────────────────────────────────┐
│                    AI 状态展示层级                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Level 1: 高层状态                                          │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 🔄 正在分析代码结构...                                   │ │
│  │ ████████████░░░░░░░░ 60%                               │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  Level 2: 工具调用                                          │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 🔧 调用工具: analyze_code                               │ │
│  │    参数: { functionId: "xxx", depth: 3 }              │ │
│  │    状态: 执行中 ⏳                                      │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  Level 3: 思考过程（可展开）                                 │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 💭 思考中...                                            │ │
│  │ ┌─────────────────────────────────────────────────┐   │ │
│  │ │ 用户想要优化这个函数的性能。首先我需要分析        │   │ │
│  │ │ 代码结构，找出性能瓶颈。看起来有一个 N^2 的       │   │ │
│  │ │ 循环嵌套，可以优化为 O(N log N)...                │   │ │
│  │ └─────────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  Level 4: Token 消耗实时显示                                 │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 📊 本次对话: 输入 1,234 tokens | 输出 567 tokens       │ │
│  │    预估成本: $0.0123                                   │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**状态类型定义**：
```typescript
type AIStatus =
  | { type: 'idle' }
  | { type: 'thinking', content?: string }              // 思考中
  | { type: 'calling_tool', tool: string, params: any } // 调用工具
  | { type: 'executing', operation: string, progress?: number } // 执行操作
  | { type: 'streaming', tokens: number }               // 流式输出中
  | { type: 'waiting_confirm', operations: Operation[] } // 等待确认
  | { type: 'error', message: string }                  // 错误

interface AIStatusUpdate {
  status: AIStatus
  timestamp: number
  tokenUsage?: { input: number, output: number, cost: number }
}
```

**数据模型扩展**：
```typescript
// 消息表增加字段
interface AIMessage {
  // ... 现有字段
  parentMessageId?: ObjectId  // 分支：父消息 ID
  version: number             // 版本号（编辑后递增）
  feedback?: 'like' | 'dislike'
  feedbackNote?: string       // 反馈备注
}

// 对话表增加字段
interface AIConversation {
  // ... 现有字段
  rootMessageIds: ObjectId[]  // 分支树的根消息
}
```

**新增 API**：
```
PATCH /api/ai/messages/:id          # 编辑消息
POST  /api/ai/messages/:id/branch   # 从消息创建分支
POST  /api/ai/messages/:id/feedback # 消息反馈
GET   /api/ai/conversations/search  # 全文搜索
```

---

#### Sprint 11: Canvas 模式 - 代码协作编辑

| 任务 | 优先级 | 工作量 | 描述 |
|------|-------|-------|------|
| Canvas 布局 | P0 | 2 天 | 左右分屏：对话 + 代码编辑器 |
| Monaco 编辑器集成 | P0 | 2 天 | 复用现有 Monaco 组件 |
| 代码同步 | P0 | 3 天 | AI 修改实时同步到编辑器 |
| 代码快捷操作 | P1 | 3 天 | Review code、Add logs、Add comments |
| Diff 对比视图 | P1 | 2 天 | 显示 AI 修改前后对比 |
| 版本历史 | P2 | 2 天 | 代码版本列表和回滚 |

**UI 设计**：
```
┌─────────────────────────────────────────────────────────────────┐
│  [对话列表 ▼]  [模型选择 ▼]  [深度思考 □]       [Canvas ⟷] [✕] │
├────────────────────────────────┬────────────────────────────────┤
│                                │  ┌────────────────────────────┐│
│  对话消息区域                    │  │ function.ts        [▼ v3]││
│                                │  ├────────────────────────────┤│
│  ┌─────────────────────────┐  │  │                            ││
│  │ 用户: 帮我优化这个函数    │  │  │  // 代码编辑区域           ││
│  └─────────────────────────┘  │  │                            ││
│                                │  │  export default async...  ││
│  ┌─────────────────────────┐  │  │                            ││
│  │ AI: 我来帮你优化...       │  │  └────────────────────────────┤│
│  │ [应用到编辑器]            │  │  ┌────────────────────────────┐│
│  └─────────────────────────┘  │  │ [Review] [Logs] [Comments] ││
│                                │  │ [Format] [Run] [Save]      ││
├────────────────────────────────┤  └────────────────────────────┘│
│ 输入消息... (@引用 /命令)  [➤] │                                │
└────────────────────────────────┴────────────────────────────────┘
```

**代码快捷操作定义**：
```typescript
const canvasActions = [
  { key: 'review', label: 'Review code', icon: '🔍', prompt: '审查这段代码，指出问题和改进建议' },
  { key: 'logs', label: 'Add logs', icon: '📝', prompt: '在关键位置添加调试日志' },
  { key: 'comments', label: 'Add comments', icon: '💬', prompt: '为代码添加清晰的注释' },
  { key: 'fix', label: 'Fix bugs', icon: '🐛', prompt: '检测并修复代码中的问题' },
  { key: 'optimize', label: 'Optimize', icon: '⚡', prompt: '优化代码性能' },
  { key: 'types', label: 'Add types', icon: '📐', prompt: '添加 TypeScript 类型定义' },
]
```

---

#### Sprint 12: Artifacts 增强与导出

| 任务 | 优先级 | 工作量 | 描述 |
|------|-------|-------|------|
| HTML 实时预览 | P0 | 3 天 | Artifacts 中预览 HTML/CSS/JS |
| React 组件预览 | P1 | 3 天 | 预览 React 组件（沙箱执行） |
| 对话导出 | P0 | 2 天 | Markdown / JSON 格式导出 |
| 代码导出 | P1 | 1 天 | 导出代码到对应文件格式 |
| 文件上传 | P1 | 3 天 | 上传文件作为上下文 |
| 图片粘贴 | P2 | 2 天 | 粘贴图片发送（需多模态模型） |

**Artifacts 预览架构**：
```typescript
// Artifacts 类型
type ArtifactType =
  | 'code'       // 代码块（现有）
  | 'html'       // HTML 页面预览
  | 'react'      // React 组件预览
  | 'svg'        // SVG 图形
  | 'mermaid'    // Mermaid 图表
  | 'markdown'   // Markdown 渲染

interface Artifact {
  id: string
  type: ArtifactType
  title: string
  content: string
  language?: string
}
```

**预览沙箱**：
```typescript
// 使用 iframe sandbox 安全预览
const PreviewSandbox = ({ html }: { html: string }) => (
  <iframe
    sandbox="allow-scripts"
    srcDoc={html}
    style={{ width: '100%', height: '400px', border: 'none' }}
  />
)
```

**导出格式**：
```typescript
// 对话导出 API
GET /api/ai/conversations/:id/export?format=markdown|json

// Markdown 导出示例
# 对话: 函数优化讨论
日期: 2025-01-20
模型: Claude Sonnet 4

## 用户
帮我优化这个函数

## AI
我来帮你优化...

\`\`\`typescript
// 优化后的代码
\`\`\`
```

**文件上传**：
```typescript
// 支持的文件类型
const ALLOWED_FILE_TYPES = [
  'text/plain',
  'text/markdown',
  'application/json',
  'text/javascript',
  'text/typescript',
  'image/png',
  'image/jpeg',
  'application/pdf',  // 需要 PDF 解析
]

// 上传 API
POST /api/ai/conversations/:id/files
Content-Type: multipart/form-data
```

---

#### 4.2.3 Chat 功能增强总览

| 功能 | Sprint | 优先级 | 对标 |
|------|--------|-------|------|
| 消息编辑重新生成 | 10 | P0 | Claude/ChatGPT |
| 分支对话 | 10 | P0 | Claude |
| 消息复制 | 10 | P0 | 通用 |
| 消息反馈 | 10 | P1 | ChatGPT |
| 快捷键支持 | 10 | P1 | 通用 |
| Canvas 分屏模式 | 11 | P0 | ChatGPT Canvas |
| 代码快捷操作 | 11 | P1 | ChatGPT Canvas |
| Diff 对比视图 | 11 | P1 | ChatGPT Canvas |
| HTML 实时预览 | 12 | P0 | Claude Artifacts |
| 对话导出 | 12 | P0 | Claude/ChatGPT |
| 文件上传 | 12 | P1 | ChatGPT |

---

### 4.3 Phase 1.5: 监控增强（可选，Sprint 13）

> 如果时间允许，可在 Chat 增强后补充监控能力

| 任务 | 优先级 | 工作量 | 描述 |
|------|-------|-------|------|
| 实时监控 WebSocket | P1 | 3 天 | 函数调用实时推送到前端 |
| 调用统计仪表板 | P1 | 2 天 | 可视化展示调用量、成功率、延迟 |
| 错误聚合分析 | P2 | 2 天 | 相同错误聚合，显示趋势 |

**新增工具**：
```typescript
{
  name: 'get_function_metrics',
  description: '获取函数调用统计（调用量、成功率、平均延迟）',
  parameters: { functionId?: string, period: '1h' | '24h' | '7d' }
}

{
  name: 'get_error_summary',
  description: '获取错误汇总（按类型聚合）',
  parameters: { functionId?: string, period: '24h' | '7d' }
}
```

### 4.4 Phase 2: 扩展开发能力（建议 Sprint 14-16）

**目标**：AI 能够操作整个项目代码，而非仅限于云函数

#### Sprint 14: 项目代码操作

| 任务 | 优先级 | 工作量 | 描述 |
|------|-------|-------|------|
| 项目文件读取 | P0 | 2 天 | AI 读取任意项目文件 |
| 项目文件写入 | P0 | 3 天 | AI 修改任意项目文件（安全限制） |
| 代码搜索 | P1 | 2 天 | 在项目中搜索代码片段 |
| 依赖分析 | P1 | 2 天 | 分析 import/require 关系 |

**新增工具**：
```typescript
{
  name: 'read_project_file',
  description: '读取项目文件内容',
  parameters: { path: string, lineStart?: number, lineEnd?: number }
}

{
  name: 'write_project_file',
  description: '写入项目文件（需要用户确认）',
  parameters: { path: string, content: string, createBackup?: boolean }
}

{
  name: 'search_code',
  description: '在项目中搜索代码',
  parameters: { query: string, filePattern?: string, caseSensitive?: boolean }
}

{
  name: 'get_file_tree',
  description: '获取项目文件树',
  parameters: { path?: string, depth?: number, exclude?: string[] }
}
```

#### Sprint 15: 依赖管理

| 任务 | 优先级 | 工作量 | 描述 |
|------|-------|-------|------|
| 依赖安装 | P0 | 2 天 | AI 执行 pnpm add |
| 依赖更新 | P1 | 2 天 | AI 执行 pnpm update |
| 安全审计 | P1 | 2 天 | npm audit 集成 |
| 版本建议 | P2 | 2 天 | AI 建议依赖版本 |

**新增工具**：
```typescript
{
  name: 'install_dependency',
  description: '安装 NPM 依赖（需要用户确认）',
  parameters: { packages: string[], dev?: boolean }
}

{
  name: 'update_dependency',
  description: '更新 NPM 依赖',
  parameters: { packages: string[], latest?: boolean }
}

{
  name: 'audit_dependencies',
  description: '安全审计依赖',
  parameters: {}
}
```

#### Sprint 16: 环境变量与配置

| 任务 | 优先级 | 工作量 | 描述 |
|------|-------|-------|------|
| 环境变量 CRUD | P0 | 2 天 | AI 管理环境变量 |
| 配置文件管理 | P1 | 2 天 | AI 读写配置文件 |
| 敏感信息保护 | P0 | 2 天 | 防止 AI 泄露敏感信息 |

**新增工具**：
```typescript
{
  name: 'set_env_variable',
  description: '设置环境变量（敏感信息脱敏显示）',
  parameters: { key: string, value: string, isSecret?: boolean }
}

{
  name: 'delete_env_variable',
  description: '删除环境变量',
  parameters: { key: string }
}
```

---

### 4.5 Phase 3: Git 与数据库增强（建议 Sprint 17-18）

**目标**：AI 具备 Git 同步和数据库分析能力

> 注：容器管理不在规划范围内，Simple IDE 采用轻量级单镜像部署，无需复杂的容器编排

#### Sprint 17: Git 操作增强

| 任务 | 优先级 | 工作量 | 描述 |
|------|-------|-------|------|
| Git 状态查看 | P0 | 1 天 | AI 查看 Git 状态 |
| Git Commit | P0 | 2 天 | AI 提交代码（需确认） |
| Git Branch | P1 | 2 天 | AI 管理分支 |
| Git Diff | P1 | 1 天 | AI 分析代码变更 |
| Git Pull/Push | P1 | 2 天 | AI 同步远程仓库 |

**新增工具**：
```typescript
{
  name: 'git_status',
  description: '获取 Git 仓库状态',
  parameters: {}
}

{
  name: 'git_commit',
  description: '提交代码更改（需要用户确认）',
  parameters: { message: string, files?: string[] }
}

{
  name: 'git_diff',
  description: '查看代码变更',
  parameters: { ref?: string, path?: string }
}

{
  name: 'git_sync',
  description: '同步远程仓库（pull/push）',
  parameters: { action: 'pull' | 'push', remote?: string, branch?: string }
}
```

#### Sprint 18: 数据库增强

| 任务 | 优先级 | 工作量 | 描述 |
|------|-------|-------|------|
| 集合分析 | P0 | 2 天 | AI 分析集合结构 |
| 查询优化建议 | P1 | 3 天 | AI 建议索引优化 |
| 数据导出 | P1 | 2 天 | AI 导出集合数据 |

**新增工具**：
```typescript
{
  name: 'analyze_collection',
  description: '分析 MongoDB 集合结构和数据分布',
  parameters: { collection: string }
}

{
  name: 'suggest_indexes',
  description: '建议集合索引优化',
  parameters: { collection: string }
}

{
  name: 'execute_query',
  description: '执行 MongoDB 查询（只读）',
  parameters: { collection: string, query: object, limit?: number }
}
```

---

### 4.6 Phase 4: 测试增强（建议 Sprint 19-20）

**目标**：完善测试自动化能力

#### Sprint 19: 测试框架集成

| 任务 | 优先级 | 工作量 | 描述 |
|------|-------|-------|------|
| Jest 集成 | P0 | 3 天 | AI 运行项目测试 |
| 覆盖率报告 | P1 | 2 天 | 生成覆盖率报告 |
| 测试用例持久化 | P1 | 2 天 | 保存 AI 生成的测试用例 |

#### Sprint 20: 高级测试（可选）

| 任务 | 优先级 | 工作量 | 描述 |
|------|-------|-------|------|
| E2E 测试 | P2 | 4 天 | Playwright 集成 |
| 性能测试 | P2 | 3 天 | 基准测试工具 |
| 回归测试 | P2 | 3 天 | 批量运行历史测试 |

---

### 4.7 Phase 5: 智能向导（建议 Sprint 21-22）

**目标**：AI 成为平台的智能导航员

#### Sprint 21: 功能图谱

| 任务 | 优先级 | 工作量 | 描述 |
|------|-------|-------|------|
| 功能索引 | P1 | 3 天 | 建立功能清单和描述 |
| 路由映射 | P1 | 2 天 | API 到功能的映射 |
| 使用统计 | P2 | 2 天 | 功能使用频率统计 |

#### Sprint 22: 智能推荐

| 任务 | 优先级 | 工作量 | 描述 |
|------|-------|-------|------|
| 行为分析 | P2 | 3 天 | 分析用户使用模式 |
| 智能建议 | P2 | 3 天 | 根据上下文推荐功能 |
| 交互教程 | P2 | 3 天 | 引导式功能教学 |

---

## 5. 技术架构设计

### 5.1 增强后的工具系统

```
┌───────────────────────────────────────────────────────────────────┐
│                        AI 工具分类体系                              │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│  │  函数管理工具    │  │   项目操作工具   │  │   运维操作工具   │   │
│  │ (现有 6 个)      │  │  (新增 6 个)     │  │  (新增 9 个)     │   │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤   │
│  │ create_function │  │ read_project_   │  │ docker_status   │   │
│  │ update_function │  │   file          │  │ docker_logs     │   │
│  │ delete_function │  │ write_project_  │  │ docker_restart  │   │
│  │ rename_function │  │   file          │  │ git_status      │   │
│  │ move_function   │  │ search_code     │  │ git_commit      │   │
│  │ create_folder   │  │ get_file_tree   │  │ git_diff        │   │
│  └─────────────────┘  │ install_dep     │  │ health_check    │   │
│                       │ update_dep      │  │ restart_service │   │
│                       └─────────────────┘  │ clear_cache     │   │
│                                            └─────────────────┘   │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│  │   监控分析工具   │  │   数据库工具     │  │   知识库工具     │   │
│  │  (新增 5 个)     │  │  (新增 4 个)     │  │  (新增 3 个)     │   │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤   │
│  │ get_function_   │  │ analyze_        │  │ search_docs     │   │
│  │   metrics       │  │   collection    │  │ get_doc_content │   │
│  │ get_error_      │  │ suggest_indexes │  │ index_docs      │   │
│  │   summary       │  │ execute_query   │  └─────────────────┘   │
│  │ create_alert_   │  │ export_data     │                        │
│  │   rule          │  └─────────────────┘                        │
│  │ get_realtime_   │                                             │
│  │   stats         │                                             │
│  └─────────────────┘                                             │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐                        │
│  │   测试工具       │  │   站点工具       │                        │
│  │  (新增 4 个)     │  │  (现有 4 个)     │                        │
│  ├─────────────────┤  ├─────────────────┤                        │
│  │ run_tests       │  │ site_create_    │                        │
│  │ get_coverage    │  │   file          │                        │
│  │ save_test_case  │  │ site_update_    │                        │
│  │ run_benchmark   │  │   file          │                        │
│  └─────────────────┘  │ site_delete_    │                        │
│                       │   file          │                        │
│                       │ site_create_    │                        │
│                       │   folder        │                        │
│                       └─────────────────┘                        │
│                                                                   │
│  工具总数: 现有 16 个 + 新增 31 个 = 47 个                          │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### 5.2 安全模型

```
┌───────────────────────────────────────────────────────────────┐
│                       AI 操作安全模型                          │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  操作分级:                                                     │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Level 0 - 只读操作（自动执行）                           │ │
│  │  • 读取文件、查看状态、搜索代码、分析日志                   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Level 1 - 低风险写入（自动执行 + 可回滚）                 │ │
│  │  • 创建/修改云函数、站点文件、环境变量                      │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Level 2 - 中风险操作（需要用户确认）                      │ │
│  │  • 修改项目源码、安装依赖、Git 提交                        │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Level 3 - 高风险操作（需要二次确认 + 备份）               │ │
│  │  • 删除文件、数据库写入、容器重启、生产部署                 │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  敏感信息保护:                                                 │
│  • API Key / Token 脱敏显示                                   │
│  • 密码类环境变量不返回给 AI                                   │
│  • 生产数据查询结果脱敏                                        │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 5.3 实时监控架构

```
┌───────────────────────────────────────────────────────────────┐
│                     实时监控架构                               │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  函数执行                                                      │
│      │                                                        │
│      ▼                                                        │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐                 │
│  │ 执行日志 │ ──► │ 事件队列 │ ──► │ 统计聚合 │                 │
│  │(MongoDB)│     │ (内存)   │     │ (Redis) │                 │
│  └─────────┘     └────┬────┘     └────┬────┘                 │
│                       │               │                       │
│                       ▼               ▼                       │
│                  ┌─────────┐     ┌─────────┐                 │
│                  │WebSocket│     │ 告警引擎 │                 │
│                  │ Server  │     │         │                 │
│                  └────┬────┘     └────┬────┘                 │
│                       │               │                       │
│                       ▼               ▼                       │
│                  ┌─────────┐     ┌─────────┐                 │
│                  │ 前端实时 │     │通知渠道  │                 │
│                  │  仪表板  │     │Webhook  │                 │
│                  └─────────┘     └─────────┘                 │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 5.4 GOI (Goal-Oriented Interface) 设计原则

> 参考论文：[arXiv:2510.04607](https://arxiv.org/abs/2510.04607) - Goal-Oriented Interface

GOI 是一种面向目标的界面设计范式，通过三个声明式原语（access、state、observation）让 AI 更高效地理解和操作系统，相比传统 DOM 操作可减少 43.5% 的 LLM 调用，提升 67% 的成功率。

#### 5.4.1 三个核心原语

```
┌───────────────────────────────────────────────────────────────┐
│                    GOI 三原语模型                              │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  ACCESS (访问)                                          │ │
│  │  定义 AI 可以执行的操作，声明式而非命令式                   │ │
│  │                                                         │ │
│  │  示例:                                                   │ │
│  │  {                                                      │ │
│  │    "access": {                                          │ │
│  │      "createFunction": { "name": "string", "code": "string" },│ │
│  │      "updateFunction": { "id": "string", "code": "string" }, │ │
│  │      "deleteFunction": { "id": "string" }               │ │
│  │    }                                                    │ │
│  │  }                                                      │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  STATE (状态)                                           │ │
│  │  描述系统当前状态，让 AI 了解上下文                        │ │
│  │                                                         │ │
│  │  示例:                                                   │ │
│  │  {                                                      │ │
│  │    "state": {                                           │ │
│  │      "currentFunction": { "id": "xxx", "name": "getUserById" },│ │
│  │      "editorContent": "export default async function...", │ │
│  │      "hasUnsavedChanges": true,                         │ │
│  │      "lastError": { "type": "TypeError", "line": 12 }   │ │
│  │    }                                                    │ │
│  │  }                                                      │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  OBSERVATION (观察)                                     │ │
│  │  操作结果反馈，让 AI 知道发生了什么                        │ │
│  │                                                         │ │
│  │  示例:                                                   │ │
│  │  {                                                      │ │
│  │    "observation": {                                     │ │
│  │      "action": "createFunction",                        │ │
│  │      "success": true,                                   │ │
│  │      "result": { "id": "new-fn-123", "publishUrl": "/invoke/..." },│ │
│  │      "sideEffects": ["functionListUpdated", "auditLogCreated"]│ │
│  │    }                                                    │ │
│  │  }                                                      │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

#### 5.4.2 应用于 Simple IDE

```typescript
// GOI 协议定义
interface SimpleIDEGOI {
  // ACCESS: AI 可执行的操作
  access: {
    // 函数操作
    function: {
      create: (params: { name: string, code: string, folderId?: string }) => Promise<FunctionResult>
      update: (params: { id: string, code: string }) => Promise<FunctionResult>
      delete: (params: { id: string }) => Promise<void>
      rename: (params: { id: string, newName: string }) => Promise<void>
      run: (params: { id: string, input?: any }) => Promise<ExecutionResult>
    }
    // 站点操作
    site: {
      createFile: (params: { path: string, content: string }) => Promise<void>
      updateFile: (params: { path: string, content: string }) => Promise<void>
      deleteFile: (params: { path: string }) => Promise<void>
    }
    // 项目操作 (Phase 2)
    project: {
      readFile: (params: { path: string }) => Promise<string>
      writeFile: (params: { path: string, content: string }) => Promise<void>
      search: (params: { query: string, pattern?: string }) => Promise<SearchResult[]>
    }
  }

  // STATE: 当前系统状态
  state: {
    workspace: {
      currentFunction: Function | null
      selectedFunctions: Function[]
      openTabs: Tab[]
      unsavedChanges: Record<string, boolean>
    }
    editor: {
      content: string
      language: string
      cursorPosition: { line: number, column: number }
      selection: { start: Position, end: Position } | null
    }
    execution: {
      lastRun: ExecutionLog | null
      lastError: Error | null
    }
    conversation: {
      id: string
      messageCount: number
      enabledTools: string[]
    }
  }

  // OBSERVATION: 操作结果观察
  observation: {
    action: string
    success: boolean
    result?: any
    error?: { code: string, message: string }
    duration: number
    sideEffects: string[]
  }
}
```

#### 5.4.3 GOI 增强的 AI 状态反馈

```
┌───────────────────────────────────────────────────────────────┐
│                GOI 驱动的状态展示                               │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  当前状态 (STATE):                                            │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ 📂 工作区: getUserById.ts (已修改)                       │ │
│  │ ⚠️ 上次错误: TypeError at line 12                       │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  可用操作 (ACCESS):                                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ [保存并运行] [修复错误] [添加日志] [重构] [发布]           │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  操作历史 (OBSERVATION):                                      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ ✅ update_function - 200ms                              │ │
│  │ ❌ run_function - TypeError: Cannot read property...    │ │
│  │ ✅ explain_error - 分析完成                              │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 5.5 SKILL 技能系统架构

> 参考：Anthropic Agent Skills Framework - 渐进式披露、按需加载上下文

SKILL 系统将 AI 能力模块化为独立的"技能"，每个技能有明确的职责边界、触发条件和上下文需求，实现按需加载而非一次性注入所有能力。

#### 5.5.1 技能定义结构

```typescript
interface AISkill {
  // 技能元信息
  id: string                           // 唯一标识
  name: string                         // 显示名称
  description: string                  // 功能描述
  version: string                      // 版本号

  // 触发条件
  triggers: {
    keywords: string[]                 // 关键词触发
    patterns: RegExp[]                 // 正则匹配
    contextConditions: ContextCondition[] // 上下文条件
    userIntent: string[]               // 意图分类
  }

  // 能力定义
  capabilities: {
    tools: string[]                    // 可用工具
    actions: ActionDefinition[]        // 可执行动作
    permissions: Permission[]          // 所需权限
  }

  // 上下文需求
  context: {
    required: ContextRequirement[]     // 必需上下文
    optional: ContextRequirement[]     // 可选上下文
    excludes: string[]                 // 排斥的上下文
  }

  // 系统提示词片段
  systemPromptFragment: string

  // 技能生命周期
  lifecycle: {
    onActivate?: () => Promise<void>   // 激活时
    onDeactivate?: () => Promise<void> // 停用时
    onError?: (error: Error) => void   // 错误处理
  }
}
```

#### 5.5.2 预定义技能集

```
┌───────────────────────────────────────────────────────────────┐
│                      SKILL 技能矩阵                            │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│  │ 🔧 代码开发技能  │  │ 🐛 调试诊断技能  │  │ 📊 监控分析技能  ││
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤│
│  │ 触发: "创建函数" │  │ 触发: "为什么报错"│  │ 触发: "日志分析" ││
│  │ "写一个API"     │  │ "修复bug"       │  │ "调用统计"       ││
│  │                 │  │ "不工作了"      │  │ "性能问题"       ││
│  │ 工具:           │  │                 │  │                 ││
│  │ create_function │  │ 工具:           │  │ 工具:           ││
│  │ update_function │  │ debug_function  │  │ get_metrics     ││
│  │ analyze_refactor│  │ run_function    │  │ get_error_logs  ││
│  │                 │  │ explain_code    │  │ analyze_logs    ││
│  │ 上下文需求:     │  │                 │  │                 ││
│  │ - 函数列表      │  │ 上下文需求:     │  │ 上下文需求:     ││
│  │ - 文件夹结构    │  │ - 当前函数代码  │  │ - 执行日志      ││
│  │                 │  │ - 最近错误      │  │ - 调用统计      ││
│  └─────────────────┘  └─────────────────┘  └─────────────────┘│
│                                                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│  │ 🌐 建站技能      │  │ 🔍 代码审查技能  │  │ 📖 问答技能     ││
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤│
│  │ 触发: "创建网页" │  │ 触发: "review"  │  │ 触发: 通用问答  ││
│  │ "建一个站点"    │  │ "检查代码"      │  │ "怎么用"        ││
│  │ "HTML页面"      │  │ "有没有问题"    │  │ "是什么"        ││
│  │                 │  │                 │  │                 ││
│  │ 工具:           │  │ 工具:           │  │ 工具:           ││
│  │ site_create_*   │  │ analyze_quality │  │ 无特定工具      ││
│  │ site_update_*   │  │ analyze_security│  │                 ││
│  │                 │  │ analyze_perf    │  │ 上下文需求:     ││
│  │ 上下文需求:     │  │                 │  │ - 对话历史      ││
│  │ - 站点文件树    │  │ 上下文需求:     │  │ - 系统提示词    ││
│  │ - 当前站点配置  │  │ - 选中的代码    │  │                 ││
│  └─────────────────┘  └─────────────────┘  └─────────────────┘│
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

#### 5.5.3 技能加载流程

```
┌───────────────────────────────────────────────────────────────┐
│                    SKILL 渐进式加载                            │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  用户消息: "帮我修复 getUserById 函数的 TypeError 错误"         │
│                                                               │
│      │                                                        │
│      ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Step 1: 意图识别                                        │ │
│  │ - 关键词匹配: "修复", "TypeError", "错误"               │ │
│  │ - 意图分类: debug                                       │ │
│  └─────────────────────────────────────────────────────────┘ │
│      │                                                        │
│      ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Step 2: 技能匹配                                        │ │
│  │ - 匹配技能: 🐛 调试诊断技能                              │ │
│  │ - 评分: 0.95 (高匹配度)                                 │ │
│  └─────────────────────────────────────────────────────────┘ │
│      │                                                        │
│      ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Step 3: 上下文加载                                      │ │
│  │ - 加载: getUserById 函数代码                            │ │
│  │ - 加载: 最近执行日志和错误信息                           │ │
│  │ - 跳过: 函数列表 (非必需)                               │ │
│  └─────────────────────────────────────────────────────────┘ │
│      │                                                        │
│      ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Step 4: 组装 Prompt                                     │ │
│  │ - 基础系统提示 + 技能片段 + 上下文 + 用户消息             │ │
│  │ - 可用工具: debug_function, run_function, explain_code  │ │
│  └─────────────────────────────────────────────────────────┘ │
│      │                                                        │
│      ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Step 5: 执行并观察                                      │ │
│  │ - AI 调用 debug_function                                │ │
│  │ - 返回诊断结果和修复建议                                 │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

#### 5.5.4 技能管理 API

```typescript
// 技能注册
skillRegistry.register({
  id: 'debug-skill',
  name: '调试诊断技能',
  triggers: {
    keywords: ['修复', 'bug', '报错', '错误', '不工作', 'TypeError', 'Error'],
    patterns: [/为什么.*?失败/, /怎么.*?报错/],
    userIntent: ['debug', 'fix', 'troubleshoot']
  },
  capabilities: {
    tools: ['debug_function', 'run_function', 'explain_code', 'update_function'],
    permissions: ['read:functions', 'execute:functions', 'write:functions']
  },
  context: {
    required: [
      { type: 'function', source: 'mentioned_or_selected' },
      { type: 'recentErrors', source: 'execution_logs', limit: 5 }
    ],
    optional: [
      { type: 'relatedFunctions', source: 'import_analysis' }
    ]
  },
  systemPromptFragment: `
你现在处于调试模式。你的目标是帮助用户找出并修复代码问题。
分析步骤:
1. 仔细阅读错误信息和代码
2. 定位问题根源
3. 提供清晰的修复方案
4. 如果需要修改代码，使用 update_function 工具
`
})

// 技能查询 API
GET /api/ai/skills                    // 获取所有技能列表
GET /api/ai/skills/:id                // 获取技能详情
POST /api/ai/skills/match             // 匹配用户意图到技能
PUT /api/ai/skills/:id/toggle         // 启用/禁用技能

// 技能执行追踪
interface SkillExecution {
  skillId: string
  conversationId: string
  matchScore: number
  loadedContext: string[]
  toolsUsed: string[]
  duration: number
  success: boolean
}
```

#### 5.5.5 与现有系统提示词的关系

```
┌───────────────────────────────────────────────────────────────┐
│              系统提示词演进: 静态 → 动态 SKILL                   │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  现有系统 (静态):                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ SystemPrompt (版本控制)                                  │ │
│  │ - 全量加载所有能力描述                                    │ │
│  │ - 所有工具一次性注入                                      │ │
│  │ - Token 消耗固定                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│                          ▼                                    │
│                                                               │
│  SKILL 系统 (动态):                                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ BasePrompt (精简)                                        │ │
│  │    +                                                     │ │
│  │ SkillFragment (按需加载)                                  │ │
│  │    +                                                     │ │
│  │ ContextData (动态注入)                                   │ │
│  │    =                                                     │ │
│  │ FinalPrompt (优化后)                                     │ │
│  │                                                          │ │
│  │ 优势:                                                     │ │
│  │ - Token 消耗降低 30-50%                                  │ │
│  │ - 响应更精准 (专注于特定任务)                             │ │
│  │ - 工具选择更准确 (只暴露相关工具)                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 6. 优先级评估

### 6.1 价值-复杂度矩阵

```
高价值 │
       │  ┌───────────────┐    ┌───────────────┐
       │  │ Canvas 模式   │    │ 项目代码操作  │
       │  │ Sprint 11     │    │ Sprint 14     │
       │  └───────────────┘    └───────────────┘
       │
       │  ┌───────────────┐    ┌───────────────┐
       │  │ 消息操作增强  │    │ Git 操作      │
       │  │ Sprint 10     │    │ Sprint 17     │
       │  └───────────────┘    └───────────────┘
       │
       │  ┌───────────────┐    ┌───────────────┐
       │  │ Artifacts增强 │    │ 数据库增强    │
       │  │ Sprint 12     │    │ Sprint 18     │
       │  └───────────────┘    └───────────────┘
       │
低价值 │  ┌───────────────┐    ┌───────────────┐
       │  │ 智能推荐      │    │ E2E 测试      │
       │  │ Sprint 22     │    │ Sprint 20     │
       │  └───────────────┘    └───────────────┘
       │
       └──────────────────────────────────────────►
              低复杂度                    高复杂度
```

### 6.2 推荐实施顺序

| 阶段 | Sprint | 核心交付 | 预期价值 |
|------|--------|---------|---------|
| **Phase 1** | 10-12 | Chat 增强（Canvas + Artifacts + 导出） | 对标 Claude/ChatGPT 体验 |
| **Phase 1.5** | 13 | 实时监控（可选） | 问题定位能力 |
| **Phase 2** | 14-16 | 项目操作 + 依赖 + 配置 | AI 可操控全部代码 |
| **Phase 3** | 17-18 | Git + 数据库 | 版本控制与数据分析 |
| **Phase 4** | 19-20 | 测试增强 | 质量保障 |
| **Phase 5** | 21-22 | 智能向导 | 用户体验 |

---

## 7. 风险与挑战

### 7.1 技术风险

| 风险 | 等级 | 缓解措施 |
|------|------|---------|
| **AI 执行错误** | 高 | 分级确认机制、自动备份、回滚能力 |
| **敏感信息泄露** | 高 | 脱敏处理、权限控制、审计日志 |
| **Canvas 性能** | 中 | Monaco 编辑器优化、虚拟滚动 |
| **Artifacts 安全** | 中 | iframe sandbox、CSP 策略 |
| **工具爆炸** | 中 | 工具分组、动态加载、智能选择 |

### 7.2 产品风险

| 风险 | 等级 | 缓解措施 |
|------|------|---------|
| **用户信任** | 高 | 透明展示 AI 操作、可撤销机制 |
| **学习曲线** | 中 | 渐进式引导、示例丰富 |
| **期望过高** | 中 | 明确能力边界、合理引导 |

### 7.3 资源风险

| 风险 | 等级 | 缓解措施 |
|------|------|---------|
| **开发周期** | 中 | MVU 原则、增量交付 |
| **API 成本** | 中 | 本地模型支持、缓存策略 |
| **维护成本** | 中 | 模块化设计、自动化测试 |

---

## 8. 总结

### 8.1 现状

Simple IDE v2.0.0 已经具备相当成熟的 AI 辅助编程能力（Sprint 5-9），特别是在：
- 云函数生成与调试
- 多轮对话与上下文理解
- 审计追踪与安全保护

### 8.2 差距

距离"全能 AI 助手"愿景（综合完成度约 31%），主要差距在于：
- **运维能力几乎为零**（20%）
- **平台向导完全缺失**（0%）
- **开发能力局限于云函数**（35%）

### 8.3 路径

通过 13 个 Sprint（约 6.5 个月）的迭代开发，预计可将综合完成度提升至 85% 以上：

```
当前: ███████░░░░░░░░░░░░░░░░░░░░░░░  31%

Phase 1 后: ████████████████░░░░░░░░░░░  55%  (Chat 对标 Claude/ChatGPT)

Phase 2 后: ████████████████████░░░░░░░  65%

Phase 3 后: ██████████████████████░░░░░  72%  (Git + 数据库)

Phase 4 后: █████████████████████████░░  82%

Phase 5 后: ██████████████████████████░  88%
```

### 8.4 下一步行动

1. **确认 Phase 1（Chat 增强）的优先级和资源**
2. **开始 Sprint 10 的详细设计（消息操作优化）**
3. **评估 Canvas 模式与现有 Monaco Editor 的集成方案**
4. **设计 Artifacts 预览的安全沙箱架构**

---

*文档结束*
