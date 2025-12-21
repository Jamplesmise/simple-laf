# 6. 功能详解 (Features)

## 函数模板

创建函数时可选择预设模板，包含 9 种常用模板：
- **基础类**: 空白函数、Hello World
- **HTTP 类**: RESTful API、HTTP 请求
- **数据处理类**: JSON 数据处理
- **工具类**: 参数验证、定时任务、环境变量、日期处理

前端入口: 创建函数弹窗 → 选择模板

## 执行统计

展示函数执行的统计数据：
- 总执行次数、成功率、平均耗时
- 24小时/7天执行数
- 触发来源分布 (手动/定时/Webhook/公开)
- 热门函数 Top 10
- 7天执行趋势图

前端入口: 函数列表 → 统计图标

## Webhook 触发器

允许外部服务通过 HTTP 请求触发函数：
- 每个函数可创建一个 Webhook
- 生成唯一 URL 和可选签名密钥
- 支持启用/禁用、重新生成 Token
- 调用记录计入执行历史

前端入口: 函数列表 → API 图标

## 代码片段

保存和复用常用代码：
- 支持名称、描述、标签
- 按标签筛选和搜索
- 使用次数统计
- 一键复制到剪贴板

前端入口: 函数列表 → 代码图标

## 全局搜索

快速搜索函数：
- 搜索函数名称和代码内容
- 高亮匹配关键词
- 键盘导航 (↑↓ 选择, Enter 打开)
- 显示代码匹配行号

快捷键: **Cmd/Ctrl + K**

## Git 仓库同步

与 Git 仓库双向同步函数代码：

**同步预览:**
- 拉取/推送前显示变更列表 (新增/修改/删除)
- 勾选要同步的函数 (选择性同步)
- 点击"查看差异"展开 Diff 对比视图

**冲突检测:**
- 对比上次同步时间和本地修改时间
- 本地有修改且远程也有变更 → 标记为冲突
- 冲突函数显示黄色警告，拉取会覆盖本地

**工作流程:**
```
Git 仓库 (GitHub/GitLab) ←→ Simple IDE ←→ 本地开发
```

前端入口: 设置 → Git 同步

## AI 辅助编程

AI 直接创建和修改云函数：

### 供应商/模型管理
- 支持多供应商: OpenAI、Anthropic、Ollama、自定义 API
- 分层管理: 供应商 → 模型
- 模型配置: 名称、别名、温度、最大 Token、定价、深度思考支持
- 定价记录: 每百万 Token 的输入/输出价格 (USD/CNY)
- 深度思考模式: 模型可配置是否支持 (如 DeepSeek-R1)
- 使用日志: 自动记录 Token 消耗和成本

### 对话功能
- 多对话管理: 创建/切换/删除多个独立对话
- 对话归档收藏
- 系统提示词: 支持版本控制和回滚
- 流式输出: SSE 实时显示 AI 回复
- ChatGPT 风格界面

### 操作功能
- 直接操作模式: AI 生成计划后自动执行 (创建/修改/删除函数)
- @ 引用函数: 输入 @ 弹出两栏选择器 (文件夹树 + 函数列表)
- 深度思考模式: 显示 AI 思考过程
- 合并分析: 选择 2+ 个函数后出现"合并分析"按钮

### 云函数代码格式 (AI 生成必须遵循)
```typescript
import cloud from '@/cloud-sdk'

export default async function (ctx: FunctionContext) {
  // ctx.body: 请求体, ctx.query: 查询参数
  // ctx.headers: 请求头, ctx.method: HTTP 方法
  return { data: 'result' }
}
```

前端入口: 编辑器右键 → AI 菜单 / 设置 → AI 模型 / 系统提示词

## AI 自动 Debug

智能调试云函数，自动发现并修复问题：

**调试流程:**
1. 选择 AI 模型 (两栏选择: 供应商/模型)
2. AI 分析代码，自动决定测试用例数量 (1-10个)
3. 自动运行测试，收集结果
4. 诊断失败原因，生成修复建议
5. Diff 对比显示代码变更
6. 一键应用修复

