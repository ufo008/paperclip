# packages/shared 开发指南

本文档为在 `packages/shared/` 目录工作的贡献者提供指导。

## 1. 概述

`packages/shared/` 是 Paperclip 的共享类型与契约定义包。它被 `server`、`ui` 和其他包共同依赖，是整个系统的核心契约层。

### 目录结构

```
packages/shared/src/
├── api.ts                    # API 路径常量（API_PREFIX, API 对象）
├── constants.ts              # 领域枚举常量（状态、类型、角色等）
├── config-schema.ts          # Paperclip 配置的 Zod 验证 schema
├── adapter-type.ts          # Agent 适配器类型定义
├── agent-url-key.ts          # Agent URL key 生成与验证工具
├── project-url-key.ts        # Project URL key 生成与验证工具
├── project-mentions.ts       # @提及解析工具（Agent、Project、Skill）
├── routine-variables.ts      # Routine 变量模板插值工具
├── execution-workspace-guards.ts  # 执行工作区守卫函数
├── telemetry/                # 遥测相关类型与客户端
│   ├── types.ts
│   ├── events.ts
│   ├── state.ts
│   ├── config.ts
│   ├── client.ts
│   └── index.ts
├── types/                    # 领域实体 TypeScript 类型定义
│   ├── index.ts              # 主入口，导出所有类型
│   ├── agent.ts
│   ├── company.ts
│   ├── project.ts
│   ├── issue.ts
│   ├── goal.ts
│   ├── budget.ts
│   ├── cost.ts
│   ├── finance.ts
│   ├── approval.ts
│   ├── routine.ts
│   ├── heartbeat.ts
│   ├── live.ts
│   ├── access.ts
│   ├── activity.ts
│   ├── dashboard.ts
│   ├── instance.ts
│   ├── plugin.ts
│   ├── secrets.ts
│   ├── asset.ts
│   ├── feedback.ts
│   ├── company-skill.ts
│   ├── company-portability.ts
│   ├── adapter-skills.ts
│   ├── inbox-dismissal.ts
│   ├── quota.ts
│   ├── sidebar-badges.ts
│   ├── work-product.ts
│   ├── workspace-runtime.ts
│   └── workspace-operation.ts
└── validators/               # Zod 验证 schema（用于 API 请求/响应校验）
    ├── index.ts              # 主入口，导出所有 schema
    ├── agent.ts
    ├── company.ts
    ├── project.ts
    ├── issue.ts
    ├── goal.ts
    ├── budget.ts
    ├── cost.ts
    ├── finance.ts
    ├── approval.ts
    ├── routine.ts
    ├── secret.ts
    ├── asset.ts
    ├── feedback.ts
    ├── access.ts
    ├── plugin.ts
    ├── instance.ts
    ├── company-skill.ts
    ├── company-portability.ts
    ├── adapter-skills.ts
    ├── execution-workspace.ts
    ├── work-product.ts
    └── json-schema.ts
```

## 2. 类型定义（types/）

### 命名规范

- **接口类型**：使用 `type` 关键字定义别名（如 `type Company = { ... }`）
- **导出格式**：`export type { TypeName } from "./types/xxx.js"`
- **源头类型**：`index.ts` 汇总导出所有类型

### 类型分组

按领域实体分组到独立文件：

| 文件 | 内容 |
|------|------|
| `agent.ts` | Agent、AgentConfig、AgentKey、AgentPermissions 等 |
| `company.ts` | Company、CompanyMembership 等 |
| `project.ts` | Project、ProjectWorkspace、ProjectGoalRef 等 |
| `issue.ts` | Issue、IssueComment、IssueExecutionState 等 |
| `goal.ts` | Goal 及其关联类型 |
| `budget.ts` | BudgetPolicy、BudgetIncident 等 |
| `cost.ts` | CostEvent、CostSummary 等 |
| `routine.ts` | Routine、RoutineTrigger、RoutineRun 等 |
| `plugin.ts` | PluginManifest、PluginConfig、PluginState 等 |
| `feedback.ts` | FeedbackVote、FeedbackTrace 等 |

### 类型设计原则

1. **公司作用域**：所有实体类型必须包含 `companyId` 字段或等效的公司标识
2. **时间戳**：使用 `createdAt`、`updatedAt` 标准时间戳字段
3. **联合类型**：使用 `as const` 断言定义枚举联合类型
4. **可选链**：谨慎使用可选字段，避免过度嵌套

## 3. 常量定义（constants.ts）

### 命名规范

- **常量数组**：`CONSTANT_NAME = [...] as const`
- **类型推断**：`type ConstantName = (typeof CONSTANT_NAME)[number]`
- **映射对象**：`CONSTANT_LABELS: Record<ConstantKey, string>`

### 常见常量类别

| 前缀 | 用途 |
|------|------|
| `COMPANY_` | 公司相关状态 |
| `AGENT_` | Agent 状态、角色、适配器类型、图标名称 |
| `ISSUE_` | Issue 状态、优先级、执行策略 |
| `GOAL_` | Goal 级别、状态 |
| `PROJECT_` | Project 状态、颜色 |
| `ROUTINE_` | Routine 状态、触发器类型、变量类型 |
| `BUDGET_` | 预算范围类型、指标、窗口类型、阈值类型 |
| `FINANCE_` | 财务事件类型、方向、计量单位 |
| `APPROVAL_` | 审批类型、状态 |
| `PLUGIN_` | 插件 API 版本、状态、类别、能力 |

### 关键常量示例

```typescript
// 状态枚举
export const AGENT_STATUSES = ["active", "paused", "idle", "running", "error"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

// 角色标签映射
export const AGENT_ROLE_LABELS: Record<AgentRole, string> = {
  ceo: "CEO",
  engineer: "Engineer",
  // ...
};
```

