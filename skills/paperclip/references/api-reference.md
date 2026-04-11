# Paperclip API 参考

Paperclip 控制平面 API 的详细参考。对于核心心跳程序和关键规则，请参阅主 `SKILL.md`。

---

## 响应模式

### 智能体记录（`GET /api/agents/me` 或 `GET /api/agents/:agentId`）

```json
{
  "id": "agent-42",
  "name": "BackendEngineer",
  "role": "engineer",
  "title": "Senior Backend Engineer",
  "companyId": "company-1",
  "reportsTo": "mgr-1",
  "capabilities": "Node.js, PostgreSQL, API design",
  "status": "running",
  "budgetMonthlyCents": 5000,
  "spentMonthlyCents": 1200,
  "chainOfCommand": [
    {
      "id": "mgr-1",
      "name": "EngineeringLead",
      "role": "manager",
      "title": "VP Engineering"
    },
    {
      "id": "ceo-1",
      "name": "CEO",
      "role": "ceo",
      "title": "Chief Executive Officer"
    }
  ]
}
```

使用 `chainOfCommand` 知道要向谁升级。使用 `budgetMonthlyCents` 和 `spentMonthlyCents` 检查剩余预算。

### 公司可移植性

CEO 安全的包路由是公司范围的：

- `POST /api/companies/:companyId/imports/preview`
- `POST /api/companies/:companyId/imports/apply`
- `POST /api/companies/:companyId/exports/preview`
- `POST /api/companies/:companyId/exports`

规则：

- 允许的调用者：board 用户和同一公司的 CEO 智能体
- 安全导入路由拒绝 `collisionStrategy: "replace"`
- 现有公司安全导入仅创建新实体或跳过冲突
- `new_company` 安全导入是允许的，并从源公司复制活动用户成员资格
- 导出预览默认为 `issues: false`；需要时明确添加任务选择器
- 在预览清单后，使用 `selectedFiles` 将最终包缩小到特定项目

安全导入预览示例：

```json
POST /api/companies/company-1/imports/preview
{
  "source": { "type": "github", "url": "https://github.com/acme/agent-company" },
  "include": { "company": true, "agents": true, "projects": true, "issues": true },
  "target": { "mode": "existing_company", "companyId": "company-1" },
  "collisionStrategy": "rename"
}
```

新公司安全导入示例：

```json
POST /api/companies/company-1/imports/apply
{
  "source": { "type": "github", "url": "https://github.com/acme/agent-company" },
  "include": { "company": true, "agents": true, "projects": true, "issues": false },
  "target": { "mode": "new_company", "newCompanyName": "Imported Acme" },
  "collisionStrategy": "rename"
}
```

无任务导出预览示例：

```json
POST /api/companies/company-1/exports/preview
{
  "include": { "company": true, "agents": true, "projects": true }
}
```

带明确任务的缩小导出示例：

```json
POST /api/companies/company-1/exports
{
  "include": { "company": true, "agents": true, "projects": true, "issues": true },
  "selectedFiles": [
    "COMPANY.md",
    "agents/ceo/AGENTS.md",
    "skills/paperclip/SKILL.md",
    "tasks/pap-42/TASK.md"
  ]
}
```

### 带祖先的 Issue（`GET /api/issues/:issueId`）

包含 issue 的 `project` 和 `goal`（带描述），加上每个祖先的解析 `project` 和 `goal`。这给智能体关于任务在项目/目标层次结构中位置的完整上下文。

响应还包括 `blockedBy` 和 `blocks` 数组，显示一等依赖关系：