**功能特点:**
- 流式展示调试进度 (SSE)
- 测试结果可点击查看详情
- 代码 Diff 对比视图
- 键盘快捷键: Enter 应用修复, Escape 取消

前端入口: 函数列表右键 → AI → 自动 Debug

## AI 解耦/合并分析

代码重构分析功能，支持函数拆分和合并：

### 解耦分析
- AI 自主评估是否需要重构 (不强制拆分)
- 评估标准: 代码行数、嵌套深度、职责划分、重复逻辑
- 如果建议拆分，展示拆分后的多个函数代码预览
- 用户确认后自动创建新函数 (不发布)，更新原函数

### 合并分析
- 选择 2+ 个函数，点击"合并分析"按钮
- AI 评估是否适合合并 (功能重叠、代码重复)
- 如果建议合并，展示合并后的函数代码预览
- 用户确认后创建新函数 (原函数保留供参考)

**使用方式:**
- 解耦分析: 右键函数 → AI → 解耦分析
- 合并分析: AI 助手中用 @ 选择多个函数 → 点击"合并分析"

**注意:** 所有 AI 创建/修改的函数默认 `published: false`，需手动发布

## AI 日志分析

让 AI 分析执行日志，快速定位问题和优化建议：

**使用方式:**
1. 在 AI 对话框中输入 `/` 打开快捷命令菜单
2. 选择时间范围:
   - `/log` - 分析最近 3 天
   - `/log7` - 分析最近 7 天
   - `/log15` - 分析最近 15 天
   - `/log30` - 分析最近 30 天
3. 输入你的问题 (如"有什么错误？"、"哪些函数性能差？")
4. AI 会结合日志数据分析回答

**分析粒度:**
- **粗粒度**: 总执行次数、成功率、平均耗时、触发来源分布
- **中粒度**: 热门函数 Top 10、各函数成功率、慢执行函数列表
- **细粒度**: 具体错误信息、请求体、控制台日志、错误发生次数

前端入口: AI 对话框 → 输入 `/` → 选择日志分析命令

## AI 项目文件操作 (Sprint 14)

AI 助手可以读取和修改项目源代码，实现真正的 AI 辅助开发：

### 可用工具

| 工具 | 功能 | 参数 |
|-----|------|------|
| `read_project_file` | 读取文件内容 | `path`: 相对路径 |
| `write_project_file` | 写入文件 | `path`, `content` |
| `get_file_tree` | 获取文件树 | `path?`, `depth?`, `pattern?` |
| `search_code` | 搜索代码 | `pattern`, `filePattern?`, `contextLines?` |

### 安全限制

**白名单路径** (允许访问):
- `src/` - 源代码目录
- `docs/` - 文档目录
- `package.json`, `tsconfig*.json` - 配置文件
- `.env.example` - 环境变量示例

**黑名单模式** (禁止访问):
- `node_modules/` - 依赖目录
- `.git/` - Git 目录
- `dist/`, `build/` - 构建产物
- `*.log`, `.env` (非 example) - 敏感文件

### 使用场景

- 代码审查和重构建议
- 添加新功能时参考现有代码结构
- 批量修改配置文件
- 项目结构分析

**注意**: 项目操作需谨慎，修改前会显示 diff 确认

## 自定义域名

为云函数配置自定义域名访问：

**配置流程:**
1. 在设置页面添加自定义域名
2. 按提示在 DNS 添加 CNAME 记录 (指向系统域名)
3. 点击验证按钮进行 DNS 验证
4. 验证通过后，自定义域名即可访问函数

**数据模型:**
```typescript
interface CustomDomain {
  domain: string       // 自定义域名 (如 api.example.com)
  targetPath?: string  // 可选: 指向特定函数路径
  verified: boolean    // DNS 验证状态
}
```

前端入口: 设置 → 自定义域名

## API Token

平台 API Token 管理，支持程序化访问：