## 4. 验证器（validators/）

### 框架

使用 **Zod** 进行运行时验证。所有 schema 均导出给 server 和 ui 层使用。

### 命名规范

- **Schema 变量**：`camelCase + Schema`（如 `createAgentSchema`）
- **类型导出**：`type CreateAgent = z.infer<typeof createAgentSchema>`
- **复合 schema**：使用 `extend` 或 `merge` 组合现有 schema

### Schema 组织

每个领域实体对应一个 validator 文件：

```typescript
// validators/agent.ts
export const createAgentSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(255),
  role: agentRoleSchema,
  adapterType: agentAdapterTypeSchema,
  // ...
});

export type CreateAgent = z.infer<typeof createAgentSchema>;
```

### 验证分层

| 层级 | 工具 | 位置 |
|------|------|------|
| Schema 验证 | Zod | `packages/shared/validators/` |
| 业务规则验证 | server services | `server/src/services/` |
| 数据库约束 | Drizzle | `packages/db/src/schema/` |

## 5. API 路径（api.ts）

### 常量结构

```typescript
export const API_PREFIX = "/api";

export const API = {
  health: `${API_PREFIX}/health`,
  companies: `${API_PREFIX}/companies`,
  agents: `${API_PREFIX}/agents`,
  projects: `${API_PREFIX}/projects`,
  issues: `${API_PREFIX}/issues`,
  goals: `${API_PREFIX}/goals`,
  // ...
} as const;
```

### 添加新 API 路径

1. 在 `api.ts` 的 `API` 对象中添加新条目
2. 使用 `as const` 确保字面量类型
3. 路径格式：`${API_PREFIX}/{resource}`

## 6. 配置 Schema（config-schema.ts）

### 用途

定义 Paperclip 配置文件（`paperclip.json`）的结构，用于：

- 配置文件验证
- 配置编辑器 UI 生成
- 默认值推导

### Schema 类别

| Schema | 用途 |
|--------|------|
| `paperclipConfigSchema` | 根配置对象 |
| `llmConfigSchema` | LLM 提供商配置 |
| `databaseConfigSchema` | 数据库连接配置 |
| `authConfigSchema` | 认证配置 |
| `secretsConfigSchema` | 密钥 provider 配置 |
| `storageConfigSchema` | 存储 provider 配置 |
| `telemetryConfigSchema` | 遥测配置 |

## 7. 工具函数

### URL Key 生成器

```typescript
// agent-url-key.ts
export const deriveAgentUrlKey = (agentId: string): string => { ... };
export const normalizeAgentUrlKey = (key: string): string => { ... };
export const isUuidLike = (s: string): boolean => { ... };

// project-url-key.ts
export const deriveProjectUrlKey = (projectId: string): string => { ... };
export const normalizeProjectUrlKey = (key: string): string => { ... };
```

### @提及解析

```typescript
// project-mentions.ts
export const extractAgentMentionIds = (text: string): string[] => { ... };
export const buildAgentMentionHref = (agentId: string): string => { ... };
export const parseAgentMentionHref = (href: string): ParsedAgentMention | null => { ... };
```

### Routine 变量插值

```typescript
// routine-variables.ts
export const interpolateRoutineTemplate = (
  template: string,
  variables: Record<string, string>
): string => { ... };
export const extractRoutineVariableNames = (template: string): string[] => { ... };
```

## 8. 变更契约同步

当修改 `packages/shared` 中的定义时，必须同步更新以下层：

```
packages/shared/
    │
    ├── types/          → packages/db (如果涉及数据库模型)
    │                   → server (API 响应类型)
    │                   → ui (API 客户端类型)
    │
    ├── constants/      → server (路由权限检查)
    │                   → ui (下拉选项、状态展示)
    │
    ├── validators/     → server (请求验证中间件)
    │                   → ui (表单验证)
    │
    └── api.ts          → ui (API 客户端函数)
```

### 同步检查清单

- [ ] 类型变更是否影响 DB schema？
- [ ] 常量新增是否需要 UI 下拉选项更新？
- [ ] Validator 变更是否需要 API 路由同步更新？
- [ ] API 路径变更是否需要 UI API 客户端更新？

## 9. 导入与导出

### 模块格式

所有导入使用 `.js` 后缀（ESM 规范）：

```typescript
// ✅ 正确
import { API_PREFIX } from "./api.js";
import type { Agent } from "./types/agent.js";

// ❌ 错误
import { API_PREFIX } from "./api";
```

### 主入口导出

`src/index.ts` 汇总导出所有公开 API：

```typescript
export { API_PREFIX, API } from "./api.js";
export type { Company, Agent, Issue } from "./types/index.js";
export { createAgentSchema } from "./validators/index.js";
```

## 10. 注意事项

### 类型与常量的一致性

每当添加新的状态常量，确保：

1. 常量数组使用 `as const` 断言
2. 对应类型使用 `(typeof CONSTANT)[number]` 推断
3. 在 `src/index.ts` 中同时导出常量和类型

### 避免循环依赖

`packages/shared` 是纯契约定义包，不应依赖：

- `server/` 的业务逻辑
- `ui/` 的组件
- `packages/db` 的 ORM 客户端

### Schema 的演化

- 使用 Zod 的 `.optional()` 而非 `?` 可选字段
- 使用 `.nullable()` 明确表达可以为 null
- 版本化 API 响应类型，避免破坏性变更

### 遥测事件（telemetry/）

- 事件类型定义在 `telemetry/events.ts`
- 使用 `telemetry/client.ts` 中的客户端记录事件
- 不要在 shared 包中直接引入外部遥测 SDK
