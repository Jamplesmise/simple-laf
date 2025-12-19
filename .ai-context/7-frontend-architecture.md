# 7. 前端架构 (Frontend Architecture)

## 页面 (pages/)

| 文件 | 用途 |
|------|------|
| `IDE.tsx` | 主 IDE 页面，三栏布局 (函数列表/编辑器/调试面板) |
| `Login.tsx` | 登录页面 |
| `Register.tsx` | 注册页面 |

## 核心组件 (components/)

### 布局与导航

| 组件 | 用途 | 修改场景 |
|------|------|---------|
| `Header.tsx` | 顶部导航栏，用户信息，主题切换 | 添加全局按钮/菜单 |
| `FunctionTree.tsx` | 左侧文件夹树 + 函数列表 | 文件夹/函数展示逻辑 |
| `EditorTabs.tsx` | 编辑器标签页管理 | 多文件编辑体验 |
| `GlobalSearch.tsx` | 全局搜索弹窗 (Cmd/Ctrl+K) | 搜索功能增强 |

### 编辑器区域

| 组件 | 用途 | 修改场景 |
|------|------|---------|
| `Editor.tsx` | Monaco 编辑器封装，LSP 集成 | 编辑器功能/快捷键 |
| `RightPanel/index.tsx` | 右侧面板容器 (API链接/调试/版本历史) | 面板布局 |
| `RightPanel/DebugPanel.tsx` | 接口调试面板 (方法选择/运行按钮) | 调试 UI |
| `RightPanel/ParamsEditor.tsx` | 参数编辑器 (Body/Query/Headers Tab) | 请求参数 UI |
| `RightPanel/VersionHistory.tsx` | 版本历史列表 | 版本管理 UI |

### 调试与输出

| 组件 | 用途 | 修改场景 |
|------|------|---------|
| `DebugPanel.tsx` | 调试面板容器 (Console/Result/History) | 调试区域布局 |
| `ConsolePanel.tsx` | 控制台日志输出 | 日志显示格式 |
| `ResultPanel.tsx` | 执行结果 JSON 展示 | 结果显示格式 |
| `ExecutionHistory.tsx` | 执行历史记录列表 | 历史记录 UI |
| `LogViewerModal/index.tsx` | 全局日志查看器弹窗 | 日志分析 UI |

### 弹窗与设置

| 组件 | 用途 | 修改场景 |
|------|------|---------|
| `SettingsModal.tsx` | 设置弹窗 (环境变量/AI/提示词/域名/Token/Git) | 添加设置 Tab |
| `PublishModal.tsx` | 发布确认弹窗 | 发布流程 |
| `PublishButton.tsx` | 发布按钮状态管理 | 发布按钮样式 |

### 版本与同步

| 组件 | 用途 | 修改场景 |
|------|------|---------|
| `VersionHistory.tsx` | 版本历史列表 + 回滚 | 版本管理 UI |
| `DiffViewer.tsx` | 代码差异对比视图 | Diff 显示 |
| `GitPanel.tsx` | Git 同步配置 (在设置中) | Git 配置 UI |
| `GitSyncDialog.tsx` | Git 同步预览弹窗 (选择性同步/冲突) | 同步流程 UI |

### 功能面板

| 组件 | 用途 | 修改场景 |
|------|------|---------|
| `DependencyPanel.tsx` | NPM 依赖管理 | 依赖安装/删除 |
| `DatabasePanel.tsx` | MongoDB 集合管理 | 集合 CRUD |
| `EnvManager.tsx` | 环境变量管理 | 环境变量 CRUD |
| `SchedulerPanel.tsx` | 定时任务管理 | 定时任务 UI |
| `StatisticsPanel.tsx` | 执行统计面板 | 统计图表 |
| `WebhookPanel.tsx` | Webhook 管理 | Webhook CRUD |
| `SnippetsPanel.tsx` | 代码片段管理 | 片段 CRUD |
| `CustomDomainManager.tsx` | 自定义域名管理 | 域名配置 |
| `ApiTokenManager.tsx` | API Token 管理 | Token CRUD |

### AI 相关

| 组件 | 用途 | 修改场景 |
|------|------|---------|
| `AIConversationDialog.tsx` | AI 对话弹窗 (ChatGPT 风格) | 对话 UI/斜杠命令 |
| `AIDebugModal.tsx` | AI 自动调试弹窗 | Debug 流程 UI |
| `AIProviderManager.tsx` | AI 供应商/模型管理 | 供应商配置 |
| `AIModelSelector.tsx` | AI 模型两栏选择器 | 模型选择 UI |
| `SystemPromptManager.tsx` | 系统提示词管理 | 提示词 CRUD |
| `FunctionImportPicker.tsx` | @ 引用函数选择器 | 函数引用 UI |

## 状态管理 (stores/)

| 文件 | 用途 | 关键状态 |
|------|------|---------|
| `auth.ts` | 认证状态 | token, user, login(), logout() |
| `function.ts` | 函数状态 | functions, currentId, openTabs, refreshList() |
| `theme.ts` | 主题状态 | mode (light/dark), toggleMode() |
| `ai.ts` | AI 状态 | selectedModel, providers |
| `database.ts` | 数据库状态 | collections, currentCollection, documents, viewMode |
| `view.ts` | 视图状态 | currentView (functions/database), statisticsOpen, webhooksOpen |

