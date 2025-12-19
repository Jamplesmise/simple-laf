# Sprint 5: AI 辅助功能

## 阶段目标

为 Simple IDE 集成 AI 辅助编程能力，提升云函数开发效率。

## 功能范围

### 核心功能

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 模型设置 | 配置 AI 供应商、模型、API Key | P0 |
| 写单个函数 | 自然语言 → 完整云函数代码 | P0 |
| 函数解耦 | 分析现有函数 → 拆分建议 + 重构代码 | P1 |
| 写多个函数 | 模块描述 → 多个相关函数 + 文件夹 | P1 |
| 错误诊断 | 执行报错 → AI 分析原因 + 修复代码 | P1 |

### 增强功能

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 依赖推荐 | 分析代码 → 自动识别需要的 npm 包 | P2 |
| API 文档生成 | 函数代码 → 调用说明/参数示例 | P2 |
| 安全检查 | 检测 SQL 注入、敏感信息泄露等 | P2 |
| Cron 生成 | 自然语言 → 定时表达式 | P2 |
| 环境变量提取 | 识别硬编码值 → 建议提取为环境变量 | P2 |
| JS → TS 转换 | JavaScript 代码 → TypeScript | P2 |

### 不包含

- 代码补全 (Copilot 式实时补全，复杂度高)
- 模型微调/训练
- 本地模型托管

## 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| AI 调用 | 统一适配层 | 支持多供应商切换 |
| 流式输出 | SSE | 实时显示生成过程 |
| 配置存储 | MongoDB | 与现有架构一致 |
| API Key 加密 | AES-256 | 安全存储 |

### 支持的供应商

| 供应商 | 模型示例 | 备注 |
|--------|---------|------|
| OpenAI | gpt-4o, gpt-4o-mini | 主流选择 |
| Anthropic | claude-sonnet-4, claude-3-5-haiku | 代码能力强 |
| 本地 Ollama | llama3, codellama | 离线可用 |
| 自定义 API | - | 兼容 OpenAI 格式 |

## 数据模型

### ai_config 集合 (新增)

```typescript
interface AIConfig {
  _id: ObjectId;
  userId: ObjectId;
  provider: 'openai' | 'anthropic' | 'ollama' | 'custom';
  model: string;
  apiKey: string;           // 加密存储
  baseUrl?: string;         // 自定义 API 地址
  params: {
    temperature: number;    // 0-1
    maxTokens: number;      // 最大 token 数
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### ai_history 集合 (新增)

```typescript
interface AIHistory {
  _id: ObjectId;
  userId: ObjectId;
  functionId?: ObjectId;    // 关联函数 (可选)
  action: 'generate' | 'refactor' | 'diagnose' | 'document' | 'other';
  prompt: string;
  response: string;
  model: string;
  tokensUsed: number;
  createdAt: Date;
}
```

## API 设计

### AI 配置

```
GET    /api/ai/config           # 获取配置 (不返回完整 apiKey)
PUT    /api/ai/config           # 保存配置
POST   /api/ai/config/test      # 测试连接
GET    /api/ai/models           # 获取可用模型列表
```

### AI 功能

```
POST   /api/ai/generate         # 生成单个函数
POST   /api/ai/generate-multi   # 生成多个函数
POST   /api/ai/refactor         # 函数解耦/重构
POST   /api/ai/diagnose         # 错误诊断
POST   /api/ai/suggest-deps     # 依赖推荐
POST   /api/ai/gen-docs         # 生成 API 文档
POST   /api/ai/security-check   # 安全检查
POST   /api/ai/gen-cron         # 生成 Cron 表达式
POST   /api/ai/extract-env      # 提取环境变量
POST   /api/ai/js-to-ts         # JS 转 TS
```

### 历史记录

```
GET    /api/ai/history          # 历史列表
DELETE /api/ai/history/:id      # 删除记录
```

## 目录结构变更

```
packages/server/src/
├── routes/
│   └── ai.ts                   # 新增：AI 路由
├── services/
│   ├── ai/
│   │   ├── index.ts            # AI 服务入口
│   │   ├── providers/
│   │   │   ├── base.ts         # 供应商基类
│   │   │   ├── openai.ts       # OpenAI 适配
│   │   │   ├── anthropic.ts    # Anthropic 适配
│   │   │   ├── ollama.ts       # Ollama 适配
│   │   │   └── custom.ts       # 自定义 API 适配
│   │   ├── prompts/
│   │   │   ├── generate.ts     # 生成函数 prompt
│   │   │   ├── refactor.ts     # 重构 prompt
│   │   │   ├── diagnose.ts     # 诊断 prompt
│   │   │   └── ...
│   │   └── crypto.ts           # API Key 加解密
│   └── ...
└── models/
    ├── aiConfig.ts             # 新增：AI 配置模型
    └── aiHistory.ts            # 新增：AI 历史模型

packages/web/src/
├── api/
│   └── ai.ts                   # 新增：AI API 调用
├── stores/
│   └── aiStore.ts              # 新增：AI 状态管理
├── components/
│   └── AI/
│       ├── AIPanel.tsx         # AI 侧边面板
│       ├── AISettingsModal.tsx # 设置弹窗
│       ├── AIChat.tsx          # 对话界面
│       ├── GenerateForm.tsx    # 生成表单
│       ├── RefactorPreview.tsx # 重构预览
│       └── DiagnoseResult.tsx  # 诊断结果
└── pages/
    └── IDE/
        └── index.tsx           # 修改：集成 AI 面板
```

## 前端交互设计

### 入口方式

1. **侧边栏 AI 面板** - 主入口，对话式交互
2. **编辑器右键菜单** - 快捷操作 (解耦、文档、安全检查)
3. **工具栏按钮** - 生成函数、错误诊断

### AI 面板布局

```
┌─────────────────────────────┐
│ AI 助手              [设置] │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ 快捷操作                │ │
│ │ [写函数] [解耦] [诊断]  │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│                             │
│  对话历史区域               │
│                             │
├─────────────────────────────┤
│ [输入框...          ] [发送]│
└─────────────────────────────┘
```

## 验收标准

### P0 核心功能

- [ ] 支持配置 OpenAI/Anthropic/Ollama/自定义供应商
- [ ] API Key 加密存储，前端不显示完整 Key
- [ ] 测试连接功能正常
- [ ] 自然语言生成单个函数，代码可直接使用
- [ ] 生成结果支持流式输出

### P1 功能

- [ ] 函数解耦分析，显示拆分建议
- [ ] 确认后自动创建拆分后的函数
- [ ] 批量生成多个函数到指定文件夹
- [ ] 执行报错后可一键诊断
- [ ] 诊断结果包含原因分析 + 修复代码

### P2 功能

- [ ] 依赖推荐准确，支持一键安装
- [ ] API 文档格式规范 (Markdown)
- [ ] 安全检查覆盖常见漏洞
- [ ] Cron 表达式生成正确
- [ ] 环境变量提取建议合理
- [ ] JS → TS 转换类型完整

## 依赖

- Sprint 1-4 基础功能完成

## Prompt 设计原则

1. **角色设定** - 明确 AI 是云函数开发助手
2. **上下文注入** - 包含项目技术栈、已有函数列表、环境变量
3. **输出格式** - 指定返回 JSON 结构，便于解析
4. **示例引导** - 提供 few-shot 示例提升质量
5. **安全约束** - 禁止生成危险代码

## 安全考虑

- API Key 使用 AES-256 加密存储
- 请求频率限制 (防滥用)
- 生成代码安全扫描
- 不记录敏感 prompt 内容