```json
{
  "id": "issue-99",
  "title": "Implement login API",
  "parentId": "issue-50",
  "projectId": "proj-1",
  "goalId": null,
  "blockedBy": [
    { "id": "issue-80", "identifier": "PAP-80", "title": "Design auth schema", "status": "in_progress", "priority": "high", "assigneeAgentId": "agent-55", "assigneeUserId": null }
  ],
  "blocks": [],
  "project": {
    "id": "proj-1",
    "name": "Auth System",
    "description": "End-to-end authentication and authorization",
    "status": "active",
    "goalId": "goal-1",
    "primaryWorkspace": {
      "id": "ws-1",
      "name": "auth-repo",
      "cwd": "/Users/me/work/auth",
      "repoUrl": "https://github.com/acme/auth",
      "repoRef": "main",
      "isPrimary": true
    },
    "workspaces": [
      {
        "id": "ws-1",
        "name": "auth-repo",
        "cwd": "/Users/me/work/auth",
        "repoUrl": "https://github.com/acme/auth",
        "repoRef": "main",
        "isPrimary": true
      }
    ]
  },
  "goal": null,
  "ancestors": [
    {
      "id": "issue-50",
      "title": "Build auth system",
      "status": "in_progress",
      "priority": "high",
      "assigneeAgentId": "mgr-1",
      "projectId": "proj-1",
      "goalId": "goal-1",
      "description": "...",
      "project": {
        "id": "proj-1",
        "name": "Auth System",
        "description": "End-to-end authentication and authorization",
        "status": "active",
        "goalId": "goal-1"
      },
      "goal": {
        "id": "goal-1",
        "title": "Launch MVP",
        "description": "Ship minimum viable product by Q1",
        "level": "company",
        "status": "active"
      }
    },
    {
      "id": "issue-10",
      "title": "Launch MVP",
      "status": "in_progress",
      "priority": "critical",
      "assigneeAgentId": "ceo-1",
      "projectId": "proj-1",
      "goalId": "goal-1",
      "description": "...",
      "project": { "..." : "..." },
      "goal": { "..." : "..." }
    }
  ]
}
```

阻塞唤醒语义是严格的：`issue_blockers_resolved` 仅在每个阻塞者达到 `done` 时触发。移动到 `cancelled` 的阻塞者仍需要手动重新分类或关系清理。

### Issue 上的执行策略字段

当 issue 有审查或审批门禁时，`GET /api/issues/:issueId` 也可以包含 `executionPolicy` 和 `executionState`：

```json
{
  "status": "in_review",
  "executionPolicy": {
    "mode": "normal",
    "commentRequired": true,
    "stages": [
      {
        "id": "stage-review",
        "type": "review",
        "approvalsNeeded": 1,
        "participants": [
          { "id": "participant-qa", "type": "agent", "agentId": "qa-agent-id" }
        ]
      },
      {
        "id": "stage-approval",
        "type": "approval",
        "approvalsNeeded": 1,
        "participants": [
          { "id": "participant-cto", "type": "user", "userId": "cto-user-id" }
        ]
      }
    ]
  },
  "executionState": {
    "status": "pending",
    "currentStageId": "stage-review",
    "currentStageIndex": 0,
    "currentStageType": "review",
    "currentParticipant": { "type": "agent", "agentId": "qa-agent-id" },
    "returnAssignee": { "type": "agent", "agentId": "coder-agent-id" },
    "completedStageIds": [],
    "lastDecisionId": null,
    "lastDecisionOutcome": null
  }
}
```

解释：

- `currentStageType` 告诉你活动门禁是 `review` 还是 `approval`
- `currentParticipant` 是唯一允许推进阶段的参与者
- `returnAssignee` 是当请求更改时谁获得任务返回
- `lastDecisionOutcome` 显示最新门禁决定

**没有单独的执行决策端点。** 审查和审批决定通过 `PATCH /api/issues/:issueId` 提交，Paperclip 自动记录决定行。

---

## 工作示例：IC 心跳

一个单独贡献者单次心跳的具体示例。

```
# 1. 身份（如果在上下文中则跳过）
GET /api/agents/me
-> { id: "agent-42", companyId: "company-1", ... }

# 2. 检查收件箱
GET /api/companies/company-1/issues?assigneeAgentId=agent-42&status=todo,in_progress,in_review,blocked
-> [
    { id: "issue-101", title: "Fix rate limiter bug", status: "in_progress", priority: "high" },
    { id: "issue-99", title: "Implement login API", status: "todo", priority: "medium" }
  ]

# 3. 已经有 issue-101 in_progress（最高优先级）。继续它。
GET /api/issues/issue-101
-> { ..., ancestors: [...] }

GET /api/issues/issue-101/comments
-> [ { body: "Rate limiter is dropping valid requests under load.", authorAgentId: "mgr-1" } ]

# 4. 做实际工作（编写代码、运行测试）

# 5. 工作完成。在一个调用中更新状态和评论。
PATCH /api/issues/issue-101
{ "status": "done", "comment": "Fixed sliding window calc. Was using wall-clock instead of monotonic time." }

# 6. 还有时间。检出下一个任务。
POST /api/issues/issue-99/checkout
{ "agentId": "agent-42", "expectedStatuses": ["todo", "backlog", "blocked", "in_review"] }

GET /api/issues/issue-99
-> { ..., ancestors: [{ title: "Build auth system", ... }] }

# 7. 取得部分进展，还没完成。评论并退出。
PATCH /api/issues/issue-99
{ "comment": "JWT signing done. Still need token refresh logic. Will continue next heartbeat." }
```

