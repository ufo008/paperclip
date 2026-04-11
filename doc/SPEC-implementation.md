# Paperclip V1 实现规格说明

状态：首发（V1）的实现合同
日期：2026-02-17
受众：产品、工程和 agent 集成作者
来源输入：`GOAL.md`、`PRODUCT.md`、`SPEC.md`、`DATABASE.md`、当前 monorepo 代码

## 1. 文档角色

`SPEC.md` 保持长期产品规格说明。
本文档是具体的、可构建的 V1 合同。
当存在冲突时，`SPEC-implementation.md` 控制 V1 行为。

## 2. V1 成果

Paperclip V1 必须为 autonomous agents 提供完整的控制平面循环：

1. 人类董事会创建公司并定义目标。
2. 董事会在组织树中创建和管理 agents。
3. Agents 通过心跳调用接收和执行任务。
4. 所有工作通过任务/评论进行跟踪，并具有审计可见性。
5. Token/成本使用情况被报告，预算限制可以停止工作。
6. 董事会可以随时干预（暂停 agents/任务、覆盖决策）。

成功意味着一个运营商可以端到端地运行一个小型的 AI 原生公司，具有清晰的可见性和控制。

## 3. 明确的 V1 产品决策

这些决策为 V1 关闭了 `SPEC.md` 中的待解决问题。

| 主题 | V1 决策 |
|---|---|
|  tenancy | 单租户部署，多公司数据模型 |
| 公司模型 | 公司是一阶的；所有业务实体都是公司范围的 |
| 董事会 | 每个部署单一人类董事会操作员 |
| 组织图 | 严格树形结构（`reports_to` 可为空的根）；无多经理汇报 |
| 可见性 | 对董事会和同一公司中的所有 agents 完全可见 |
| 通信 | 仅任务 + 评论（无独立聊天系统） |
| 任务所有权 | 单一 assignee；`in_progress` 转换需要原子检出 |
| 恢复 | 无自动重新分配；工作恢复保持手动/显式 |
| Agent adapters | 内置 `process` 和 `http` adapters |
| 认证 | 模式相关的人类认证（当前代码中 `local_trusted` 隐式董事会；认证模式使用会话），agents 使用 API 密钥 |
| 预算周期 | 每月 UTC 日历窗口 |
| 预算执行 | 软警报 + 硬限制自动暂停 |
| 部署模式 | 规范模型是 `local_trusted` + `authenticated`，具有 `private/public` 暴露策略（参见 `doc/DEPLOYMENT-MODES.md`） |

## 4. 当前基线（仓库快照）

截至 2026-02-17，仓库已包含：

- Node + TypeScript 后端，具有 `agents`、`projects`、`goals`、`issues`、`activity` 的 REST CRUD
- 用于 dashboard/agents/projects/goals/issues 列表的 React UI 页面
- 通过 Drizzle 的 PostgreSQL schema，当 `DATABASE_URL` 未设置时使用嵌入式 PostgreSQL 回退

V1 实现将此基线扩展为以公司为中心、支持治理的控制平面。

## 5. V1 范围

## 5.1 范围内

- 公司生命周期（创建/列表/获取/更新/归档）
- 链接到公司使命的目标层级
- 具有组织结构和 adapter 配置的 Agent 生命周期
- 具有父/子层级和评论的任务生命周期
- 原子任务检出和显式任务状态转换
- 用于聘用和 CEO 战略提案的董事会审批
- 心跳调用、状态跟踪和取消
- 成本事件摄取和汇总（agent/任务/项目/公司）
- 预算设置和硬限制执行
- 用于 dashboard、组织图、任务、agents、审批、成本的董事会 Web UI
- 面向 Agent 的 API 契约（任务读/写、心跳报告、成本报告）
- 所有变更操作的可审计活动日志

## 5.2 范围外（V1）

- 插件框架和第三方扩展 SDK
- 除模型/token 成本外的收入/支出核算
- 知识库子系统
- 公共市场（ClipHub）
- 多董事会治理或基于角色的人类权限粒度
- 自动自愈编排（自动重新分配/重试 planners）

## 6. 架构

## 6.1 运行时组件

- `server/`：REST API、认证、编排服务
- `ui/`：董事会操作员界面
- `packages/db/`：Drizzle schema、迁移、DB 客户端（PostgreSQL）
- `packages/shared/`：共享 API 类型、验证器、常量

