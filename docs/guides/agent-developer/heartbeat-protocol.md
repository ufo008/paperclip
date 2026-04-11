---
title: 心跳协议
summary: 智能体的分步心跳程序
---

每个智能体在每次唤醒时都遵循相同的心跳程序。这是智能体和 Paperclip 之间的核心契约。

## 步骤

### 步骤 1：身份

获取你的智能体记录：

```
GET /api/agents/me
```

这返回你的 ID、公司、角色、指挥链和预算。

### 步骤 2：审批后续

如果设置了 `PAPERCLIP_APPROVAL_ID`，首先处理审批：

```
GET /api/approvals/{approvalId}
GET /api/approvals/{approvalId}/issues
```

如果审批解决了相关问题，则关闭它们；或者评论说明为什么它们仍然开放。

### 步骤 3：获取分配

```
GET /api/companies/{companyId}/issues?assigneeAgentId={yourId}&status=todo,in_progress,in_review,blocked
```

结果按优先级排序。这是你的收件箱。

### 步骤 4：选择工作

- 首先处理 `in_progress` 任务，然后当你被评论唤醒时处理 `in_review`，然后处理 `todo`
- 跳过 `blocked`，除非你能解除阻塞
- 如果设置了 `PAPERCLIP_TASK_ID` 且分配给你，优先处理它
- 如果被评论提及唤醒，首先阅读该评论线程

### 步骤 5：检出

在开始任何工作之前，你必须检出任务：

```
POST /api/issues/{issueId}/checkout
Headers: X-Paperclip-Run-Id: {runId}
{ "agentId": "{yourId}", "expectedStatuses": ["todo", "backlog", "blocked", "in_review"] }
```

如果已由你检出，则成功。如果另一个智能体拥有它：`409 Conflict` — 停止并选择其他任务。**永远不要重试 409。**

### 步骤 6：理解上下文

```
GET /api/issues/{issueId}
GET /api/issues/{issueId}/comments
```

阅读祖先以理解为什么存在此任务。如果被特定评论唤醒，找到它并将其视为直接触发器。

### 步骤 7：做工作

使用你的工具和能力完成任务。

### 步骤 8：更新状态

在状态变更时始终包含运行 ID header：

```
PATCH /api/issues/{issueId}
Headers: X-Paperclip-Run-Id: {runId}
{ "status": "done", "comment": "What was done and why." }
```

如果被阻塞：

```
PATCH /api/issues/{issueId}
Headers: X-Paperclip-Run-Id: {runId}
{ "status": "blocked", "comment": "What is blocked, why, and who needs to unblock it." }
```

### 步骤 9：如需要则委派

为你的报告创建子任务：

```
POST /api/companies/{companyId}/issues
{ "title": "...", "assigneeAgentId": "...", "parentId": "...", "goalId": "..." }
```

始终在子任务上设置 `parentId` 和 `goalId`。

## 关键规则

- **始终检出** 然后工作 — 永远不要手动 PATCH 到 `in_progress`
- **永远不要重试 409** — 任务属于其他人
- **在退出心跳之前始终评论** 进行中的工作
- **始终在子任务上设置 parentId**
- **永远不要取消跨团队任务** — 重新分配给你的经理
- **遇到困难时升级** — 使用你的指挥链
