# 4. 编码规范 (Coding Standards)

## 命名规范

### 文件命名

```
kebab-case.ts        # 普通文件
ComponentName.tsx    # React 组件
```

### 变量命名

```typescript
// 变量: camelCase
const userName = 'test'

// 常量: UPPER_SNAKE_CASE
const MAX_RETRY = 3

// 类/组件: PascalCase
class FunctionService {}
function EditorPanel() {}

// 接口: PascalCase + I 前缀 (可选)
interface IUser {}
interface User {}  // 也可以不加 I
```

## TypeScript 规范

```typescript
// 优先使用 interface
interface User {
  id: string
  name: string
}

// 使用类型推断，避免冗余类型标注
const count = 0  // ✅
const count: number = 0  // ❌ 冗余

// 使用可选链和空值合并
const name = user?.profile?.name ?? 'Unknown'

// 禁止 any，使用 unknown
function parse(data: unknown) {
  if (typeof data === 'string') {
    return JSON.parse(data)
  }
}
```

## React 规范

```typescript
// 使用函数组件 + Hooks
function FunctionList() {
  const [functions, setFunctions] = useState<Function[]>([])

  useEffect(() => {
    loadFunctions()
  }, [])

  return <div>...</div>
}

// Props 类型定义
interface Props {
  value: string
  onChange: (value: string) => void
}

function Editor({ value, onChange }: Props) {
  return ...
}
```

## 错误处理

```typescript
// 使用 try-catch，返回统一格式
async function handleRequest(req, res) {
  try {
    const result = await doSomething()
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'OPERATION_FAILED',
        message: error.message
      }
    })
  }
}
```

## Git 提交规范

```
<type>: <subject>

type:
- feat: 新功能
- fix: Bug 修复
- docs: 文档
- refactor: 重构
- test: 测试
- chore: 构建/工具

示例:
feat: 添加函数编辑器
fix: 修复 LSP 连接断开问题
docs: 更新 API 文档
```

## 代码量限制

遵循 MVU 原则 (Minimum Viable Unit):
- 单文件 < 300 行
- 单函数 < 50 行
- 单次提交改动 < 5 文件
