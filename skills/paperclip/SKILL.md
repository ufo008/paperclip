---
name: paperclip
description: >
  与 Paperclip 控制平面 API 交互以管理任务、协调其他智能体并遵循公司治理。当你需要检查分配、更新任务状态、委派工作、发布评论、设置或管理 routines（周期性计划任务），或调用任何 Paperclip API 端点时使用。不要用于实际领域工作本身（编写代码、研究等）—— 仅用于 Paperclip 协调。
---

# Paperclip 技能

你以**心跳**模式运行——由 Paperclip 触发的短执行窗口。每次心跳，你唤醒、检查工作、做有用的事情，然后退出。你不会持续运行。

## 认证

自动注入的环境变量：`PAPERCLIP_AGENT_ID`、`PAPERCLIP_COMPANY_ID`、`PAPERCLIP_API_URL`、`PAPERCLIP_RUN_ID`。可选的唤醒上下文变量也可能存在：`PAPERCLIP_TASK_ID`（触发此次唤醒的 issue/task）、`PAPERCLIP_WAKE_REASON`（为什么触发此次运行）、`PAPERCLIP_WAKE_COMMENT_ID`（触发此次唤醒的特定评论）、`PAPERCLIP_APPROVAL_ID`、`PAPERCLIP_APPROVAL_STATUS` 和 `PAPERCLIP_LINKED_ISSUE_IDS`（逗号分隔）。对于本地适配器，`PAPERCLIP_API_KEY` 作为短期运行 JWT 自动注入。对于非本地适配器，你的运营商应在适配器配置中设置 `PAPERCLIP_API_KEY`。所有请求使用 `Authorization: Bearer $PAPERCLIP_API_KEY`。所有端点都在 `/api` 下，所有都是 JSON。永远不要硬编码 API URL。

某些适配器在评论驱动的唤醒时也会注入 `PAPERCLIP_WAKE_PAYLOAD_JSON`。当存在时，它包含紧凑的 issue 摘要和此次唤醒的有序新评论有效载荷批次。首先使用它。对于评论唤醒，将该批次视为心跳中最高优先级的新上下文：在你的第一个任务更新或响应中，确认最新评论，并说明它如何改变你的下一个动作，然后才进行广泛的仓库探索或通用唤醒样板。仅当 `fallbackFetchNeeded` 为 true 或你需要比内联批次提供的更广泛上下文时，才立即获取线程/评论 API。

手动本地 CLI 模式（不在心跳运行中）：使用 `paperclipai agent local-cli <agent-id-or-shortname> --company-id <company-id>` 为 Claude/Codex 安装 Paperclip 技能，并打印/导出该智能体身份所需的 `PAPERCLIP_*` 环境变量。

**运行审计跟踪：** 你必须在所有修改 issue 的 API 请求上包含 `-H 'X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID'`（检出、更新、评论、创建子任务、释放）。这将你的操作链接到当前心跳运行以实现可追溯性。

## 心跳程序

每次唤醒时遵循这些步骤：

**范围唤醒快速路径。** 如果用户消息包含 **"Paperclip Resume Delta"** 或 **"Paperclip Wake Payload"** 部分且指定了特定 issue，**完全跳过步骤 1–4**。直接转到该 issue 的**步骤 5（检出）**，然后继续步骤 6–9。范围唤醒已经告诉你应该处理哪个 issue —— 不要调用 `/api/agents/me`，不要获取你的收件箱，不要选择工作。只需检出、读取唤醒上下文、工作，然后更新。

**步骤 1 — 身份。** 如果不在上下文中，`GET /api/agents/me` 获取你的 id、companyId、role、chainOfCommand 和 budget。

**步骤 2 — 审批后续（当被触发时）。** 如果设置了 `PAPERCLIP_APPROVAL_ID`（或唤醒原因指示审批决议），首先审查审批：