## 6.2 数据存储

- 主存储：PostgreSQL
- 本地默认：嵌入式 PostgreSQL，位于 `~/.paperclip/instances/default/db`
- 可选本地类生产：Docker Postgres
- 可选托管：Supabase/PostgreSQL 兼容
- 文件/对象存储：
  - 本地默认：`~/.paperclip/instances/default/data/storage`（`local_disk`）
  - 云：S3 兼容对象存储（`s3`）

## 6.3 后台处理

服务器进程中的轻量级调度器/工作器处理：

- 心跳触发器检查
- 卡住运行检测
- 预算阈值检查

V1 不需要单独队列基础设施。

## 7. 规范数据模型（V1）

所有核心表都包含 `id`、`created_at`、`updated_at`，除非另有说明。

## 7.0 认证表

人类认证表（`users`、`sessions` 和特定于 provider 的认证产物）由所选认证库管理。本规格将它们视为必需依赖，并在需要用户归属时引用 `users.id`。

## 7.1 `companies`

- `id` uuid pk
- `name` text not null
- `description` text null
- `status` enum: `active | paused | archived`

不变量：每条业务记录都属于一个公司。

## 7.2 `agents`

- `id` uuid pk
- `company_id` uuid fk `companies.id` not null
- `name` text not null
- `role` text not null
- `title` text null
- `status` enum: `active | paused | idle | running | error | terminated`
- `reports_to` uuid fk `agents.id` null
- `capabilities` text null
- `adapter_type` enum: `process | http`
- `adapter_config` jsonb not null
- `context_mode` enum: `thin | fat` default `thin`
- `budget_monthly_cents` int not null default 0
- `spent_monthly_cents` int not null default 0
- `last_heartbeat_at` timestamptz null

不变量：

- agent 和 manager 必须在同一公司
- 汇报树中无循环
- `terminated` agents 无法恢复

## 7.3 `agent_api_keys`

- `id` uuid pk
- `agent_id` uuid fk `agents.id` not null
- `company_id` uuid fk `companies.id` not null
- `name` text not null
- `key_hash` text not null
- `last_used_at` timestamptz null
- `revoked_at` timestamptz null

不变量：明文密钥在创建时显示一次；仅存储哈希。

## 7.4 `goals`

- `id` uuid pk
- `company_id` uuid fk not null
- `title` text not null
- `description` text null
- `level` enum: `company | team | agent | task`
- `parent_id` uuid fk `goals.id` null
- `owner_agent_id` uuid fk `agents.id` null
- `status` enum: `planned | active | achieved | cancelled`

不变量：每个公司至少有一个根 `company` 级别目标。

## 7.5 `projects`

- `id` uuid pk
- `company_id` uuid fk not null
- `goal_id` uuid fk `goals.id` null
- `name` text not null
- `description` text null
- `status` enum: `backlog | planned | in_progress | completed | cancelled`
- `lead_agent_id` uuid fk `agents.id` null
- `target_date` date null
- `env` jsonb null（与 agent 配置中使用的相同 secret-aware env 绑定格式）

不变量：

- 项目 env 合并到该项目中问题的运行环境中，并在 Paperclip 运行时拥有的 env 键注入之前覆盖冲突的 agent env 键

## 7.6 `issues`（核心任务实体）

- `id` uuid pk
- `company_id` uuid fk not null
- `project_id` uuid fk `projects.id` null
- `goal_id` uuid fk `goals.id` null
- `parent_id` uuid fk `issues.id` null
- `title` text not null
- `description` text null
- `status` enum: `backlog | todo | in_progress | in_review | done | blocked | cancelled`
- `priority` enum: `critical | high | medium | low`
- `assignee_agent_id` uuid fk `agents.id` null
- `created_by_agent_id` uuid fk `agents.id` null
- `created_by_user_id` uuid fk `users.id` null
- `request_depth` int not null default 0
- `billing_code` text null
- `started_at` timestamptz null
- `completed_at` timestamptz null
- `cancelled_at` timestamptz null

不变量：

- 仅单一 assignee
- 任务必须通过 `goal_id`、`parent_id` 或项目-目标链接追溯到公司目标链
- `in_progress` 需要 assignee
- 终态：`done | cancelled`

## 7.7 `issue_comments`

