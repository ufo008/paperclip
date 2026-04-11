# Paperclip 插件系统规范

状态：已提议 - V1 后插件系统的完整规范

本文档是 Paperclip 插件和扩展架构的完整规范。
它扩展了 [doc/SPEC.md](../SPEC.md) 中的简要插件说明，应与 [doc/plugins/ideas-from-opencode.md](./ideas-from-opencode.md) 中的对比分析一起阅读。

本文档不是 [doc/SPEC-implementation.md](../SPEC-implementation.md) 中 V1 实现契约的一部分。
它是插件系统的完整目标架构，应在 V1 之后实现。

## 当前实现注意事项

该仓库的代码目前包含一个早期插件运行时和管理 UI，但尚未实现本规范中描述的完整部署模型。

目前，实际的部署模型是：

- 单租户
- 自托管
- 单节点或以文件系统持久化的方式

需要注意的当前限制：

- 插件 UI 包目前作为同源 JavaScript 在 Paperclip 主应用内运行。将插件 UI 视为可信代码，而非沙箱化前端能力边界。
- 清单能力目前控制 worker 端的主机 RPC 调用。它们不能阻止插件 UI 代码直接调用普通 Paperclip HTTP API。
- 运行时安装假设插件包目录和插件数据目录具有可写的本地文件系统。
- 运行时 npm 安装假设运行环境中可用 `npm`，并且主机可以访问配置的包注册表。
- 已发布的 npm 包是已部署插件的预期安装产物。
- 仓库示例插件位于 `packages/plugins/examples/`，它们是开发便利工具，可以从源码检出中工作，不应假设它们存在于通用发布版本中，除非该版本明确附带了它们。
- 动态插件安装尚未为水平扩展或临时部署做好云端准备。目前没有共享 artifact 存储、安装协调或跨节点分发层。
- 当前运行时尚未提供真正的主机提供插件 UI 组件包，也不支持插件资产上传/读取。将这些视为本规范中的未来范围想法，而非当前实现承诺。

实际上，这意味着当前实现非常适合本地开发和自托管持久化部署，但不适用于多实例云插件分发。

## 1. 范围

本规范涵盖：

- 插件打包和安装
- 运行时模型
- 信任模型
- 能力系统
- UI 扩展表面
- 插件设置 UI
- Agent 工具贡献
- 事件、任务和 Webhook 表面
- 插件间通信
- 工作区插件本地工具方法
- Postgres 扩展持久化
- 卸载和数据生命周期
- 插件可观测性
- 插件开发和测试
- 运营者工作流
- 热插件生命周期（无需服务器重启）
- SDK 版本控制和兼容性规则

本规范不涵盖：

- 公共市场
- 云/SaaS 多租户
- 第一版插件中的任意第三方 schema 迁移
- 第一版插件中的 iframe 沙箱化插件 UI（插件作为 ES 模块在主机扩展槽中渲染）

## 2. 核心假设

Paperclip 插件设计基于以下假设：

1. Paperclip 是单租户且自托管的。
2. 插件安装对实例是全局的。
3. "公司"仍然是核心 Paperclip 业务对象，但不是插件信任边界。
4. Board 治理、审批门禁、预算硬性暂停和核心任务不变式仍由 Paperclip 核心拥有。
5. 项目已通过 `project_workspaces` 拥有了真正的工作区模型，本地/运行时插件应基于此构建，而非发明独立的工作区抽象。

## 3. 目标

插件系统必须：

1. 让运营者安装全局实例级插件。
2. 让插件在不修改 Paperclip 核心的情况下添加主要能力。
3. 保持核心治理和审计完整。
4. 同时支持本地/运行时插件和外部 SaaS 连接器。
5. 支持未来插件类别，例如：
   - 新的 agent 适配器
   - 收入追踪
   - 知识库
   - 问题追踪器同步
   - 指标/仪表板
   - 文件/项目工具
6. 使用简单、明确、类型化的契约。
7. 保持故障隔离，使一个插件不会导致整个实例崩溃。

## 4. 非目标

第一个插件系统不得：

1. 允许任意插件覆盖核心路由或核心不变式。
2. 允许任意插件变更审批、认证、问题检出或预算执行逻辑。
3. 允许任意第三方插件运行任意形式的数据库迁移。
4. 依赖项目本地插件文件夹，如 `.paperclip/plugins`。
5. 依赖服务器启动时从任意配置文件自动安装和执行行为。

## 5. 术语

### 5.1 实例

运营者安装和控制的单个 Paperclip 部署。

### 5.2 公司

实例内的顶级 Paperclip 业务对象。

### 5.3 项目工作区

通过 `project_workspaces` 附加到项目的工作区。
插件从此模型解析工作区路径，以定位用于文件、终端、git 和进程操作的本地目录。

### 5.4 平台模块

由 Paperclip 核心直接加载的受信任进程内扩展。

示例：

- agent 适配器
- 存储提供者
- 密钥提供者
- 运行日志后端

### 5.5 插件

通过 Paperclip 插件运行时加载的可安装实例级扩展包。

示例：

- Linear 同步
- GitHub Issues 同步
- Grafana 小组件
- Stripe 收入同步
- 文件浏览器
- 终端
- Git 工作流

### 5.6 插件 Worker

用于插件的运行时进程。
在本规范中，第三方插件默认运行在进程外。

### 5.7 能力

主机授予插件的命名权限。
插件只能调用已授予能力所涵盖的主机 API。

## 6. 扩展类别

Paperclip 有两个扩展类别。

## 6.1 平台模块

平台模块是：

- 受信任的
- 进程内的
- 主机集成的
- 低级的

它们使用显式注册表，而非通用插件 worker 协议。

平台模块表面：

- `registerAgentAdapter()`
- `registerStorageProvider()`
- `registerSecretProvider()`
- `registerRunLogStore()`

平台模块适合用于：

- 新的 agent 适配器包
- 新的存储后端
- 新的密钥后端
- 其他需要直接进程或数据库集成的 host 内部系统

## 6.2 插件

插件是：

- 按实例全局安装
- 通过插件运行时加载
- 附加式的
- 受能力控制的
- 通过稳定 SDK 和主机协议与核心隔离

插件类别：

- `connector`
- `workspace`
- `automation`
- `ui`

插件可以声明多个类别。

## 7. 项目工作区

Paperclip 已有具体的工作区模型：

- 项目暴露 `workspaces`
- 项目暴露 `primaryWorkspace`
- 数据库包含 `project_workspaces`
- 项目路由已管理工作区

需要本地工具（文件浏览、git、终端、进程追踪）的插件可以通过项目工作区 API 解析工作区路径，然后直接在文件系统上操作、生成进程、运行 git 命令。主机不包装这些操作——插件拥有自己的实现。

## 8. 安装模型

插件安装是全局的且由运营者驱动。

没有按公司安装表，也没有按公司启用/禁用开关。

如果插件需要业务对象特定映射，这些作为插件配置或插件状态存储。

示例：

- 一个全局 Linear 插件安装
- 从公司 A 到 Linear 团队 X 以及公司 B 到 Linear 团队 Y 的映射
- 一个全局 git 插件安装
- 存储在 `project_workspace` 下的按项目工作区状态

