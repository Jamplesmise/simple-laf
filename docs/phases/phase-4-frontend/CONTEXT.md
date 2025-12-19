# Phase 4: 前端 IDE

## 阶段目标

实现 Web IDE 界面，集成 Monaco 编辑器和 LSP。

## 功能范围

### 包含

- 登录/注册页面
- IDE 主界面布局
- Monaco 代码编辑器
- LSP 智能提示集成
- 函数列表管理
- 调试面板 (参数/结果/日志)

### 不包含

- 复杂布局定制
- 多标签编辑
- 主题切换
- 快捷键配置

## 页面结构

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Logo + 用户信息 + 登出                              │
├─────────────┬───────────────────────────┬───────────────────┤
│             │                           │                   │
│  函数列表    │    Monaco Editor          │   调试面板        │
│             │                           │                   │
│  + 新建     │    (带 LSP 智能提示)       │   ├─ 参数输入     │
│  - 函数1    │                           │   ├─ 运行按钮     │
│  - 函数2    │                           │   ├─ 返回结果     │
│  - ...      │                           │   └─ 控制台日志   │
│             │                           │                   │
├─────────────┴───────────────────────────┴───────────────────┤
│  Footer: 状态栏 (保存状态、LSP 状态)                          │
└─────────────────────────────────────────────────────────────┘
```

## 组件设计

```
src/
├── pages/
│   ├── Login.tsx           # 登录页
│   ├── Register.tsx        # 注册页
│   └── IDE.tsx             # IDE 主页
├── components/
│   ├── FunctionList.tsx    # 函数列表
│   ├── Editor.tsx          # Monaco 编辑器
│   ├── DebugPanel.tsx      # 调试面板
│   │   ├── ParamsInput.tsx # 参数输入
│   │   ├── ResultView.tsx  # 结果展示
│   │   └── Console.tsx     # 控制台
│   └── Header.tsx          # 顶部栏
├── stores/
│   ├── auth.ts             # 认证状态
│   └── function.ts         # 函数状态
└── api/
    ├── auth.ts             # 认证 API
    └── functions.ts        # 函数 API
```

## Monaco + LSP 集成

### 参考 laf

`web/src/components/Editor/FunctionEditor.tsx`

### 关键点

1. 创建 Monaco 编辑器
2. 建立 WebSocket 连接到 /_/lsp
3. 使用 monaco-languageclient 桥接
4. 处理 LSP 消息

## 验收标准

- [ ] 登录/注册功能正常
- [ ] 函数列表显示正确
- [ ] 新建/删除函数正常
- [ ] 编辑器代码保存正常
- [ ] LSP 智能提示工作
- [ ] 调试面板能运行函数
- [ ] 控制台显示日志

## 依赖

- Phase 1 (Server API)
- Phase 2 (Runtime 执行)
- Phase 3 (LSP 服务)

## 下一阶段

完成本阶段后，进入 Phase 5：集成部署