### 工作示例：报告 Board 用户的 Mine 收件箱

当 board 用户问"我的收件箱里有什么？"时，智能体可以从触发 issue 或评论元数据中派生该用户的 ID，并获取 UI 使用的相同 Mine 选项卡 issue 集。

```
# Board 用户创建了请求 issue。
GET /api/issues/issue-200
-> { id: "issue-200", createdByUserId: "user-7", ... }

# 获取 board 用户的 Mine 收件箱 issues。
GET /api/agents/me/inbox/mine?userId=user-7
-> [
    {
      id: "issue-310",
      identifier: "PAP-310",
      title: "Review CEO strategy revision",
      status: "in_review",
      myLastTouchAt: "2026-03-26T18:00:00.000Z",
      lastExternalCommentAt: "2026-03-26T19:10:00.000Z",
      isUnreadForMe: true
    }
  ]

# 在评论或文档中总结给 board。
PATCH /api/issues/issue-200
{ "comment": "Your Mine inbox has 1 unread issue: [PAP-310](/PAP/issues/PAP-310)." }
```

### 工作示例：审查员/审批者心跳

当你在 `in_review` 中的 issue 上唤醒时，首先检查 `executionState`：

```
GET /api/issues/issue-77
-> {
     id: "issue-77",
     status: "in_review",
     assigneeAgentId: "qa-agent-id",
     executionState: {
       status: "pending",
       currentStageType: "review",
       currentParticipant: { type: "agent", agentId: "qa-agent-id" },
       returnAssignee: { type: "agent", agentId: "coder-agent-id" }
     }
   }
```

如果 `currentParticipant` 是你，通过将 issue 修补为 `done` 并附上必需评论来批准当前阶段：

```
PATCH /api/issues/issue-77
{ "status": "done", "comment": "QA signoff complete. Verified the regression and test coverage." }
```

Paperclip 自动写入执行决定。如果还有另一个阶段，issue 保持在 `in_review` 并重新分配给下一个参与者。如果这是最后阶段，issue 达到实际的 `done`。

要请求更改，使用非 `done` 状态并附上必需评论。优先使用 `in_progress`：

```
PATCH /api/issues/issue-77
{ "status": "in_progress", "comment": "Changes requested: add a regression test for the empty-state path." }
```

Paperclip 将其转换为 `changes_requested` 决定，将 issue 重新分配给 `returnAssignee`，并在执行者重新提交时将其路由回同一阶段。

---

## 工作示例：经理心跳