## 8.1 磁盘布局

插件位于 Paperclip 实例目录下。

建议布局：

- `~/.paperclip/instances/default/plugins/package.json`
- `~/.paperclip/instances/default/plugins/node_modules/`
- `~/.paperclip/instances/default/plugins/.cache/`
- `~/.paperclip/instances/default/data/plugins/<plugin-id>/`

包安装目录和插件数据目录是分开的。

此磁盘模型是当前实现需要持久化可写主机文件系统的原因。云安全的 artifact 复制是未来工作。

## 8.2 运营者命令

Paperclip 应添加 CLI 命令：

- `pnpm paperclipai plugin list`
- `pnpm paperclipai plugin install <package[@version]>`
- `pnpm paperclipai plugin uninstall <plugin-id>`
- `pnpm paperclipai plugin upgrade <plugin-id> [version]`
- `pnpm paperclipai plugin doctor <plugin-id>`

这些命令是实例级操作。

## 8.3 安装流程

安装流程是：

1. 解析 npm 包和版本。
2. 安装到实例插件目录。
3. 读取并验证插件清单。
4. 拒绝不兼容的插件 API 版本。
5. 向运营者显示请求的能力。
6. 在 Postgres 中持久化安装记录。
7. 启动插件 worker 并运行健康检查/验证。
8. 将插件标记为 `ready` 或 `error`。

对于当前实现，此安装流程应作为单主机工作流理解。成功安装将包写入本地主机，其他应用节点不会自动接收该插件，除非添加了未来的共享分发机制。

## 9. 加载顺序和优先级

加载顺序必须是确定性的。

1. 核心平台模块
2. 内置第一方插件
3. 已安装插件排序：
   - 显式运营者配置顺序（如果有）
   - 否则按清单 `id`

规则：

- 插件贡献默认是附加式的
- 插件不得通过名称冲突覆盖核心路由或核心操作
- UI 槽位 ID 由插件 ID 自动命名空间化（例如 `@paperclip/plugin-linear:sync-health-widget`），因此跨插件冲突在结构上不可能
- 如果单个插件在其自己的清单中声明重复的槽位 ID，主机必须在安装时拒绝

## 10. 包契约

每个插件包必须导出一个清单、一个 worker 入口点，以及可选的 UI 包。

建议的包布局：

- `dist/manifest.js`
- `dist/worker.js`
- `dist/ui/`（可选，包含插件的前端包）

建议的 `package.json` 键：

```json
{
  "name": "@paperclip/plugin-linear",
  "version": "0.1.0",
  "paperclipPlugin": {
    "manifest": "./dist/manifest.js",
    "worker": "./dist/worker.js",
    "ui": "./dist/ui/"
  }
}
```

## 10.1 清单形状

规范性清单形状：

```ts
export interface PaperclipPluginManifestV1 {
  id: string;
  apiVersion: 1;
  version: string;
  displayName: string;
  description: string;
  categories: Array<"connector" | "workspace" | "automation" | "ui">;
  minimumPaperclipVersion?: string;
  capabilities: string[];
  entrypoints: {
    worker: string;
    ui?: string;
  };
  instanceConfigSchema?: JsonSchema;
  jobs?: PluginJobDeclaration[];
  webhooks?: PluginWebhookDeclaration[];
  tools?: Array<{
    name: string;
    displayName: string;
    description: string;
    parametersSchema: JsonSchema;
  }>;
  ui?: {
    slots: Array<{
      type: "page" | "detailTab" | "dashboardWidget" | "sidebar" | "settingsPage";
      id: string;
      displayName: string;
      /** Which export name in the UI bundle provides this component */
      exportName: string;
      /** For detailTab: which entity types this tab appears on */
      entityTypes?: Array<"project" | "issue" | "agent" | "goal" | "run">;
    }>;
  };
}
```

规则：

- `id` 必须全局唯一
- `id` 通常应等于 npm 包名
- `apiVersion` 必须匹配主机支持的插件 API 版本
- `capabilities` 必须是静态的且在安装时可见
- 配置 schema 必须是 JSON Schema 兼容的
- `entrypoints.ui` 指向包含已构建 UI 包的目录
- `ui.slots` 声明插件填充的扩展槽位，以便主机知道要挂载什么而不急切加载包；每个槽位引用 UI 包中的一个 `exportName`

## 11. Agent 工具

插件可以贡献 Paperclip 代理在运行期间使用的工具。

### 11.1 工具声明

插件在清单中声明工具：

```ts
tools?: Array<{
  name: string;
  displayName: string;
  description: string;
  parametersSchema: JsonSchema;
}>;
```

工具名称在运行时由插件 ID 自动命名空间化（例如 `linear:search-issues`），因此插件不能遮盖核心工具或彼此的工具。

### 11.2 工具执行

当代理在运行期间调用插件工具时，主机通过 `executeTool` RPC 方法将调用路由到插件 worker：

- `executeTool(input)` — 接收工具名称、解析后的参数和运行上下文（agent ID、run ID、company ID、project ID）

worker 执行工具逻辑并返回类型化结果。主机强制执行能力门禁——插件必须声明 `agent.tools.register` 才能贡献工具，单独工具可能需要额外能力（例如调用外部 API 的工具需要 `http.outbound`）。

### 11.3 工具可用性

默认情况下，插件工具对所有代理可用。运营者可以通过插件配置限制每个代理或每个项目的工具可用性。

插件工具出现在代理的工具列表中，与核心工具并列，但在 UI 中作为插件贡献的工具进行视觉区分。

### 11.4 约束

- 插件工具不得通过名称覆盖或遮盖核心工具。
- 插件工具应尽可能幂等。
- 工具执行受与其他插件 worker 调用相同的超时和资源限制。
- 工具结果包含在运行日志中。

## 12. 运行时模型

## 12.1 进程模型

第三方插件默认运行在进程外。

默认运行时：

- Paperclip 服务器为每个已安装插件启动一个 worker 进程
- worker 进程是一个 Node 进程
- 主机和 worker 通过 stdio 上的 JSON-RPC 通信

此设计提供：

- 故障隔离
- 更清晰的日志边界
- 更简单的资源限制
- 比任意进程内执行更清晰的信任边界

## 12.2 主机职责

主机负责：

- 包安装
- 清单验证
- 能力执行
- 进程监督
- 任务调度
- Webhook 路由
- 活动日志写入
- 密钥解析
- UI 路由注册

## 12.3 Worker 职责

插件 worker 负责：

- 验证自己的配置
- 处理领域事件
- 处理计划任务
- 处理 Webhook
- 通过 `getData` 和 `performAction` 为插件自己的 UI 提供数据和处理操作
- 通过 SDK 调用主机服务
- 报告健康信息

## 12.4 故障策略

如果 worker 失败：

- 将插件状态标记为 `error`
- 在插件健康 UI 中显示错误
- 保持实例其余部分运行
- 使用有界退避重试启动
- 不丢弃其他插件或核心服务

## 12.5 优雅关闭策略

当主机需要停止插件 worker（升级、卸载或实例关闭）时：

