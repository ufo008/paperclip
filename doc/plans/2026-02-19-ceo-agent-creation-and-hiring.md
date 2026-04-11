# CEO Agent Creation and Hiring Governance Plan (V1.1)

状态：提议
日期：2026-02-19
所有者：Product + Server + UI + Skills

## 1. Goal

启用 CEO 代理直接创建新代理，具有轻量级但明确的治理：

- 公司级切换：新员工需要 board 批准（默认开启）。
- 代理级权限：`can_create_agents`（CEO 默认开启，其他所有人默认关闭）。
- 清晰的招聘工作流，在批准前处于草稿/limbo 状态。
- 配置反映，以便招聘代理可以检查可用的适配器配置并比较现有代理配置（包括自身）。
- 带评论、修订请求和审计跟踪的批准协作流程。

## 2. Current State (Repo Reality)

- 代理创建在 `POST /api/companies/:companyId/agents`（`server/src/routes/agents.ts`）仅限 board。
- 批准支持 `pending/approved/rejected/cancelled` 和 `hire_agent` + `approve_ceo_strategy`（`packages/shared/src/constants.ts`，`server/src/services/approvals.ts`）。

## 3. Proposed Implementation

### 3.1 Agent Creation Permission

```ts
interface AgentPermissions {
  canCreateAgents: boolean;
  canModifySelf: boolean;
}
```

### 3.2 Hire Workflow

1. CEO 创建新代理草稿
2. 系统创建待批准请求
3. Board 批准或拒绝
4. 批准后，代理变为活动状态

### 3.3 Config Reflection

```ts
interface AgentConfig {
  id: string;
  name: string;
  adapter: string;
  model?: string;
  permissions: AgentPermissions;
}
```

## 4. Implementation Plan

### Phase 1: Permission Model

1. 添加代理权限数据模型
2. 更新代理创建端点
3. 添加权限检查

### Phase 2: Hire Workflow

1. 添加待批准状态
2. 创建批准流程
3. 添加评论和修订

### Phase 3: UI

1. 添加代理创建 UI
2. 添加批准 UI
3. 添加配置反映 UI
