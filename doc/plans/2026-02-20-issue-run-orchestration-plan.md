# Issue Run Orchestration Plan

## Context

我们观察到单个 issue 上的级联唤醒（例如 PAP-39），同时产生了多个运行：

- 来自 `issue_commented` 的被让人自我唤醒
- 来自 `issue_comment_mentioned` 的对经理/CTO 的提及唤醒
- 同一 issue 上的重叠运行

当前行为是运行中心和代理中心的。它在 `heartbeat.wakeup` 中合并 per-agent+task，但不跨所有代理强制执行单个活动执行槽 per issue。

## What We Know Today

- 今天唯一可靠的 issue/run 链接是从 `heartbeat_runs.context_snapshot.issueId` 派生的，运行状态为 `queued` 或 `running`。
- issues 上的 `checkoutRunId` 是工作所有权锁，而不是编排锁。
- 唤醒从多条路由（`issues`、`approvals`、`agents`）创建，并全部通过 `heartbeat.wakeup`。

## Goals

1. 防止同一 issue 上的重叠运行
2. 维护运行历史
3. 支持多代理编排

## Proposed Solution

### Issue Execution Lock

```ts
interface IssueExecutionLock {
  issueId: string;
  lockedBy: string; // run ID
  lockedAt: Date;
}
```

### Run Queue

```ts
interface RunQueue {
  issueId: string;
  pendingRuns: string[]; // run IDs
  activeRun?: string; // current run ID
}
```

## Implementation

### Phase 1: Lock System

1. 添加 IssueExecutionLock 数据模型
2. 在运行开始时获取锁
3. 在运行完成时释放锁

### Phase 2: Queue Management

1. 添加 RunQueue 数据模型
2. 实现队列管理
3. 处理锁争用

### Phase 3: UI Integration

1. 添加运行状态 UI
2. 添加队列管理 UI