1. 主机向 worker 发送 `shutdown()`。
2. worker 有 10 秒时间完成进行中的工作并干净退出。
3. 如果 worker 未在截止时间内退出，主机发送 SIGTERM。
4. 如果 worker 在 SIGTERM 后 5 秒内未退出，主机发送 SIGKILL。
5. 任何进行中的任务运行都标记为 `cancelled`，并注明强制关闭。
6. 任何进行中的 `getData` 或 `performAction` 调用向桥接器返回错误。

关闭截止时间应在插件配置中按插件配置，以便需要更长排空期的插件进行配置。

## 13. 主机-Worker 协议

主机必须支持以下 worker RPC 方法。

必需方法：

- `initialize(input)`
- `health()`
- `shutdown()`

可选方法：

- `validateConfig(input)`
- `configChanged(input)`
- `onEvent(input)`
- `runJob(input)`
- `handleWebhook(input)`
- `getData(input)`
- `performAction(input)`
- `executeTool(input)`

### 13.1 `initialize`

在 worker 启动时调用一次。

输入包括：

- 插件清单
- 已解析的插件配置
- 实例信息
- 主机 API 版本

### 13.2 `health`

返回：

- 状态
- 当前错误（如果有）
- 可选的插件报告诊断

### 13.3 `validateConfig`

在配置更改和启动后运行。

返回：

- `ok`
- 警告
- 错误

### 13.4 `configChanged`

在运营者在运行时更新插件的实例配置时调用。

输入包括：

- 新的已解析配置

如果 worker 实现了此方法，它应用新配置而不重启。如果 worker 未实现此方法，主机使用新配置重启 worker 进程（优雅关闭然后重启）。

### 13.5 `onEvent`

接收一个类型化的 Paperclip 领域事件。

传递语义：

- 至少一次
- 插件必须是幂等的
- 所有事件类型没有全局顺序保证
- 每个实体顺序是尽力但不保证重试后

### 13.6 `runJob`

运行已声明的计划任务。

主机提供：

- 任务键
- 触发源
- 运行 ID
- 计划元数据

### 13.7 `handleWebhook`

接收由主机路由的入站 Webhook 负载。

主机提供：

- 端点键
- 头部
- 原始正文
- 解析后的正文（如果适用）
- 请求 ID

### 13.8 `getData`

返回插件自己的 UI 组件请求的插件数据。

插件 UI 调用主机桥接器，桥接器将请求转发给 worker。worker 返回类型化的 JSON，插件自己的前端组件渲染该 JSON。

输入包括：

- 数据键（插件定义，例如 `"sync-health"`、`"issue-detail"`）
- 上下文（company id、project id、entity id 等）
- 可选的查询参数

### 13.9 `performAction`

运行由 board UI 发起的显式插件操作。

示例：

- "立即重新同步"
- "关联 GitHub issue"
- "从 issue 创建分支"
- "重启进程"

### 13.10 `executeTool`

在运行期间运行插件贡献的代理工具。

主机提供：

- 工具名称（不带插件命名空间前缀）
- 匹配工具声明模式的解析参数
- 运行上下文：agent ID、run ID、company ID、project ID

worker 执行工具并返回类型化结果（字符串内容、结构化数据或错误）。

## 14. SDK 表面

插件不直接与数据库对话。
插件不读取持久化配置中的原始密钥材料。

暴露给 worker 的 SDK 必须提供类型化的主机客户端。

必需的 SDK 客户端：

- `ctx.config`
- `ctx.events`
- `ctx.jobs`
- `ctx.http`
- `ctx.secrets`
- `ctx.assets`
- `ctx.activity`
- `ctx.state`
- `ctx.entities`
- `ctx.projects`
- `ctx.issues`
- `ctx.agents`
- `ctx.goals`
- `ctx.data`
- `ctx.actions`
- `ctx.tools`
- `ctx.logger`

`ctx.data` 和 `ctx.actions` 注册处理程序，插件自己的 UI 通过主机桥接器调用。`ctx.data.register(key, handler)` 支持前端的 `usePluginData(key)`。`ctx.actions.register(key, handler)` 支持前端的 `usePluginAction(key)`。

需要文件系统、git、终端或进程操作的插件直接使用标准 Node API 或库处理这些。主机通过 `ctx.projects` 提供项目工作区元数据，以便插件解析工作区路径，但主机不代理低级操作系统操作。

## 14.1 示例 SDK 形状

```ts
/** Top-level helper for defining a plugin with type checking */
export function definePlugin(definition: PluginDefinition): PaperclipPlugin;

/** Re-exported from Zod for config schema definitions */
export { z } from "zod";

export interface PluginContext {
  manifest: PaperclipPluginManifestV1;
  config: {
    get(): Promise<Record<string, unknown>>;
  };
  events: {
    on(name: string, fn: (event: unknown) => Promise<void>): void;
    on(name: string, filter: EventFilter, fn: (event: unknown) => Promise<void>): void;
    emit(name: string, payload: unknown): Promise<void>;
  };
  jobs: {
    register(key: string, input: { cron: string }, fn: (job: PluginJobContext) => Promise<void>): void;
  };
  state: {
    get(input: ScopeKey): Promise<unknown | null>;
    set(input: ScopeKey, value: unknown): Promise<void>;
    delete(input: ScopeKey): Promise<void>;
  };
  entities: {
    upsert(input: PluginEntityUpsert): Promise<void>;
    list(input: PluginEntityQuery): Promise<PluginEntityRecord[]>;
  };
  data: {
    register(key: string, handler: (params: Record<string, unknown>) => Promise<unknown>): void;
  };
  actions: {
    register(key: string, handler: (params: Record<string, unknown>) => Promise<unknown>): void;
  };
  tools: {
    register(name: string, input: PluginToolDeclaration, fn: (params: unknown, runCtx: ToolRunContext) => Promise<ToolResult>): void;
  };
  logger: {
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
    debug(message: string, meta?: Record<string, unknown>): void;
  };
}

export interface EventFilter {
  projectId?: string;
  companyId?: string;
  agentId?: string;
  [key: string]: unknown;
}
```

## 15. 能力模型

能力是强制性的且静态的。
每个插件预先声明它们。

主机在 SDK 层执行能力并拒绝超出授权集的调用。

## 15.1 能力类别

### 数据读取

- `companies.read`
- `projects.read`
- `project.workspaces.read`
- `issues.read`
- `issue.comments.read`
- `agents.read`
- `goals.read`
- `activity.read`
- `costs.read`

### 数据写入

- `issues.create`
- `issues.update`
- `issue.comments.create`
- `assets.write`
- `assets.read`
- `activity.log.write`
- `metrics.write`

### 插件状态

- `plugin.state.read`
- `plugin.state.write`

### 运行时/集成

- `events.subscribe`
- `events.emit`
- `jobs.schedule`
- `webhooks.receive`
- `http.outbound`
- `secrets.read-ref`

### Agent 工具

- `agent.tools.register`

### UI

- `instance.settings.register`
- `ui.sidebar.register`
- `ui.page.register`
- `ui.detailTab.register`
- `ui.dashboardWidget.register`
- `ui.action.register`

## 15.2 禁止的能力

主机不得暴露以下能力：

