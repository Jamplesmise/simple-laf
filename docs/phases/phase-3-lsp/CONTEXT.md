# Phase 3: LSP 集成

## 阶段目标

集成 TypeScript Language Server，为 Monaco 编辑器提供智能提示。

## 功能范围

### 包含

- WebSocket 服务
- typescript-language-server 集成
- 代码补全
- 错误诊断
- 类型提示

### 不包含

- 代码重构
- 跨文件引用
- 完整的项目配置

## 核心参考 (laf)

| 文件 | 用途 |
|------|------|
| `runtimes/nodejs/src/support/lsp.ts` | LSP WebSocket 桥接 |

## 架构

```
Monaco Editor (浏览器)
    │
    │ WebSocket (JSON-RPC)
    ▼
Runtime /_/lsp 端点
    │
    │ stdio
    ▼
typescript-language-server
    │
    │ 类型分析
    ▼
TypeScript 编译器 API
```

## LSP 协议简述

```
// 初始化
→ initialize { capabilities }
← initialized

// 打开文件
→ textDocument/didOpen { uri, text }

// 编辑文件
→ textDocument/didChange { uri, changes }

// 请求补全
→ textDocument/completion { uri, position }
← completionItems

// 诊断推送
← textDocument/publishDiagnostics { uri, diagnostics }
```

## 目录结构 (单镜像架构)

```
simple-ide/src/               # 后端源码
├── lsp/
│   ├── index.ts             # LSP WebSocket 处理
│   └── server.ts            # typescript-language-server 管理
└── index.ts                 # Express 入口 (添加 WebSocket 升级)
```

> 注：单镜像架构下，LSP 直接集成在主服务的 `/_/lsp` 端点。

## 验收标准

- [ ] WebSocket 连接 /_/lsp 成功
- [ ] 发送 initialize 请求成功
- [ ] 打开文件后收到诊断消息
- [ ] 输入 `ctx.` 后收到补全建议
- [ ] 类型错误显示红色波浪线

## 依赖

- Phase 2 完成 (Runtime 基础架构)

## 下一阶段

完成本阶段后，进入 Phase 4：前端 IDE