**功能特点:**
- 创建 Token 时设置有效期 (7/30/90/180/365 天)
- Token 列表显示：名称、前缀、创建日期、失效日期、最后使用时间
- 创建后完整 Token 只显示一次
- 过期 Token 自动删除 (MongoDB TTL)
- 即将过期提醒 (7天内)

**使用方式:**
```bash
curl -H "Authorization: sk-xxx..." https://your-domain/api/functions
```

前端入口: 设置 → API Token

## MongoDB 集合管理

可视化管理 MongoDB 数据库集合：

**功能特点:**
- 集合列表：显示所有集合及文档数量
- 文档 CRUD：创建/编辑/删除文档 (Monaco JSON 编辑器)
- 索引管理：查看/创建/删除索引
- 多种视图：列表视图、表格视图、JSON 视图
- 搜索过滤：按字段筛选文档

前端入口: 侧边栏 → 集合图标 (Database)

## 函数审计日志

记录所有函数的增删改操作，便于追溯：

### 操作者类型 (operator)
- `user` - 用户通过 UI 手动操作
- `ai` - AI 辅助操作 (记录使用的模型名和操作账号)
- `git` - Git 同步操作 (pull/push)
- `system` - 系统自动操作

### 审计动作 (action)
- `create` - 创建函数
- `update` - 更新代码
- `delete` - 删除函数
- `rename` - 重命名
- `move` - 移动到其他文件夹
- `publish` - 发布函数
- `unpublish` - 取消发布
- `rollback` - 版本回滚

### 数据模型
```typescript
interface FunctionAuditLog {
  _id: ObjectId
  functionId: ObjectId
  functionName: string
  userId: ObjectId
  username: string           // 操作账号用户名
  action: AuditAction
  operator: OperatorType
  operatorDetail?: string    // 如 "AI: deepseek-v3 (账号: admin)"
  changes?: {
    before?: string          // 修改前代码
    after?: string           // 修改后代码
    description?: string     // 变更描述
  }
  metadata?: Record<string, unknown>  // 额外信息
  createdAt: Date
}
```

### API 接口
```
GET  /api/audit                    # 审计日志列表
     ?functionId=xxx               # 按函数筛选
     &action=update                # 按动作筛选
     &operator=ai                  # 按操作者类型筛选
     &startDate=2024-01-01         # 开始日期
     &endDate=2024-01-31           # 结束日期
     &limit=50&offset=0            # 分页

GET  /api/audit/function/:id       # 指定函数的审计日志

GET  /api/audit/stats              # 审计统计
     ?days=7                       # 统计天数
```

### 日志记录位置
- **用户操作**: `routes/functions.ts` - 创建/更新/删除/发布/回滚/移动
- **AI 操作**: `services/ai/executor.ts` - AI 创建/更新/删除/重命名/移动函数
- **Git 操作**: `routes/git.ts` - Git pull 同步的函数

## 升级开发计划

| Sprint | 名称 | 内容 | 状态 |
|--------|------|------|------|
| Sprint 1 | 基础架构 | Node.js VM 执行 + 发布功能 + laf 布局 | ✅ 完成 |
| Sprint 2 | 依赖与调试 | NPM 依赖管理 + 调试面板 + Console | ✅ 完成 |
| Sprint 3 | 版本与环境 | 历史版本 + Diff 对比 + 环境变量 | ✅ 完成 |
| Sprint 4 | 结构与同步 | 文件夹管理 + Git 同步 | ✅ 完成 |
| Sprint 5 | AI 辅助 (基础) | AI 直接操作 + 多供应商支持 + 流式输出 | ✅ 完成 |
| Sprint 6 | AI 辅助 (增强) | 对话历史 + 供应商/模型管理 + 系统提示词 | ✅ 完成 |
| Sprint 7 | AI Debug + 域名 | AI 自动调试 + 自定义域名 | ✅ 完成 |
| Sprint 8 | AI 重构分析 | 解耦分析 + 合并分析 + 深度思考 + @ 引用增强 | ✅ 完成 |

**详细文档**：`docs/upgrade-phases/`