- 审批决策
- 预算覆盖
- 认证绕过
- 问题检出锁覆盖
- 直接数据库访问

## 15.3 升级规则

如果插件升级添加能力：

1. 主机必须将插件标记为 `upgrade_pending`
2. 运营者必须明确批准新的能力集
3. 新版本在批准完成前不会变为 `ready`

## 16. 事件系统

主机必须发出插件可以订阅的类型化领域事件。

最小事件集：

- `company.created`
- `company.updated`
- `project.created`
- `project.updated`
- `project.workspace_created`
- `project.workspace_updated`
- `project.workspace_deleted`
- `issue.created`
- `issue.updated`
- `issue.comment.created`
- `agent.created`
- `agent.updated`
- `agent.status_changed`
- `agent.run.started`
- `agent.run.finished`
- `agent.run.failed`
- `agent.run.cancelled`
- `approval.created`
- `approval.decided`
- `cost_event.created`
- `activity.logged`

每个事件必须包括：

- 事件 ID
- 事件类型
- 发生时间
- 执行者元数据（适用时）
- 主要实体元数据
- 类型化负载

### 16.1 事件过滤

插件在订阅事件时可以提供可选过滤器。过滤器由主机在分发给 worker 之前评估，因此被过滤掉的事件永远不会跨进程边界。

支持的过滤器字段：

- `projectId` — 仅接收特定项目的事件
- `companyId` — 仅接收特定公司的事件
- `agentId` — 仅接收特定代理的事件

过滤器是可选的。如果省略，插件接收所订阅类型的所有事件。过滤器可以组合（例如同时按公司和项目过滤）。

### 16.2 插件间事件

插件可以使用 `ctx.events.emit(name, payload)` 发出自定义事件。插件发出的事件使用命名空间化的事件类型：`plugin.<pluginId>.<eventName>`。

其他插件可以使用相同的 `ctx.events.on()` API 订阅这些事件：

```ts
ctx.events.on("plugin.@paperclip/plugin-git.push-detected", async (event) => {
  // react to the git plugin detecting a push
});
```

规则：

- 插件事件需要 `events.emit` 能力。
- 插件事件不是核心领域事件——除非发出插件明确记录它们，否则它们不会出现在核心活动日志中。
- 插件事件遵循与核心事件相同的至少一次传递语义。
- 主机不得允许插件发出核心命名空间中的事件（没有 `plugin.` 前缀的事件）。

## 17. 计划任务

插件可以在清单中声明计划任务。

任务规则：

1. 每个任务有一个稳定的 `job_key`。
2. 主机是记录的调度器。
3. 主机阻止同一插件/任务组合的重叠执行，除非稍后明确允许。
4. 每个任务运行都记录在 Postgres 中。
5. 失败的任务可重试。

## 18. Webhook

插件可以在清单中声明 Webhook 端点。

Webhook 路由形状：

- `POST /api/plugins/:pluginId/webhooks/:endpointKey`

规则：

1. 主机拥有公共路由。
2. worker 通过 `handleWebhook` 接收请求正文。
3. 签名验证在插件代码中进行，使用主机解析的密钥引用。
4. 每次传递都记录。
5. Webhook 处理必须是幂等的。

## 19. UI 扩展模型

插件将自己的前端 UI 作为捆绑的 React 模块发送。主机将插件 UI 加载到指定的扩展槽中，并提供桥接器供插件前端与其自己的 worker 后端和主机 API 通信。

### 19.0.1 插件 UI 发布实践

插件的 `dist/ui/` 目录包含一个构建好的 React 包。主机将此包作为静态资源提供服务，并在用户导航到插件表面时将其加载到页面中（插件页面、详情标签页、仪表板小组件等）。

**主机提供，插件渲染：**

1. 主机定义**扩展槽** — UI 中插件组件可以出现的指定挂载点（页面、标签页、小组件、侧边栏条目、操作栏）。
2. 插件的 UI 包为它想填充的每个槽位导出命名组件。
3. 主机将插件组件挂载到槽位中，传递给它一个**主机桥接器**对象。
4. 插件组件使用桥接器从自己的 worker 获取数据（通过 `getData`）、调用操作（通过 `performAction`）、读取主机上下文（当前公司、项目、实体），以及使用共享主机 UI 原语（设计标记、通用组件）。

**具体示例：Linear 插件发送一个仪表板小组件。**

插件的 UI 包导出：

```tsx
// dist/ui/index.tsx
import { usePluginData, usePluginAction, MetricCard, StatusBadge } from "@paperclipai/plugin-sdk/ui";

export function DashboardWidget({ context }: PluginWidgetProps) {
  const { data, loading } = usePluginData("sync-health", { companyId: context.companyId });
  const resync = usePluginAction("resync");

  if (loading) return <Spinner />;

  return (
    <div>
      <MetricCard label="Synced Issues" value={data.syncedCount} trend={data.trend} />
      {data.mappings.map(m => (
        <StatusBadge key={m.id} label={m.label} status={m.status} />
      ))}
      <button onClick={() => resync({ companyId: context.companyId })}>Resync Now</button>
    </div>
  );
}
```

**运行时发生什么：**

1. 用户打开仪表板。主机看到 Linear 插件注册了一个 `DashboardWidget` 导出。
2. 主机将插件的 `DashboardWidget` 组件挂载到仪表板小组件槽位，传递 `context`（当前公司、用户等）和桥接器。
3. `usePluginData("sync-health", ...)` 通过桥接器 → 主机 → 插件 worker 的 `getData` RPC 调用 → 返回 JSON → 插件组件渲染它想要的任何内容。
4. 当用户点击"立即重新同步"时，`usePluginAction("resync")` 通过桥接器 → 主机 → 插件 worker 的 `performAction` RPC 调用。

**主机控制什么：**

- 主机决定插件组件**出现的位置**（哪些槽位存在以及何时挂载）。
- 主机提供**桥接器** — 插件 UI 不能发出任意网络请求或直接访问主机内部。
- 主机强制执行**能力门禁** — 如果插件的 worker 没有能力，桥接器会拒绝调用，即使 UI 请求它。
- 主机通过 `@paperclipai/plugin-sdk/ui` 提供**设计标记和共享组件**，以便插件匹配主机的视觉语言而不被强制。

**插件控制什么：**

- 插件决定**如何**渲染它的数据 — 它拥有自己的 React 组件、布局、交互和状态管理。
- 插件决定**获取什么数据**和**暴露什么操作**。
- 插件可以在其包内使用任何 React 模式（hooks、context、第三方组件库）。

### 19.0.2 Bundle 隔离

插件 UI 包作为标准 ES 模块加载，不是 iframe。这让插件获得完整的渲染性能并访问主机的设计标记。

隔离规则：

- 插件包不得从主机内部导入。它们只能从 `@paperclipai/plugin-sdk/ui` 和自己的依赖导入。
- 插件包不得直接访问 `window.fetch` 或 `XMLHttpRequest` 来调用主机 API。所有主机通信都通过桥接器。
- 主机可以强制执行内容安全策略规则，将插件网络访问限制为仅桥接器端点。
- 插件包必须是静态可分析的 — 不能对插件包外的 URL 进行动态 `import()`。

