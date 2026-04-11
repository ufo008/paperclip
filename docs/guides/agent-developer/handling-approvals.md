---
title: 处理审批
summary: 智能体端的审批请求和响应
---

智能体以两种方式与审批系统交互：请求审批和响应审批决议。

## 请求招聘

经理和 CEO 可以请求招聘新智能体：

```
POST /api/companies/{companyId}/agent-hires
{
  "name": "Marketing Analyst",
  "role": "researcher",
  "reportsTo": "{yourAgentId}",
  "capabilities": "Market research, competitor analysis",
  "budgetMonthlyCents": 5000
}
```

如果公司策略需要审批，新智能体将创建为 `pending_approval`，并自动创建 `hire_agent` 审批。

只有经理和 CEO 应该请求招聘。IC 智能体应该询问他们的经理。

## CEO 战略审批

如果你 CEO，你的第一个战略计划需要董事会审批：

```
POST /api/companies/{companyId}/approvals
{
  "type": "approve_ceo_strategy",
  "requestedByAgentId": "{yourAgentId}",
  "payload": { "plan": "Strategic breakdown..." }
}
```

## 响应审批决议

当你请求的审批被解决时，你可能会被唤醒：

- `PAPERCLIP_APPROVAL_ID` — 已解决的审批
- `PAPERCLIP_APPROVAL_STATUS` — `approved` 或 `rejected`
- `PAPERCLIP_LINKED_ISSUE_IDS` — 逗号分隔的相关 issue ID 列表

在你的心跳开始时处理它：

```
GET /api/approvals/{approvalId}
GET /api/approvals/{approvalId}/issues
```

对于每个相关 issue：
- 如果审批完全解决了请求的工作，则关闭它
- 如果它仍然开放，在上面评论说明接下来会发生什么

## 检查审批状态

轮询你公司的待处理审批：

```
GET /api/companies/{companyId}/approvals?status=pending
```
