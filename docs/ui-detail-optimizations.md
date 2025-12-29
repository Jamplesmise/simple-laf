# UI 细节优化记录

> 本文档记录 Simple IDE 项目中所有用户界面的细节优化。

---

## 2024-12-23: AI 对话界面优化

### 1. Markdown 渲染支持

**新增依赖**:
```bash
pnpm add react-markdown remark-gfm
```

**支持语法**: 标题、粗体、斜体、列表、代码块、行内代码、引用、表格、链接

**修改文件**:
- `src/client/components/AIConversationDialog/MessageContent.tsx`
  - 引入 `react-markdown` 和 `remark-gfm`
  - 重写 `TextContent` 组件
  - 自定义代码块组件保留预览功能

---

### 2. 操作按钮位置调整

**变更**:
- 原位置: 消息右上角
- 新位置: 消息内容下方
- 移除复制按钮（代码块已有复制功能）

**保留按钮**: 编辑(用户)、点赞/点踩(AI)、分支(通用)

**修改文件**:
- `MessagePanel.tsx` - 新增 `messageBody` 容器
- `MessageActions/index.tsx` - 移除复制按钮
- `styles.module.css` - 调整 `.messageActions` 样式

---

### 3. AI 头像更换

**变更**:
- 原图标: `RobotOutlined` (Ant Design)
- 新图标: `Sparkles` (lucide-react) - 魔法闪亮图标

**修改文件**: `MessagePanel.tsx`

---

### 4. 代码行数显示

**变更**:
- 原方式: 卡片内直接显示 "xxx 行代码"
- 新方式: 鼠标悬浮时 Tooltip 显示

**修改文件**: `MessageContent.tsx` - `OperationCard` 用 `Tooltip` 包裹

---

### 5. Markdown 间距优化

**问题**: 默认间距过大

**解决**: 在 `styles.module.css` 使用强选择器覆盖:

```css
.messageText p { margin-bottom: 3px; }
.messageText h1, .messageText h2, .messageText h3 {
  margin-top: 9px;
  margin-bottom: 3px;
}
.messageText ul, .messageText ol {
  padding-left: 20px;
  margin: 3px 0;
}
.messageText li { line-height: 1.5; }
.messageText li + li { margin-top: 2px; }
```

---

### 6. 新增样式类

- `.inlineCode` - 行内代码
- `.markdownP/H1~H4` - 段落/标题
- `.markdownUl/Ol/Li` - 列表
- `.markdownBlockquote` - 引用块
- `.markdownTable` - 表格
- `.markdownLink` - 链接
- `.markdownStrong/Em` - 粗体/斜体
- `.messageBody` - 消息体容器

暗色模式: 所有样式有 `:global(.dark)` 变体

---

### 相关文件

| 文件 | 修改类型 |
|------|----------|
| `AIConversationDialog/MessageContent.tsx` | 重构 |
| `AIConversationDialog/MessagePanel.tsx` | 修改 |
| `AIConversationDialog/MessageActions/index.tsx` | 修改 |
| `AIConversationDialog/styles.module.css` | 新增样式 |
| `package.json` | 新增依赖 |

---

<!-- 后续优化在此追加 -->