- `id` uuid pk
- `company_id` uuid fk not null
- `issue_id` uuid fk `issues.id` not null
- `author_agent_id` uuid fk `agents.id` null
- `author_user_id` uuid fk `users.id` null
- `body` text not null

## 7.8 `heartbeat_runs`

- `id` uuid pk
- `company_id` uuid fk not null
- `agent_id` uuid fk not null
- `invocation_source` enum: `scheduler | manual | callback`
- `status` enum: `queued | running | succeeded | failed | cancelled | timed_out`
- `started_at` timestamptz null
- `finished_at` timestamptz null
- `error` text null
- `external_run_id` text null
- `context_snapshot` jsonb null

## 7.9 `cost_events`

- `id` uuid pk
- `company_id` uuid fk not null
- `agent_id` uuid fk `agents.id` not null
- `issue_id` uuid fk `issues.id` null
- `project_id` uuid fk `projects.id` null
- `goal_id` uuid fk `goals.id` null
- `billing_code` text null
- `provider` text not null
- `model` text not null
- `input_tokens` int not null default 0
- `output_tokens` int not null default 0
- `cost_cents` int not null
- `occurred_at` timestamptz not null

不变量：每个事件必须附加到 agent 和公司；汇总是聚合，而不是手动编辑。

## 7.10 `approvals`

- `id` uuid pk
- `company_id` uuid fk not null
- `type` enum: `hire_agent | approve_ceo_strategy`
- `requested_by_agent_id` uuid fk `agents.id` null
- `requested_by_user_id` uuid fk `users.id` null
- `status` enum: `pending | approved | rejected | cancelled`
- `payload` jsonb not null
- `decision_note` text null
- `decided_by_user_id` uuid fk `users.id` null
- `decided_at` timestamptz null

## 7.11 `activity_log`

- `id` uuid pk
- `company_id` uuid fk not null
- `actor_type` enum: `agent | user | system`
- `actor_id` uuid/text not null
- `action` text not null
- `entity_type` text not null
- `entity_id` uuid/text not null
- `details` jsonb null
- `created_at` timestamptz not null default now()

## 7.12 `company_secrets` + `company_secret_versions`

- Secret 值不存储在 `agents.adapter_config.env` 的内联中。
- Agent env 条目应使用 secret 引用来处理敏感值。
- `company_secrets` 跟踪每个公司的身份/provider 元数据。
- `company_secret_versions` 存储每个版本的加密/引用材料。
- 本地部署中的默认 provider：`local_encrypted`。

操作策略：

- 配置读取 API 会对敏感明文值进行编辑。
- 活动和审批 payload 不得持久化原始敏感值。
- 配置修订可能包含编辑后的占位符；此类修订对于编辑的字段是不可恢复的。

## 7.13 必需索引

- `agents(company_id, status)`
- `agents(company_id, reports_to)`
- `issues(company_id, status)`
- `issues(company_id, assignee_agent_id, status)`
- `issues(company_id, parent_id)`
- `issues(company_id, project_id)`
- `cost_events(company_id, occurred_at)`
- `cost_events(company_id, agent_id, occurred_at)`
- `heartbeat_runs(company_id, agent_id, started_at desc)`
- `approvals(company_id, status, type)`
- `activity_log(company_id, created_at desc)`
- `assets(company_id, created_at desc)`
- `assets(company_id, object_key)` unique
- `issue_attachments(company_id, issue_id)`
- `company_secrets(company_id, name)` unique
- `company_secret_versions(secret_id, version)` unique

## 7.14 `assets` + `issue_attachments`

- `assets` 存储 provider 支持的对象元数据（不是内联字节）：
  - `id` uuid pk
  - `company_id` uuid fk not null
  - `provider` enum/text (`local_disk | s3`)
  - `object_key` text not null
  - `content_type` text not null
  - `byte_size` int not null
  - `sha256` text not null
  - `original_filename` text null
  - `created_by_agent_id` uuid fk null
  - `created_by_user_id` uuid/text fk null
- `issue_attachments` 将 assets 链接到 issues/comments：
  - `id` uuid pk
  - `company_id` uuid fk not null
  - `issue_id` uuid fk not null
  - `asset_id` uuid fk not null
  - `issue_comment_id` uuid fk null

## 7.15 `documents` + `document_revisions` + `issue_documents`

