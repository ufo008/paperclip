# Agent Runs 子系统规格

状态：草稿
日期：2026-02-17
受众：产品 + 工程
范围：Agent 执行运行时、适配器协议、唤醒编排和实时状态推送

## 1. 文档角色

本规格定义了 Paperclip 如何在保持运行时无关性的同时实际运行 agents。

- `doc/SPEC-implementation.md` 保持为 V1 基线契约。
- 本文档为 agent 执行添加了具体的子系统细节，包括本地 CLI 适配器、运行时状态持久化、唤醒调度和浏览器实时更新。
- 如果本文档与代码中的当前运行时行为冲突，本文是即将实施的目标行为。

## 2. 捕获的意图（来自请求）

以下意图在本文档中明确保留：

1. Paperclip 是适配器无关的。关键是协议，而非特定运行时。
2. 我们仍然需要默认的内置适配器来使系统立即可用。
3. 前两个内置适配器是 `claude-local` 和 `codex-local`。
4. 这些适配器直接在宿主机上运行本地 CLI，不沙箱化。
5. Agent 配置包括工作目录和初始/默认提示词。
6. 心跳运行配置的适配器进程，Paperclip 管理生命周期，退出时 Paperclip 解析 JSON 输出并更新状态。
7. Session ID 和 token 使用量必须持久化，以便后续心跳可以恢复。
8. 适配器应支持状态更新（短消息 + 颜色）和可选的日志流。
9. UI 应支持提示词模板"药丸"以便变量插入。
10. CLI 错误必须在 UI 中完整显示（或尽可能多）。
11. 状态变更必须通过服务器推送在任务和 agent 视图间实时更新。
12. 唤醒触发器应由心跳/唤醒服务集中管理，至少包括：
    - 定时器间隔
    - 任务分配时唤醒
    - 显式 ping/请求

## 3. 目标和非目标

### 3.1 目标

1. 定义支持多种运行时的稳定适配器协议。
2. 为 Claude CLI 和 Codex CLI 提供可投入生产的本地适配器。
3. 持久化适配器运行时状态（session ID、token/成本使用量、上次错误）。
4. 在一个服务中集中化唤醒决策和排队。
5. 向浏览器提供实时的 run/task/agent 更新。
6. 支持部署特定的全日志存储而不膨胀 Postgres。
7. 保留公司作用域和现有治理不变式。

### 3.2 非目标（此子系统阶段）

1. 跨多台主机的分布式执行工作线程。
2. 第三方适配器市场/插件 SDK。
3. 对不发出成本的提供商进行精确成本计算。
4. 超出基本保留的长期日志归档策略。

## 4. 基线和差距（截至 2026-02-17）

当前代码已有：

- 具有 `adapterType` + `adapterConfig` 的 `agents`。
- 具有基本状态跟踪的 `heartbeat_runs`。
- 调用 `process` 和 `http` 的进程内 `heartbeatService`。
- 取消活动 runs 的端点。

本文档解决的主要差距：

1. 没有用于 session 恢复的持久化 per-agent 运行时状态。
2. 没有队列/唤醒抽象（调用是即时的）。
3. 没有基于分配或定时器触发的集中化唤醒。
4. 没有到浏览器的 websocket/SSE 推送路径。
5. 没有持久化的 run 事件时间线或外部全日志存储契约。
6. 没有用于 Claude/Codex session 和使用量提取的类型化本地适配器契约。
7. 没有 agent 设置中的提示词模板变量/药丸系统。
8. 没有用于全 run 日志存储的部署感知适配器（磁盘/对象存储等）。

## 5. 架构概述

子系统引入了六个协作组件：

1. `Adapter Registry`
   - 将 `adapter_type` 映射到实现。
   - 暴露能力元数据和配置验证。

2. `Wakeup Coordinator`
   - 所有唤醒的单一入口点（`timer`、`assignment`、`on_demand`、`automation`）。
   - 应用去重/合并和队列规则。

