# Sprint 5: AI 辅助功能 - 任务清单

## 任务概览

| 阶段 | 任务数 | 说明 |
|------|--------|------|
| Phase 1 | 6 | 基础设施：配置、供应商适配 |
| Phase 2 | 5 | 核心功能：生成、解耦 |
| Phase 3 | 4 | 诊断与推荐 |
| Phase 4 | 6 | 增强功能 |
| Phase 5 | 3 | 前端集成 |

---

## Phase 1: 基础设施

### 任务 1.1: 数据模型

**后端** `packages/server/src/models/`

- [ ] 创建 `aiConfig.ts` - AI 配置模型
- [ ] 创建 `aiHistory.ts` - AI 历史记录模型
- [ ] 在 `db.ts` 中注册集合

```typescript
// aiConfig.ts
export interface AIConfig {
  _id?: ObjectId;
  userId: ObjectId;
  provider: 'openai' | 'anthropic' | 'ollama' | 'custom';
  model: string;
  apiKey: string;
  baseUrl?: string;
  params: {
    temperature: number;
    maxTokens: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### 任务 1.2: API Key 加解密

**后端** `packages/server/src/services/ai/crypto.ts`

- [ ] 实现 `encryptApiKey(plainKey: string): string`
- [ ] 实现 `decryptApiKey(encryptedKey: string): string`
- [ ] 使用 AES-256-GCM 算法
- [ ] 密钥从环境变量 `AI_ENCRYPTION_KEY` 读取

### 任务 1.3: 供应商基类

**后端** `packages/server/src/services/ai/providers/base.ts`

- [ ] 定义 `AIProvider` 抽象基类
- [ ] 统一接口：`chat(messages, options): AsyncGenerator<string>`
- [ ] 统一接口：`listModels(): Promise<string[]>`
- [ ] 错误处理标准化

```typescript
export abstract class AIProvider {
  abstract chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncGenerator<string>;

  abstract listModels(): Promise<string[]>;

  abstract testConnection(): Promise<boolean>;
}
```

### 任务 1.4: OpenAI 适配器

**后端** `packages/server/src/services/ai/providers/openai.ts`

- [ ] 实现 `OpenAIProvider extends AIProvider`
- [ ] 支持流式输出 (SSE)
- [ ] 模型列表获取
- [ ] 错误映射

### 任务 1.5: Anthropic 适配器

**后端** `packages/server/src/services/ai/providers/anthropic.ts`

- [ ] 实现 `AnthropicProvider extends AIProvider`
- [ ] 适配 Anthropic 消息格式
- [ ] 支持流式输出

### 任务 1.6: Ollama + 自定义适配器

**后端** `packages/server/src/services/ai/providers/`

- [ ] 实现 `OllamaProvider` - 本地模型
- [ ] 实现 `CustomProvider` - 兼容 OpenAI 格式的自定义 API

---

## Phase 2: 核心功能

### 任务 2.1: AI 配置路由

**后端** `packages/server/src/routes/ai.ts`

- [ ] `GET /api/ai/config` - 获取配置 (apiKey 脱敏)
- [ ] `PUT /api/ai/config` - 保存配置
- [ ] `POST /api/ai/config/test` - 测试连接
- [ ] `GET /api/ai/models` - 获取可用模型

### 任务 2.2: AI 服务入口

**后端** `packages/server/src/services/ai/index.ts`

- [ ] 实现 `AIService` 类
- [ ] 根据配置自动选择 Provider
- [ ] 统一调用入口

```typescript
class AIService {
  async getProvider(userId: ObjectId): Promise<AIProvider>;
  async chat(userId: ObjectId, messages: ChatMessage[]): AsyncGenerator<string>;
}
```

### 任务 2.3: Prompt 模板 - 生成函数

**后端** `packages/server/src/services/ai/prompts/generate.ts`

- [ ] 单函数生成 prompt
- [ ] 多函数生成 prompt
- [ ] 包含项目上下文 (技术栈、已有函数)

```typescript
export function buildGeneratePrompt(params: {
  description: string;
  existingFunctions?: string[];
  techStack?: string;
}): string;
```

### 任务 2.4: 生成函数 API

**后端** `packages/server/src/routes/ai.ts`

- [ ] `POST /api/ai/generate` - 生成单个函数
- [ ] `POST /api/ai/generate-multi` - 生成多个函数
- [ ] 流式返回生成结果
- [ ] 记录到 ai_history

请求格式：
```typescript
// 单函数
{ prompt: string }

