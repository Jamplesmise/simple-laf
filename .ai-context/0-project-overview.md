# 0. 项目概览 (Project Overview)

## 项目身份

| 属性 | 值 |
|------|-----|
| **项目名称** | Simple IDE |
| **项目类型** | 轻量级 Serverless Web IDE |
| **定位** | laf 项目的简化版，专注核心 IDE 功能 |
| **目标** | 3-5 天完成 MVP |

## 核心目标

**解决什么问题：**
1. 提供浏览器内云函数开发环境
2. TypeScript 智能提示 (LSP)
3. 函数即时执行和调试
4. 简单部署，无需 Kubernetes

**不做什么：**
- 多租户隔离
- 自动扩缩容
- 计费系统
- 团队协作
- 对象存储管理

## 核心功能 (MVP)

```
┌─────────────────────────────────────────┐
│  前端 Web IDE                           │
│  ├─ Monaco 代码编辑器                   │
│  ├─ TypeScript 智能提示                 │
│  ├─ 函数列表管理                        │
│  ├─ 调试面板 (参数/结果)                │
│  └─ 控制台日志                          │
└─────────────────────────────────────────┘
                  │
┌─────────────────────────────────────────┐
│  后端 API                               │
│  ├─ 用户认证 (JWT)                      │
│  ├─ 函数 CRUD                           │
│  └─ TypeScript 编译                     │
└─────────────────────────────────────────┘
                  │
┌─────────────────────────────────────────┐
│  Runtime 运行时                         │
│  ├─ 函数执行引擎                        │
│  ├─ LSP 服务 (typescript-language-server)│
│  └─ 简化版 Cloud SDK                    │
└─────────────────────────────────────────┘
```

## 成功标准

- [ ] 能创建、编辑、删除云函数
- [ ] Monaco 编辑器有 TypeScript 智能提示
- [ ] 能执行函数并查看返回结果
- [ ] 能查看 console.log 输出
- [ ] Docker Compose 一键部署

## 参考来源

本项目参考 [laf](https://github.com/labring/laf) 的核心实现，重点复用：
- `runtimes/nodejs/src/support/engine/` - 函数执行引擎
- `runtimes/nodejs/src/support/lsp.ts` - LSP 集成
- `web/src/components/Editor/` - Monaco 编辑器集成