3. `Run Executor`
   - 认领排队的唤醒。
   - 创建 `heartbeat_runs`。
   - 为本地适配器生成/监控子进程。
   - 处理超时/取消/优雅终止。

4. `Runtime State Store`
   - 持久化每个 agent 的可恢复适配器状态。
   - 持久化 run 使用摘要和轻量级 run 事件时间线。

5. `Run Log Store`
   - 通过可插拔存储适配器持久化完整的 stdout/stderr 流。
   - 返回稳定的 `logRef` 用于检索（本地路径、对象键或数据库引用）。

6. `Realtime Event Hub`
   - 通过 websocket 发布 run/agent/task 更新。
   - 支持按公司的选择性订阅。

控制流（正常路径）：

1. 触发器到达（`timer`、`assignment`、`on_demand` 或 `automation`）。
2. Wakeup coordinator 将唤醒请求加入队列/合并。
3. Executor 认领请求，创建 run 行，将 agent 标记为 `running`。
4. 适配器执行，发送状态/日志/使用量事件。
5. 全日志流式传输到 `RunLogStore`；元数据/事件持久化到数据库并推送到 websocket 订阅者。
6. 进程退出，输出解析器更新 run 结果 + 运行时状态。
7. Agent 返回 `idle` 或 `error`；UI 实时更新。

## 6. Agent Run 协议（版本 `agent-run/v1`）

此协议是运行时无关的，由所有适配器实现。

```ts
type RunOutcome = "succeeded" | "failed" | "cancelled" | "timed_out";
type StatusColor = "neutral" | "blue" | "green" | "yellow" | "red";

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  cachedOutputTokens?: number;
}

interface AdapterInvokeInput {
  protocolVersion: "agent-run/v1";
  companyId: string;
  agentId: string;
  runId: string;
  wakeupSource: "timer" | "assignment" | "on_demand" | "automation";
  triggerDetail?: "manual" | "ping" | "callback" | "system";
  cwd: string;
  prompt: string;
  adapterConfig: Record<string, unknown>;
  runtimeState: Record<string, unknown>;
  env: Record<string, string>;
  timeoutSec: number;
}

interface AdapterHooks {
  status?: (update: { message: string; color?: StatusColor }) => Promise<void>;
  log?: (event: { stream: "stdout" | "stderr" | "system"; chunk: string }) => Promise<void>;
  usage?: (usage: TokenUsage) => Promise<void>;
  event?: (eventType: string, payload: Record<string, unknown>) => Promise<void>;
}

interface AdapterInvokeResult {
  outcome: RunOutcome;
  exitCode: number | null;
  errorMessage?: string | null;
  summary?: string | null;
  sessionId?: string | null;
  usage?: TokenUsage | null;
  provider?: string | null;
  model?: string | null;
  costUsd?: number | null;
  runtimeStatePatch?: Record<string, unknown>;
  rawResult?: Record<string, unknown> | null;
}

interface AgentRunAdapter {
  type: string;
  protocolVersion: "agent-run/v1";
  capabilities: {
    resumableSession: boolean;
    statusUpdates: boolean;
    logStreaming: boolean;
    tokenUsage: boolean;
  };
  validateConfig(config: unknown): { ok: true } | { ok: false; errors: string[] };
  invoke(input: AdapterInvokeInput, hooks: AdapterHooks, signal: AbortSignal): Promise<AdapterInvokeResult>;
}
```

### 6.1 必需行为

1. `validateConfig` 在保存或调用之前运行。
2. 对于给定的 config + 运行时状态 + 提示词，`invoke` 必须是确定性的。
3. 适配器不能直接修改数据库；只能通过结果/事件返回数据。
4. 适配器必须发出足够的上下文以便调试错误。
5. 如果 `invoke` 抛出，executor 将 run 记录为 `failed`，并附带捕获的错误文本。

### 6.2 可选行为

适配器可以省略状态/日志钩子。如果省略，运行时仍然发出系统生命周期状态（`queued`、`running`、`finished`）。

### 6.3 Run 日志存储协议

完整的 run 日志由单独的可插拔存储管理（不由 agent 适配器管理）。