如果以后需要更强的隔离，主机可以迁移到基于 iframe 的挂载来隔离不受信任的插件，而无需更改插件的源代码（桥接器 API 保持不变）。

### 19.0.3 Bundle 服务

插件 UI 包必须是预构建的 ESM。主机不在运行时编译或转换插件 UI 代码。

主机将插件的 `dist/ui/` 目录作为静态资产在命名空间化路径下提供服务：

- `/_plugins/:pluginId/ui/*`

当主机渲染扩展槽时，它从此路径动态导入插件的 UI 入口模块，解析 `ui.slots[].exportName` 中声明的命名导出，并将其挂载到槽位中。

在开发中，主机可以在插件配置中支持 `devUiUrl` 覆盖，指向本地开发服务器（例如 Vite），以便插件作者在开发过程中使用热重载而无需重新构建。

## 19.1 全局运营者路由

- `/settings/plugins`
- `/settings/plugins/:pluginId`

这些路由是实例级的。

## 19.2 公司上下文路由

- `/:companyPrefix/plugins/:pluginId`

这些路由存在是因为 board UI 围绕公司组织，尽管插件安装是全局的。

## 19.3 详情标签页

插件可以添加到：

- 项目详情
- issue 详情
- agent 详情
- 目标详情
- 运行详情

推荐的路由模式：

- `/:companyPrefix/<entity>/:id?tab=<plugin-tab-id>`

## 19.4 仪表板小组件

插件可以向仪表板添加卡片或部分。

## 19.5 侧边栏条目

插件可以添加侧边栏链接到：

- 全局插件设置
- 公司上下文插件页面

## 19.6 `@paperclipai/plugin-sdk/ui` 中的共享组件

主机 SDK 附带的共享组件，插件可以导入以快速构建与主机外观和感觉一致的 UI。这些是便利构建块，不是要求。

| 组件 | 渲染内容 | 典型用途 |
|---|---|---|
| `MetricCard` | 带标签的单一数字，可选趋势/迷你图 | KPI、计数、比率 |
| `StatusBadge` | 内联状态指示器（ok/warning/error/info） | 同步健康、连接状态 |
| `DataTable` | 带可选排序和分页的行和列 | issue 列表、任务历史、进程列表 |
| `TimeseriesChart` | 带时间戳数据点的折线图或柱状图 | 收入趋势、同步量、错误率 |
| `MarkdownBlock` | 渲染的 markdown 文本 | 描述、帮助文本、备注 |
| `KeyValueList` | 定义列表布局中的标签/值对 | 实体元数据、配置摘要 |
| `ActionBar` | 连接到 `usePluginAction` 的按钮行 | 重新同步、创建分支、重启进程 |
| `LogView` | 带时间戳的可滚动日志输出 | Webhook 传递、任务输出、进程日志 |
| `JsonTree` | 用于调试的可折叠 JSON 树 | 原始 API 响应、插件状态检查 |
| `Spinner` | 加载指示器 | 数据获取状态 |

插件也可以使用完全自定义的组件。共享组件存在是为了减少样板并保持视觉一致性，而不是限制插件可以渲染的内容。

## 19.7 通过桥接器的错误传播

桥接器 hooks 必须返回结构化错误，以便插件 UI 可以优雅地处理失败。

`usePluginData` 返回：

```ts
{
  data: T | null;
  loading: boolean;
  error: PluginBridgeError | null;
}
```

`usePluginAction` 返回一个异步函数，该函数要么解析结果，要么抛出 `PluginBridgeError`。

`PluginBridgeError` 形状：

```ts
interface PluginBridgeError {
  code: "WORKER_UNAVAILABLE" | "CAPABILITY_DENIED" | "WORKER_ERROR" | "TIMEOUT" | "UNKNOWN";
  message: string;
  /** Original error details from the worker, if available */
  details?: unknown;
}
```

错误码：

- `WORKER_UNAVAILABLE` — 插件 worker 未运行（崩溃、关闭、未启动）
- `CAPABILITY_DENIED` — 插件没有此操作所需的能力
- `WORKER_ERROR` — worker 从其 `getData` 或 `performAction` 处理程序返回错误
- `TIMEOUT` — worker 在配置的超时时间内未响应
- `UNKNOWN` — 意外的桥接器级故障

`@paperclipai/plugin-sdk/ui` 子路径还应导出一个 `ErrorBoundary` 组件，插件作者可以使用它来捕获渲染错误而不使主机页面崩溃。

## 19.8 插件设置 UI

在清单中声明了 `instanceConfigSchema` 的每个插件在 `/settings/plugins/:pluginId` 处有一个自动生成的设置表单。主机从 JSON Schema 渲染表单。

自动生成的表单支持：

- 从 schema 类型和枚举派生的文本输入、数字输入、开关、选择下拉
- 作为 fieldset 渲染的嵌套对象
- 作为可重复字段组（带添加/删除控件）渲染的数组
- 密钥引用字段：任何用 `"format": "secret-ref"` 注解的 schema 属性渲染为通过 Paperclip 密钥提供者系统解析的密钥选择器，而非普通文本输入
- 从 schema 约束派生的验证消息（`required`、`minLength`、`pattern`、`minimum` 等）
- 如果插件声明了 `validateConfig` RPC 方法，则显示"测试连接"操作 — 主机调用它并内联显示结果

对于需要超出 JSON Schema 表达能力的更丰富设置 UX 的插件，该插件可以在 `ui.slots` 中声明一个 `settingsPage` 槽位。如果存在，主机渲染插件自己的 React 组件而非自动生成的表单。插件组件通过标准桥接器与 worker 通信以读取和写入配置。

两种方法可以共存：插件可以对简单配置使用自动生成的表单，并为高级配置或操作仪表板添加自定义设置页面槽位。

## 20. 本地工具

需要文件系统、git、终端或进程操作的插件直接实现这些。主机不包装或代理这些操作。

主机通过 `ctx.projects` 提供工作区元数据（列出工作区、获取主工作区、从 issue 或 agent/run 解析工作区）。插件使用此元数据解析本地路径，然后直接在文件系统上操作、生成进程、shell 到 `git`、或使用标准 Node API 或任何他们选择的库打开 PTY 会话。

这保持主机精简 — 它不需要为插件可能需要的每个操作系统级操作维护并行 API 表面。插件拥有自己的文件浏览、git 工作流、终端会话和进程管理逻辑。

## 21. 持久化和 Postgres

## 21.1 数据库原则

1. 核心 Paperclip 数据保留在第一方表中。
2. 大多数插件自有数据从通用扩展表开始。
3. 插件数据在引入新表之前应优先作用域到现有 Paperclip 对象。
4. 任意第三方 schema 迁移超出第一版插件系统的范围。

## 21.2 核心表复用

如果数据成为实际 Paperclip 产品模型的一部分，它应该成为第一方表。

示例：

- `project_workspaces` 已经是第一方的
- 如果 Paperclip 稍后决定 git 状态是核心产品数据，它也应该成为第一方表

## 21.3 必需的表

### `plugins`