- `documents` 存储可编辑的文本优先文档：
  - `id` uuid pk
  - `company_id` uuid fk not null
  - `title` text null
  - `format` text not null（`markdown`）
  - `latest_body` text not null
  - `latest_revision_id` uuid null
  - `latest_revision_number` int not null
  - `created_by_agent_id` uuid fk null
  - `created_by_user_id` uuid/text fk null
  - `updated_by_agent_id` uuid fk null
  - `updated_by_user_id` uuid/text fk null
- `document_revisions` 存储仅追加历史：
  - `id` uuid pk
  - `company_id` uuid fk not null
  - `document_id` uuid fk not null
  - `revision_number` int not null
  - `body` text not null
  - `change_summary` text null
- `issue_documents` 使用稳定的 workflow 密钥将文档链接到 issues：
  - `id` uuid pk
  - `company_id` uuid fk not null
  - `issue_id` uuid fk not null
  - `document_id` uuid fk not null
  - `key` text not null（`plan`、`design`、`notes` 等）

## 8. 状态机

## 8.1 Agent 状态

允许的转换：

- `idle -> running`
- `running -> idle`
- `running -> error`
- `error -> idle`
- `idle -> paused`
- `running -> paused`（需要取消流程）
- `paused -> idle`
- `* -> terminated`（仅限董事会，不可逆）

## 8.2 Issue 状态

允许的转换：

- `backlog -> todo | cancelled`
- `todo -> in_progress | blocked | cancelled`
- `in_progress -> in_review | blocked | done | cancelled`
- `in_review -> in_progress | done | cancelled`
- `blocked -> todo | in_progress | cancelled`
- 终态：`done`、`cancelled`

副作用：

- 进入 `in_progress` 设置 `started_at`（如果为 null）
- 进入 `done` 设置 `completed_at`
- 进入 `cancelled` 设置 `cancelled_at`

## 8.3 审批状态

- `pending -> approved | rejected | cancelled`
- 决策后终止

## 9. 认证和权限

## 9.1 董事会认证

- 人类操作员的基于会话的认证
- 董事会对部署中所有公司具有完全读/写权限
- 每次董事会变更都写入 `activity_log`

## 9.2 Agent 认证

- 映射到一个 agent 和公司的 Bearer API 密钥
- Agent 密钥作用域：
  - 读取自己公司的 org/任务/公司上下文
  - 读/写分配给自己的任务和评论
  - 创建用于委托的任务/评论
  - 报告心跳状态
  - 报告成本事件
- Agent 不能：
  - 绕过审批门控
  - 直接修改公司级预算
  - 变更 auth/密钥

## 9.3 权限矩阵（V1）

| 操作 | 董事会 | Agent |
|---|---|---|
| 创建公司 | yes | no |
| 聘用/创建 agent | yes（直接） | 通过审批请求 |
| 暂停/恢复 agent | yes | no |
| 创建/更新任务 | yes | yes |
| 强制重新分配任务 | yes | 有限 |
| 审批策略/聘用请求 | yes | no |
| 报告成本 | yes | yes |
| 设置公司预算 | yes | no |
| 设置下属预算 | yes | yes（仅 manager 子树） |

## 10. API 契约（REST）

所有端点都在 `/api` 下，返回 JSON。

## 10.1 公司

- `GET /companies`
- `POST /companies`
- `GET /companies/:companyId`
- `PATCH /companies/:companyId`
- `PATCH /companies/:companyId/branding`
- `POST /companies/:companyId/archive`

## 10.2 目标

- `GET /companies/:companyId/goals`
- `POST /companies/:companyId/goals`
- `GET /goals/:goalId`
- `PATCH /goals/:goalId`
- `DELETE /goals/:goalId`（软删除可选，硬删除仅限董事会）

## 10.3 Agent

- `GET /companies/:companyId/agents`
- `POST /companies/:companyId/agents`
- `GET /agents/:agentId`
- `PATCH /agents/:agentId`
- `POST /agents/:agentId/pause`
- `POST /agents/:agentId/resume`
- `POST /agents/:agentId/terminate`
- `POST /agents/:agentId/keys`（创建 API 密钥）
- `POST /agents/:agentId/heartbeat/invoke`

## 10.4 任务（Issues）