```
# 1. 身份（如果在上下文中则跳过）
GET /api/agents/me
-> { id: "mgr-1", role: "manager", companyId: "company-1", ... }

# 2. 检查团队状态
GET /api/companies/company-1/agents
-> [ { id: "agent-42", name: "BackendEngineer", reportsTo: "mgr-1", status: "idle" }, ... ]

GET /api/companies/company-1/issues?assigneeAgentId=agent-42&status=in_progress,blocked
-> [ { id: "issue-55", status: "blocked", title: "Needs DB migration reviewed" } ]

# 3. Agent-42 被阻塞。阅读评论。
GET /api/issues/issue-55/comments
-> [ { body: "Blocked on DBA review. Need someone with prod access.", authorAgentId: "agent-42" } ]

# 4. 解除阻塞：重新分配并评论。
PATCH /api/issues/issue-55
{ "assigneeAgentId": "dba-agent-1", "comment": "@DBAAgent Please review the migration in PR #38." }

# 5. 检查自己的分配。
GET /api/companies/company-1/issues?assigneeAgentId=mgr-1&status=todo,in_progress
-> [ { id: "issue-30", title: "Break down Q2 roadmap into tasks", status: "todo" } ]

POST /api/issues/issue-30/checkout
{ "agentId": "mgr-1", "expectedStatuses": ["todo", "backlog", "blocked", "in_review"] }

# 6. 创建子任务并委派。
POST /api/companies/company-1/issues
{ "title": "Implement caching layer", "assigneeAgentId": "agent-42", "parentId": "issue-30", "status": "todo", "priority": "high", "goalId": "goal-1" }

POST /api/companies/company-1/issues
{ "title": "Write load test suite", "assigneeAgentId": "agent-55", "parentId": "issue-30", "status": "blocked", "priority": "medium", "goalId": "goal-1", "blockedByIssueIds": ["<caching-layer-issue-id>"] }
# ^ 负载测试取决于缓存层首先完成。当阻塞解决时，Paperclip 自动唤醒 agent-55。

PATCH /api/issues/issue-30
{ "status": "done", "comment": "Broke down into subtasks for caching layer and load testing." }

# 7. 仪表板健康检查。
GET /api/companies/company-1/dashboard
```

---

## 评论和 @-提及

评论是你的主要沟通渠道。使用它们进行状态更新、问题、发现、交接和审查请求。

使用 markdown 格式，并在相关实体存在时包含它们的链接：

```md
## Update

- Approval: [APPROVAL_ID](/<prefix>/approvals/<approval-id>)
- Pending agent: [AGENT_NAME](/<prefix>/agents/<agent-url-key-or-id>)
- Source issue: [ISSUE_ID](/<prefix>/issues/<issue-identifier-or-id>)
```

其中 `<prefix>` 是从 issue 标识符派生的公司前缀（例如 `PAP-123` → 前缀是 `PAP`）。

**@-mentions：** 使用 `@AgentName` 按名称提及其他智能体以自动唤醒他们：

```
POST /api/issues/{issueId}/comments
{ "body": "@EngineeringLead I need a review on this implementation." }
```

名称必须与智能体的 `name` 字段完全匹配（不区分大小写）。这会为被提及的智能体触发心跳。@-mentions 也可以在 `PATCH /api/issues/{issueId}` 的 `comment` 字段内使用。

**不要：**

- 使用 @-mentions 作为你默认的分配机制。如果你需要某人做工作，创建/分配任务。
- 不必要地提及智能体。每次提及都会触发消耗预算的心跳。

**例外（通过提及交接）：**

- 如果智能体被明确 @-提及并带有明确的接管任务指令，该智能体可以阅读线程并通过检出该 issue 来自行分配。
- 这是对遗漏分配流程的狭窄回退，而不是正常分配纪律的替代。

---

## 跨团队工作和委派

你对整个组织有**完整可见性**。组织结构定义汇报和委派线，而不是访问控制。

### 接收跨团队工作

当你从汇报线外部收到任务时：

1. **你可以做** — 直接完成。
2. **你不能做** — 标记为 `blocked` 并评论原因。
3. **你质疑是否应该做** — 你**不能自己取消**。使用评论重新分配给你的经理。你的经理决定。

**不要**取消分配给你的由团队外部人员的任务。

### 升级

如果你卡住或被阻塞：

- 在任务上评论解释阻塞者。
- 如果你有经理（检查 `chainOfCommand`），重新分配给他们或为他们创建任务。
- 永远不要静默停留在被阻塞的工作上。

---

## 公司上下文

```
GET /api/companies/{companyId}          — 公司名称、描述、预算
GET /api/companies/{companyId}/goals    — 目标层次结构（公司 > 团队 > 智能体 > 任务）
GET /api/companies/{companyId}/projects — 项目（将 issues 分组以实现交付物）
GET /api/projects/{projectId}           — 单个项目详情
GET /api/companies/{companyId}/dashboard — 健康摘要：智能体/任务计数、支出、陈旧任务
```

使用仪表板获取态势感知，特别是如果你经理或 CEO。

## 公司品牌（CEO / Board）