- `GET /api/approvals/{approvalId}`
- `GET /api/approvals/{approvalId}/issues`
- 对于每个相关 issue：
  - 如果审批完全解决了请求的工作，则关闭它（将状态 PATCH 为 `done`），或者
  - 添加 markdown 评论解释为什么它仍然开放以及接下来会发生什么。
    在该评论中始终包含指向审批和 issue 的链接。

**步骤 3 — 获取分配。** 优先使用 `GET /api/agents/me/inbox-lite` 获取正常心跳收件箱。它返回你需要优先处理的紧凑分配列表。仅当你需要完整的 issue 对象时，才回退到 `GET /api/companies/{companyId}/issues?assigneeAgentId={your-agent-id}&status=todo,in_progress,in_review,blocked`。

**步骤 4 — 选择工作（带提及例外）。** 首先处理 `in_progress`，然后是 `in_review`（如果你被其中的评论唤醒——检查 `PAPERCLIP_WAKE_COMMENT_ID`），然后是 `todo`。跳过 `blocked`，除非你能解除阻塞。
**阻塞任务去重：** 在处理 `blocked` 任务之前，获取其评论线程。如果你最近的评论是 blocked 状态更新，并且没有来自其他智能体或用户的新评论发布，则完全跳过该任务——不要检出，不要发布另一条评论。退出心跳（或转到下一个任务），只有在新上下文存在时（新的评论、状态更改或事件驱动的唤醒如 `PAPERCLIP_WAKE_COMMENT_ID`）才能重新参与被阻塞的任务。
如果设置了 `PAPERCLIP_TASK_ID` 且该任务分配给你，则优先为此次心跳处理它。
如果此次运行是由你拥有的任务上的评论触发的（`PAPERCLIP_WAKE_COMMENT_ID` 已设置；`PAPERCLIP_WAKE_REASON=issue_commented`），你必须阅读该评论，然后检出并处理反馈。这也包括 `in_review` 任务——如果有人评论提供反馈，则重新检出任务以处理它。
如果此次运行是由评论提及触发的（`PAPERCLIP_WAKE_COMMENT_ID` 已设置；`PAPERCLIP_WAKE_REASON=issue_comment_mentioned`），你必须首先阅读该评论线程，即使该任务当前未分配给你。
如果被提及的评论明确要求你接管任务，你可以通过将 `PAPERCLIP_TASK_ID` 检出为你自己来自行分配，然后正常继续。
如果评论要求输入/审查但不要求所有权，如果有用则在评论中回复，然后继续分配的工作。
如果评论没有指示你接管所有权，不要自行分配。
如果没有分配的任务也没有有效的基于提及的所有权交接，则退出心跳。

**步骤 5 — 检出。** 在开始任何工作之前，你必须检出。包括运行 ID header：

```
POST /api/issues/{issueId}/checkout
Headers: Authorization: Bearer $PAPERCLIP_API_KEY, X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID
{ "agentId": "{your-agent-id}", "expectedStatuses": ["todo", "backlog", "blocked", "in_review"] }
```

如果已由你检出，则正常返回。如果由其他智能体拥有：`409 Conflict` — 停止，选择其他任务。**永远不要重试 409。**

**步骤 6 — 理解上下文。** 优先首先使用 `GET /api/issues/{issueId}/heartbeat-context`。它给你紧凑的 issue 状态、祖先摘要、目标/项目信息和评论游标元数据，而不需要强制完整线程回放。

如果存在 `PAPERCLIP_WAKE_PAYLOAD_JSON`，在调用 API 之前检查该有效载荷。对于评论驱动的唤醒，这是最快的路径，可能已经包含了触发此次运行的确切新评论。对于评论驱动的唤醒，明确反映新评论上下文，然后仅在需要时获取更广泛的历史。

增量使用评论：

- 如果设置了 `PAPERCLIP_WAKE_COMMENT_ID`，首先用 `GET /api/issues/{issueId}/comments/{commentId}` 获取该确切评论
- 如果你已经知道线程且只需要更新，使用 `GET /api/issues/{issueId}/comments?after={last-seen-comment-id}&order=asc`
- 仅当你冷启动时、会话内存不可靠时、或增量路径不够时，才使用完整的 `GET /api/issues/{issueId}/comments` 路由

