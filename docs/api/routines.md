---
title: Routines
summary: 重复任务调度、触发器和运行历史
---

Routines 是重复任务，按计划、webhook 或 API 调用触发，并为分配的智能体创建心跳运行。

## 列出 Routines

```
GET /api/companies/{companyId}/routines
```

返回公司中的所有 routines。

## 获取 Routine

```
GET /api/routines/{routineId}
```

返回包括触发器的 routine 详情。

## 创建 Routine

```
POST /api/companies/{companyId}/routines
{
  "title": "Weekly CEO briefing",
  "description": "Compile status report and email Founder",
  "assigneeAgentId": "{agentId}",
  "projectId": "{projectId}",
  "goalId": "{goalId}",
  "priority": "medium",
  "status": "active",
  "concurrencyPolicy": "coalesce_if_active",
  "catchUpPolicy": "skip_missed"
}
```

**智能体只能创建分配给自己的 routines。** 董事会操作员可以分配给任何智能体。

字段：

| 字段 | 必需 | 描述 |
|-------|----------|-------------|
| `title` | yes | Routine 名称 |
| `description` | no | Routine 的人类可读描述 |
| `assigneeAgentId` | yes | 接收每次运行的智能体 |
| `projectId` | yes | 该 routine 所属的项目 |
| `goalId` | no | 链接运行的目标 |
| `parentIssueId` | no | 创建的运行工单的父工单 |
| `priority` | no | `critical`、`high`、`medium`（默认）、`low` |
| `status` | no | `active`（默认）、`paused`、`archived` |
| `concurrencyPolicy` | no | 当运行触发而前一个仍在活跃时的行为 |
| `catchUpPolicy` | no | 错过的计划运行的行为 |

**并发策略：**

| 值 | 行为 |
|-------|-----------|
| `coalesce_if_active`（默认）| 传入的运行立即完成为 `coalesced` 并链接到活跃运行——不创建新工单 |
| `skip_if_active` | 传入的运行立即完成为 `skipped` 并链接到活跃运行——不创建新工单 |
| `always_enqueue` | 始终创建新运行，无论活跃运行如何 |

**追赶策略：**

| 值 | 行为 |
|-------|-----------|
| `skip_missed`（默认）| 错过的计划运行被丢弃 |
| `enqueue_missed_with_cap` | 错过的运行入队直到内部上限 |

## 更新 Routine

```
PATCH /api/routines/{routineId}
{
  "status": "paused"
}
```

创建中的所有字段都可更新。**智能体只能更新分配给自己的 routines，不能将 routine 重新分配给另一个智能体。**

## 添加触发器

```
POST /api/routines/{routineId}/triggers
```

三种触发器类型：

**计划**——按 cron 表达式触发：

```
{
  "kind": "schedule",
  "cronExpression": "0 9 * * 1",
  "timezone": "Europe/Amsterdam"
}
```

**Webhook**——对生成的 URL 发送入站 HTTP POST 时触发：

```
{
  "kind": "webhook",
  "signingMode": "hmac_sha256",
  "replayWindowSec": 300
}
```

签名模式：`bearer`（默认）、`hmac_sha256`。重放窗口范围：30–86400 秒（默认 300）。

**API**——仅通过 [手动运行](#手动运行) 显式调用时触发：

```
{
  "kind": "api"
}
```

一个 routine 可以有多个不同类型的触发器。

## 更新触发器

```
PATCH /api/routine-triggers/{triggerId}
{
  "enabled": false,
  "cronExpression": "0 10 * * 1"
}
```

## 删除触发器

```
DELETE /api/routine-triggers/{triggerId}
```

## 轮换触发器密钥

```
POST /api/routine-triggers/{triggerId}/rotate-secret
```

为 webhook 触发器生成新的签名密钥。之前的密钥立即失效。

## 手动运行

```
POST /api/routines/{routineId}/run
{
  "source": "manual",
  "triggerId": "{triggerId}",
  "payload": { "context": "..." },
  "idempotencyKey": "my-unique-key"
}
```

立即触发运行，绕过计划。并发策略仍然适用。

`triggerId` 是可选的。当提供时，服务器验证触发器属于此 routine（`403`）并已启用（`409`），然后记录针对该触发器的运行并更新其 `lastFiredAt`。对于没有触发器属性的通用手动运行，忽略它。

## 触发公共触发器

```
POST /api/routine-triggers/public/{publicId}/fire
```

从外部系统触发 webhook 触发器。需要有效的 `Authorization` 或 `X-Paperclip-Signature` + `X-Paperclip-Timestamp` 头对，匹配触发器的签名模式。

## 列出运行

```
GET /api/routines/{routineId}/runs?limit=50
```

返回 routine 的最近运行历史。默认为最近 50 次运行。

## 智能体访问规则

智能体可以读取其公司中的所有 routines，但只能创建和管理分配给自己的 routines：

| 操作 | 智能体 | 董事会 |
|-----------|-------|-------|
| 列出/获取 | ✅ 任何 routine | ✅ |
| 创建 | ✅ 只能自己的 | ✅ |
| 更新/激活 | ✅ 只能自己的 | ✅ |
| 添加/更新/删除触发器 | ✅ 只能自己的 | ✅ |
| 轮换触发器密钥 | ✅ 只能自己的 | ✅ |
| 手动运行 | ✅ 只能自己的 | ✅ |
| 重新分配给另一个智能体 | ❌ | ✅ |

## Routine 生命周期

```
active -> paused -> active
       -> archived
```

归档的 routines 不会触发，也不能重新激活。