```ts
type RunLogStoreType = "local_file" | "object_store" | "postgres";

interface RunLogHandle {
  store: RunLogStoreType;
  logRef: string; // opaque provider reference (path, key, uri, row id)
}

interface RunLogStore {
  begin(input: { companyId: string; agentId: string; runId: string }): Promise<RunLogHandle>;
  append(
    handle: RunLogHandle,
    event: { stream: "stdout" | "stderr" | "system"; chunk: string; ts: string },
  ): Promise<void>;
  finalize(
    handle: RunLogHandle,
    summary: { bytes: number; sha256?: string; compressed: boolean },
  ): Promise<void>;
  read(
    handle: RunLogHandle,
    opts?: { offset?: number; limitBytes?: number },
  ): Promise<{ content: string; nextOffset?: number }>;
  delete?(handle: RunLogHandle): Promise<void>;
}
```

V1 部署默认值：

1. 开发/本地默认：`local_file`（写入 `data/run-logs/...`）。
2. 云/无服务器默认：`object_store`（S3/R2/GCS 兼容）。
3. 可选回退：`postgres`，有严格的大小限制。

### 6.4 适配器身份和兼容性

对于 V1 推出，适配器身份是明确的：

- `claude_local`
- `codex_local`
- `process`（通用现有行为）
- `http`（通用现有行为）

`claude_local` 和 `codex_local` 不是任意 `process` 的包装器；它们是具有已知解析器/恢复语义的类型化适配器。

## 7. 内置适配器（第一阶段）

## 7.1 `claude-local`

直接在本地运行 `claude` CLI。

### 配置

```json
{
  "cwd": "/absolute/or/relative/path",
  "promptTemplate": "You are agent {{agent.id}} ...",
  "model": "optional-model-id",
  "maxTurnsPerRun": 1000,
  "dangerouslySkipPermissions": true,
  "env": {"KEY": "VALUE"},
  "extraArgs": [],
  "timeoutSec": 1800,
  "graceSec": 20
}
```

### 调用

- 基础命令：`claude --print <prompt> --output-format json`
- 恢复：当运行时状态有 session ID 时，添加 `--resume <sessionId>`
- 非沙箱模式：启用时添加 `--dangerously-skip-permissions`

### 输出解析

1. 解析 stdout JSON 对象。
2. 提取 `session_id` 用于恢复。
3. 提取使用量字段：
   - `usage.input_tokens`
   - `usage.cache_read_input_tokens`（如果存在）
   - `usage.output_tokens`
4. 提取 `total_cost_usd`（如果存在）。
5. 非零退出时：仍然尝试解析；如果解析成功则保留提取的状态，并将 run 标记为失败，除非适配器明确报告成功。

## 7.2 `codex-local`

直接在本地运行 `codex` CLI。

### 配置

```json
{
  "cwd": "/absolute/or/relative/path",
  "promptTemplate": "You are agent {{agent.id}} ...",
  "model": "optional-model-id",
  "search": false,
  "dangerouslyBypassApprovalsAndSandbox": true,
  "env": {"KEY": "VALUE"},
  "extraArgs": [],
  "timeoutSec": 1800,
  "graceSec": 20
}
```

### 调用

- 基础命令：`codex exec --json <prompt>`
- 恢复形式：`codex exec --json resume <sessionId> <prompt>`
- 非沙箱模式：启用时添加 `--dangerously-bypass-approvals-and-sandbox`
- 可选搜索模式：添加 `--search`

### 输出解析

Codex 发出 JSONL 事件。逐行解析并提取：

1. `thread.started.thread_id` -> session ID
2. `item.completed`，其中 item 类型为 `agent_message` -> 输出文本
3. `turn.completed.usage`：
   - `input_tokens`
   - `cached_input_tokens`
   - `output_tokens`

Codex JSONL 当前可能不包含成本；存储 token 使用量并将成本保留为 null/unknown（除非可用）。

## 7.3 通用本地适配器进程处理

两个本地适配器都必须：

