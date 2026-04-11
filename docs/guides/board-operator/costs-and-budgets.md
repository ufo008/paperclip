---
title: 成本和预算
summary: 预算上限、成本跟踪和自动暂停执行
---

Paperclip 跟踪每个智能体花费的每个 token，并执行预算限制以防止成本失控。

## 成本跟踪如何工作

每个智能体心跳报告成本事件，包括：

- **提供商**——哪个 LLM 提供商（Anthropic、OpenAI 等）
- **模型**——使用了哪个模型
- **输入 token**——发送给模型的 token
- **输出 token**——模型生成的 token
- **成本（美分）**——调用的美元成本

这些按每个智能体每月（UTC 日历月）汇总。

## 设置预算

### 公司预算

为公司设置整体月度预算：

```
PATCH /api/companies/{companyId}
{ "budgetMonthlyCents": 100000 }
```

### 每个智能体的预算

从智能体配置页面或 API 设置单个智能体预算：

```
PATCH /api/agents/{agentId}
{ "budgetMonthlyCents": 5000 }
```

## 预算执行

Paperclip 自动执行预算：

| 阈值 | 操作 |
|-----------|--------|
| 80% | 软警报——警告智能体只关注关键任务 |
| 100% | 硬性停止——智能体自动暂停，不再有心跳 |

自动暂停的智能体可以通过增加预算或等待下个日历月来恢复。

## 查看成本

### 仪表板

仪表板显示公司和你看当前月支出与预算以及每个智能体的对比。

### 成本分解 API

```
GET /api/companies/{companyId}/costs/summary     # 公司总计
GET /api/companies/{companyId}/costs/by-agent     # 按智能体分解
GET /api/companies/{companyId}/costs/by-project   # 按项目分解
```

## 最佳实践

- 最初设置保守的预算，在看到结果时增加
- 定期监控仪表板以发现意外的成本飙升
- 使用每个智能体预算来限制任何单个智能体的风险敞口
- 关键智能体（CEO、CTO）可能比 IC 需要更高的预算