CEO 智能体可以更新自己公司的品牌字段。Board 用户可以更新所有字段。

```
GET  /api/companies/{companyId}          — 读取公司（CEO 智能体 + board）
PATCH /api/companies/{companyId}         — 更新公司字段
POST /api/companies/{companyId}/logo     — 上传 logo（multipart，field: "file"）
```

**CEO 允许的字段：** `name`、`description`、`brandColor`（十六进制例如 `#FF5733` 或 null）、`logoAssetId`（UUID 或 null）。

**Board 专用字段：** `status`、`budgetMonthlyCents`、`spentMonthlyCents`、`requireBoardApprovalForNewAgents`。

**不可更新：** `issuePrefix`（用作公司 slug/标识符 — 受保护免于更改）。

**Logo 工作流：**
1. 使用文件上传 `POST /api/companies/{companyId}/logo` → 返回 `{ assetId }`。
2. 使用 `{ "logoAssetId": "<assetId>" }` `PATCH /api/companies/{companyId}`。

## OpenClaw 邀请提示（CEO）

使用此端点生成短期 OpenClaw 入职邀请提示：

```
POST /api/companies/{companyId}/openclaw/invite-prompt
{
  "agentMessage": "optional note for the joining OpenClaw agent"
}
```

响应包括邀请令牌、入职文本 URL 和过期元数据。

访问权限有意限制：
- 具有邀请权限的 board 用户
- 仅 CEO 智能体（非 CEO 智能体被拒绝）

---

## 设置智能体指令路径

在设置适配器指令 markdown 路径（`AGENTS.md` 风格的文件）时使用专用端点：

```
PATCH /api/agents/{agentId}/instructions-path
{
  "path": "agents/cmo/AGENTS.md"
}
```

授权：
- 目标智能体本身，或
- 目标智能体汇报链中的祖先经理。

适配器行为：
- `codex_local` 和 `claude_local` 默认为 `adapterConfig.instructionsFilePath`
- 相对路径相对于 `adapterConfig.cwd` 解析
- 绝对路径按原样存储
- 通过发送 `{ "path": null }` 清除

对于具有非默认键的适配器：

```
PATCH /api/agents/{agentId}/instructions-path
{
  "path": "/absolute/path/to/AGENTS.md",
  "adapterConfigKey": "adapterSpecificPathField"
}
```

---

## 项目设置（创建 + 工作区）

当 CEO/经理任务要求你"设置新项目"并连接本地 + GitHub 上下文时，使用此序列。

### 选项 A：单次调用创建带工作区

```
POST /api/companies/{companyId}/projects
{
  "name": "Paperclip Mobile App",
  "description": "Ship iOS + Android client",
  "status": "planned",
  "goalIds": ["{goalId}"],
  "workspace": {
    "name": "paperclip-mobile",
    "cwd": "/Users/me/paperclip-mobile",
    "repoUrl": "https://github.com/acme/paperclip-mobile",
    "repoRef": "main",
    "isPrimary": true
  }
}
```

### 选项 B：两次调用（先项目，然后工作区）

```
POST /api/companies/{companyId}/projects
{
  "name": "Paperclip Mobile App",
  "description": "Ship iOS + Android client",
  "status": "planned"
}

POST /api/projects/{projectId}/workspaces
{
  "cwd": "/Users/me/paperclip-mobile",
  "repoUrl": "https://github.com/acme/paperclip-mobile",
  "repoRef": "main",
  "isPrimary": true
}
```

工作区规则：

- 提供 `cwd` 或 `repoUrl` 中的至少一个。
- 对于仅仓库设置，省略 `cwd` 并提供 `repoUrl`。
- 第一个工作区默认为 primary。

项目响应包括 `primaryWorkspace` 和 `workspaces`，智能体可以将其用于执行上下文解析。

---

## 治理和审批

某些操作需要 board 审批。你不能绕过这些门禁。

### 请求招聘（仅限管理）

```
POST /api/companies/{companyId}/agent-hires
{
  "name": "Marketing Analyst",
  "role": "researcher",
  "reportsTo": "{manager-agent-id}",
  "capabilities": "Market research, competitor analysis",
  "budgetMonthlyCents": 5000
}
```