1. 使用 `spawn(command, args, { shell: false, stdio: "pipe" })`。
2. 按流块捕获 stdout/stderr 并转发到 `RunLogStore`。
3. 在内存中维护滚动的 stdout/stderr 尾部摘录，用于数据库诊断字段。
4. 向 websocket 订阅者发出实时日志事件（可选节流/分块）。
5. 支持优雅取消：`SIGTERM`，然后在 `graceSec` 后 `SIGKILL`。
6. 使用适配器 `timeoutSec` 强制超时。
7. 返回退出码 + 解析结果 + 诊断 stderr。

## 8. 心跳和 Wakeup Coordinator

## 8.1 唤醒源

支持的源：

1. `timer`：每个 agent 的周期性心跳。
2. `assignment`：分配/重新分配给 agent 的 issue。
3. `on_demand`：显式唤醒请求路径（board/手动点击或 API ping）。
4. `automation`：非交互式唤醒路径（外部回调或内部系统自动化）。

## 8.2 中心 API

所有源调用一个内部服务：

```ts
enqueueWakeup({
  companyId,
  agentId,
  source,
  triggerDetail, // optional: manual|ping|callback|system
  reason,
  payload,
  requestedBy,
  idempotencyKey?
})
```

没有源直接调用适配器。

## 8.3 队列语义

1. 每个 agent 的最大活动 run 保持为 `1`。
2. 如果 agent 已有 `queued`/`running` run：
   - 合并重复的唤醒
   - 增加 `coalescedCount`
   - 保留最新的 reason/source 元数据
3. 队列为数据库支持以确保重启安全。
4. Coordinator 使用 FIFO（按 `requested_at`），具有可选优先级：
   - `on_demand` > `assignment` > `timer`/`automation`

## 8.4 Agent 心跳策略字段

Agent 级控制平面设置（不是适配器特定的）：

```json
{
  "heartbeat": {
    "enabled": true,
    "intervalSec": 300,
    "wakeOnAssignment": true,
    "wakeOnOnDemand": true,
    "wakeOnAutomation": true,
    "cooldownSec": 10
  }
}
```

默认值：

- `enabled: true`
- `intervalSec: null`（明确设置前无定时器）或如果需要全局默认则为 `300`
- `wakeOnAssignment: true`
- `wakeOnOnDemand: true`
- `wakeOnAutomation: true`

## 8.5 触发器集成规则

1. 定时器在服务器工作线程间隔检查并对到期 agent 入队。
2. Issue 分配变更在 assignee 变更时入队唤醒，当目标 agent 的 `wakeOnAssignment=true` 时。
3. 按需端点在 `wakeOnOnDemand=true` 时，用 `source=on_demand` 和 `triggerDetail=manual|ping` 入队唤醒。
4. 回调/系统自动化在 `wakeOnAutomation=true` 时，用 `source=automation` 和 `triggerDetail=callback|system` 入队唤醒。
5. 已暂停/终止的 agent 不会收到新唤醒。
6. 硬预算停止的 agent 不会收到新唤醒。

## 9. 持久化模型

所有表保持公司作用域。

## 9.0 `agents` 表的变更

1. 扩展 `adapter_type` 域以包含 `claude_local` 和 `codex_local`（与现有的 `process`、`http` 并列）。
2. 保持 `adapter_config` 为适配器拥有的配置（CLI 标志、cwd、提示词模板、环境覆盖）。
3. 添加 `runtime_config` jsonb 用于控制平面调度策略：
   - 心跳启用/间隔
   - 分配时唤醒
   - 按需唤醒
   - 自动化时唤醒
   - 冷却时间

此分离使适配器配置与运行时无关，同时允许心跳服务应用一致的调度逻辑。

## 9.1 新表：`agent_runtime_state`

每个 agent 一行，用于聚合运行时计数器和遗留兼容性。

