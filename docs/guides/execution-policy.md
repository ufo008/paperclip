# 执行策略：审查和审批工作流

Paperclip 的执行策略系统确保任务以正确的监督级别完成。不是依赖智能体记住交接工作以供审查，**运行时强制执行**审查和审批阶段。

## 概述

执行策略是任何工单上的可选结构化对象，定义了执行者完成工作后必须发生什么。它支持三层强制执行：

| 层级 | 目的 | 范围 |
|---|---|---|
| **需要评论** | 每个智能体运行必须将评论发布回工单 | 运行时不变式（始终开启）|
| **审查阶段** | 审查者检查质量/正确性，可以请求更改 | 按工单，可选 |
| **审批阶段** | 管理者/利益相关者给予最终签字 | 按工单，可选 |

这些层级是组合的。工单可以只有审查、只有审批、两者顺序组合，或两者都没有（只有评论必需的保障）。

## 数据模型

### 执行策略（工单字段：`executionPolicy`）

```ts
interface IssueExecutionPolicy {
  mode: "normal" | "auto";
  commentRequired: boolean;       // 始终为 true，由运行时强制执行
  stages: IssueExecutionStage[];  // 有序的审查/审批阶段列表
}

interface IssueExecutionStage {
  id: string;                                 // 自动生成的 UUID
  type: "review" | "approval";                // 阶段类型
  approvalsNeeded: 1;                         // 暂不支持多审批
  participants: IssueExecutionStageParticipant[];
}

interface IssueExecutionStageParticipant {
  id: string;
  type: "agent" | "user";
  agentId?: string | null;    // 当类型为 "agent" 时设置
  userId?: string | null;     // 当类型为 "user" 时设置
}
```

参与者可以是智能体或 board 用户。每个阶段可以有多个参与者；运行时选择第一个符合条件的参与者，优先选择任何明确请求的 assignee，同时排除原始执行者。

### 执行状态（工单字段：`executionState`）

跟踪工单当前位于其策略工作流的什么位置：

```ts
interface IssueExecutionState {
  status: "idle" | "pending" | "changes_requested" | "completed";
  currentStageId: string | null;
  currentStageIndex: number | null;
  currentStageType: "review" | "approval" | null;
  currentParticipant: IssueExecutionStagePrincipal | null;
  returnAssignee: IssueExecutionStagePrincipal | null;
  completedStageIds: string[];
  lastDecisionId: string | null;
  lastDecisionOutcome: "approved" | "changes_requested" | null;
}
```

### 执行决策（表：`issue_execution_decisions`）

每个审查/审批操作的审计跟踪：

```ts
interface IssueExecutionDecision {
  id: string;
  companyId: string;
  issueId: string;
  stageId: string;
  stageType: "review" | "approval";
  actorAgentId: string | null;
  actorUserId: string | null;
  outcome: "approved" | "changes_requested";
  body: string;              // 解释决策的必需评论
  createdByRunId: string | null;
  createdAt: Date;
}
```

## 工作流

### 快乐路径：审查 + 审批

```
┌──────────┐    executor     ┌───────────┐   reviewer    ┌───────────┐   approver    ┌──────┐
│  todo     │───completes───▶│ in_review  │───approves───▶│ in_review │───approves───▶│ done │
│ (Coder)  │    work         │ (QA)      │               │ (CTO)     │               │      │
└──────────┘                 └───────────┘               └───────────┘               └──────┘
```

1. **创建带有 `executionPolicy` 的工单**，指定审查阶段（例如 QA）和审批阶段（例如 CTO）。
2. **执行者在 `in_progress` 状态下处理工单。**
3. **执行者转换到 `done`** —— 运行时拦截此操作：
   - 状态变为 `in_review`（不是 `done`）
   - 工单重新分配给第一个审查者
   - `executionState` 进入审查阶段的 `pending`
4. **审查者审查**并用评论转换到 `done`：
   - 创建决策记录：`{ outcome: "approved" }`
   - 工单保持 `in_review`，重新分配给审批者
   - `executionState` 进入审批阶段
5. **审批者批准**并用评论转换到 `done`：
   - 创建决策记录：`{ outcome: "approved" }`
   - `executionState.status` 变为 `completed`
   - 工单达到实际的 `done` 状态

### 请求更改流程

```
┌───────────┐   reviewer requests   ┌─────────────┐   executor    ┌───────────┐
│ in_review  │───changes────────────▶│ in_progress  │───resubmits──▶│ in_review │
│ (QA)      │                       │ (Coder)      │               │ (QA)      │
└───────────┘                       └──────────────┘               └───────────┘
```

1. **审查者请求更改**通过转换到除 `done` 以外的任何状态（通常为 `in_progress`），并带有解释需要更改的评论。
2. 运行时自动：
   - 设置状态为 `in_progress`
   - 重新分配给原始执行者（存储在 `returnAssignee`）
   - 设置 `executionState.status` 为 `changes_requested`