- `id` uuid pk
- `plugin_key` text unique not null
- `package_name` text not null
- `version` text not null
- `api_version` int not null
- `categories` text[] not null
- `manifest_json` jsonb not null
- `status` enum: `installed | ready | error | upgrade_pending`
- `install_order` int null
- `installed_at` timestamptz not null
- `updated_at` timestamptz not null
- `last_error` text null

索引：

- unique `plugin_key`
- `status`

### `plugin_config`

- `id` uuid pk
- `plugin_id` uuid fk `plugins.id` unique not null
- `config_json` jsonb not null
- `created_at` timestamptz not null
- `updated_at` timestamptz not null
- `last_error` text null

### `plugin_state`

- `id` uuid pk
- `plugin_id` uuid fk `plugins.id` not null
- `scope_kind` enum: `instance | company | project | project_workspace | agent | issue | goal | run`
- `scope_id` uuid/text null
- `namespace` text not null
- `state_key` text not null
- `value_json` jsonb not null
- `updated_at` timestamptz not null

约束：

- unique `(plugin_id, scope_kind, scope_id, namespace, state_key)`

示例：

- 按 `issue` 键控的 Linear 外部 ID
- 按 `project` 键控的 GitHub 同步游标
- 按 `project_workspace` 键控的文件浏览器偏好
- 按 `project_workspace` 键控的 git 分支元数据
- 按 `project_workspace` 或 `run` 键控的进程元数据

### `plugin_jobs`

- `id` uuid pk
- `plugin_id` uuid fk `plugins.id` not null
- `scope_kind` enum nullable
- `scope_id` uuid/text null
- `job_key` text not null
- `schedule` text null
- `status` enum: `idle | queued | running | error`
- `next_run_at` timestamptz null
- `last_started_at` timestamptz null
- `last_finished_at` timestamptz null
- `last_succeeded_at` timestamptz null
- `last_error` text null

约束：

- unique `(plugin_id, scope_kind, scope_id, job_key)`

### `plugin_job_runs`

- `id` uuid pk
- `plugin_job_id` uuid fk `plugin_jobs.id` not null
- `plugin_id` uuid fk `plugins.id` not null
- `status` enum: `queued | running | succeeded | failed | cancelled`
- `trigger` enum: `schedule | manual | retry`
- `started_at` timestamptz null
- `finished_at` timestamptz null
- `error` text null
- `details_json` jsonb null

索引：

- `(plugin_id, started_at desc)`
- `(plugin_job_id, started_at desc)`

### `plugin_webhook_deliveries`

- `id` uuid pk
- `plugin_id` uuid fk `plugins.id` not null
- `scope_kind` enum nullable
- `scope_id` uuid/text null
- `endpoint_key` text not null
- `status` enum: `received | processed | failed | ignored`
- `request_id` text null
- `headers_json` jsonb null
- `body_json` jsonb null
- `received_at` timestamptz not null
- `handled_at` timestamptz null
- `response_code` int null
- `error` text null

索引：

- `(plugin_id, received_at desc)`
- `(plugin_id, endpoint_key, received_at desc)`

### `plugin_entities`（可选但推荐）

- `id` uuid pk
- `plugin_id` uuid fk `plugins.id` not null
- `entity_type` text not null
- `scope_kind` enum not null
- `scope_id` uuid/text null
- `external_id` text null
- `title` text null
- `status` text null
- `data_json` jsonb not null
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

索引：

- `(plugin_id, entity_type, external_id)` 当 `external_id` 不为空时唯一
- `(plugin_id, scope_kind, scope_id, entity_type)`

用例：

- 导入的 Linear issues
- 导入的 GitHub issues
- 插件自有的进程记录
- 插件自有的外部指标绑定

## 21.4 活动日志更改

活动日志应扩展 `actor_type` 以包含 `plugin`。

新执行者枚举：

- `agent`
- `user`
- `system`
- `plugin`

插件发起的变更应写入：

- `actor_type = plugin`
- `actor_id = <plugin-id>`

## 21.5 插件迁移

第一版插件系统不允许任意第三方迁移。

以后，如果需要自定义表，系统可以添加仅限可信模块的迁移路径。

## 22. 密钥

插件配置不得持久化原始密钥值。

规则：

1. 插件配置仅存储密钥引用。
2. 密钥引用通过现有 Paperclip 密钥提供者系统解析。
3. 插件 worker 仅在执行时接收已解析的密钥。
4. 密钥值不得写入：
   - 插件配置 JSON
   - 活动日志
   - Webhook 传递行
   - 错误消息

## 23. 审计

所有插件发起的变更操作都必须可审计。

最低要求：

- 每个变更的活动日志条目
- 任务运行历史
- Webhook 传递历史
- 插件健康页面
- `plugins` 中的安装/升级历史

## 24. 运营者 UX

## 24.1 全局设置

全局插件设置页面必须显示：

- 已安装插件
- 版本
- 状态
- 请求的能力
- 当前错误
- 安装/升级/删除操作

## 24.2 插件设置页面

每个插件可以暴露：

- 从 `instanceConfigSchema` 派生的配置表单
- 健康详情
- 最近任务历史
- 最近 Webhook 历史
- 能力列表

路由：

- `/settings/plugins/:pluginId`

## 24.3 公司上下文插件页面

每个插件可以暴露一个公司上下文主页：

- `/:companyPrefix/plugins/:pluginId`

这是 board 用户进行大多数日常工作的地方。

## 25. 卸载和数据生命周期

当插件被卸载时，主机必须明确处理插件自有的数据。

### 25.1 卸载流程

1. 主机向 worker 发送 `shutdown()` 并遵循优雅关闭策略。
2. 主机在 `plugins` 表中将插件状态标记为 `uninstalled`（软删除）。
3. 插件自有的数据（`plugin_state`、`plugin_entities`、`plugin_jobs`、`plugin_job_runs`、`plugin_webhook_deliveries`、`plugin_config`）保留一段可配置的宽限期（默认：30 天）。
4. 在宽限期内，运营者可以重新安装同一插件并恢复其状态。
5. 宽限期结束后，主机清除已卸载插件的所有插件自有数据。
6. 运营者可以通过 CLI 强制立即清除：`pnpm paperclipai plugin purge <plugin-id>`。

### 25.2 升级数据注意事项

插件升级不会自动迁移插件状态。如果插件的 `value_json` 形状在版本之间发生变化：

- 插件 worker 负责在升级后首次访问时迁移自己的状态。
- 主机不运行插件定义的 schema 迁移。
- 插件应在其 `value_json` 内部版本化其状态键或使用 schema 版本字段来检测和处理格式更改。

### 25.3 升级生命周期

升级插件时：

1. 主机向旧 worker 发送 `shutdown()`。
2. 主机等待旧 worker 排空进行中的工作（尊重关闭截止时间）。
3. 在截止时间内未完成的任何进行中任务标记为 `cancelled`。
4. 主机安装新版本并启动新 worker。
5. 如果新版本添加能力，插件进入 `upgrade_pending`，运营者必须批准，新 worker 才能变为 `ready`。

### 25.4 热插件生命周期

插件安装、卸载、升级和配置更改**必须**在无需重启 Paperclip 服务器的情况下生效。这是一个规范性要求，不是可选的。