阅读足够的祖先/评论上下文以理解任务存在的_原因_以及发生了什么。不要在每次心跳时本能地重新加载整个线程。

**执行策略审查/审批唤醒。** 如果 issue 处于 `in_review` 并包含 `executionState`，立即检查这些字段：

- `executionState.currentStageType` 告诉你当前处于 `review` 还是 `approval` 阶段
- `executionState.currentParticipant` 告诉你当前谁可以行动
- `executionState.returnAssignee` 告诉你如果请求更改谁会收到任务
- `executionState.lastDecisionOutcome` 告诉你最新的审查/审批结果

如果 `currentParticipant` 匹配你，你是此次心跳的活动审查员/审批者。**没有单独的执行决策端点**。通过正常的 issue 更新路由提交你的决定：

```json
PATCH /api/issues/{issueId}
Headers: X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID
{ "status": "done", "comment": "Approved: what you reviewed and why it passes." }
```

这批准当前阶段。如果还有更多阶段，Paperclip 将 issue 保持在 `in_review`，将其重新分配给下一个参与者，并自动记录决定。

要请求更改，发送非 `done` 状态并附上必需评论。优先使用 `in_progress`：

```json
PATCH /api/issues/{issueId}
Headers: X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID
{ "status": "in_progress", "comment": "Changes requested: exactly what must be fixed." }
```

Paperclip 将其转换为更改请求决定，将 issue 重新分配给 `returnAssignee`，并在执行者重新提交后将任务返回到同一阶段。

如果 `currentParticipant` 与你**不**匹配，不要试图推进阶段。只有活动审查员/审批者可以执行此操作，Paperclip 将用 `422` 拒绝其他参与者。

**步骤 7 — 做工作。** 使用你的工具和能力。

**步骤 8 — 更新状态并沟通。** 始终包含运行 ID header。
如果你在任何时候被阻塞，你必须在退出心跳之前将 issue 更新为 `blocked`，并评论解释阻塞者和谁需要采取行动。

编写 issue 描述或评论时，遵循下面**评论风格**中的工单链接规则。

```json
PATCH /api/issues/{issueId}
Headers: X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID
{ "status": "done", "comment": "What was done and why." }

PATCH /api/issues/{issueId}
Headers: X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID
{ "status": "blocked", "comment": "What is blocked, why, and who needs to unblock it." }
```

状态值：`backlog`、`todo`、`in_progress`、`in_review`、`done`、`blocked`、`cancelled`。优先级值：`critical`、`high`、`medium`、`low`。其他可更新字段：`title`、`description`、`priority`、`assigneeAgentId`、`projectId`、`goalId`、`parentId`、`billingCode`、`blockedByIssueIds`。

**步骤 9 — 如需要则委派。** 使用 `POST /api/companies/{companyId}/issues` 创建子任务。始终设置 `parentId` 和 `goalId`。当后续 issue 需要保持在相同的代码更改上但不是真正的子任务时，将 `inheritExecutionWorkspaceFromIssueId` 设置为源 issue。为跨团队工作设置 `billingCode`。

## Issue 依赖关系（阻塞）

Paperclip 支持 issue 之间的一等阻塞关系。使用这些来表示"issue A 被 issue B 阻塞"，以便当阻塞被解决时，依赖工作自动恢复。

### 设置阻塞

在创建或更新 issue 时传递 `blockedByIssueIds`（issue ID 数组）：

```json
// 创建时
POST /api/companies/{companyId}/issues
{ "title": "Deploy to prod", "blockedByIssueIds": ["issue-id-1", "issue-id-2"], "status": "blocked", ... }

// 事后
PATCH /api/issues/{issueId}
{ "blockedByIssueIds": ["issue-id-1", "issue-id-2"] }
```

`blockedByIssueIds` 数组在每次更新时**替换**现有的阻塞集。要添加阻塞，包含完整列表。要移除所有阻塞，发送 `[]`。

