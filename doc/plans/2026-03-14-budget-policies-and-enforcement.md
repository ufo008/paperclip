# Budget Policies and Enforcement

## Context

Paperclip 已经将预算作为核心控制平面职责：

- `doc/SPEC.md` 赋予 Board 设置预算、暂停代理、暂停工作并覆盖任何预算的权力。
- `doc/SPEC-implementation.md` 表示 V1 必须支持每月 UTC 预算窗口、软警报和硬性自动暂停。
- 当前代码仅部分实现了该意图。

今天系统有狭窄的金钱预算行为：

- 公司跟踪 `budgetMonthlyCents` 和 `spentMonthlyCents`
- 代理跟踪 `budgetMonthlyCents` 和 `spentMonthlyCents`
- `cost_events` 摄入增量增加这些计数器
- 当代理超过其每月预算时，代理被暂停

这留下了主要的产品缺口：

- 没有项目预算模型
- 预算超支时没有生成审批
- 没有通用预算策略系统
- 没有与预算关联的项目暂停语义
- 没有持久的incident跟踪以防止重复警报
- 在可强制执行的支出预算和建议性使用配额之间没有区分

本计划定义了 Paperclip 接下来应该实施的精确预算模型。

## Product Goals

Paperclip 应让操作员：

1. 在代理和项目上设置预算。
2. 理解预算是基于金钱还是使用量。
3. 在预算耗尽之前收到警告。
4. 在硬性预算超支时自动暂停工作。
5. 使用明显的 UI 批准、提高或从预算停止恢复。
6. 在仪表板、`/costs` 和范围详情页上查看预算状态。

系统应该非常清楚一件事：

- 预算是策略控制
- 配额是使用可见性

它们相关，但不是同一概念。

## Product Decisions

### V1 Budget Defaults

对于下一个实施阶段，Paperclip 应执行这些默认值：

- 代理预算是重复的每月预算
- 项目预算是终身总预算
- 硬性停止执行使用账单美元，而不是 token
- 每月窗口使用 UTC 日历月
- 项目总预算不会自动重置

这给了一个清晰的心智模型：

- 代理是持续的工作者，所以每月重复预算是自然的
- 项目是有界限的工作流，所以终身上限是自然的

### Metric To Enforce First

第一个可强制执行的指标应该是 `billed_cents`。

理由：

- 它跨提供商、计费者和模型工作
- 它直接映射到真实财务风险
- 它一致地处理超额和计量使用
- 它避免了跨提供商 token 归一化问题
- 即使未来金融事件不是基于 token，它也能干净地应用

Token 预算不应是第一个硬性停止策略。
它们应该在基于货币的系统稳固后作为建议性使用控制稍后出现。

### Subscription Usage Decision

Paperclip 应将订阅包含的使用量与账单支出分开：

- `subscription_included`
  - 在报告中可见
  - 在使用摘要中可见
  - 不计入金钱预算
- `subscription_overage`
  - 在报告中可见
  - 计入金钱预算
- `metered_api`
  - 在报告中可见
  - 计入金钱预算

这保持预算系统的诚实：

- 用户不应看到"支出"因未产生边际账单成本的使用而上升
- 用户仍应看到 token 使用量和提供商配额状态

### Soft Alert Versus Hard Stop

Paperclip 应有明确的软硬边界：

- 软警报：在预算耗尽前发出警告，不停止工作
- 硬性停止：在预算耗尽时自动暂停工作

两者都应在 V1 中存在。

### Approval On Hard Stop

当硬性停止触发时：

- 系统应生成审批请求
- Board 可以批准额外支出或调整预算
- 代理保持暂停直到审批通过

### Budget Visibility

所有预算状态应在以下位置可见：

- 代理详情页
- 项目详情页
- 公司仪表板
- /costs 页面

## Data Model Changes

### New Tables

#### budget_policies

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| scope_type | text | 'company' | 'project' | 'agent' |
| scope_id | uuid | FK to scoped entity |
| budget_type | text | 'monthly' | 'lifetime' |
| metric | text | 'billed_cents' | 'tokens' |
| limit_value | integer | Budget limit |
| enforcement | text | 'soft' | 'hard' |
| alert_threshold | decimal | Percentage to trigger alert |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update |

#### budget_incidents

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| company_id | uuid | Company FK |
| policy_id | uuid | Budget policy FK |
| trigger_type | text | 'alert' | 'hard_stop' |
| triggered_at | timestamp | When triggered |
| resolved_at | timestamp | When resolved (null if open) |
| resolution | text | 'approved' | 'budget_raised' | 'ignored' |
| resolved_by | uuid | User who resolved |
| notes | text | Resolution notes |

#### budget_events

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| company_id | uuid | Company FK |
| policy_id | uuid | Budget policy FK |
| incident_id | uuid | Budget incident FK (nullable) |
| event_type | text | 'created' | 'updated' | 'triggered' | 'resolved' |
| previous_value | integer | Previous budget value |
| new_value | integer | New budget value |
| created_at | timestamp | Event time |

## Implementation Phases

### Phase 1: Core Budget Model

1. Add budget_policies table
2. Add budget_incidents table
3. Add budget_events table
4. Create BudgetService
5. Implement policy CRUD operations

### Phase 2: Enforcement Engine

1. Add cost event processing for budget checking
2. Implement soft alert triggers
3. Implement hard stop triggers
4. Add incident creation on triggers

### Phase 3: UI Integration

1. Add budget UI to agent detail
2. Add budget UI to project detail
3. Add budget dashboard widget
4. Add approval workflow for hard stops

### Phase 4: Reporting

1. Add budget reports to /costs page
2. Add budget alerts to notifications
3. Add budget history view

## Open Questions

1. Should we support budget rollover?
2. How do we handle mid-month policy changes?
3. Should projects inherit from company budget?
4. How do we handle budget transfers between scopes?
5. What's the interaction with existing agent pause behavior?

## Security Considerations

1. Only Board can create/modify budget policies
2. Budget incidents should be auditable
3. Resolution actions should be logged

## Cost Considerations

1. Budget checking should be cheap
2. incidents should not proliferate unnecessarily
3. Historical data retention policy needed