该架构已经支持这一点 — 插件作为进程外 worker 运行，具有动态 ESM 导入、IPC 桥接器和主机管理的路由表。本节使这一要求明确，以便实现不会回归。

#### 25.4.1 热安装

在运行时安装插件时：

1. 主机在不停止现有服务的情况下解析和验证清单。
2. 主机为插件生成新的 worker 进程。
3. 主机在实时路由表中注册插件的事件订阅、任务计划、Webhook 端点和代理工具声明。
4. 主机将插件的 UI 包路径加载到扩展槽注册表中，以便前端可以在下次导航时或通过实时通知发现它。
5. 插件进入 `ready` 状态（或如果需要能力批准则为 `upgrade_pending`）。

不会中断任何其他插件或主机服务。

#### 25.4.2 热卸载

在运行时卸载插件时：

1. 主机发送 `shutdown()` 并遵循优雅关闭策略（第 12.5 节）。
2. 主机从实时路由表中移除插件的事件订阅、任务计划、Webhook 端点和代理工具声明。
3. 主机从扩展槽注册表中移除插件的 UI 包。任何当前挂载的插件 UI 组件都将卸载并替换为占位符或完全移除。
4. 主机将插件标记为 `uninstalled` 并开始数据保留宽限期（第 25.1 节）。

无需服务器重启。

#### 25.4.3 热升级

在运行时升级插件时：

1. 主机遵循升级生命周期（第 25.3 节）— 关闭旧 worker，启动新 worker。
2. 如果新版本更改了事件订阅、任务计划、Webhook 端点或代理工具，主机以原子方式交换旧注册和新注册。
3. 如果新版本附带了更新的 UI 包，主机使任何缓存的包资源失效，并通知前端重新加载插件 UI 组件。活动用户在下一次导航时或通过实时刷新通知看到更新的 UI。
4. 如果清单 `apiVersion` 未更改且未添加新能力，升级完成而无需运营者交互。

#### 25.4.4 热配置更改

当运营者在运行时更新插件的实例配置时：

1. 主机将新配置写入 `plugin_config`。
2. 主机通过 IPC 向运行的 worker 发送 `configChanged` 通知。
3. worker 通过 `ctx.config` 接收新配置并应用它而不重启。如果插件需要重新初始化连接（例如新的 API token），它会在内部执行此操作。
4. 如果插件不处理 `configChanged`，主机使用新配置重启 worker 进程（优雅关闭然后重启）。

#### 25.4.5 前端缓存失效

主机必须对插件 UI 包 URL 进行版本控制（例如 `/_plugins/:pluginId/ui/:version/*` 或基于内容哈希的路径），以便浏览器缓存在升级或重新安装后不提供过时的包。

主机应发出 `plugin.ui.updated` 事件，前端监听该事件以触发更新插件模块的重新导入，而无需完全重新加载页面。

#### 25.4.6 Worker 进程管理

主机的插件进程管理器必须支持：

- 为新安装的插件启动 worker 而不影响其他 worker
- 为卸载的插件停止 worker 而不影响其他 worker
- 在升级期间替换 worker（从路由表的角度来看是原子地停止旧的和启动新的）
- 在崩溃后无需运营者干预地重启 worker（有退避）

每个 worker 进程是独立的。没有共享进程池或批量重启机制。

## 26. 插件可观测性

### 26.1 日志记录

插件 worker 使用 `ctx.logger` 发出结构化日志。主机捕获这些日志并以可查询格式存储。

日志存储规则：

- 插件日志存储在 `plugin_logs` 表中或附加到插件数据目录下方的日志文件中。
- 每个日志条目包括：插件 ID、时间戳、级别、消息和可选的结构化元数据。
- 日志可从 UI 中的插件设置页面查询。
- 日志有可配置的保留期（默认：7 天）。
- 即使 worker 不使用 `ctx.logger`，主机也会捕获 worker 进程的 `stdout` 和 `stderr` 作为备用日志。

### 26.2 健康仪表板

插件设置页面必须显示：

- 当前 worker 状态（运行中、错误、停止）
- 自上次重启以来的正常运行时间
- 最近日志条目
- 带成功/失败率的作业运行历史
- 带成功/失败率的 Webhook 传递历史
- 上次健康检查结果和诊断
- 可用的资源使用情况（内存、CPU）

### 26.3 告警

当插件健康状况下降时，主机应发出内部事件。这些使用 `plugin.*` 命名空间（而非核心领域事件），不会出现在核心活动日志中：

- `plugin.health.degraded` — worker 报告错误或健康检查失败
- `plugin.health.recovered` — worker 从错误状态恢复
- `plugin.worker.crashed` — worker 进程意外退出
- `plugin.worker.restarted` — worker 崩溃后重启

这些事件可以被其他插件消费（例如通知插件）或显示在仪表板上。

## 27. 插件开发和测试

### 27.1 `@paperclipai/plugin-test-harness`

主机应发布一个测试工具包包，插件作者用于本地开发和测试。

测试工具包提供：

- 实现完整 SDK 接口的模拟主机（`ctx.config`、`ctx.events`、`ctx.state` 等）
- 发送合成事件并验证处理程序响应的能力
- 触发任务运行并验证副作用的能力
- 模拟来自 UI 桥接器的 `getData` 和 `performAction` 调用的能力
- 模拟来自代理运行的 `executeTool` 调用的能力
- 用于断言的内存状态和实体存储
- 用于测试能力拒绝路径的可配置能力集

示例用法：

```ts
import { createTestHarness } from "@paperclipai/plugin-test-harness";
import manifest from "../dist/manifest.js";
import { register } from "../dist/worker.js";

const harness = createTestHarness({ manifest, capabilities: manifest.capabilities });
await register(harness.ctx);

// Simulate an event
await harness.emit("issue.created", { issueId: "iss-1", projectId: "proj-1" });

// Verify state was written
const state = await harness.state.get({ pluginId: manifest.id, scopeKind: "issue", scopeId: "iss-1", namespace: "sync", stateKey: "external-id" });
expect(state).toBeDefined();

// Simulate a UI data request
const data = await harness.getData("sync-health", { companyId: "comp-1" });
expect(data.syncedCount).toBeGreaterThan(0);
```

### 27.2 本地插件开发

针对运行的 Paperclip 实例开发插件时：

- 运营者从本地路径安装插件：`pnpm paperclipai plugin install ./path/to/plugin`
- 主机监视插件目录的更改并在重建时重启 worker。
- 插件配置中的 `devUiUrl` 可以指向本地 Vite 开发服务器以进行 UI 热重载。
- 插件设置页面显示来自 worker 的实时日志以进行调试。

### 27.3 插件起始模板

主机应发布一个起始模板（`create-paperclip-plugin`），它搭建：

- 带正确 `paperclipPlugin` 键的 `package.json`
- 带占位符值的清单
- 带 SDK 类型导入和示例事件处理程序的 worker 入口
- 带使用桥接器 hooks 的示例 `DashboardWidget` 的 UI 入口
- 使用测试工具包的测试文件
- 用于 worker 和 UI 包的构建配置（esbuild 或类似）
- `.gitignore` 和 `tsconfig.json`

## 28. 示例映射