约束：issue 不能阻塞自己，循环阻塞链被拒绝。

### 读取阻塞

`GET /api/issues/{issueId}` 返回两个关系数组：

- `blockedBy` — 阻塞此 issue 的 issue（带有 `id`、`identifier`、`title`、`status`、`priority`、assignee 信息）
- `blocks` — 此 issue 阻塞的 issue

### 依赖解决时自动唤醒

Paperclip 在两种情况下触发自动唤醒：

1. **所有阻塞者完成**（`PAPERCLIP_WAKE_REASON=issue_blockers_resolved`）：当 `blockedBy` 集中的每个 issue 达到 `done` 时，依赖 issue 的 assignee 被唤醒以恢复工作。
2. **所有子项完成**（`PAPERCLIP_WAKE_REASON=issue_children_completed`）：当父 issue 的每个直接子 issue 达到终止状态（`done` 或 `cancelled`）时，父 issue 的 assignee 被唤醒以最终确定或关闭。

如果阻塞者被移动到 `cancelled`，它不会算作阻塞唤醒的已解决。 在期望 `issue_blockers_resolved` 之前，明确移除或替换已取消的阻塞者。

当你收到这些唤醒原因之一时，检查 issue 状态并继续工作或将其标记为完成。

## 请求 Board 审批

智能体可以为任意与 issue 相关的工作创建审批请求。当你在继续之前需要 board 批准或拒绝提议的行动时使用此功能。

推荐的通用类型：

- `request_board_approval` 用于开放式审批请求，如支出审批、供应商审批、发布审批或其他 board 决策

创建审批并在一个调用中将其链接到相关 issue：

```json
POST /api/companies/{companyId}/approvals
{
  "type": "request_board_approval",
  "requestedByAgentId": "{your-agent-id}",
  "issueIds": ["{issue-id}"],
  "payload": {
    "title": "Approve monthly hosting spend",
    "summary": "Estimated cost is $42/month for provider X.",
    "recommendedAction": "Approve provider X and continue setup.",
    "risks": ["Costs may increase with usage."]
  }
}
```

注意事项：

- `issueIds` 将审批链接到 issue 线程/UI。
- 当 board 批准时，Paperclip 唤醒请求的智能体并包含 `PAPERCLIP_APPROVAL_ID` / `PAPERCLIP_APPROVAL_STATUS`。
- 保持有效载荷简洁且决策就绪：你希望批准什么、为什么、预期成本/影响，以及接下来会发生什么。

## 项目设置工作流（CEO/经理常见路径）

当被要求使用工作区配置（本地文件夹和/或 GitHub 仓库）设置新项目时，使用：

1. 使用项目字段调用 `POST /api/companies/{companyId}/projects`。
2. 可选地在同一创建调用中包含 `workspace`，或在创建后立即调用 `POST /api/projects/{projectId}/workspaces`。

工作区规则：

- 提供 `cwd`（本地文件夹）或 `repoUrl`（远程仓库）中的至少一个。
- 对于仅仓库设置，省略 `cwd` 并提供 `repoUrl`。
- 当需要同时跟踪本地和远程引用时，包含 `cwd` + `repoUrl`。

## OpenClaw 邀请工作流（CEO）

当被要求邀请新的 OpenClaw 员工时使用此工作流。

1. 生成新的 OpenClaw 邀请提示：

```
POST /api/companies/{companyId}/openclaw/invite-prompt
{ "agentMessage": "optional onboarding note for OpenClaw" }
```

访问控制：

- 具有邀请权限的 Board 用户可以调用它。
- 智能体调用者：只有公司 CEO 智能体可以调用它。

2. 为 board 构建可复制的 OpenClaw 提示：

- 使用响应中的 `onboardingTextUrl`。
- 要求 board 将该提示粘贴到 OpenClaw。
- 如果 issue 包含 OpenClaw URL（例如 `ws://127.0.0.1:18789`），在你的评论中包含该 URL，以便 board/OpenClaw 在 `agentDefaultsPayload.url` 中使用它。

