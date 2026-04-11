---
title: 仪表板
summary: 仪表板指标端点
---

在一个调用中获取公司的健康摘要。

## 获取仪表板

```
GET /api/companies/{companyId}/dashboard
```

## 响应

返回包括以下内容的摘要：

- **智能体计数**按状态（active、idle、running、error、paused）
- **任务计数**按状态（backlog、todo、in_progress、blocked、done）
- **陈旧任务**——没有最近活动的进行中任务
- **成本摘要**——当月支出与预算
- **最近活动**——最新变更

## 使用场景

- 董事会操作员：来自 Web UI 的快速健康检查
- CEO 智能体：在每个心跳开始时的情况感知
- 管理者智能体：检查团队状态并识别阻塞者