- `GET /companies/:companyId/issues`
- `POST /companies/:companyId/issues`
- `GET /issues/:issueId`
- `PATCH /issues/:issueId`
- `GET /issues/:issueId/documents`
- `GET /issues/:issueId/documents/:key`
- `PUT /issues/:issueId/documents/:key`
- `GET /issues/:issueId/documents/:key/revisions`
- `DELETE /issues/:issueId/documents/:key`
- `POST /issues/:issueId/checkout`
- `POST /issues/:issueId/release`
- `POST /issues/:issueId/comments`
- `GET /issues/:issueId/comments`
- `POST /companies/:companyId/issues/:issueId/attachments`（multipart 上传）
- `GET /issues/:issueId/attachments`
- `GET /attachments/:attachmentId/content`
- `DELETE /attachments/:attachmentId`

### 10.4.1 原子检出契约

`POST /issues/:issueId/checkout` 请求：

```json
{
  "agentId": "uuid",
  "expectedStatuses": ["todo", "backlog", "blocked", "in_review"]
}
```

服务器行为：

1. 使用 `WHERE id = ? AND status IN (?) AND (assignee_agent_id IS NULL OR assignee_agent_id = :agentId)` 的单一 SQL 更新
2. 如果更新的行数为 0，返回 `409` 以及当前 owner/status
3. 成功检出设置 `assignee_agent_id`、`status = in_progress` 和 `started_at`

## 10.5 项目

- `GET /companies/:companyId/projects`
- `POST /companies/:companyId/projects`
- `GET /projects/:projectId`
- `PATCH /projects/:projectId`

## 10.6 审批

- `GET /companies/:companyId/approvals?status=pending`
- `POST /companies/:companyId/approvals`
- `POST /approvals/:approvalId/approve`
- `POST /approvals/:approvalId/reject`

## 10.7 成本和预算

- `POST /companies/:companyId/cost-events`
- `GET /companies/:companyId/costs/summary`
- `GET /companies/:companyId/costs/by-agent`
- `GET /companies/:companyId/costs/by-project`
- `PATCH /companies/:companyId/budgets`
- `PATCH /agents/:agentId/budgets`

## 10.8 活动和仪表板

- `GET /companies/:companyId/activity`
- `GET /companies/:companyId/dashboard`

仪表板 payload 必须包含：

- active/running/paused/error agent 计数
- open/in_progress/blocked/done issue 计数
- 当月至今支出和预算利用率
- 待处理审批计数

## 10.9 错误语义

- `400` 验证错误
- `401` 未认证
- `403` 未授权
- `404` 未找到
- `409` 状态冲突（检出冲突、无效转换）
- `422` 语义规则违反
- `500` 服务器错误

## 11. 心跳和 Adapter 契约

## 11.1 Adapter 接口

```ts
interface AgentAdapter {
  invoke(agent: Agent, context: InvocationContext): Promise<InvokeResult>;
  status(run: HeartbeatRun): Promise<RunStatus>;
  cancel(run: HeartbeatRun): Promise<void>;
}
```

## 11.2 Process Adapter

配置形状：

```json
{
  "command": "string",
  "args": ["string"],
  "cwd": "string",
  "env": {"KEY": "VALUE"},
  "timeoutSec": 900,
  "graceSec": 15
}
```

行为：

- 生成子进程
- 将 stdout/stderr 流式传输到运行日志
- 根据退出码/超时标记运行状态
- 取消发送 SIGTERM，然后在 grace 后发送 SIGKILL

## 11.3 HTTP Adapter

配置形状：

```json
{
  "url": "https://...",
  "method": "POST",
  "headers": {"Authorization": "Bearer ..."},
  "timeoutMs": 15000,
  "payloadTemplate": {"agentId": "{{agent.id}}", "runId": "{{run.id}}"}
}
```

行为：

- 通过出站 HTTP 请求调用
- 2xx 表示已接受
- 非 2xx 标记为调用失败
- 可选回调端点允许异步完成更新

## 11.4 上下文传递

- `thin`：仅发送 ID 和指针；agent 通过 API 获取上下文
- `fat`：包含当前分配、目标摘要、预算快照和近期评论

## 11.5 调度器规则

`adapter_config` 中每个 agent 的调度字段：

- `enabled` boolean
- `intervalSec` integer（最小 30）
- `maxConcurrentRuns` V1 固定为 `1`

调度器必须在以下情况下跳过调用：

- agent 已暂停/终止
- 现有运行处于活跃状态
- 硬预算限制已达到

## 12. 治理和审批流程

## 12.1 聘用

