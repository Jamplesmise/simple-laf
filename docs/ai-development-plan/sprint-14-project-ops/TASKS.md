# Sprint 14: 项目代码操作 - 任务清单

## 任务概览

| 任务 | 轨道 | 优先级 | 预估 | 依赖 | 状态 |
|------|------|-------|------|------|------|
| 14.1.1 文件读取工具 | 后端 | P0 | 2h | 无 | ✅ 完成 |
| 14.1.2 文件写入工具 | 后端 | P0 | 3h | 无 | ✅ 完成 |
| 14.1.3 文件树工具 | 后端 | P0 | 2h | 无 | ✅ 完成 |
| 14.2.1 代码搜索工具 | 后端 | P1 | 3h | 无 | ✅ 完成 |

---

## 14.1 文件读写工具

### 14.1.1 文件读取工具

**文件**：`src/server/services/ai/tools/projectFile.ts`

**具体步骤**：

- [x] 实现 `read_project_file` 工具
- [x] 路径安全校验（白名单/黑名单）
- [x] 支持行范围读取
- [x] 返回行号标注

```typescript
async function readProjectFile(params: {
  path: string,
  lineStart?: number,
  lineEnd?: number
}): Promise<{ content: string, totalLines: number }> {
  // 1. 路径安全检查
  validatePath(params.path)

  // 2. 读取文件
  const content = await fs.readFile(resolvePath(params.path), 'utf-8')

  // 3. 行范围处理
  if (params.lineStart || params.lineEnd) {
    return sliceLines(content, params.lineStart, params.lineEnd)
  }

  return { content, totalLines: content.split('\n').length }
}
```

**验收**：
- [x] 文件读取正常
- [x] 行范围正确
- [x] 禁止路径返回错误

---

### 14.1.2 文件写入工具

**文件**：`src/server/services/ai/tools/projectFile.ts`

**具体步骤**：

- [x] 实现 `write_project_file` 工具
- [x] 必须用户确认（Level 2 权限）
- [x] 可选自动备份
- [ ] 记录审计日志（待后续集成）

```typescript
async function writeProjectFile(params: {
  path: string,
  content: string,
  createBackup?: boolean
}): Promise<{ success: boolean, backupPath?: string }> {
  // 1. 路径安全检查
  validatePath(params.path)

  // 2. 创建备份
  if (params.createBackup) {
    await createBackup(params.path)
  }

  // 3. 写入文件
  await fs.writeFile(resolvePath(params.path), params.content)

  // 4. 记录审计
  await auditLog('write_project_file', params.path)

  return { success: true }
}
```

**验收**：
- [x] 写入需要确认
- [x] 备份正确创建
- [ ] 审计日志记录（待后续集成）

---

### 14.1.3 文件树工具

**文件**：`src/server/services/ai/tools/projectFile.ts`

**具体步骤**：

- [x] 实现 `get_file_tree` 工具
- [x] 支持深度限制
- [x] 支持排除模式
- [x] 返回树形结构

```typescript
interface FileNode {
  name: string
  type: 'file' | 'directory'
  path: string
  children?: FileNode[]
}

async function getFileTree(params: {
  path?: string,
  depth?: number,
  exclude?: string[]
}): Promise<FileNode> {
  const root = params.path || '.'
  const maxDepth = params.depth || 3
  const excludePatterns = params.exclude || ['node_modules', '.git']

  return buildTree(root, 0, maxDepth, excludePatterns)
}
```

**验收**：
- [x] 树形结构正确
- [x] 深度限制生效
- [x] 排除模式生效

---

## 14.2 代码搜索

### 14.2.1 代码搜索工具

**文件**：`src/server/services/ai/tools/search.ts`

**具体步骤**：

- [x] 实现 `search_code` 工具
- [x] 支持正则表达式
- [x] 支持文件模式过滤
- [x] 返回匹配行和上下文

```typescript
interface SearchResult {
  file: string
  line: number
  content: string
  context: {
    before: string[]
    after: string[]
  }
}

async function searchCode(params: {
  query: string,
  filePattern?: string,
  caseSensitive?: boolean
}): Promise<SearchResult[]> {
  const pattern = params.caseSensitive
    ? new RegExp(params.query)
    : new RegExp(params.query, 'i')

  const files = await glob(params.filePattern || '**/*.{ts,tsx,js,jsx}')
  const results: SearchResult[] = []

  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8')
    const lines = content.split('\n')

    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        results.push({
          file,
          line: index + 1,
          content: line,
          context: {
            before: lines.slice(Math.max(0, index - 2), index),
            after: lines.slice(index + 1, index + 3)
          }
        })
      }
    })
  }

  return results.slice(0, 50) // 限制结果数量
}
```

**验收**：
- [x] 搜索结果正确
- [x] 正则支持正常
- [x] 文件过滤生效
- [x] 性能可接受

---

## 并行开发说明

所有任务为纯后端，可由多人并行开发。

---

## 实现文件清单

| 文件 | 行数 | 说明 |
|------|------|------|
| `src/server/services/ai/tools/index.ts` | ~10 | 模块入口 |
| `src/server/services/ai/tools/projectFile.ts` | ~290 | 文件读写和文件树工具 |
| `src/server/services/ai/tools/search.ts` | ~180 | 代码搜索工具 |

**修改的文件**：
- `src/server/services/ai/tools.ts` - 添加 `projectTools` 工具定义
- `src/server/services/ai/types.ts` - 添加项目操作类型定义
- `src/server/services/ai/executor.ts` - 添加项目操作执行逻辑