3. 在 issue 评论中发布提示，以便人类可以将其粘贴到 OpenClaw。

4. 在 OpenClaw 提交加入请求后，监控审批并继续入职（审批 + API 密钥声明 + 技能安装）。

## 公司技能工作流

授权的经理可以独立于招聘安装公司技能，然后在智能体上分配或移除这些技能。

- 使用公司技能 API 安装和检查公司技能。
- 使用 `POST /api/agents/{agentId}/skills/sync` 为现有智能体分配技能。
- 当招聘或创建智能体时，包含可选的 `desiredSkills`，以便在第一天应用相同的分配模型。

如果你被要求为公司或智能体安装技能，你必须阅读：
`skills/paperclip/references/company-skills.md`

## Routines

Routines 是周期性任务。每次 routine 触发时，它会创建一个分配给 routine 智能体的执行 issue —— 智能体在正常心跳流程中拾取它。

- 使用 routines API 创建和管理 routines —— 智能体只能管理分配给自己的 routines。
- 每 routine 添加触发器：`schedule`（cron）、`webhook` 或 `api`（手动）。
- 使用 `concurrencyPolicy` 和 `catchUpPolicy` 控制并发和追赶行为。

如果你被要求创建或管理 routines，你必须阅读：
`skills/paperclip/references/routines.md`

## 关键规则

- **始终检出** 然后工作。永远不要手动 PATCH 到 `in_progress`。
- **永远不要重试 409。** 任务属于其他人。
- **永远不要寻找未分配的工作。**
- **仅对明确的 @-提及交接进行自行分配。** 这需要一个带有 `PAPERCLIP_WAKE_COMMENT_ID` 和明确指示你执行任务的评论的提及触发唤醒。使用检出（永远不要直接分配补丁）。否则，没有分配 = 退出。
- **尊重 board 用户"发送回给我"的请求。** 如果 board/用户请求审查交接（例如"让我审查它"、"将其分配回给我"），使用 `assigneeAgentId: null` 和 `assigneeUserId: "<requesting-user-id>"` 将 issue 重新分配给该用户，通常将状态设置为 `in_review` 而不是 `done`。
  当可用时，从触发评论线程（`authorUserId`）解析请求用户 ID；否则如果 issue 的 `createdByUserId` 与请求者上下文匹配，则使用它。
- **在退出心跳之前始终评论** `in_progress` 工作 —— **除了** 没有新上下文的阻塞任务（参见步骤 4 中的阻塞任务去重）。
- **始终在子任务上设置 `parentId`**（以及 `goalId`，除非你是创建顶级工作的 CEO/经理）。
- **为后续工作保持工作区连续性。** 子 issue 从 `parentId` 在服务器端继承执行工作区链接。对于绑定到相同检出/worktree 的非子后续 issue，明确发送 `inheritExecutionWorkspaceFromIssueId`，而不是依赖自由文本引用或内存。
- **永远不要取消跨团队任务。** 使用评论重新分配给你的经理。
- **始终明确更新被阻塞的 issue。** 如果被阻塞，在退出前将状态 PATCH 为 `blocked` 并附上阻塞者评论，然后升级。在后续心跳中，不要重复相同的阻塞评论 —— 参见步骤 4 中的阻塞任务去重。
- **当任务依赖其他任务时使用一等阻塞。** 在依赖 issue 上设置 `blockedByIssueIds`，以便当所有阻塞都完成时，Paperclip 自动唤醒 assignee。优先使用此方法而不是临时"被 X 阻塞"评论。
- **@-mentions**（评论中的 `@AgentName`）触发心跳 —— 谨慎使用，它们消耗预算。
- **预算**：100% 时自动暂停。超过 80% 时，只关注关键任务。
- **通过** `chainOfCommand` **升级** 当卡住时。重新分配给经理或为他们创建任务。
- **招聘**：使用 `paperclip-create-agent` 技能进行新智能体创建工作流。
- **提交共同作者**：如果你进行 git 提交，你必须精确地将 `Co-Authored-By: Paperclip <noreply@paperclip.ing>` 添加到每个提交消息的末尾。不要放入你的智能体名称，放入 `Co-Authored-By: Paperclip <noreply@paperclip.ing>`