- `agent_id` uuid pk fk `agents.id`
- `company_id` uuid fk not null
- `adapter_type` text not null
- `session_id` text null
- `state_json` jsonb not null default `{}`
- `last_run_id` uuid fk `heartbeat_runs.id` null
- `last_run_status` text null
- `total_input_tokens` bigint not null default `0`
- `total_output_tokens` bigint not null default `0`
- `total_cached_input_tokens` bigint not null default `0`
- `total_cost_cents` bigint not null default `0`
- `last_error` text null
- `updated_at` timestamptz not null

不变式：每个 agent 恰好有一行运行时状态。

## 9.1.1 新表：`agent_task_sessions`

每个 `(company_id, agent_id, adapter_type, task_key)` 一行，用于可恢复的 session 状态。

- `id` uuid pk
- `company_id` uuid fk not null
- `agent_id` uuid fk not null
- `adapter_type` text not null
- `task_key` text not null
- `session_params_json` jsonb null（适配器定义的形状）
- `session_display_id` text null（用于 UI/调试）
- `last_run_id` uuid fk `heartbeat_runs.id` null
- `last_error` text null
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

不变式：唯一 `(company_id, agent_id, adapter_type, task_key)`。

## 9.2 新表：`agent_wakeup_requests`

唤醒的队列 + 审计。

- `id` uuid pk
- `company_id` uuid fk not null
- `agent_id` uuid fk not null
- `source` text not null（`timer|assignment|on_demand|automation`）
- `trigger_detail` text null（`manual|ping|callback|system`）
- `reason` text null
- `payload` jsonb null
- `status` text not null（`queued|claimed|coalesced|skipped|completed|failed|cancelled`）
- `coalesced_count` int not null default `0`
- `requested_by_actor_type` text null（`user|agent|system`）
- `requested_by_actor_id` text null
- `idempotency_key` text null
- `run_id` uuid fk `heartbeat_runs.id` null
- `requested_at` timestamptz not null
- `claimed_at` timestamptz null
- `finished_at` timestamptz null
- `error` text null

## 9.3 新表：`heartbeat_run_events`

每个 run 的仅追加轻量级事件时间线（无完整的原始日志块）。

- `id` bigserial pk
- `company_id` uuid fk not null
- `run_id` uuid fk `heartbeat_runs.id` not null
- `agent_id` uuid fk `agents.id` not null
- `seq` int not null
- `event_type` text not null（`lifecycle|status|usage|error|structured`）
- `stream` text null（`system|stdout|stderr`）（仅摘要事件，非完整流块）
- `level` text null（`info|warn|error`）
- `color` text null
- `message` text null
- `payload` jsonb null
- `created_at` timestamptz not null

## 9.4 `heartbeat_runs` 表的变更

添加结果和诊断所需的字段：

- `wakeup_request_id` uuid fk `agent_wakeup_requests.id` null
- `exit_code` int null
- `signal` text null
- `usage_json` jsonb null
- `result_json` jsonb null
- `session_id_before` text null
- `session_id_after` text null
- `log_store` text null（`local_file|object_store|postgres`）
- `log_ref` text null（不透明 provider 引用；path/key/uri/row id）
- `log_bytes` bigint null
- `log_sha256` text null
- `log_compressed` boolean not null default false
- `stderr_excerpt` text null
- `stdout_excerpt` text null
- `error_code` text null

这使 per-run 诊断可查询，而无需将完整日志存储在 Postgres 中。

## 9.5 日志存储适配器配置

运行时日志存储是部署配置的（默认不是 per-agent）。

```json
{
  "runLogStore": {
    "type": "local_file | object_store | postgres",
    "basePath": "./data/run-logs",
    "bucket": "paperclip-run-logs",
    "prefix": "runs/",
    "compress": true,
    "maxInlineExcerptBytes": 32768
  }
}
```

规则：

1. `log_ref` 在 API 边界必须是抽象的且 provider 中立的。
2. UI/API 不能假设本地文件系统语义。
3. Provider 特定的 secrets/credentials 保存在服务器配置中，绝不在 agent 配置中。

## 10. 提示词模板和药丸系统

## 10.1 模板格式

