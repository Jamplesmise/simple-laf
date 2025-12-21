# Sprint 13: 实时监控 - 任务清单

## 任务概览

| 任务 | 轨道 | 优先级 | 预估 | 依赖 | 状态 |
|------|------|-------|------|------|------|
| 13.1.1 WebSocket 服务器 | 后端 | P1 | 3h | 无 | ✅ 完成 |
| 13.1.2 事件收集中间件 | 后端 | P1 | 2h | 13.1.1 | ✅ 完成 |
| 13.2.1 统计聚合 API | 后端 | P1 | 2h | 无 | ✅ 完成 |
| 13.2.2 仪表板组件 | 前端 | P1 | 4h | 13.2.1 | ✅ 完成 |
| 13.3.1 错误聚合服务 | 后端 | P2 | 2h | 无 | ✅ 完成 |
| 13.3.2 错误列表组件 | 前端 | P2 | 2h | 13.3.1 | ✅ 完成 |

---

## 13.1 WebSocket 推送

### 13.1.1 WebSocket 服务器

**文件**：`src/server/services/monitor/websocket.ts`

- [x] 安装 `socket.io` 依赖
- [x] 创建 WebSocket 服务器
- [x] 实现认证中间件
- [x] 实现房间订阅机制

### 13.1.2 事件收集中间件

**文件**：`src/server/middleware/monitor.ts`

- [x] 在函数调用时收集事件
- [x] 广播到订阅的客户端
- [x] 性能优化（批量发送）

---

## 13.2 统计仪表板

### 13.2.1 统计聚合 API

**API**：`GET /api/monitor/stats`

```typescript
{
  period: '1h' | '24h' | '7d',
  functionId?: string
}

// 响应
{
  callCount: number,
  successRate: number,
  avgLatency: number,
  timeline: { time: Date, count: number }[]
}
```

**额外实现的 API**：
- `GET /api/monitor/top-functions` - 热门函数排行
- `GET /api/monitor/connections` - WebSocket 连接统计
- `GET /api/monitor/errors` - 错误摘要
- `GET /api/monitor/errors/:functionId` - 函数错误详情

### 13.2.2 仪表板组件

**文件**：`src/client/components/Monitor/Dashboard.tsx`

- [x] 调用量折线图
- [x] 成功率/延迟卡片
- [x] 热门函数列表

---

## 13.3 错误聚合

### 13.3.1 错误聚合服务

**文件**：`src/server/services/monitor/errorAggregator.ts`

- [x] 按错误类型分组
- [x] 计算错误趋势
- [x] 提供 AI 工具接口

### 13.3.2 错误列表组件

**文件**：`src/client/components/Monitor/ErrorList.tsx`

- [x] 错误类型分组展示
- [x] 错误详情展开
- [x] 跳转到相关函数

---

## 集成说明

监控功能已集成到 `StatisticsPanel` 组件，通过 Tabs 切换：
- **概览** - 原有统计功能
- **实时监控** - Dashboard 组件
- **错误分析** - ErrorList 组件

入口：侧边栏 **统计** 图标

---

## 并行开发说明

后端和前端可完全并行开发，通过 Mock 数据联调。
