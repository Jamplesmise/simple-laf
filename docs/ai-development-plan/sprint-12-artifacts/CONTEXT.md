# Sprint 12: Artifacts 增强

## 阶段目标

实现 Claude Artifacts 风格的预览功能，支持 HTML/React 实时预览，对话导出和文件上传。

## 功能范围

### 12.1 HTML/React 预览（可独立开发）

**前端**：
- HTML 页面实时预览（iframe sandbox）
- React 组件预览（沙箱执行）
- Mermaid 图表渲染
- SVG 图形展示

### 12.2 导出功能（可独立开发）

**后端**：
- 对话导出 API（Markdown/JSON）
- 代码文件导出

**前端**：
- 导出对话框
- 格式选择
- 下载触发

### 12.3 文件上传（可独立开发）

**后端**：
- 文件上传 API
- 文件内容解析
- 上下文注入

**前端**：
- 文件上传组件
- 拖拽上传支持
- 上传进度展示

### 不包含

- PDF 解析（复杂度高，后续考虑）
- 图片 OCR（需要额外模型）

## 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| HTML 预览 | iframe sandbox | 安全隔离 |
| React 预览 | @babel/standalone | 浏览器端编译 |
| Mermaid | mermaid.js | 官方库 |
| 文件解析 | 原生 API | 轻量 |

## API 变更

### 新增 API

```
GET    /api/ai/conversations/:id/export?format=markdown|json  # 导出对话
POST   /api/ai/conversations/:id/files                        # 上传文件
GET    /api/ai/conversations/:id/files                        # 获取文件列表
DELETE /api/ai/conversations/:id/files/:fileId                # 删除文件
```

## 目录结构变更

```
src/client/components/AI/
├── Artifacts/                   # 新增：Artifacts 预览
│   ├── index.tsx               # Artifacts 容器
│   ├── HTMLPreview.tsx         # HTML 预览
│   ├── ReactPreview.tsx        # React 预览
│   ├── MermaidPreview.tsx      # Mermaid 预览
│   └── SVGPreview.tsx          # SVG 预览
├── Export/                      # 新增：导出功能
│   ├── index.tsx
│   └── ExportDialog.tsx
└── FileUpload/                  # 新增：文件上传
    ├── index.tsx
    ├── DropZone.tsx
    └── FileList.tsx
```

## 验收标准

### 12.1 HTML/React 预览

- [ ] HTML 代码可实时预览
- [ ] React 组件可预览（沙箱安全）
- [ ] Mermaid 图表正确渲染
- [ ] SVG 图形正确展示

### 12.2 导出功能

- [ ] 可导出 Markdown 格式
- [ ] 可导出 JSON 格式
- [ ] 代码块正确保留
- [ ] 下载文件名包含对话标题

### 12.3 文件上传

- [ ] 支持文本文件上传
- [ ] 支持拖拽上传
- [ ] 文件内容作为上下文
- [ ] 可删除已上传文件

## 依赖

- Sprint 10（基础 Chat 架构）

## 下一阶段

完成 Phase 1 后，可进入：
- Sprint 13：实时监控（可选）
- Sprint 14：项目代码操作