- Mustache 风格占位符：`{{path.to.value}}`
- 无任意代码执行。
- 保存时未知变量 = 验证错误。

## 10.2 初始变量目录

- `company.id`
- `company.name`
- `agent.id`
- `agent.name`
- `agent.role`
- `agent.title`
- `run.id`
- `run.source`
- `run.startedAt`
- `heartbeat.reason`
- `paperclip.skill`（共享 Paperclip skill 文本块）
- `credentials.apiBaseUrl`
- `credentials.apiKey`（可选，敏感）

## 10.3 提示词字段

1. `promptTemplate`
   - 每次唤醒时使用（首次运行和恢复的运行）。
   - 可以包含 run source/reason 药丸。

## 10.4 UI 要求

1. Agent 设置/编辑表单包含带药丸插入的提示词编辑器。
2. 变量显示为可点击的药丸以便快速插入。
3. 保存时验证指示未知/缺失的变量。
4. 敏感药丸（`credentials.*`）显示明确的警告徽章。

## 10.5 凭证安全注意事项

1. 为简化初期，允许在提示词中使用凭证，但不鼓励。
2. 首选传输是在运行时注入的环境变量（`PAPERCLIP_*`）。
3. 提示词预览和日志必须编辑敏感值。

## 11. 实时状态推送

## 11.1 传输

主要传输：每个公司一个 websocket 通道。

- 端点：`GET /api/companies/:companyId/events/ws`
- 认证：board session 或 agent API key（公司绑定）

## 11.2 事件信封

```json
{
  "eventId": "uuid-or-monotonic-id",
  "companyId": "uuid",
  "type": "heartbeat.run.status",
  "entityType": "heartbeat_run",
  "entityId": "uuid",
  "occurredAt": "2026-02-17T12:00:00Z",
  "payload": {}
}
```

## 11.3 必需的事件类型

1. `agent.status.changed`
2. `heartbeat.run.queued`
3. `heartbeat.run.started`
4. `heartbeat.run.status`（简短颜色+消息更新）
5. `heartbeat.run.log`（可选的实时块流；完整持久化由 `RunLogStore` 处理）
6. `heartbeat.run.finished`
7. `issue.updated`
8. `issue.comment.created`
9. `activity.appended`

## 11.4 UI 行为

1. Agent 详情视图实时更新 run 时间线。
2. 任务板反映来自 agent 活动的分配/状态/评论变更，无需刷新。
3. 组织/agent 列表实时反映状态变更。
4. 如果 websocket 断开连接，客户端回退到短轮询直到重新连接。

## 12. 错误处理和诊断

## 12.1 错误类

- `adapter_not_installed`
- `invalid_working_directory`
- `spawn_failed`
- `timeout`
- `cancelled`
- `nonzero_exit`
- `output_parse_error`
- `resume_session_invalid`
- `budget_blocked`

## 12.2 日志要求

1. 将完整的 stdout/stderr 流持久化到配置的 `RunLogStore`。
2. 仅将轻量级 run 元数据/事件持久化到 Postgres（`heartbeat_runs`、`heartbeat_run_events`）。
3. 在 Postgres 中持久化有限的 `stdout_excerpt` 和 `stderr_excerpt` 用于快速诊断。
4. 明确标记摘录被截断的情况。
5. 从日志、摘录和 websocket 载荷中编辑 secrets。

## 12.3 日志保留和生命周期

1. `RunLogStore` 保留期由部署配置（例如 7/30/90 天）。
2. Postgres run 元数据可以比完整日志对象存活更久。
3. 删除/清理任务必须安全处理孤立的元数据/日志对象引用。
4. 如果完整日志对象已消失，API 仍然返回元数据和摘录，状态为 `log_unavailable`。

## 12.4 重启恢复

在服务器启动时：

1. 查找过时的 `queued`/`running` runs。
2. 标记为 `failed`，错误码为 `error_code=control_plane_restart`。
3. 将受影响的非暂停/非终止 agent 设置为 `error`（或根据策略设置为 `idle`）。
4. 向 websocket 和活动日志发出恢复事件。