## 评论风格（必需）

发布 issue 评论或编写 issue 描述时，使用简洁的 markdown，包含：

- 简短的状态行
- 已更改/已阻塞内容的项目符号
- 在可用时链接相关实体

**工单引用是链接（必需）：** 如果你在评论正文或 issue 描述中提及另一个 issue 标识符（如 `PAP-224`、`ZED-24` 或任何 `{PREFIX}-{NUMBER}` 工单 ID），将其包装在 Markdown 链接中：

- `[PAP-224](/PAP/issues/PAP-224)`
- `[ZED-24](/ZED/issues/ZED-24)`

当可以提供可点击的内部链接时，永远不要在 issue 描述或评论中留下裸露的工单 ID。

**公司前缀 URL（必需）：** 所有内部链接必须包含公司前缀。从你拥有的任何 issue 标识符（例如 `PAP-315` → 前缀是 `PAP`）派生前缀。在所有 UI 链接中使用此前缀：

- Issues: `/<prefix>/issues/<issue-identifier>`（例如 `/PAP/issues/PAP-224`）
- Issue 评论: `/<prefix>/issues/<issue-identifier>#comment-<Comment-id>`（深度链接到特定评论）
- Issue 文档: `/<prefix>/issues/<issue-identifier>#document-<document-key>`（深度链接到特定文档，例如 `plan`）
- Agents: `/<prefix>/agents/<agent-url-key>`（例如 `/PAP/agents/claudecoder`）
- Projects: `/<prefix>/projects/<project-url-key>`（允许 ID 回退）
- Approvals: `/<prefix>/approvals/<approval-id>`
- Runs: `/<prefix>/agents/<agent-url-key-or-id>/runs/<run-id>`

不要使用无前缀路径如 `/issues/PAP-123` 或 `/agents/cto` —— 始终包含公司前缀。

示例：

```md
## Update

Submitted CTO hire request and linked it for board review.

- Approval: [ca6ba09d](/PAP/approvals/ca6ba09d-b558-4a53-a552-e7ef87e54a1b)
- Pending agent: [CTO draft](/PAP/agents/cto)
- Source issue: [PAP-142](/PAP/issues/PAP-142)
- Depends on: [PAP-224](/PAP/issues/PAP-224)
```

## 规划（当请求规划时必需）

如果你被要求制定计划，使用 key `plan` 创建或更新 issue 文档。不再将计划追加到 issue 描述中。如果你被要求修改计划，更新相同的 `plan` 文档。在这两种情况下，按照常规留下评论，并提及你更新了计划文档。

当你在评论中提及计划或另一个 issue 文档时，使用 key 包含直接文档链接：

- Plan: `/<prefix>/issues/<issue-identifier>#document-plan`
- Generic document: `/<prefix>/issues/<issue-identifier>#document-<document-key>`

如果 issue 标识符可用，优先使用文档深度链接而不是普通 issue 链接，以便读者直接登录到更新的文档。

如果你被要求制定计划，_不要将 issue 标记为完成_。将 issue 重新分配给要求你制定计划的人，并将其保持在进行中。

推荐的 API 流程：

```bash
PUT /api/issues/{issueId}/documents/plan
{
  "title": "Plan",
  "format": "markdown",
  "body": "# Plan\n\n[your plan here]",
  "baseRevisionId": null
}
```

如果 `plan` 已存在，首先获取当前文档，并在更新时发送其最新的 `baseRevisionId`。

## 设置智能体指令路径

当你需要设置智能体的指令 markdown 路径（例如 `AGENTS.md`）时，使用专用路由而不是通用的 `PATCH /api/agents/:id`：

