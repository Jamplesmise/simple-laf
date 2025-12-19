# Simple IDE 开发计划

> 目标：5 天完成轻量级 Web IDE MVP

## 背景

参考 laf 项目，提取核心 IDE 功能，实现简化版云函数开发平台。

## 分阶段计划

| 阶段 | 名称 | 目标 | 预估工作量 |
|------|------|------|-----------|
| Phase 1 | 后端基础 | Server API + 数据库 | 1 天 |
| Phase 2 | Runtime 引擎 | 函数执行 + Cloud SDK | 1 天 |
| Phase 3 | LSP 集成 | TypeScript 智能提示 | 1 天 |
| Phase 4 | 前端 IDE | Monaco + 调试面板 | 1.5 天 |
| Phase 5 | 集成部署 | 单镜像 Docker + 测试 | 0.5 天 |

**总计**：5 天

---

## 目录结构

```
docs/phases/
├── README.md                     # 本文件
├── phase-1-backend/              # 阶段1：后端基础
│   ├── CONTEXT.md
│   └── TASKS.md
├── phase-2-runtime/              # 阶段2：Runtime引擎
│   ├── CONTEXT.md
│   └── TASKS.md
├── phase-3-lsp/                  # 阶段3：LSP集成
│   ├── CONTEXT.md
│   └── TASKS.md
├── phase-4-frontend/             # 阶段4：前端IDE
│   ├── CONTEXT.md
│   └── TASKS.md
└── phase-5-integration/          # 阶段5：集成部署
    ├── CONTEXT.md
    └── TASKS.md
```

---

## 关键里程碑

| 里程碑 | 验收标准 | 依赖阶段 |
|--------|---------|---------|
| M1 | Server 启动，JWT 认证可用 | Phase 1 |
| M2 | 函数 CRUD API 可用 | Phase 1 |
| M3 | Runtime 能执行函数并返回结果 | Phase 2 |
| M4 | LSP WebSocket 连接成功 | Phase 3 |
| M5 | Monaco 有 TypeScript 智能提示 | Phase 3 |
| M6 | 前端完整 IDE 界面 | Phase 4 |
| M7 | 单镜像 Docker 部署 | Phase 5 |

---

## 技术决策

### 1. 为什么用 Express 而不是 NestJS？

- Express 更轻量，学习成本低
- 项目规模小，不需要 NestJS 的模块化
- 快速开发优先

### 2. 为什么不支持多租户？

- MVP 目标是验证核心功能
- 多租户增加大量复杂度
- 后续可扩展

### 3. 为什么用 MongoDB？

- laf 原项目使用 MongoDB
- 灵活的 Schema 适合快速开发
- 云函数场景常见选择

---

## laf 核心代码参考

| 功能 | laf 文件位置 | 参考价值 |
|------|-------------|---------|
| 函数执行 | `runtimes/nodejs/src/support/engine/executor.ts` | 高，直接复用 |
| 模块加载 | `runtimes/nodejs/src/support/engine/module.ts` | 高，直接复用 |
| Console 捕获 | `runtimes/nodejs/src/support/engine/console.ts` | 高，直接复用 |
| LSP 集成 | `runtimes/nodejs/src/support/lsp.ts` | 高，核心逻辑复用 |
| Monaco 编辑器 | `web/src/components/Editor/FunctionEditor.tsx` | 中，参考集成方式 |
| 函数调用 | `runtimes/nodejs/src/handler/invoke.ts` | 中，简化后使用 |

---

## 开发日志

| 日期 | 阶段 | 完成内容 | 负责人 |
|------|------|---------|-------|
| - | - | - | - |

---

*文档版本：v1.0*
*创建日期：2024-12*
