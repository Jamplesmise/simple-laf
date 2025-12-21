# Sprint 14: 项目代码操作

## 阶段目标

让 AI 能够读取和修改项目源代码，实现代码搜索功能。

## 功能范围

### 14.1 文件读写工具

**后端**：
- 项目文件读取 API
- 项目文件写入 API（需确认）
- 文件树获取 API

### 14.2 代码搜索

**后端**：
- 全文搜索 API
- 正则搜索支持
- 搜索结果高亮

## 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| 文件操作 | Node.js fs | 原生支持 |
| 搜索 | ripgrep（可选）或 glob | 性能好 |
| 安全限制 | 白名单路径 | 防止越权 |

## 新增 AI 工具

```typescript
{
  name: 'read_project_file',
  description: '读取项目文件内容',
  parameters: {
    path: string,
    lineStart?: number,
    lineEnd?: number
  }
}

{
  name: 'write_project_file',
  description: '写入项目文件（需要用户确认）',
  parameters: {
    path: string,
    content: string,
    createBackup?: boolean
  }
}

{
  name: 'search_code',
  description: '在项目中搜索代码',
  parameters: {
    query: string,
    filePattern?: string,
    caseSensitive?: boolean
  }
}

{
  name: 'get_file_tree',
  description: '获取项目文件树',
  parameters: {
    path?: string,
    depth?: number,
    exclude?: string[]
  }
}
```

## 安全限制

```typescript
// 允许访问的路径
const ALLOWED_PATHS = [
  'src/',
  'public/',
  'package.json',
  'tsconfig.json',
  '.env.example'
]

// 禁止访问的路径
const BLOCKED_PATHS = [
  '.env',
  'node_modules/',
  '.git/',
  '*.key',
  '*.pem'
]
```

## 验收标准

- [x] AI 可读取项目文件
- [x] AI 可写入文件（需用户确认）
- [x] 搜索功能正常
- [x] 安全限制有效

## 依赖

- 无前置依赖（可与 Sprint 15 并行）

## 完成状态

**Sprint 14 已完成** ✅

实现文件：
- `src/server/services/ai/tools/projectFile.ts` - 文件读写和文件树工具
- `src/server/services/ai/tools/search.ts` - 代码搜索工具
- `src/server/services/ai/tools/index.ts` - 模块入口