// 多函数
{ prompt: string, folderId?: string }
```

### 任务 2.5: 函数解耦 API

**后端** `packages/server/src/routes/ai.ts`

- [ ] `POST /api/ai/refactor` - 函数解耦分析
- [ ] 输入：functionId
- [ ] 输出：拆分建议 + 重构后代码

Prompt 设计：
```typescript
export function buildRefactorPrompt(params: {
  code: string;
  functionName: string;
}): string;
```

---

## Phase 3: 诊断与推荐

### 任务 3.1: 错误诊断 API

**后端** `packages/server/src/routes/ai.ts`

- [ ] `POST /api/ai/diagnose`
- [ ] 输入：functionId + errorMessage + errorStack
- [ ] 输出：原因分析 + 修复建议代码

### 任务 3.2: 依赖推荐 API

**后端** `packages/server/src/routes/ai.ts`

- [ ] `POST /api/ai/suggest-deps`
- [ ] 分析代码中的 import/require
- [ ] 识别未安装的依赖
- [ ] 返回推荐的 npm 包列表

### 任务 3.3: Cron 表达式生成

**后端** `packages/server/src/routes/ai.ts`

- [ ] `POST /api/ai/gen-cron`
- [ ] 输入：自然语言描述 (如 "每天早上9点")
- [ ] 输出：cron 表达式 + 解释

### 任务 3.4: 历史记录 API

**后端** `packages/server/src/routes/ai.ts`

- [ ] `GET /api/ai/history` - 列表 (分页)
- [ ] `DELETE /api/ai/history/:id` - 删除

---

## Phase 4: 增强功能

### 任务 4.1: API 文档生成

**后端** `packages/server/src/routes/ai.ts`

- [ ] `POST /api/ai/gen-docs`
- [ ] 输入：functionId
- [ ] 输出：Markdown 格式文档 (参数、返回值、示例)

### 任务 4.2: 安全检查

**后端** `packages/server/src/routes/ai.ts`

- [ ] `POST /api/ai/security-check`
- [ ] 检测 SQL 注入、XSS、敏感信息泄露
- [ ] 返回风险列表 + 修复建议

### 任务 4.3: 环境变量提取

**后端** `packages/server/src/routes/ai.ts`

- [ ] `POST /api/ai/extract-env`
- [ ] 识别硬编码的 URL、密钥、配置
- [ ] 建议提取为环境变量

### 任务 4.4: JS → TS 转换

**后端** `packages/server/src/routes/ai.ts`

- [ ] `POST /api/ai/js-to-ts`
- [ ] 添加类型注解
- [ ] 转换 require 为 import

### 任务 4.5: 代码解释

**后端** `packages/server/src/routes/ai.ts`

- [ ] `POST /api/ai/explain`
- [ ] 输入：选中的代码片段
- [ ] 输出：自然语言解释

### 任务 4.6: 添加注释

**后端** `packages/server/src/routes/ai.ts`

- [ ] `POST /api/ai/add-comments`
- [ ] 为函数生成 JSDoc 注释

---

## Phase 5: 前端集成

### 任务 5.1: AI Store + API

**前端** `packages/web/src/`

- [ ] 创建 `api/ai.ts` - API 调用封装
- [ ] 创建 `stores/aiStore.ts` - 状态管理
- [ ] 处理流式响应

```typescript
// stores/aiStore.ts
interface AIState {
  config: AIConfig | null;
  isGenerating: boolean;
  currentOutput: string;
  history: AIHistory[];
}
```

### 任务 5.2: AI 设置弹窗

**前端** `packages/web/src/components/AI/AISettingsModal.tsx`

- [ ] 供应商选择下拉框
- [ ] 模型选择 (动态加载)
- [ ] API Key 输入 (密码模式)
- [ ] 自定义 API 地址
- [ ] 参数设置 (temperature, maxTokens)
- [ ] 测试连接按钮

### 任务 5.3: AI 面板

**前端** `packages/web/src/components/AI/`

- [ ] `AIPanel.tsx` - 侧边面板主组件
- [ ] `AIChat.tsx` - 对话历史 + 输入框
- [ ] `GenerateForm.tsx` - 生成函数表单
- [ ] `RefactorPreview.tsx` - 解耦预览 (Diff 视图)
- [ ] `DiagnoseResult.tsx` - 诊断结果展示
- [ ] 集成到 IDE 布局

---

## 开发日志

| 日期 | 任务 | 状态 | 备注 |
|------|------|------|------|
| - | - | - | - |

---

## 测试清单

### 单元测试

- [ ] API Key 加解密
- [ ] Prompt 模板生成
- [ ] 各供应商适配器

### 集成测试

- [ ] 配置保存/读取
- [ ] 函数生成端到端
- [ ] 流式输出正确性

### 手动测试

- [ ] 各供应商连接测试
- [ ] 生成代码可执行
- [ ] 解耦建议合理性
- [ ] 错误诊断准确性

---

## 注意事项

1. **API Key 安全** - 永远不在前端显示完整 Key，日志中脱敏
2. **流式输出** - 使用 SSE，注意超时处理
3. **错误处理** - 供应商 API 错误友好提示
4. **请求限流** - 防止滥用，可配置每分钟请求数
5. **Prompt 迭代** - 预留 prompt 版本管理，便于优化