## 13. API 表面变更

## 13.1 新增/更新的端点

1. `POST /agents/:agentId/wakeup`
   - 用 source/reason 入队唤醒
2. `POST /agents/:agentId/heartbeat/invoke`
   - 向后兼容的唤醒 API 别名
3. `GET /agents/:agentId/runtime-state`
   - 仅 board 的调试视图
4. `GET /agents/:agentId/task-sessions`
   - 仅 board 的任务作用域适配器 session 列表
5. `POST /agents/:agentId/runtime-state/reset-session`
   - 清除 agent 的所有任务 session，或在提供 `taskKey` 时清除一个
6. `GET /heartbeat-runs/:runId/events?afterSeq=:n`
   - 获取持久化的轻量级时间线
7. `GET /heartbeat-runs/:runId/log`
   - 通过 `RunLogStore` 读取完整日志流（或为对象存储重定向/预签名 URL）
8. `GET /api/companies/:companyId/events/ws`
   - websocket 流

## 13.2 变更日志

所有唤醒/run 状态变更必须创建 `activity_log` 条目：

- `wakeup.requested`
- `wakeup.coalesced`
- `heartbeat.started`
- `heartbeat.finished`
- `heartbeat.failed`
- `heartbeat.cancelled`
- `runtime_state.updated`

## 14. 心跳服务实施计划

## 第一阶段：契约和 schema

1. 添加新的数据库表/列（`agent_runtime_state`、`agent_wakeup_requests`、`heartbeat_run_events`、`heartbeat_runs.log_*` 字段）。
2. 添加 `RunLogStore` 接口和配置布线。
3. 添加共享类型/常量/验证器。
4. 在迁移期间保持现有路由功能。

## 第二阶段：Wakeup coordinator

1. 实现数据库支持的唤醒队列。
2. 将 invoke/wake 路由转换为用 `source=on_demand` 和适当的 `triggerDetail` 入队。
3. 添加工作循环以认领和执行排队的唤醒。

## 第三阶段：本地适配器

1. 实现 `claude-local` 适配器。
2. 实现 `codex-local` 适配器。
3. 解析并持久化 session ID 和 token 使用量。
4. 连接取消/超时/优雅行为。

## 第四阶段：实时推送

1. 实现公司 websocket hub。
2. 发布 run/agent/issue 事件。
3. 更新 UI 页面以订阅并使/更新相关数据。

## 第五阶段：提示词药丸和配置 UX

1. 添加带提示词模板的适配器特定配置编辑器。
2. 添加药丸插入和变量验证。
3. 添加敏感变量警告和编辑。

## 第六阶段：强化

1. 添加失败/重启恢复扫描。
2. 添加元数据/完整日志保留策略和清理任务。
3. 为唤醒触发器和实时更新添加集成/e2e 覆盖。

## 15. 验收标准

1. 具有 `claude-local` 或 `codex-local` 的 Agent 可以运行、退出并持久化 run 结果。
2. Session 参数按任务作用域持久化，并自动重用于同一任务的恢复。
3. Token 使用量按 run 持久化并累积到 agent 运行时状态。
4. 定时器、分配、按需和自动化唤醒都通过一个 coordinator 入队。
5. 暂停/终止中断正在运行的本地进程并阻止新唤醒。
6. 浏览器接收 run 状态/日志和任务/agent 变更的实时 websocket 更新。
7. 失败的 runs 在 UI 中暴露丰富的 CLI 诊断，摘录立即可用，完整日志可通过 `RunLogStore` 检索。
8. 所有操作保持公司作用域和可审计性。

## 16. 开放问题

1. 定时器默认值应该是 `null`（默认关闭）还是 `300` 秒？
2. 完整日志对象 vs Postgres 元数据的默认保留策略应该是什么？
3. 是否默认允许 agent API 凭证在提示词模板中，还是需要明确的 opt-in 开关？
4. Websocket 是否应该是唯一的实时通道，还是也应该为更简单的客户端暴露 SSE？

（文件结束 — 共 756 行）