3. **执行者进行更改**并再次转换到 `done`。
4. 运行时返回到**相同的审查阶段**（不是开始），并带有相同的审查者。
5. 此循环继续直到审查者批准。

### 策略变体

**仅审查**（无审批阶段）：
```json
{
  "stages": [
    { "type": "review", "participants": [{ "type": "agent", "agentId": "qa-agent-id" }] }
  ]
}
```
执行者完成 → 审查者批准 → done。

**仅审批**（无审查阶段）：
```json
{
  "stages": [
    { "type": "approval", "participants": [{ "type": "user", "userId": "manager-user-id" }] }
  ]
}
```
执行者完成 → 审批者签字 → done。

**多个审查者/审批者：**
每个阶段支持多个参与者。运行时选择一个来操作，排除原始执行者以防止自我审查。

## 评论必需保障

独立于审查阶段，每个绑定到工单的智能体运行必须留下评论。这在运行时级别强制执行：

1. **运行完成** —— 运行时检查智能体是否为此运行发布了评论。
2. **如果没有评论**：将 `issueCommentStatus` 设置为 `retry_queued`，并以原因 `missing_issue_comment` 再次唤醒智能体一次。
3. **如果重试后仍然没有评论**：将 `issueCommentStatus` 设置为 `retry_exhausted`。不再重试。记录失败。
4. **如果发布了评论**：将 `issueCommentStatus` 设置为 `satisfied` 并链接到评论 ID。

这防止了智能体完成工作但不留任何工作痕迹的静默完成。

### 运行级跟踪字段

| 字段 | 描述 |
|---|---|
| `issueCommentStatus` | `satisfied`、`retry_queued` 或 `retry_exhausted` |
| `issueCommentSatisfiedByCommentId` | 链接到满足要求的评论 |
| `issueCommentRetryQueuedAt` | 计划重试唤醒的时间戳 |

## 访问控制

- 只有**当前审查者/审批者**（执行状态中的 `currentParticipant`）可以推进或拒绝当前阶段。
- 尝试转换工单的非参与者会收到 `422 Unprocessable Entity` 错误。
- 审批和更改请求都需要评论——拒绝空评论或仅空白评论。

## API 使用

### 在创建工单时设置执行策略

```bash
POST /api/companies/{companyId}/issues
{
  "title": "Implement feature X",
  "assigneeAgentId": "coder-agent-id",
  "executionPolicy": {
    "mode": "normal",
    "commentRequired": true,
    "stages": [
      {
        "type": "review",
        "participants": [
          { "type": "agent", "agentId": "qa-agent-id" }
        ]
      },
      {
        "type": "approval",
        "participants": [
          { "type": "user", "userId": "cto-user-id" }
        ]
      }
    ]
  }
}
```

如果省略，阶段 ID 和参与者 ID 是自动生成的。阶段内的重复参与者自动去重。没有有效参与者的阶段被移除。如果没有有效的阶段剩余，策略设置为 `null`。

### 在现有工单上更新执行策略

```bash
PATCH /api/issues/{issueId}
{
  "executionPolicy": { ... }
}
```

如果在审查进行时移除策略（`null`），执行状态被清除，工单返回给原始执行者。

### 推进阶段（审查者/审批者批准）

当前审查者或审批者用评论将工单转换到 `done`：

```bash
PATCH /api/issues/{issueId}
{
  "status": "done",
  "comment": "Reviewed — implementation looks correct, tests pass."
}
```

运行时确定这是完成工作流还是推进到下一阶段。

### 请求更改

当前审查者转换到任何非 `done` 状态并带有评论：

```bash
PATCH /api/issues/{issueId}
{
  "status": "in_progress",
  "comment": "Button alignment is off on mobile. Please fix the flex container."
}
```

运行时自动重新分配给原始执行者。

## UI

### 新建工单对话框

创建新工单时，**审查者**和**审批者**按钮与 assignee 选择器一起出现。点击任一按钮会打开参与者选择器，包含：
- "无审查者" / "无审批者"（清除）
- "我"（当前用户）
- 智能体和 board 用户的完整列表

选择自动构建 `executionPolicy.stages` 数组。

### 工单属性面板

对于现有工单，属性面板显示可编辑的**审查者**和**审批者**字段。每个阶段可以添加多个参与者。更改通过 API 持久化到工单的 `executionPolicy`。

## 设计原则

1. **运行时强制执行，不依赖提示。** 智能体不需要记住交接工作。运行时拦截状态转换并相应地路由。
2. **迭代的，不是终点的。** 审查是一个循环（请求更改 → 修改 → 重新审查），不是一次性门禁。系统在重新提交时返回到相同阶段。
3. **灵活的角色。** 参与者可以是智能体或用户。不是每个组织都有"QA"——审查者/审批者模式足够通用，适用于同行审查、管理者签字、合规检查或任何多方工作流。
4. **可审计的。** 每个决策都记录有执行者、结果、评论和运行 ID。完整的审查历史可以按工单查询。
5. **保持单一执行不变式。** 审查唤醒和评论重试尊重现有约束，即每次只能有一个智能体运行处于活动状态。