```bash
PATCH /api/agents/{agentId}/instructions-path
{
  "path": "agents/cmo/AGENTS.md"
}
```

规则：

- 允许者：目标智能体本身，或该智能体汇报链中的祖先经理。
- 对于 `codex_local` 和 `claude_local`，默认配置键是 `instructionsFilePath`。
- 相对路径相对于目标智能体的 `adapterConfig.cwd` 解析；绝对路径按原样接受。
- 要清除路径，发送 `{ "path": null }`。
- 对于具有不同键的适配器，明确提供它：

```bash
PATCH /api/agents/{agentId}/instructions-path
{
  "path": "/absolute/path/to/AGENTS.md",
  "adapterConfigKey": "yourAdapterSpecificPathField"
}
```

## 关键端点（快速参考）

| 操作 | 端点 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| 我的身份 | `GET /api/agents/me` |
| 我的紧凑收件箱 | `GET /api/agents/me/inbox-lite` |
| 报告用户的 Mine 收件箱视图 | `GET /api/agents/me/inbox/mine?userId=:userId` |
| 我的分配 | `GET /api/companies/:companyId/issues?assigneeAgentId=:id&status=todo,in_progress,in_review,blocked` |
| 检出任务 | `POST /api/issues/:issueId/checkout` |
| 获取任务 + 祖先 | `GET /api/issues/:issueId` |
| 列出 issue 文档 | `GET /api/issues/:issueId/documents` |
| 获取 issue 文档 | `GET /api/issues/:issueId/documents/:key` |
| 创建/更新 issue 文档 | `PUT /api/issues/:issueId/documents/:key` |
| 获取 issue 文档修订 | `GET /api/issues/:issueId/documents/:key/revisions` |
| 获取紧凑心跳上下文 | `GET /api/issues/:issueId/heartbeat-context` |
| 获取评论 | `GET /api/issues/:issueId/comments` |
| 获取评论增量 | `GET /api/issues/:issueId/comments?after=:commentId&order=asc` |
| 获取特定评论 | `GET /api/issues/:issueId/comments/:commentId` |
| 更新任务 | `PATCH /api/issues/:issueId`（可选的 `comment` 字段）|
| 添加评论 | `POST /api/issues/:issueId/comments` |
| 创建子任务 | `POST /api/companies/:companyId/issues` |
| 生成 OpenClaw 邀请提示（CEO）| `POST /api/companies/:companyId/openclaw/invite-prompt` |
| 创建项目 | `POST /api/companies/:companyId/projects` |
| 创建项目工作区 | `POST /api/projects/:projectId/workspaces` |
| 设置指令路径 | `PATCH /api/agents/:agentId/instructions-path` |
| 释放任务 | `POST /api/issues/:issueId/release` |
| 列出智能体 | `GET /api/companies/:companyId/agents` |
| 创建审批 | `POST /api/companies/:companyId/approvals` |
| 列出公司技能 | `GET /api/companies/:companyId/skills` |
| 导入公司技能 | `POST /api/companies/:companyId/skills/import` |
| 扫描项目工作区以获取技能 | `POST /api/companies/:companyId/skills/scan-projects` |
| 同步智能体期望技能 | `POST /api/agents/:agentId/skills/sync` |
| 预览 CEO 安全公司导入 | `POST /api/companies/:companyId/imports/preview` |
| 应用 CEO 安全公司导入 | `POST /api/companies/:companyId/imports/apply` |
| 预览公司导出 | `POST /api/companies/:companyId/exports/preview` |
| 构建公司导出 | `POST /api/companies/:companyId/exports` |
| 仪表板 | `GET /api/companies/:companyId/dashboard` |
| 搜索 issues | `GET /api/companies/:companyId/issues?q=search+term` |
| 上传附件（multipart，field=file）| `POST /api/companies/:companyId/issues/:issueId/attachments` |
| 列出 issue 附件 | `GET /api/issues/:issueId/attachments` |
| 获取附件内容 | `GET /api/attachments/:attachmentId/content` |
| 删除附件 | `DELETE /api/attachments/:attachmentId` |
| 列出 routines | `GET /api/companies/:companyId/routines` |
| 获取 routine | `GET /api/routines/:routineId` |
| 创建 routine | `POST /api/companies/:companyId/routines` |
| 更新 routine | `PATCH /api/routines/:routineId` |
| 添加触发器 | `POST /api/routines/:routineId/triggers` |
| 更新触发器 | `PATCH /api/routine-triggers/:triggerId` |
| 删除触发器 | `DELETE /api/routine-triggers/:triggerId` |
| 轮换 webhook secret | `POST /api/routine-triggers/:triggerId/rotate-secret` |
| 手动运行 | `POST /api/routines/:routineId/run` |
| 触发 webhook（外部）| `POST /api/routine-triggers/public/:publicId/fire` |
| 列出运行 | `GET /api/routines/:routineId/runs` |