## API 模块 (api/)

| 文件 | 对应后端路由 | 用途 |
|------|-------------|------|
| `client.ts` | - | Axios 实例，拦截器 |
| `auth.ts` | `/api/auth/*` | 登录/注册 |
| `functions.ts` | `/api/functions/*` | 函数 CRUD |
| `folders.ts` | `/api/folders/*` | 文件夹 CRUD |
| `dependencies.ts` | `/api/dependencies/*` | 依赖管理 |
| `env.ts` | `/api/env/*` | 环境变量 |
| `git.ts` | `/api/git/*` | Git 同步 |
| `scheduler.ts` | `/api/scheduler/*` | 定时任务 |
| `executionLogs.ts` | `/api/execution-logs/*` | 执行历史 |
| `webhook.ts` | `/api/webhooks/*` | Webhook |
| `snippets.ts` | `/api/snippets/*` | 代码片段 |
| `search.ts` | `/api/search` | 全局搜索 |
| `customDomain.ts` | `/api/custom-domains/*` | 自定义域名 |
| `apiToken.ts` | `/api/tokens/*` | API Token |
| `invoke.ts` | `/invoke/*` | 函数调用 |
| `ai.ts` | `/api/ai/*` | AI 操作/Debug/日志分析 |
| `aiConversation.ts` | `/api/ai/conversations/*` | AI 对话 |
| `aiProvider.ts` | `/api/ai/providers/*` | AI 供应商/模型 |
| `aiSystemPrompt.ts` | `/api/ai/prompts/*` | 系统提示词 |
| `database.ts` | `/api/database/*` | MongoDB 管理 |

## IDE 布局结构

```
┌─────────────────────────────────────────────────────────────┐
│  Header.tsx (顶部导航)                                       │
├──┬─────────┬──────────────────────────┬─────────────────────┤
│  │         │                          │                     │
│侧│Function │    Editor.tsx            │   RightPanel.tsx    │
│边│Tree.tsx │    (Monaco 编辑器)        │   (请求参数)        │
│栏│         │                          │                     │
│  │(左侧    │    EditorTabs.tsx        │                     │
│  │ 文件树) │    (编辑器标签)           │                     │
│  │         ├──────────────────────────┴─────────────────────┤
│  │         │                                                │
│  │         │    ConsolePanel.tsx (控制台)                    │
│  │─────────│                                                │
│  │Dependency                                                │
│  │Panel    │    ResultPanel.tsx (运行结果)                   │
│  │(依赖)   │                                                │
└──┴─────────┴────────────────────────────────────────────────┘

侧边栏图标 (Lucide React):
- Code: 云函数视图
- Database: 集合视图 (MongoDB 管理)
- Activity: 统计面板 (弹窗)
- Link: Webhooks 面板 (弹窗)
```

## 常见修改场景

| 需求 | 修改文件 |
|------|---------|
| 添加设置项 | `SettingsModal.tsx` 添加 Tab |
| 修改编辑器行为 | `Editor.tsx` |
| 修改函数列表 | `FunctionTree.tsx` |
| 修改调试输出 | `ConsolePanel.tsx` / `ResultPanel.tsx` |
| 修改日志查看器 | `LogViewerModal/index.tsx` |
| 添加 AI 功能 | `AIConversationDialog/` 目录下组件 |
| 修改请求参数 UI | `RightPanel/ParamsEditor.tsx` |
| 修改依赖面板 | `DependencyPanel.tsx` |
| 添加弹窗 | 新建组件，在 `IDE.tsx` 中引入 |
| 添加 API 调用 | `api/` 下新建或修改对应文件 |
| 添加全局状态 | `stores/` 下新建或修改 |

## UI 设计系统

### 颜色规范 (Emerald 主题)

**主色调:**
| 用途 | 色值 |
|------|------|
| Primary | `#059669` |
| Primary Hover | `#047857` |
| Primary Light | `#10B981` |
| Accent Surface | `#ecfdf5` |

**中性色 (Slate):**
| 用途 | 色值 |
|------|------|
| Text Primary | `#1f2937` |
| Text Secondary | `#374151` |
| Text Muted | `#6b7280` |
| Border | `#e5e7eb` |
| Background | `#fff` |
| Background Muted | `#f9fafb` |

**状态色:**
| 状态 | 背景 | 文字 |
|------|------|------|
| Success | `#ecfdf5` | `#059669` |
| Error | `#fef2f2` | `#ef4444` |
| Warning | `#fffbeb` | `#f59e0b` |
| Info | `#eff6ff` | `#3b82f6` |

### 字体

| 用途 | 字体 |
|------|------|
| 正文 | Inter, -apple-system, system-ui |
| 代码 | 'JetBrains Mono', 'Fira Code', monospace |

### 动画

```css
transition: all 0.15s ease;
```

## laf 核心代码参考

| 功能 | laf 文件位置 | 复用程度 |
|------|-------------|---------|
| 函数执行器 | `runtimes/nodejs/src/support/engine/` | 高 |
| LSP 集成 | `runtimes/nodejs/src/support/lsp.ts` | 高 |
| Monaco 编辑器 | `web/src/components/Editor/` | 中 |
| 函数调用 | `runtimes/nodejs/src/handler/invoke.ts` | 中 |
| IDE 布局 | `web/src/pages/app/functions/` | 高 |