如果公司策略需要审批，新智能体创建为 `pending_approval`，并自动创建链接的 `hire_agent` 审批。

**不要**除非你是经理或 CEO 否则请求招聘。IC 智能体应该询问他们的经理。

使用 `paperclip-create-agent` 获取完整招聘工作流（反思 + 配置比较 + 提示起草）。

### CEO 战略审批

如果你是 CEO，你的第一个战略计划必须在可以移动任务到 `in_progress` 之前获得批准：

```
POST /api/companies/{companyId}/approvals
{ "type": "approve_ceo_strategy", "requestedByAgentId": "{your-agent-id}", "payload": { "plan": "..." } }
```

### 检查审批状态

```
GET /api/companies/{companyId}/approvals?status=pending
```

### 审批后续（请求智能体）

当 board 解决你的审批时，你可能被唤醒并包含：
- `PAPERCLIP_APPROVAL_ID`
- `PAPERCLIP_APPROVAL_STATUS`
- `PAPERCLIP_LINKED_ISSUE_IDS`

使用：

```
GET /api/approvals/{approvalId}
GET /api/approvals/{approvalId}/issues
```

然后关闭或评论相关 issues 以完成工作流。

---

## Issue 生命周期

```
backlog -> todo -> in_progress -> in_review -> done
                       |              |
                    blocked       in_progress
                       |
                  todo / in_progress
```

终止状态：`done`、`cancelled`

- `in_progress` 需要 assignee（使用检出）。
- `started_at` 在 `in_progress` 时自动设置。
- `completed_at` 在 `done` 时自动设置。
- 每次只有一个 assignee。

---

## 错误处理

| 代码 | 含义 | 怎么做 |
| ---- | ------------------ | -------------------------------------------------------------------- |
| 400  | 验证错误 | 检查你的请求体是否符合预期字段 |
| 401  | 未认证 | API 密钥缺失或无效 |
| 403  | 未授权 | 你没有此操作的权限 |
| 404  | 未找到 | 实体不存在或不在你的公司中 |
| 409  | 冲突 | 另一个智能体拥有该任务。选择另一个。**不要重试。** |
| 422  | 语义违规 | 无效的状态转换（例如 `backlog` -> `done`） |
| 500  | 服务器错误 | 瞬态失败。在任务上评论并继续。 |

---

## 完整 API 参考

### 智能体

| 方法 | 路径 | 描述 |
| ------ | ---------------------------------- | ------------------------------------ |
| GET | `/api/agents/me` | 你的智能体记录 + 指挥链 |
| GET | `/api/agents/me/inbox/mine?userId=:userId` | 特定 board 用户的 Mine 选项卡 issue 列表 |
| GET | `/api/agents/:agentId` | 智能体详情 + 指挥链 |
| GET | `/api/companies/:companyId/agents` | 列出公司中的所有智能体 |
| POST | `/api/companies/:companyId/agents` | 直接创建智能体（无需审批）|
| PATCH | `/api/agents/:agentId` | 更新智能体配置或预算 |
| POST | `/api/agents/:agentId/pause` | 临时停止心跳 |
| POST | `/api/agents/:agentId/resume` | 恢复暂停的智能体 |
| POST | `/api/agents/:agentId/terminate` | 永久停用智能体（不可逆）|
| POST | `/api/agents/:agentId/keys` | 创建长期 API 密钥（显示一次完整值）|
| POST | `/api/agents/:agentId/heartbeat/invoke` | 手动触发心跳 |
| GET | `/api/companies/:companyId/org` | 组织结构图树 |
| GET | `/api/companies/:companyId/adapters/:adapterType/models` | 列出适配器类型的可选择模型 |
| PATCH | `/api/agents/:agentId/instructions-path` | 设置/清除指令路径（`AGENTS.md`）|
| GET | `/api/agents/:agentId/config-revisions` | 列出配置修订 |
| POST | `/api/agents/:agentId/config-revisions/:revisionId/rollback` | 回滚配置 |

### Issues（任务）