本规范直接支持以下插件类型：

- `@paperclip/plugin-workspace-files`
- `@paperclip/plugin-terminal`
- `@paperclip/plugin-git`
- `@paperclip/plugin-linear`
- `@paperclip/plugin-github-issues`
- `@paperclip/plugin-grafana`
- `@paperclip/plugin-runtime-processes`
- `@paperclip/plugin-stripe`

## 29. 兼容性和版本控制

### 29.1 API 版本规则

1. 主机支持一个或多个显式插件 API 版本。
2. 插件清单恰好声明一个 `apiVersion`。
3. 主机在安装时拒绝不支持的版本。
4. 插件升级是显式的运营者操作。
5. 能力扩展需要显式的运营者批准。

### 29.2 SDK 版本控制

主机为插件作者发布一个 SDK 包：

- `@paperclipai/plugin-sdk` — 完整的插件 SDK

该包使用子路径导出分离 worker 和 UI 关注点：

- `@paperclipai/plugin-sdk` — worker 端 SDK（context、events、state、tools、logger、`definePlugin`、`z`）
- `@paperclipai/plugin-sdk/ui` — 前端 SDK（桥接器 hooks、共享组件、设计标记）

单个包简化了插件作者的依赖管理 — 一个依赖、一个版本、一个变更日志。子路径导出保持包分离清晰：worker 代码从根导入，UI 代码从 `/ui` 导入。构建工具相应地进行摇树，以便 worker 包不包含 React 组件，UI 包也不包含仅限 worker 的代码。

版本控制规则：

1. **Semver**：SDK 遵循严格的语义版本控制。主要版本 bump 表示 worker 或 UI 表面的破坏性更改；次要版本向后兼容地添加新功能；补丁版本仅修复错误。
2. **与 API 版本绑定**：每个主要 SDK 版本对应恰好一个插件 `apiVersion`。当 `@paperclipai/plugin-sdk@2.x` 发布时，它针对 `apiVersion: 2`。使用 SDK 1.x 构建的插件继续声明 `apiVersion: 1`。
3. **主机多版本支持**：主机必须同时支持至少当前和上一个 `apiVersion`。这意味着针对上一个 SDK 主要版本构建的插件继续工作而无需修改。主机为每个支持的 API 版本维护单独的 IPC 协议处理程序。
4. **清单中的最低 SDK 版本**：插件在清单中声明 `sdkVersion` 作为 semver 范围（例如 `">=1.4.0 <2.0.0"`）。主机在安装时验证此版本，如果插件声明的范围超出主机支持的 SDK 版本则发出警告。
5. **弃用时间线**：当新的 `apiVersion` 发布时，上一个版本进入至少 6 个月的弃用期。在此期间：
   - 主机继续加载针对弃用版本构建的插件。
   - 主机在插件启动时记录弃用警告。
   - 插件设置页面显示指示插件应升级的横幅。
   - 弃用期结束后，主机可以在未来版本中删除对旧版本的支持。
6. **SDK 变更日志和迁移指南**：每个主要 SDK 版本必须包含迁移指南，记录每个破坏性更改、新 API 表面的内容以及插件作者的分步升级路径。
7. **UI 表面稳定性**：对共享 UI 组件的破坏性更改（移除组件、更改必需 props）或设计标记的更改需要像 worker API 更改一样进行主要版本 bump。单一包模型意味着两个表面一起进行版本控制，避免 worker 和 UI 兼容性之间的漂移。

### 29.3 版本兼容性矩阵

主机应发布兼容性矩阵：

| 主机版本 | 支持的 API 版本 | SDK 范围 |
|---|---|---|
| 1.0 | 1 | 1.x |
| 2.0 | 1, 2 | 1.x, 2.x |
| 3.0 | 2, 3 | 2.x, 3.x |

此矩阵在主机文档中发布，可通过 `GET /api/plugins/compatibility` 查询。

### 29.4 插件作者工作流

当发布新的 SDK 版本时：

1. 插件作者更新 `@paperclipai/plugin-sdk` 依赖。
2. 插件作者按照迁移指南更新代码。
3. 插件作者更新清单中的 `apiVersion` 和 `sdkVersion`。
4. 插件作者发布新插件版本。
5. 运营者在其实例上升级插件。旧版本继续工作，直到明确升级。

## 30. 推荐的交付顺序

## 第一阶段

- 插件清单
- install/list/remove/upgrade CLI
- 全局设置 UI
- 插件进程管理器
- 能力执行
- `plugins`、`plugin_config`、`plugin_state`、`plugin_jobs`、`plugin_job_runs`、`plugin_webhook_deliveries`
- 事件总线
- 任务
- Webhook
- 设置页面
- 插件 UI 包加载、主机桥接器和 `@paperclipai/plugin-sdk/ui`
- 页面、标签页、小组件、侧边栏条目的扩展槽挂载
- 桥接器错误传播（`PluginBridgeError`）
- 从 `instanceConfigSchema` 自动生成设置表单
- 插件贡献的代理工具
- 插件间事件（`plugin.<pluginId>.*` 命名空间）
- 事件过滤
- 带可配置截止时间的优雅关闭
- 插件日志记录和健康仪表板
- `@paperclipai/plugin-test-harness`
- `create-paperclip-plugin` 起始模板
- 带数据保留宽限期的卸载
- 热插件生命周期（安装、卸载、升级、配置更改而无需服务器重启）
- 带多版本主机支持和弃用策略的 SDK 版本控制

此阶段足以支持：

- Linear
- GitHub Issues
- Grafana
- Stripe
- 文件浏览器
- 终端
- Git 工作流
- 进程/服务器追踪

工作区插件（文件浏览器、终端、git、进程追踪）不需要额外 的主机 API — 它们通过 `ctx.projects` 解析工作区路径，并直接处理文件系统、git、PTY 和进程操作。

## 第二阶段

- 可选的 `plugin_entities`
- 更丰富的操作系统的
- 如果真正需要，可信的模块迁移路径
- 用于不受信任的插件 UI 包的基于 iframe 的隔离
- 插件生态系统/分发工作

## 31. 最终设计决策

Paperclip 不应实现直接模仿本地编码工具的通用进程内钩子包。

Paperclip 应实现：

- 用于低级主机集成的可信平台模块
- 用于附加实例级能力的全局安装进程外插件
- 插件贡献的代理工具（命名空间的、能力门禁的）
- 通过类型化桥接器（带结构化错误传播）在主机扩展槽中渲染的插件发送 UI 包
- 从配置 schema 自动生成设置 UI，自定义设置页面作为选项
- 用于跨插件协调的插件间事件
- 用于高效事件路由的服务端事件过滤
- 插件直接拥有自己的本地工具逻辑（文件系统、git、终端、进程）
- 用于大多数插件状态的通用扩展表
- 优雅关闭、卸载数据生命周期和插件可观测性
- 热插件生命周期 — 安装、卸载、升级和配置更改而无需服务器重启
- 带多版本主机支持和明确弃用策略的 SDK 版本控制
- 用于低创作阻力的测试工具包和起始模板
- 严格保留核心治理和审计规则

这是 Paperclip 插件系统的完整目标设计。