1. Agent 或董事会创建 `approval(type=hire_agent, status=pending, payload=agent draft)`。
2. 董事会批准或拒绝。
3. 批准后，服务器创建 agent 行和初始 API 密钥（可选）。
4. 决策记录在 `activity_log` 中。

董事会可以绕过请求流程，直接通过 UI 创建 agents；直接创建仍作为治理操作记录。

## 12.2 CEO 战略审批

1. CEO 将战略提案发布为 `approval(type=approve_ceo_strategy)`。
2. 董事会审查 payload（计划文本、初始结构、高层任务）。
3. 审批解锁 CEO 创建的委托工作的执行状态。

在第一次战略审批之前，CEO 只能起草任务，不能将任务转换为活跃执行状态。

## 12.3 董事会覆盖

董事会可以随时：

- 暂停/恢复/终止任何 agent
- 重新分配或取消任何任务
- 编辑预算和限制
- 批准/拒绝/取消待处理审批

## 13. 成本和预算系统

## 13.1 预算层级

- 公司月度预算
- agent 月度预算
- 可选项目预算（如果已配置）

## 13.2 执行规则

- 软警报默认阈值：80%
- 硬限制：达到 100% 时触发：
  - 将 agent 状态设置为 `paused`
  - 阻止该 agent 的新检出/调用
  - 发出高优先级活动事件

董事会可以通过提高预算或显式恢复 agent 来覆盖。

## 13.3 成本事件摄取

`POST /companies/:companyId/cost-events` 请求体：

```json
{
  "agentId": "uuid",
  "issueId": "uuid",
  "provider": "openai",
  "model": "gpt-5",
  "inputTokens": 1234,
  "outputTokens": 567,
  "costCents": 89,
  "occurredAt": "2026-02-17T20:25:00Z",
  "billingCode": "optional"
}
```

验证：

- 非负 token 计数
- `costCents >= 0`
- 所有链接实体的公司所有权检查

## 13.4 汇总

V1 可以接受读取时聚合查询。
如果查询延迟超过目标，以后可以添加物化汇总。

## 14. UI 要求（董事会应用）

V1 UI 路由：

- `/` dashboard
- `/companies` 公司列表/创建
- `/companies/:id/org` 组织图和 agent 状态
- `/companies/:id/tasks` 任务列表/看板
- `/companies/:id/agents/:agentId` agent 详情
- `/companies/:id/costs` 成本和预算仪表板
- `/companies/:id/approvals` 待处理/历史审批
- `/companies/:id/activity` 审计/事件流

必需 UX 行为：

- 全局公司选择器
- 快速操作：暂停/恢复 agent、创建任务、批准/拒绝请求
- 原子检出失败时的冲突 toast
- 无静默后台失败；每个失败的运行在 UI 中可见

## 15. 操作要求

## 15.1 环境

- Node 20+
- `DATABASE_URL` 可选
- 如果未设置，自动使用 PGlite 并推送 schema

## 15.2 迁移

- Drizzle 迁移是真相来源
- V1 升级路径不进行原地破坏性迁移
- 提供从现有最小表到公司范围 schema 的迁移脚本

## 15.3 日志和审计

- 结构化日志（生产环境为 JSON）
- 每个 API 调用的请求 ID
- 每个变更操作写入 `activity_log`

## 15.4 可靠性目标

- 标准 CRUD 在 1k 任务/公司时 API p95 延迟低于 250 ms
- process adapter 的心跳调用确认低于 2 s
- 无丢失审批决策（事务性写入）

## 16. 安全要求

- 仅存储 hashed agent API 密钥
- 在日志中编辑 secret（`adapter_config`、auth 头、env 变量）
- 董事会会话端点的 CSRF 保护
- 认证和密钥管理端点的速率限制
- 每个实体获取/变更的严格公司边界检查

## 17. 测试策略

## 17.1 单元测试

- 状态转换守卫（agent、issue、approval）
- 预算执行规则
- adapter 调用/取消语义

## 17.2 集成测试

- 原子检出冲突行为
- 审批到 agent 创建流程
- 成本摄取和汇总正确性
- 运行活跃时暂停（优雅取消然后强制终止）

## 17.3 端到端测试

- 董事会创建公司 -> 聘用 CEO -> 审批策略 -> CEO 接收工作
- agent 报告成本 -> 达到预算阈值 -> 自动暂停发生
- 跨团队任务委托，请求深度递增

## 17.4 回归套件最低要求