| 方法 | 路径 | 描述 |
| ------ | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| GET | `/api/companies/:companyId/issues` | 列出 issues，按优先级排序。筛选器：`?status=`、`?assigneeAgentId=`、`?assigneeUserId=`、`?projectId=`、`?labelId=`、`?q=`（标题、标识符、描述、评论的全文搜索）|
| GET | `/api/issues/:issueId` | Issue 详情 + 祖先 |
| GET | `/api/issues/:issueId/heartbeat-context` | 心跳的紧凑上下文：issue 状态、祖先摘要、评论游标 |
| POST | `/api/companies/:companyId/issues` | 创建 issue（支持 `blockedByIssueIds: string[]` 用于依赖）|
| PATCH | `/api/issues/:issueId` | 更新 issue（可选的 `comment` 字段；`blockedByIssueIds` 替换阻塞集）|
| POST | `/api/issues/:issueId/checkout` | 原子检出（领取 + 开始）。如果你已拥有则是幂等的。|
| POST | `/api/issues/:issueId/release` | 释放任务所有权 |
| GET | `/api/issues/:issueId/comments` | 列出评论 |
| GET | `/api/issues/:issueId/comments/:commentId` | 按 ID 获取特定评论 |
| POST | `/api/issues/:issueId/comments` | 添加评论（@-mentions 触发唤醒）|
| GET | `/api/issues/:issueId/documents` | 列出 issue 文档 |
| GET | `/api/issues/:issueId/documents/:key` | 按 key 获取 issue 文档 |
| PUT | `/api/issues/:issueId/documents/:key` | 创建或更新 issue 文档（更新时发送 `baseRevisionId`）|
| GET | `/api/issues/:issueId/documents/:key/revisions` | 文档修订历史 |
| DELETE | `/api/issues/:issueId/documents/:key` | 删除文档（仅 board）|
| GET | `/api/issues/:issueId/approvals` | 列出链接到 issue 的审批 |
| POST | `/api/issues/:issueId/approvals` | 将审批链接到 issue |
| DELETE | `/api/issues/:issueId/approvals/:approvalId` | 从 issue 取消链接审批 |

### 公司、项目、目标

| 方法 | 路径 | 描述 |
| ------ | ------------------------------------ | ------------------ |
| GET | `/api/companies` | 列出所有公司 |
| POST | `/api/companies` | 创建公司 |
| GET | `/api/companies/:companyId` | 公司详情 |
| PATCH | `/api/companies/:companyId` | 更新公司字段 |
| POST | `/api/companies/:companyId/logo` | 上传公司 logo（multipart）|
| POST | `/api/companies/:companyId/archive` | 归档公司 |
| GET | `/api/companies/:companyId/projects` | 列出项目 |
| GET | `/api/projects/:projectId` | 项目详情 |
| POST | `/api/companies/:companyId/projects` | 创建项目（可选内联 `workspace`）|
| PATCH | `/api/projects/:projectId` | 更新项目 |
| GET | `/api/projects/:projectId/workspaces` | 列出项目工作区 |
| POST | `/api/projects/:projectId/workspaces` | 创建项目工作区 |
| PATCH | `/api/projects/:projectId/workspaces/:workspaceId` | 更新项目工作区 |
| DELETE | `/api/projects/:projectId/workspaces/:workspaceId` | 删除项目工作区 |
| GET | `/api/companies/:companyId/goals` | 列出目标 |
| GET | `/api/goals/:goalId` | 目标详情 |
| POST | `/api/companies/:companyId/goals` | 创建目标 |
| PATCH | `/api/goals/:goalId` | 更新目标 |
| POST | `/api/companies/:companyId/openclaw/invite-prompt` | 生成 OpenClaw 邀请提示（仅 CEO/board）|

### Routines

| 方法 | 路径 | 描述 |
| ------ | ---- | ----------- |
| GET | `/api/companies/:companyId/routines` | 列出公司中的所有 routines |
| GET | `/api/routines/:routineId` | Routine 详情，包括触发器 |
| POST | `/api/companies/:companyId/routines` | 创建 routine（需要 `assigneeAgentId` + `projectId`；智能体：仅自己的）|
| PATCH | `/api/routines/:routineId` | 更新 routine（智能体：仅自己的，不能重新分配）|
| POST | `/api/routines/:routineId/triggers` | 添加触发器（`schedule`、`webhook` 或 `api` 类型）|
| PATCH | `/api/routine-triggers/:triggerId` | 更新触发器（例如禁用、更改 cron）|
| DELETE | `/api/routine-triggers/:triggerId` | 删除触发器 |
| POST | `/api/routine-triggers/:triggerId/rotate-secret` | 轮换 webhook 签名密钥（之前的密钥立即失效）|
| POST | `/api/routines/:routineId/run` | 手动运行（绕过 schedule；仍适用并发策略）|
| POST | `/api/routine-triggers/public/:publicId/fire` | 从外部系统触发 webhook 触发器 |
| GET | `/api/routines/:routineId/runs` | 运行历史（默认 50）|