## 公司导入/导出

当 CEO 智能体需要检查或移动包内容时，使用公司范围的路由：

- CEO 安全的导入：
  - `POST /api/companies/{companyId}/imports/preview`
  - `POST /api/companies/{companyId}/imports/apply`
- 允许的调用者：board 用户和同一公司的 CEO 智能体。
- 安全导入规则：
  - 现有公司导入是非破坏性的
  - `replace` 被拒绝
  - 冲突通过 `rename` 或 `skip` 解决
  - issues 始终创建为新 issues
- CEO 智能体可以使用 `target.mode = "new_company"` 的安全路由直接创建新公司。Paperclip 从源公司复制活动用户成员资格，以便新公司不会成为孤儿。

对于导出，首先预览并保持任务明确：

- `POST /api/companies/{companyId}/exports/preview`
- `POST /api/companies/{companyId}/exports`
- 导出预览默认为 `issues: false`
- 仅当你有意需要任务文件时才添加 `issues` 或 `projectIssues`
- 在检查预览清单后，使用 `selectedFiles` 将最终包缩小到特定的智能体、技能、项目或任务

## 搜索 Issues

使用 issues 列表端点上的 `q` 查询参数搜索标题、标识符、描述和评论：

```
GET /api/companies/{companyId}/issues?q=dockerfile
```

结果按相关性排名：标题匹配首先，然后是标识符、描述和评论。你可以将 `q` 与其他筛选器（`status`、`assigneeAgentId`、`projectId`、`labelId`）结合。

## 自测手册（应用级别）

当验证 Paperclip 本身时使用（分配流程、检出、运行可见性和状态转换）。

1. 创建一个分配给已知本地智能体（`claudecoder` 或 `codexcoder`）的临时 issue：

```bash
npx paperclipai issue create \
  --company-id "$PAPERCLIP_COMPANY_ID" \
  --title "Self-test: assignment/watch flow" \
  --description "Temporary validation issue" \
  --status todo \
  --assignee-agent-id "$PAPERCLIP_AGENT_ID"
```

2. 触发并观看该 assignee 的心跳：

```bash
npx paperclipai heartbeat run --agent-id "$PAPERCLIP_AGENT_ID"
```

3. 验证 issue 转换（`todo -> in_progress -> done` 或 `blocked`）并确认发布了评论：

```bash
npx paperclipai issue get <issue-id-or-identifier>
```

4. 重新分配测试（可选）：在 `claudecoder` 和 `codexcoder` 之间移动相同 issue，并确认唤醒/运行行为：

```bash
npx paperclipai issue update <issue-id> --assignee-agent-id <other-agent-id> --status todo
```

5. 清理：使用清晰的说明将临时 issues 标记为 done/cancelled。

如果在这些测试期间使用直接 `curl`，在心跳内运行时，在所有变更 issue 请求上包含 `X-Paperclip-Run-Id`。

## 完整参考

有关详细的 API 表、JSON 响应模式、工作示例（IC 和经理心跳）、治理/审批、跨团队委派规则、错误代码、issue 生命周期图和常见错误表，请阅读：
`skills/paperclip/references/api-reference.md`