除非以下测试通过，否则发布候选被阻止：

1. 认证边界测试
2. 检出竞态测试
3. 硬预算停止测试
4. agent 暂停/恢复测试
5. dashboard 摘要一致性测试

## 18. 交付计划

## 里程碑 1：公司核心和认证

- 添加 `companies` 并将现有实体限定为公司范围
- 添加董事会会话认证和 agent API 密钥
- 将现有 API 路由迁移到公司感知路径

## 里程碑 2：任务和治理语义

- 实现原子检出端点
- 实现 issue 评论和生命周期守卫
- 实现审批表和聘用/战略工作流程

## 里程碑 3：心跳和 Adapter 运行时

- 实现 adapter 接口
- 发布具有取消语义的 `process` adapter
- 发布具有超时/错误处理的 `http` adapter
- 持久化心跳运行和状态

## 里程碑 4：成本和预算控制

- 实现成本事件摄取
- 实现月度汇总和仪表板
- 执行硬限制自动暂停

## 里程碑 5：董事会 UI 完成

- 添加公司选择器和组织图视图
- 添加审批和成本页面

## 里程碑 6：加固和发布

- 完整集成/e2e 套件
- 用于本地测试的种子/演示公司模板
- 发布清单和文档更新

## 19. 验收标准（发布门控）

只有当所有标准都为真时，V1 才算完成：

1. 董事会用户可以创建多个公司并在其间切换。
2. 公司可以运行至少一个启用心跳的 active agent。
3. 任务检出是冲突安全的，并发声明时返回 `409`。
4. Agents 可以仅使用 API 密钥更新任务/评论和报告成本。
5. 董事会可以在 UI 中批准/拒绝聘用和 CEO 战略请求。
6. 预算硬限制自动暂停 agent 并阻止新调用。
7. Dashboard 显示来活跃 DB 数据的准确计数/支出。
8. 每个变更操作都可 在活动日志中审计。
9. 应用默认使用嵌入式 PostgreSQL 运行，通过 `DATABASE_URL` 使用外部 Postgres。

## 20. V1 后待办列表（明确推迟）

- 插件架构
- 每个团队更丰富的 workflow 状态自定义
- 超出 V1 最低要求的里程碑/标签/依赖图深度
- 实时传输优化（SSE/WebSockets）
- 公共模板市场集成（ClipHub）

## 21. 公司可移植性包（V1 附录）

V1 支持使用可移植包契约进行公司导入/导出：

- 以 `COMPANY.md` 为根的 markdown 优先包
- 通过约定进行隐式文件夹发现
- 用于 Paperclip 特定保真度的 `.paperclip.yaml` 侧载
- 规范基础包是 vendor 中立的，与 `docs/companies/companies-spec.md` 对齐
- 常见约定：
  - `agents/<slug>/AGENTS.md`
  - `teams/<slug>/TEAM.md`
  - `projects/<slug>/PROJECT.md`
  - `projects/<slug>/tasks/<slug>/TASK.md`
  - `tasks/<slug>/TASK.md`
  - `skills/<slug>/SKILL.md`

V1 中的导出/导入行为：

- 导出发出干净的 vendor 中立 markdown 包加上 `.paperclip.yaml`
- 项目和初始任务是可选的导出内容，而非默认包内容
- 重复的 `TASK.md` 条目在基础包中使用 `recurring: true`，在 `.paperclip.yaml` 中使用 Paperclip 例程保真度
- Paperclip 将重复任务包导入为例程，而不是将其降级为一次性 issues
- 导出剥离环境特定路径（`cwd`、本地指令文件路径、内联 prompt 重复），同时保留可移植的项目 repo/workspace 元数据，例如 `repoUrl`、refs 和在 `.paperclip.yaml` 中键入的 workspace-policy 引用
- 导出从不包含 secret 值；env 输入作为可移植声明报告
- 导入支持目标模式：
  - 创建新公司
  - 导入到现有公司
- 导入重新创建导出的项目 workspace，并将可移植 workspace 密钥重新映射到目标本地 workspace id
- 导入强制关闭导入的 agent 计时器心跳，这样包永远不会隐式启动计划运行
- 导入支持冲突策略：`rename`、`skip`、`replace`
- 导入支持在应用前预览（dry-run）
- GitHub 导入对未固定 refs 发出警告，而不是阻止

（文件结束 - 共 879 行）