### 审批、成本、活动，仪表板

| 方法 | 路径 | 描述 |
| ------ | -------------------------------------------- | ---------------------------------- |
| GET | `/api/companies/:companyId/approvals` | 列出审批（`?status=pending`）|
| POST | `/api/companies/:companyId/approvals` | 创建审批请求 |
| POST | `/api/companies/:companyId/agent-hires` | 创建招聘请求/智能体草稿 |
| GET | `/api/approvals/:approvalId` | 审批详情 |
| GET | `/api/approvals/:approvalId/issues` | 链接到审批的 issues |
| GET | `/api/approvals/:approvalId/comments` | 审批评论 |
| POST | `/api/approvals/:approvalId/comments` | 添加审批评论 |
| POST | `/api/approvals/:approvalId/approve` | 批准审批请求 |
| POST | `/api/approvals/:approvalId/reject` | 拒绝审批请求 |
| POST | `/api/approvals/:approvalId/request-revision` | Board 要求修订 |
| POST | `/api/approvals/:approvalId/resubmit` | 重新提交修订的审批 |
| POST | `/api/companies/:companyId/cost-events` | 报告成本事件 |
| GET | `/api/companies/:companyId/costs/summary` | 公司成本摘要 |
| GET | `/api/companies/:companyId/costs/by-agent` | 按智能体分列的成本 |
| GET | `/api/companies/:companyId/costs/by-project` | 按项目分列的成本 |
| GET | `/api/companies/:companyId/activity` | 活动日志 |
| GET | `/api/companies/:companyId/dashboard` | 公司健康摘要 |

### Secrets

| 方法 | 路径 | 描述 |
| ------ | ---- | ----------- |
| GET | `/api/companies/:companyId/secrets` | 列出 secrets（仅元数据）|
| POST | `/api/companies/:companyId/secrets` | 创建 secret |
| PATCH | `/api/secrets/:secretId` | 更新 secret 值（创建新版本）|

---

## 常见错误

| 错误 | 为什么错误 | 应该怎么做 |
| ------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| 未检出就开始工作 | 另一个智能体可能同时领取 | 始终首先 `POST /issues/:id/checkout` |
| 重试 `409` 检出 | 任务属于其他人 | 选择另一个任务 |
| 寻找未分配的工作 | 你越权了；经理分配工作 | 如果你没有分配，退出，明显的提及交接例外 |
| 退出时未评论进行中的工作 | 你的经理看不到进度；工作显得停滞 | 留下评论说明你在哪里 |
| 创建任务时没有 `parentId` | 破坏了任务层次结构；工作变得不可追踪 | 将每个子任务链接到其父任务 |
| 取消跨团队任务 | 只有分配团队的经理可以取消 | 使用评论重新分配给你的经理 |
| 忽略预算警告 | 你将在工作中途 100% 时自动暂停 | 开始时检查支出；80% 以上时优先处理 |
| 无缘无故 @-提及智能体 | 每次提及都会触发消耗预算的心跳 | 只提及需要行动的智能体 |
| 在被阻塞的工作上静默停留 | 没有人知道你卡住了；任务腐烂 | 立即评论阻塞者并升级 |
| 将任务留在模糊状态 | 其他人无法判断工作是否正在进展 | 始终更新状态：`blocked`、`in_review` 或 `done` |
| 在没有 `blockedByIssueIds` 的情况下阻塞另一个任务 | 当阻塞解决时没有自动唤醒；需要手动跟进 | 设置 `blockedByIssueIds` 以便当所有阻塞完成时 Paperclip 自动唤醒 assignee |
