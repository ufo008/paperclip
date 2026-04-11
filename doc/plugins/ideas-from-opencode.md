# 来自 OpenCode 的插件构想

状态：设计报告，非 V1 承诺

Paperclip V1 在 [doc/SPEC-implementation.md](../SPEC-implementation.md) 中明确排除了插件框架，但长期规划说明架构应为扩展留有空间。本报告研究了 `opencode` 的插件系统，并将其有用的模式转化为适合 Paperclip 的设计。

本文件的假设：Paperclip 是一个单租户、由操作员控制的实例。因此插件安装应在整个实例范围内是全局性的。"公司"仍然是 Paperclip 的一等对象，但它们是组织记录，不是插件信任或安装的租户隔离边界。

## 执行摘要

`opencode` 已有成熟的插件系统。它特意降低了使用门槛：

- 插件是普通的 JS/TS 模块
- 从本地目录和 npm 包加载
- 可以挂载多种运行时事件
- 可以添加自定义工具
- 可以扩展 provider 认证流程
- 在进程内运行，可以直接改变运行时行为

这种模式对于本地编码工具效果很好。不应原封不动地复制到 Paperclip 中。

主要结论：

- Paperclip 应借鉴 `opencode` 的类型化 SDK、确定性加载、低编写门槛和清晰的扩展面。
- Paperclip 不应借鉴 `opencode` 的信任模型、项目本地插件加载、"按名称冲突覆盖"行为，或针对核心业务逻辑的任意进程内变更钩子。
- Paperclip 应使用多个扩展类而非一个通用插件袋：
  - 可信的进程内模块，用于低级平台关注点，如 agent 适配器、存储 provider、密钥 provider，以及可能的运行日志后端
  - 进程外插件，用于大多数第三方集成，如 Linear、GitHub Issues、Grafana、Stripe 和调度器
  - 插件贡献的 agent 工具（带命名空间，非冲突覆盖）
  - 插件打包的 React UI，通过类型化桥接加载到宿主扩展槽位
  - 类型化事件总线，具有服务端过滤和插件间事件，以及用于自动化的定时任务

如果 Paperclip 做得好，你列出的例子将变得简单：

- 文件浏览器 / 终端 / git 工作流 / 子进程追踪成为工作区插件，从宿主解析路径并直接处理操作系统操作
- Linear / GitHub / Grafana / Stripe 成为连接器插件
- 未来的知识库和财务功能也可以适用相同模式

## 审查的来源

我克隆了 `anomalyco/opencode` 并审查了提交：

- `a965a062595403a8e0083e85770315d5dc9628ab`

审查的主要文件：

- `https://github.com/anomalyco/opencode/blob/a965a062595403a8e0083e85770315d5dc9628ab/packages/plugin/src/index.ts`
- `https://github.com/anomalyco/opencode/blob/a965a062595403a8e0083e85770315d5dc9628ab/packages/plugin/src/tool.ts`
- `https://github.com/anomalyco/opencode/blob/a965a062595403a8e0083e85770315d5dc9628ab/packages/opencode/src/plugin/index.ts`
- `https://github.com/anomalyco/opencode/blob/a965a062595403a8e0083e85770315d5dc9628ab/packages/opencode/src/config/config.ts`
- `https://github.com/anomalyco/opencode/blob/a965a062595403a8e0083e85770315d5dc9628ab/packages/opencode/src/tool/registry.ts`
- `https://github.com/anomalyco/opencode/blob/a965a062595403a8e0083e85770315d5dc9628ab/packages/opencode/src/provider/auth.ts`
- `https://github.com/anomalyco/opencode/blob/a965a062595403a8e0083e85770315d5dc9628ab/packages/web/src/content/docs/plugins.mdx`
- `https://github.com/anomalyco/opencode/blob/a965a062595403a8e0083e85770315d5dc9628ab/packages/web/src/content/docs/custom-tools.mdx`
- `https://github.com/anomalyco/opencode/blob/a965a062595403a8e0083e85770315d5dc9628ab/packages/web/src/content/docs/ecosystem.mdx`

审查的 Paperclip 相关文件（当前扩展接缝）：

- [server/src/adapters/registry.ts](../../server/src/adapters/registry.ts)
- [ui/src/adapters/registry.ts](../../ui/src/adapters/registry.ts)
- [server/src/storage/provider-registry.ts](../../server/src/storage/provider-registry.ts)
- [server/src/secrets/provider-registry.ts](../../server/src/secrets/provider-registry.ts)
- [server/src/services/run-log-store.ts](../../server/src/services/run-log-store.ts)
- [server/src/services/activity-log.ts](../../server/src/services/activity-log.ts)
- [doc/SPEC.md](../SPEC.md)
- [doc/SPEC-implementation.md](../SPEC-implementation.md)

## OpenCode 实际实现的内容

## 1. 插件编写 API

`opencode` 提供了一个小型包 `@opencode-ai/plugin`，带有类型化的 `Plugin` 函数和类型化的 `tool()` 辅助函数。

核心结构：

- 插件是一个接收 context 对象的异步函数
- 插件返回一个 `Hooks` 对象
- 钩子是可选的
- 插件也可以贡献工具和认证 provider

插件初始化 context 包括：

- SDK 客户端
- 当前项目信息
- 当前目录
- 当前 git worktree
- 服务器 URL
- Bun shell 访问

这很重要：`opencode` 立即赋予插件丰富的运行时能力，而不是狭窄的能力 API。

## 2. 钩子模型

钩子集很广泛，包括：

- 事件订阅
- 配置时钩子
- 消息钩子
- 模型参数 / 请求头钩子
- 权限决策钩子
- Shell 环境注入
- 工具执行前 / 后钩子
- 工具定义变更
- 压缩提示自定义
- 文本补全转换

实现模式非常简单：

- 核心代码构造一个 `output` 对象
- 每个匹配的插件钩子顺序运行
- 钩子变更 `output`
- 最终变更后的 output 被核心使用

这很优雅且易于扩展。

它也非常强大。插件可以更改认证头、模型参数、权限答案、工具输入、工具描述和 shell 环境。

## 3. 插件发现和加载顺序

`opencode` 支持两种插件来源：

- 本地文件
- npm 包

本地目录：

- `~/.config/opencode/plugins/`
- `.opencode/plugins/`

Npm 插件：

- 在 config 的 `plugin: []` 下列出

加载顺序是确定性的且有文档记录：

1. 全局 config
2. 项目 config
3. 全局插件目录
4. 项目插件目录

重要细节：

- config 数组是拼接而非替换
- 重复的插件名称去重，高优先级的条目获胜
- 内部第一方插件和默认插件也通过插件管道加载

这给了 `opencode` 一个真正的优先级模型，而不是"最后加载的意外"。

## 4. 依赖处理

对于本地 config/ 插件目录，`opencode` 会：

- 确保存在 `package.json`
- 注入 `@opencode-ai/plugin`
- 运行 `bun install`

这允许本地插件和本地自定义工具导入依赖。

这对于本地开发人员 ergonomics 非常好。

对于操作员控制的控制平面服务器来说，这不是安全的默认值。

## 5. 错误处理

插件加载失败默认不会使运行时崩溃。

相反，`opencode`：

- 记录错误
- 发布会话错误事件
- 继续加载其他插件

这是一个好的运营模式。一个坏插件不应使整个产品崩溃，除非操作员明确将其配置为必需。

## 6. 工具是一等扩展点

`opencode` 有两种添加工具的方式：

- 通过 `hook.tool` 从插件直接导出工具
- 在 `.opencode/tools/` 或全局工具目录中定义本地文件

工具 API 很强大：

- 工具有描述
- 工具有 Zod schema
- 工具执行获取 session ID、消息 ID、目录和 worktree 等上下文
- 工具合并到与内置工具相同的注册表中
- 工具定义本身可以被 `tool.definition` 钩子变更

设计中最激进的部分：

- 自定义工具可以通过名称覆盖内置工具

这对于本地编码助手来说非常强大。
对于 Paperclip 核心操作来说太危险了。

然而，插件贡献 agent 可用工具的概念对 Paperclip 非常有价值——只要插件工具使用命名空间（不能遮蔽核心工具）并受能力限制。

## 7. 认证也是插件面

`opencode` 允许插件为 provider 注册认证方法。

插件可以贡献：

- 认证方法元数据
- 提示流程
- OAuth 流程
- API 密钥流程
- 在认证成功后调整 provider 行为的请求加载器

这是一个值得借鉴的强模式。集成通常需要自定义认证 UX 和 token 处理。

## 8. 生态系统证据

生态系统页面是该模式在实践中运行良好的最佳证明。
社区插件已覆盖：

- 沙盒 / 工作区系统
- 认证 provider
- 会话头 / 遥测
- 记忆 / 上下文功能
- 调度
- 通知
- worktree 辅助工具
- 后台 agent
- 监控

这验证了主要论点：简单的类型化插件 API 可以产生真正的生态系统 velocity。

## OpenCode 做对的地方

## 1. 将插件 SDK 与宿主运行时分离

这是设计最好的部分之一。

- 插件作者针对干净的公共包编写代码
- 宿主内部可以在加载器后面演进
- 运行时代码和插件代码有干净的契约边界

Paperclip 绝对应该这样做。

## 2. 确定性加载和优先级

`opencode` 明确说明：

- 插件来自哪里
- config 如何合并
- 什么顺序获胜

Paperclip 应该借鉴这种纪律。

## 3. 低仪式编写

插件作者不必学习一个大型框架。

- 导出 async function
- 返回 hooks
- 可选导出工具

这种简单性很重要。

## 4. 类型化的工具定义

`tool()` 辅助函数非常出色：

- 类型化的
- 基于 schema
- 易于文档化
- 易于运行时验证

Paperclip 应该为插件操作、自动化和 UI schema 采用这种风格。

## 5. 内置功能和插件使用相似的形状

`opencode` 在多个地方将相同的钩子系统用于内部和外部插件风格行为。
这减少了特殊情况。

Paperclip 可以从适配器、密钥后端、存储 provider 和连接器模块中受益。

## 6. 增量扩展，而非前期大抽象

`opencode` 不是先设计一个大型市场平台。
它添加了真实功能需要的具体扩展点。

这也是 Paperclip 的正确心态。

## Paperclip 不应直接复制的内容

## 1. 进程内任意插件代码作为默认值

`opencode` 本质上是一个本地 agent 运行时，因此对其受众来说，不沙盒化的插件执行是可以接受的。

Paperclip 是一个用于管理实例的操作员管理的控制平面，具有公司对象。
风险配置文件不同：

- 密钥很重要
- 审批门很重要
- 预算很重要
- 变更操作需要可审计性

默认情况下，第三方插件不应在无限制的进程内访问服务器内存、数据库句柄和密钥的情况下运行。

## 2. 项目本地插件加载

`opencode` 有项目本地插件文件夹，因为该工具以代码库为中心。

Paperclip 不是项目范围的。它是实例范围的。
可比较的单位是：

- 实例安装的插件包

Paperclip 不应像 `.paperclip/plugins` 或项目目录那样自动加载工作区仓库中的任意代码。

## 3. 核心业务决策的任意变更钩子

像以下这样的钩子：

- `permission.ask`
- `tool.execute.before`
- `chat.headers`
- `shell.env`

在 `opencode` 中是有意义的。

对于 Paperclip，相当于进入：

- 审批决策
- 问题检出语义
- 活动日志行为
- 预算执行

将是一个错误。

核心不变量应保留在核心代码中，而不是成为可钩子重写的。

## 4. 按名称冲突覆盖

允许插件按名称替换内置工具在本地 agent 产品中很有用。

Paperclip 不应允许插件静默替换：

- 核心路由
- 核心变更操作
- 认证行为
- 权限评估器
- 预算逻辑
- 审计逻辑

扩展应该是增量的或明确委托的，而不是意外遮蔽。

## 5. 从用户配置自动安装和执行

`opencode` 的"在启动时安装依赖"流程很人性化。
对于 Paperclip 来说这很危险，因为它结合了：

- 包安装
- 代码加载
- 执行

在控制平面服务器启动路径中。

Paperclip 应要求明确的操作员安装步骤。

## 为什么 Paperclip 需要不同的形状

产品解决不同的问题。

| 主题 | OpenCode | Paperclip |
|---|---|---|
| 主要单位 | 本地项目 / worktree | 具有公司对象的单租户操作员实例 |
| 信任假设 | 本地高级用户在自己的机器上 | 管理一个受信任 Paperclip 实例的操作员 |
| 失败爆炸半径 | 本地会话 / 运行时 | 整个公司控制平面 |
| 扩展风格 | 自由变更运行时行为 | 保持治理和可审计性 |
| UI 模型 | 本地应用可以加载本地行为 | 面板 UI 必须保持一致和安全 |
| 安全模型 | 宿主信任的本地插件 | 需要能力边界和可审计性 |

这意味着 Paperclip 应该借鉴 `opencode` 的好想法，但使用更严格的架构。

## Paperclip 已有有用的预插件接缝

Paperclip 已有多个类似扩展的接缝：

- 服务器适配器注册表：[server/src/adapters/registry.ts](../../server/src/adapters/registry.ts)
- UI 适配器注册表：[ui/src/adapters/registry.ts](../../ui/src/adapters/registry.ts)
- 存储 provider 注册表：[server/src/storage/provider-registry.ts](../../server/src/storage/provider-registry.ts)
- 密钥 provider 注册表：[server/src/secrets/provider-registry.ts](../../server/src/secrets/provider-registry.ts)
- 可插拔运行日志存储接缝：[server/src/services/run-log-store.ts](../../server/src/services/run-log-store.ts)
- 活动日志和实时事件发射：[server/src/services/activity-log.ts](../../server/src/services/activity-log.ts)

这是好消息。
Paperclip 不需要从头发明扩展性。
它需要统一和强化现有接缝。

## 推荐的 Paperclip 插件模型

## 1. 使用多个扩展类

不要为所有内容创建一个巨大的 `hooks` 对象。

使用具有不同信任模型的不同插件类。

| 扩展类 | 示例 | 运行时模型 | 信任级别 | 原因 |
|---|---|---|---|---|
| 平台模块 | agent 适配器、存储 provider、密钥 provider、运行日志后端 | 进程内 | 高度可信 | 紧密集成、性能、低级 API |
| 连接器插件 | Linear、GitHub Issues、Grafana、Stripe | 进程外 worker 或 sidecar | 中等 | 外部同步、更安全的隔离、更清晰的故障边界 |
| 工作区插件 | 文件浏览器、终端、git 工作流、子进程 / 服务器追踪 | 进程外，直接操作系统访问 | 中等 | 从宿主解析工作区路径，直接拥有文件系统 / git / PTY / 进程逻辑 |
| UI 贡献 | 仪表板小部件、设置表单、公司面板 | 通过桥接在宿主扩展槽中加载的插件打包 React bundles | 中等 | 插件拥有自己的渲染；宿主控制槽位放置和桥接访问 |
| 自动化插件 | 告警、调度器、同步任务、webhook 处理器 | 进程外 | 中等 | 事件驱动自动化是自然的插件契合点 |

这种拆分是本报告中最重要的设计建议。

## 2. 将低级模块与第三方插件分开

Paperclip 已经有这种模式的隐含形式：

- 适配器是一回事
- 存储 provider 是另一回事
- 密钥 provider 是另一回事

保持这种分离。

我会这样 formalize：

- `module` 意味着由宿主加载的可信代码，用于低级运行时服务
- `plugin` 意味着通过类型化插件协议和能力模型与 Paperclip 对话的集成代码

这避免尝试将 Stripe、PTY 终端和新 agent 适配器强制到同一个抽象中。

## 3. 优先使用事件驱动扩展而非核心逻辑变更

对于第三方插件，主要 API 应该是：

- 订阅类型化域事件（带可选的服务端过滤）
- 发射插件命名空间事件用于跨插件通信
- 读取实例状态，包括相关的公司绑定业务记录
- 注册 webhook
- 运行定时任务
- 贡献 agent 在运行期间可以使用的工具
- 写入插件拥有的状态
- 添加附加 UI 面
- 通过 API 调用显式 Paperclip 操作

不要让第三方插件负责：

- 决定审批是否通过
- 拦截问题检出语义
- 重写活动日志行为
- 覆盖预算硬停止

那些是核心不变量。

## 4. 插件打包自己的 UI

插件将自己的 React UI 作为打包模块包含在 `dist/ui/` 中。宿主将插件组件加载到指定的**扩展槽**（页面、选项卡、小部件、侧边栏条目）中，并提供**桥接**供插件前端与其自己的 worker 后端通信以及访问宿主上下文。

**工作原理：**

1. 插件的 UI 为其填充的每个槽导出命名组件（例如 `DashboardWidget`、`IssueDetailTab`、`SettingsPage`）。
2. 宿主将插件组件挂载到正确的槽中，传递一个带有 `usePluginData(key, params)` 和 `usePluginAction(key)` 等钩子的桥接对象。
3. 插件组件通过桥接从自己的 worker 获取数据并按需渲染。
4. 宿主通过桥接执行能力门控——如果 worker 没有能力，桥接拒绝调用。

**宿主控制的内容：** 插件组件出现的位置、桥接 API、能力执行和共享 UI 原语（`@paperclipai/plugin-sdk/ui`），包含设计标记和通用组件。

**插件控制的内容：** 如何渲染其数据、获取什么数据、暴露什么操作，以及是否使用宿主的共享组件或构建完全自定义的 UI。

第一版扩展槽：

- 仪表板小部件
- 设置页面
- 详情页选项卡（项目、问题、agent、目标、运行）
- 侧边栏条目
- 公司上下文插件页面

宿主 SDK 提供共享组件（MetricCard、DataTable、StatusBadge、LogView 等）以保持视觉一致性，但这些是可选的。

以后，如果不受信任的第三方插件变得普遍，宿主可以迁移到基于 iframe 的隔离，而无需更改插件的源代码（桥接 API 保持不变）。

## 5. 使安装成为全局性的，并保持映射 / config 分离

`opencode` 主要是用户级本地 config。
Paperclip 应将插件安装视为全局实例级操作。

示例：

- 安装 `@paperclip/plugin-linear` 一次
- 立即使其在各处可用
- 可选存储对 Paperclip 对象的映射，以防一个公司映射到与另一个不同的 Linear 团队

## 6. 使用项目工作区作为本地工具的主要锚点

Paperclip 已经有用于项目的具体工作区模型：

- 项目暴露 `workspaces` 和 `primaryWorkspace`
- 数据库已有 `project_workspaces`
- 项目路由已支持创建、更新和删除工作区
- 心跳解析已优先项目工作区，然后回退到任务会话或 agent 主目录工作区

这意味着本地 / 运行时插件通常应首先锚定到项目，而不是发明并行工作区模型。

实际指导：

- 文件浏览器应首先浏览项目工作区
- 终端会话应可从项目工作区启动
- git 应将项目工作区视为 repo 根锚点
- 开发服务器和子进程追踪应附加到项目工作区
- 问题和 agent 视图仍可 deep-link 到相关项目工作区上下文

换句话说：

- `project` 是业务对象
- `project_workspace` 是本地运行时锚点
- 插件应在此基础上构建，而不是先创建不相关的工作区模型

## 7. 让插件贡献 agent 工具

`opencode` 将工具作为一等扩展点。这对 Paperclip 也是最高价值的表面之一。

Linear 插件应能够贡献一个 `search-linear-issues` 工具，供 agent 在运行期间使用。git 插件应贡献 `create-branch` 和 `get-diff`。文件浏览器插件应贡献 `read-file` 和 `list-directory`。

关键约束：

- 插件工具按插件 ID 命名空间（例如 `linear:search-issues`），因此它们不能遮蔽核心工具
- 插件工具需要 `agent.tools.register` 能力
- 工具执行通过与其他所有内容相同的 worker RPC 边界进行
- 工具结果出现在运行日志中

这是自然契合——插件已有 SDK 上下文、外部 API 凭证和域逻辑。将这些包装在工具定义中对插件作者来说是最小的额外工作。

## 8. 支持插件间事件

插件应能够发出其他插件可以订阅的自定义事件。例如，git 插件检测到推送并发出 `plugin.@paperclip/plugin-git.push-detected`。GitHub Issues 插件订阅该事件并更新 PR 链接。

这避免了插件需要通过共享状态或外部通道进行协调。宿主通过相同的事件总线路由插件事件，具有与核心事件相同的传递语义。

插件事件使用 `plugin.<pluginId>.*` 命名空间，因此它们不能与核心事件冲突。

## 9. 从 config schema 自动生成设置 UI

声明了 `instanceConfigSchema` 的插件应免费获得自动生成设置表单。宿主直接从 JSON Schema 呈现文本输入、下拉框、切换开关、数组和密钥引用选择器。

对于需要更丰富设置 UX 的插件，它们可以声明 `settingsPage` 扩展槽并打包自定义 React 组件。两种方法共存。

这很重要，因为设置表单是每个插件都需要的样板。从已存在的 schema 自动生成它们可以消除大量的编写摩擦。

## 10. 为优雅关闭和升级设计

spec 应明确说明插件 worker 停止时会发生什么——在升级、卸载或实例重启期间。

推荐策略：

- 发送带有可配置截止日期的 `shutdown()`（默认 10 秒）
- 截止日期后 SIGTERM，再 5 秒后 SIGKILL
- 进行中的任务标记为 `cancelled`
- 进行中的桥接调用向 UI 返回结构化错误

对于特定升级：旧 worker 排空，新 worker 启动。如果新版本添加了能力，它进入 `upgrade_pending` 状态，直到操作员批准。

## 11. 定义卸载数据生命周期

当插件被卸载时，其数据（`plugin_state`、`plugin_entities`、`plugin_jobs` 等）应保留一段宽限期（默认 30 天），而不是立即删除。操作员可以在宽限期内重新安装并恢复状态，或通过 CLI 强制清除。

这很重要，因为意外卸载不应导致不可逆的数据丢失。

## 12. 投资插件可观测性

通过 `ctx.logger` 的插件日志应可从插件设置页面存储和查询。宿主还应捕获 worker 进程的原始 `stdout`/`stderr` 作为回退。

插件健康仪表板应显示：worker 状态、正常运行时间、最近日志、任务成功 / 失败率、webhook 传递率和资源使用情况。宿主应发出内部事件（`plugin.health.degraded`、`plugin.worker.crashed`），其他插件或仪表板可以消费。

这对操作员至关重要。没有可观测性，调试插件问题需要 SSH 访问和手动日志 tailing。

## 13. 打包测试工具链和入门模板

`@paperclipai/plugin-test-harness` 包应提供带有内存存储、合成事件发射和 `getData`/`performAction`/`executeTool` 模拟的模拟宿主。插件作者应能够编写单元测试，而无需运行 Paperclip 实例。

`create-paperclip-plugin` CLI 应搭建包含清单、worker、UI bundle、测试文件和构建配置的工作插件。

低编写摩擦被指出为 `opencode` 最好的品质之一。测试工具链和入门模板是 Paperclip 实现相同目标的方式。

## 14. 支持热插件生命周期

插件安装、卸载、升级和 config 更改应生效而无需重启 Paperclip 服务器。这对开发人员工作流和操作员体验至关重要。

进程外 worker 架构使这变得自然：

- **热安装**：生成新的 worker，在实时路由表中注册其事件订阅、任务调度、webhook 端点和 agent 工具，将 UI bundle 加载到扩展槽注册表中。
- **热卸载**：优雅关闭 worker，从路由表中删除所有注册，卸载 UI 组件，开始数据保留宽限期。
- **热升级**：关闭旧 worker，启动新 worker，原子交换路由表条目，使 UI bundle 缓存失效，以便前端加载更新的 bundle。
- **热 config 更改**：将新 config 写入 `plugin_config`，通过 IPC 通知运行中的 worker（`configChanged`）。worker 应用更改而不重启。如果它不处理 `configChanged`，宿主仅重启该 worker。

前端缓存失效使用版本化或内容哈希的 bundle URL 和 `plugin.ui.updated` 事件，触发重新导入而无需完全页面重新加载。

每个 worker 进程是独立的——启动、停止或替换一个 worker 永远不会影响任何其他插件或宿主本身。

## 15. 定义 SDK 版本控制和兼容性

`opencode` 没有正式的 SDK 版本控制故事，因为插件在进程内运行，有效地固定到当前运行时。Paperclip 的进程外模型意味着插件可能针对一个 SDK 版本构建，但在已向前移动的宿主上运行。这需要明确的规则。

推荐方法：

- **单一 SDK 包**：`@paperclipai/plugin-sdk`，带子路径导出——worker 代码的根，`/ui` 用于前端代码。一个依赖、一个版本、一个 changelog。
- **SDK 主版本 = API 版本**：`@paperclipai/plugin-sdk@2.x` 针对 `apiVersion: 2`。使用 SDK 1.x 构建的插件声明 `apiVersion: 1` 并继续工作。
- **宿主多版本支持**：宿主同时支持至少当前和上一个 `apiVersion`，每个版本有单独的 IPC 协议处理器。
- **manifest 中的 `sdkVersion`**：插件声明一个 semver 范围（例如 `">=1.4.0 <2.0.0"`）。宿主在安装时验证。
- **弃用时间线**：新版本发布后，旧 API 版本至少获得 6 个月的持续支持。宿主记录弃用警告并在插件设置页面上显示横幅。
- **迁移指南**：每个主要 SDK 版本都附带分步迁移指南，涵盖每个破坏性更改。
- **UI 表面与 worker 同时版本化**：worker 和 UI 表面都在同一个包中，因此它们一起版本化。共享 UI 组件的破坏性更改需要像 worker API 更改一样的主要版本升级。
- **发布的兼容性矩阵**：宿主发布支持的 API 版本和 SDK 范围矩阵，可通过 API 查询。

## Paperclip 的具体 SDK 形状

故意缩小的第一版可能如下所示：

```ts
import { definePlugin, z } from "@paperclipai/plugin-sdk";

export default definePlugin({
  id: "@paperclip/plugin-linear",
  version: "0.1.0",
  categories: ["connector", "ui"],
  capabilities: [
    "events.subscribe",
    "jobs.schedule",
    "http.outbound",
    "instance.settings.register",
    "ui.dashboardWidget.register",
    "secrets.read-ref",
  ],
  instanceConfigSchema: z.object({
    linearBaseUrl: z.string().url().optional(),
    companyMappings: z.array(
      z.object({
        companyId: z.string(),
        teamId: z.string(),
        apiTokenSecretRef: z.string(),
      }),
    ).default([]),
  }),
  async register(ctx) {
    ctx.jobs.register("linear-pull", { cron: "*/5 * * * *" }, async (job) => {
      // sync Linear issues into plugin-owned state or explicit Paperclip entities
    });

    // subscribe with optional server-side filter
    ctx.events.on("issue.created", { projectId: "proj-1" }, async (event) => {
      // only receives issue.created events for project proj-1
    });

    // subscribe to events from another plugin
    ctx.events.on("plugin.@paperclip/plugin-git.push-detected", async (event) => {
      // react to the git plugin detecting a push
    });

    // contribute a tool that agents can use during runs
    ctx.tools.register("search-linear-issues", {
      displayName: "Search Linear Issues",
      description: "Search for Linear issues by query",
      parametersSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    }, async (params, runCtx) => {
      // search Linear API and return results
      return { content: JSON.stringify(results) };
    });

    // getData is called by the plugin's own UI components via the host bridge
    ctx.data.register("sync-health", async ({ companyId }) => {
      // return typed JSON that the plugin's DashboardWidget component renders
      return { syncedCount: 142, trend: "+12 today", mappings: [...] };
    });

    ctx.actions.register("resync", async ({ companyId }) => {
      // run sync logic
    });
  },
});
```

插件的 UI bundle（与 worker 分开）可能如下所示：

```tsx
// dist/ui/index.tsx
import { usePluginData, usePluginAction, MetricCard, ErrorBoundary } from "@paperclipai/plugin-sdk/ui";

export function DashboardWidget({ context }: PluginWidgetProps) {
  const { data, loading, error } = usePluginData("sync-health", { companyId: context.companyId });
  const resync = usePluginAction("resync");

  if (loading) return <Spinner />;
  if (error) return <div>Plugin error: {error.message} ({error.code})</div>;

  return (
    <ErrorBoundary fallback={<div>Widget failed to render</div>}>
      <MetricCard label="Synced Issues" value={data.syncedCount} trend={data.trend} />
      <button onClick={() => resync({ companyId: context.companyId })}>Resync Now</button>
    </ErrorBoundary>
  );
}
```

重要的不是确切的语法。

重要的是契约形状：

- 类型化 manifest
- 显式能力
- 带有可选公司映射的显式全局 config
- 带可选服务端过滤的事件订阅
- 通过命名空间事件类型的插件间事件
- agent 工具贡献
- 任务
- 通过宿主桥接与其 worker 通信的插件打包 UI
- 从 worker 到 UI 的结构化错误传播

## 推荐的Core扩展面

## 1. 平台模块表面

这些应保持接近当前的注册表风格。

候选者：

- `registerAgentAdapter()`
- `registerStorageProvider()`
- `registerSecretProvider()`
- `registerRunLogStore()`

这些是可信的平台模块，不是随意插件。

## 2. 连接器插件表面

这些是最近期最高价值、最低风险的插件候选者。

能力：

- 订阅域事件
- 定义定时同步任务
- 在 `/api/plugins/:pluginId/...` 下暴露插件特定 API 路由
- 使用公司密钥引用
- 写入插件状态
- 发布仪表板数据
- 通过核心 API 记录活动

示例：

- Linear 问题同步
- GitHub 问题同步
- Grafana 仪表板卡片
- Stripe MRR / 订阅汇总

## 3. 工作区运行时表面

工作区插件直接处理本地工具：

- 文件浏览器
- 终端
- git 工作流
- 子进程追踪
- 本地开发服务器追踪

插件通过宿主 API（`ctx.projects` 提供工作区元数据，包括 `cwd`、`repoUrl` 等）解析工作区路径，然后使用标准 Node API 或它们选择的任何库对文件系统进行操作、生成进程、shell 到 `git` 或打开 PTY 会话。

宿主不包装或代理这些操作。这保持了核心的精简——无需为插件可能需要的每个操作系统级操作维护并行 API 表面。插件拥有自己的实现。

## 治理和安全要求

任何 Paperclip 插件系统都必须保留 repo 文档中的核心控制平面不变量。

这意味着：

- 插件安装对实例是全局的
- "公司"在 API 和数据模型中仍然是业务对象，不是租户边界
- 审批门仍然是核心拥有的
- 预算硬停止仍然是核心拥有的
- 变更操作被记录活动日志
- 密钥仍然基于引用并在日志中编辑

我会为每个插件要求以下：

## 1. 能力声明

每个插件声明一个静态能力集，例如：

- `companies.read`
- `issues.read`
- `issues.write`
- `events.subscribe`
- `events.emit`
- `jobs.schedule`
- `http.outbound`
- `webhooks.receive`
- `assets.read`
- `assets.write`
- `secrets.read-ref`
- `agent.tools.register`
- `plugin.state.read`
- `plugin.state.write`

Board / 操作员在安装前看到这些。

## 2. 全局安装

插件安装一次，并在整个实例中可用。
如果它需要映射到特定的 Paperclip 对象，那些是插件数据，不是启用 / 禁用边界。

## 3. 活动日志

插件产生的变更应通过相同的活动日志机制流动，带有专用的 `plugin` 执行者类型：

- `actor_type = plugin`
- `actor_id = <plugin-id>`（例如 `@paperclip/plugin-linear`）

## 4. 健康和故障报告

每个插件应暴露：

- 启用 / 禁用状态
- 最近一次成功运行
- 最近一次错误
- 最近的 webhook / 任务历史

一个损坏的插件不能破坏其余的公司。

## 5. 密钥处理

插件应接收密钥引用，而不是 config 持久化中的原始密钥值。
解析应通过现有的密钥 provider 抽象进行。

## 6. 资源限制

插件应有：

- 超时限制
- 并发限制
- 重试策略
- 可选的按插件预算

这对同步连接器和工作区插件尤其重要。

## 考虑添加的数据模型

我会避免在第一版中使用"任意第三方插件定义的 SQL 迁移"。
那太早给予太多权力。

正确的思维模型是：

- 当数据明显是 Paperclip 本身的一部分时，重用核心表
- 对大多数插件拥有的状态使用通用扩展表
- 只在以后允许插件特定表，并且仅针对可信平台模块或严格控制的迁移工作流

## 推荐的扩展 Postgres 策略

### 1. 核心表保持为核心

如果一个概念正在成为 Paperclip 实际产品模型的一部分，它应该获得一个正常的第一方表。

示例：

- `project_workspaces` 已经是核心表，因为项目工作区现在是 Paperclip 本身的一部分
- 如果未来的"项目 git 状态"成为核心功能而非插件拥有的元数据，那也应该是第一方表

### 2. 大多数插件应从通用扩展表开始

对于大多数插件，宿主应提供几个通用持久化表，插件在那里存储命名空间记录。

这保持系统可管理：

- 更简单的迁移
- 更简单的备份 / 恢复
- 更简单的可移植性故事
- 更简单的操作员审查
- 更少的插件 schema 漂移破坏实例的机会

### 3. 在添加自定义 schema 之前先按 Paperclip 对象限定插件数据

很多插件数据自然挂在现有 Paperclip 对象上：

- 项目工作区插件状态通常应限定到 `project` 或 `project_workspace`
- 问题同步状态应限定到 `issue`
- 指标小部件可能限定到 `company`、`project` 或 `goal`
- 进程追踪可能限定到 `project_workspace`、`agent` 或 `run`

这为引入自定义表之前提供了良好的默认键控模型。

### 4. 稍后添加可信模块迁移，而不是现在任意插件迁移

如果 Paperclip 最终需要扩展拥有的表，我只允许用于：

- 可信的第一方包
- 可信的平苔模块
- 也许明确安装的经过管理员审查的固定版本插件

我不会让随机第三方插件在启动时自由运行任意表单 schema 迁移。

如果需要，以后再添加控制机制。

## 建议的基线扩展表

## 1. `plugins`

实例级安装记录。

建议字段：

- `id`
- `package_name`
- `version`
- `categories`
- `manifest_json`
- `installed_at`
- `status`

## 2. `plugin_config`

实例级插件配置。

建议字段：

- `id`
- `plugin_id`
- `config_json`
- `created_at`
- `updated_at`
- `last_error`

## 3. `plugin_state`

插件的通用键 / 值状态。

建议字段：

- `id`
- `plugin_id`
- `scope_kind`（`instance | company | project | project_workspace | agent | issue | goal | run`）
- `scope_id` nullable
- `namespace`
- `state_key`
- `value_json`
- `updated_at`

这对于允许自定义表之前的许多连接器来说已经足够。

示例：

- 按 `issue` 键控的 Linear 外部 ID
- 按 `project` 键控的 GitHub 同步游标
- 按 `project_workspace` 键控的文件浏览器偏好
- 按 `project_workspace` 键控的 git 分支元数据
- 按 `project_workspace` 或 `run` 键控的进程元数据

## 4. `plugin_jobs`

定时任务和运行追踪。

建议字段：

- `id`
- `plugin_id`
- `scope_kind` nullable
- `scope_id` nullable
- `job_key`
- `status`
- `last_started_at`
- `last_finished_at`
- `last_error`

## 5. `plugin_webhook_deliveries`

如果插件暴露 webhook，传递历史值得存储。

建议字段：

- `id`
- `plugin_id`
- `scope_kind` nullable
- `scope_id` nullable
- `endpoint_key`
- `status`
- `received_at`
- `response_code`
- `error`

## 6. 以后可能：`plugin_entities`

如果通用插件状态变得过于限制，在允许任意插件迁移之前，添加结构化的、可查询的实体表用于连接器记录。

建议字段：

- `id`
- `plugin_id`
- `entity_type`
- `scope_kind`
- `scope_id`
- `external_id`
- `title`
- `status`
- `data_json`
- `updated_at`

这是一个有用的中间地带：

- 比不透明的键 / 值状态更可查询
- 仍然避免让每个插件立即创建自己的关系 schema

## 请求的示例如何映射到此模型

| 用例 | 最佳匹配 | 需要的宿主原语 | 备注 |
|---|---|---|---|
| 文件浏览器 | 工作区插件 | 项目工作区元数据 | 插件直接拥有文件系统操作 |
| 终端 | 工作区插件 | 项目工作区元数据 | 插件直接生成 PTY 会话 |
| Git 工作流 | 工作区插件 | 项目工作区元数据 | 插件直接 shell 到 git |
| Linear 问题追踪 | 连接器插件 | 任务、webhook、密钥引用、问题同步 API | 非常强的插件候选者 |
| GitHub 问题追踪 | 连接器插件 | 任务、webhook、密钥引用 | 非常强的插件候选者 |
| Grafana 指标 | 连接器插件 + 仪表板小部件 | 出站 HTTP | 可能先只读 |
| 子进程 / 服务器追踪 | 工作区插件 | 项目工作区元数据 | 插件直接管理进程 |
| Stripe 收入追踪 | 连接器插件 | 密钥引用、定时同步、公司指标 API | 强的插件候选者 |

# 插件示例

## 工作区文件浏览器

包概念：`@paperclip/plugin-workspace-files`

此插件让 board 检查项目工作区、agent 工作区、生成的工件和问题相关文件，无需降级到 shell。它用于：

- 在项目工作区内浏览文件
- 调试 agent 更改的内容
- 在审批前审查生成的输出
- 将文件从工作区附加到问题
- 了解公司的 repo 布局
- 在本地可信模式下检查 agent 主目录工作区

### UX

- 设置页面：`/settings/plugins/workspace-files`
- 主页面：`/:companyPrefix/plugins/workspace-files`
- 项目选项卡：`/:companyPrefix/projects/:projectId?tab=files`
- 可选问题选项卡：`/:companyPrefix/issues/:issueId?tab=files`
- 可选 agent 选项卡：`/:companyPrefix/agents/:agentId?tab=workspace`

主要屏幕和交互：

- 插件设置：
  - 选择插件是否默认为 `project.primaryWorkspace`
  - 选择哪些项目工作区可见
  - 选择是否允许文件写入或只读
  - 选择是否显示隐藏文件
- 主资源管理器页面：
  - 顶部的项目选择器
  - 作用域为所选项目 `workspaces` 的工作区选择器
  - 左侧的树视图
  - 右侧的文件预览窗格
  - 用于文件名 / 路径搜索的搜索框
  - 操作：复制路径、下载文件、附加到问题、打开 diff
- 项目选项卡：
  - 直接打开项目的首选工作区
  - 让 board 在所有项目工作区之间切换
  - 显示 `cwd`、`repoUrl` 和 `repoRef` 等工作区元数据
- 问题选项卡：
  - 解析问题的项目并打开该项目的工作区上下文
  - 显示链接到问题的文件
  - 让 board 将文件从项目工作区拉入问题附件
  - 显示每个链接文件的路径和最后修改信息
- Agent 选项卡：
  - 显示 agent 当前解析的工作区
  - 如果运行附加到项目，链接回项目工作区视图
  - 让 board 检查 agent 当前正在处理的文件

核心工作流：

- Board 打开一个项目并浏览其首选工作区文件。
- 当项目有多个 checkout 或 repo 引用时，Board 在一个项目工作区和另一个之间切换。
- Board 打开一个问题，从文件浏览器附加生成的工件，并留下审查评论。
- Board 打开 agent 详情页面以检查失败运行背后的确切文件。

### 需要的钩子

推荐的能力和扩展点：

- `instance.settings.register`
- `ui.sidebar.register`
- `ui.page.register`
- `ui.detailTab.register` 用于 `project`、`issue` 和 `agent`
- `projects.read`
- `project.workspaces.read`
- 可选 `assets.write`
- `activity.log.write`

插件通过 `ctx.projects` 解析工作区路径，并使用 Node API 直接处理所有文件系统操作（读取、写入、stat、搜索、列出目录）。

可选事件订阅：

- `events.subscribe(agent.run.started)`
- `events.subscribe(agent.run.finished)`
- `events.subscribe(issue.attachment.created)`

## 工作区终端

包概念：`@paperclip/plugin-terminal`

此插件为 board 提供用于项目工作区和 agent 工作区的受控终端 UI。它用于：

- 调试卡住的运行
- 验证环境状态
- 运行有针对性的手动命令
- 观看长时间运行的命令
- 将人工操作员与 agent 工作流配对

### UX

- 设置页面：`/settings/plugins/terminal`
- 主页面：`/:companyPrefix/plugins/terminal`
- 项目选项卡：`/:companyPrefix/projects/:projectId?tab=terminal`
- 可选 agent 选项卡：`/:companyPrefix/agents/:agentId?tab=terminal`
- 可选运行选项卡：`/:companyPrefix/agents/:agentId/runs/:runId?tab=terminal`

主要屏幕和交互：

- 插件设置：
  - 允许的 shell 和 shell 策略
  - 命令是只读、自由形式还是允许列表
  - 终端是否需要在启动前明确确认
  - 新终端会话是否默认为项目的首选工作区
- 终端主页：
  - 活动终端会话列表
  - 打开新会话的按钮
  - 项目选择器，然后从该项目的工作区中选择工作区
  - 可选的 agent 关联
  - 带输入、调整大小和重新连接支持的终端面板
  - 控制：中断、杀死、清除、保存记录
- 项目终端选项卡：
  - 打开已作用域到项目首选工作区的会话
  - 让 board 在项目的配置工作区之间切换
  - 显示该项目的最近命令和相关进程 / 服务器状态
- Agent 终端选项卡：
  - 打开已作用域到 agent 工作区的会话
  - 显示相关的最近运行和命令
- 运行终端选项卡：
  - 让 board 检查特定失败运行周围的环境

核心工作流：

- Board 针对 agent 工作区打开终端以重现失败的命令。
- Board 打开项目页面，直接在该项目的首选工作区启动终端。
- Board 从终端页面观看长时间运行的开发服务器或测试命令。
- Board 从同一 UI 杀死或中断失控进程。

### 需要的钩子

推荐的能力和扩展点：

- `instance.settings.register`
- `ui.sidebar.register`
- `ui.page.register`
- `ui.detailTab.register` 用于 `project`、`agent` 和 `run`
- `projects.read`
- `project.workspaces.read`
- `activity.log.write`

插件通过 `ctx.projects` 解析工作区路径，并使用 Node PTY 库直接处理 PTY 会话管理（打开、输入、调整大小、终止、订阅）。

可选事件订阅：

- `events.subscribe(agent.run.started)`
- `events.subscribe(agent.run.failed)`
- `events.subscribe(agent.run.cancelled)`

## Git 工作流

包概念：`@paperclip/plugin-git`

此插件在问题和工区周围添加 repo 感知的工作流工具。它用于：

- 与问题绑定的分支创建
- 快速 diff 审查
- 提交和工作区可见性
- PR 准备
- 将项目的首选工作区作为规范 repo 锚点
- 查看 agent 的工作区是干净还是脏的

### UX

- 设置页面：`/settings/plugins/git`
- 主页面：`/:companyPrefix/plugins/git`
- 项目选项卡：`/:companyPrefix/projects/:projectId?tab=git`
- 可选问题选项卡：`/:companyPrefix/issues/:issueId?tab=git`
- 可选 agent 选项卡：`/:companyPrefix/agents/:agentId?tab=git`

主要屏幕和交互：

- 插件设置：
  - 分支命名模板
  - 可选的远程 provider token 密钥引用
  - 写操作是启用还是只读
  - 插件是否始终使用 `project.primaryWorkspace`，除非选择了不同的项目工作区
- Git 概览页面：
  - 项目选择器和工作区选择器
  - 当前分支
  - 领先 / 落后状态
  - 脏文件摘要
  - 最近提交
  - 活动 worktree
  - 操作：刷新、创建分支、创建 worktree、暂存所有、提交、打开 diff
- 项目选项卡：
  - 在项目的首选工作区中打开
  - 显示工作区元数据和 repo 绑定（`cwd`、`repoUrl`、`repoRef`）
  - 显示该项目工作区的分支、diff 和提交历史
- 问题选项卡：
  - 解析问题的项目并使用该项目的工作区上下文
  - "从问题创建分支"操作
  - 作用域为项目所选工作区的 diff 视图
  - 将分支 / worktree 元数据链接到问题
- Agent 选项卡：
  - 显示 agent 的分支、worktree 和脏状态
  - 显示该 agent 产生的最近提交
  - 如果 agent 在项目工作区内工作，链接回项目 git 选项卡

核心工作流：

- Board 从问题创建分支并将其绑定到项目的首选工作区。
- Board 打开项目页面，审查该项目工作区的 diff，而不离开 Paperclip。
- Board 在不离开 Paperclip 的情况下审查运行后的 diff。
- Board 打开 worktree 列表以了解跨 agent 的并行分支。

### 需要的钩子

推荐的能力和扩展点：

- `instance.settings.register`
- `ui.sidebar.register`
- `ui.page.register`
- `ui.detailTab.register` 用于 `project`、`issue` 和 `agent`
- `ui.action.register`
- `projects.read`
- `project.workspaces.read`
- 可选 `agent.tools.register`（例如 `create-branch`、`get-diff`、`get-status`）
- 可选 `events.emit`（例如 `plugin.@paperclip/plugin-git.push-detected`）
- `activity.log.write`

插件通过 `ctx.projects` 解析工作区路径，并使用 git CLI 或 git 库直接处理所有 git 操作（status、diff、log、branch create、commit、worktree create、push）。

可选事件订阅：

- `events.subscribe(issue.created)`
- `events.subscribe(issue.updated)`
- `events.subscribe(agent.run.finished)`

git 插件可以发出其他插件（例如 GitHub Issues）订阅的 `plugin.@paperclip/plugin-git.push-detected` 事件，用于跨插件协调。

注意：GitHub / GitLab PR 创建可能应该放在单独的连接器插件中，而不是重载本地 git 插件。

## Linear 问题追踪

包概念：`@paperclip/plugin-linear`

此插件同步 Paperclip 工作与 Linear。它用于：

- 从 Linear 导入 backlog
- 将 Paperclip 问题链接到 Linear 问题
- 同步状态、评论和被分配人
- 将公司目标 / 项目映射到外部产品规划
- 让 board 在一个地方看到同步健康状况

### UX

- 设置页面：`/settings/plugins/linear`
- 主页面：`/:companyPrefix/plugins/linear`
- 仪表板小部件：`/:companyPrefix/dashboard`
- 可选问题选项卡：`/:companyPrefix/issues/:issueId?tab=linear`
- 可选项目选项卡：`/:companyPrefix/projects/:projectId?tab=linear`

主要屏幕和交互：

- 插件设置：
  - Linear API token 密钥引用
  - 工作区 / 团队 / 项目映射
  - Paperclip 和 Linear 之间的状态映射
  - 同步方向：仅导入、仅导出、双向
  - 评论同步切换
- Linear 概览页面：
  - 同步健康状况卡片
  - 最近的同步任务
  - 映射的项目和团队
  - 未解决的冲突队列
  - 团队、项目和问题的导入操作
- 问题选项卡：
  - 链接的 Linear 问题键和 URL
  - 同步状态和上次同步时间
  - 操作：链接现有、在 Linear 中创建、立即同步、取消链接
  - 同步的评论 / 状态更改时间线
- 仪表板小部件：
  - 开放的同步错误
  - 导入 vs 链接的问题计数
  - 最近的 webhook / 任务失败

核心工作流：

- Board 启用插件，映射 Linear 团队，并将 backlog 导入 Paperclip。
- Paperclip 问题状态更改推送到 Linear，Linear 评论通过 webhook 返回。
- Board 从插件页面解决映射冲突，而不是静默漂移状态。

### 需要的钩子

推荐的能力和扩展点：

- `instance.settings.register`
- `ui.sidebar.register`
- `ui.page.register`
- `ui.dashboardWidget.register`
- `ui.detailTab.register` 用于 `issue` 和 `project`
- `events.subscribe(issue.created)`
- `events.subscribe(issue.updated)`
- `events.subscribe(issue.comment.created)`
- `events.subscribe(project.updated)`
- `jobs.schedule`
- `webhooks.receive`
- `http.outbound`
- `secrets.read-ref`
- `plugin.state.read`
- `plugin.state.write`
- 可选 `issues.create`
- 可选 `issues.update`
- 可选 `issue.comments.create`
- 可选 `agent.tools.register`（例如 `search-linear-issues`、`get-linear-issue`）
- `activity.log.write`

重要约束：

- webhook 处理应该是幂等的且具有冲突意识
- 外部 ID 和同步游标应放在插件拥有的状态中，而不是在第一版的内联核心问题行上

## GitHub 问题追踪

包概念：`@paperclip/plugin-github-issues`

此插件同步 Paperclip 问题与 GitHub Issues，并可选择链接 PR。它用于：

- 导入 repo backlog
- 镜像问题状态和评论
- 将 PR 链接到 Paperclip 问题
- 从一个公司视图跟踪跨 repo 工作
- 将工程工作流与 Paperclip 任务治理桥接

### UX

- 设置页面：`/settings/plugins/github-issues`
- 主页面：`/:companyPrefix/plugins/github-issues`
- 仪表板小部件：`/:companyPrefix/dashboard`
- 可选问题选项卡：`/:companyPrefix/issues/:issueId?tab=github`
- 可选项目选项卡：`/:companyPrefix/projects/:projectId?tab=github`

主要屏幕和交互：

- 插件设置：
  - GitHub App 或 PAT 密钥引用
  - org / repo 映射
  - 标签 / 状态映射
  - 是否启用 PR 链接
  - 新 Paperclip 问题是否自动创建 GitHub 问题
- GitHub 概览页面：
  - repo 映射列表
  - 同步健康和最近的 webhook 事件
  - 导入 backlog 操作
  - 未链接 GitHub 问题队列
- 问题选项卡：
  - 链接的 GitHub 问题和可选链接的 PR
  - 操作：创建 GitHub 问题、链接现有问题、取消链接、同步
  - 评论 / 状态同步时间线
- 仪表板小部件：
  - 链接到活动 Paperclip 问题的开放 PR
  - webhook 失败
  - 同步延迟指标

核心工作流：

- Board 将 GitHub Issues 导入 Paperclip。
- GitHub webhook 更新 Paperclip 中的状态 / 评论状态。
- PR 被链接回 Paperclip 问题，以便 board 可以跟踪交付状态。

### 需要的钩子

推荐的能力和扩展点：

- `instance.settings.register`
- `ui.sidebar.register`
- `ui.page.register`
- `ui.dashboardWidget.register`
- `ui.detailTab.register` 用于 `issue` 和 `project`
- `events.subscribe(issue.created)`
- `events.subscribe(issue.updated)`
- `events.subscribe(issue.comment.created)`
- `events.subscribe(plugin.@paperclip/plugin-git.push-detected)`（跨插件协调）
- `jobs.schedule`
- `webhooks.receive`
- `http.outbound`
- `secrets.read-ref`
- `plugin.state.read`
- `plugin.state.write`
- 可选 `issues.create`
- 可选 `issues.update`
- 可选 `issue.comments.create`
- `activity.log.write`

重要约束：

- 将"本地 git 状态"和"远程 GitHub 问题状态"保持在单独的插件中，即使它们一起工作——跨插件事件处理协调

## Grafana 指标

包概念：`@paperclip/plugin-grafana`

此插件在 Paperclip 内部呈现外部指标和仪表板。它用于：

- 公司 KPI 可见性
- 基础设施 / 事件监控
- 在工作旁边显示部署、流量、延迟或收入图表
- 从异常指标创建 Paperclip 问题

### UX

- 设置页面：`/settings/plugins/grafana`
- 主页面：`/:companyPrefix/plugins/grafana`
- 仪表板小部件：`/:companyPrefix/dashboard`
- 可选目标选项卡：`/:companyPrefix/goals/:goalId?tab=metrics`

主要屏幕和交互：

- 插件设置：
  - Grafana 基础 URL
  - 服务帐号 token 密钥引用
  - 仪表板和面板映射
  - 刷新间隔
  - 可选的告警阈值规则
- 仪表板小部件：
  - 主仪表板上的一个或多个指标卡片
  - 快速趋势视图和上次刷新时间
  - 链接到 Grafana 和链接到完整 Paperclip 插件页面
- 完整指标页面：
  - 嵌入式或代理的所选仪表板面板
  - 指标选择器
  - 时间范围选择器
  - "从异常创建问题"操作
- 目标选项卡：
  - 与特定目标或项目相关的指标卡片

核心工作流：

- Board 直接在 Paperclip 仪表板上看到服务降级或业务 KPI 变动。
- Board 点击进入完整指标页面，检查相关 Grafana 面板。
- Board 从阈值违规创建带有附加指标快照的 Paperclip 问题。

### 需要的钩子

推荐的能力和扩展点：

- `instance.settings.register`
- `ui.dashboardWidget.register`
- `ui.page.register`
- `ui.detailTab.register` 用于 `goal` 或 `project`
- `jobs.schedule`
- `http.outbound`
- `secrets.read-ref`
- `plugin.state.read`
- `plugin.state.write`
- 可选 `issues.create`
- 可选 `assets.write`
- `activity.log.write`

可选事件订阅：

- `events.subscribe(goal.created)`
- `events.subscribe(project.updated)`

重要约束：

- 先只读
- 不要将 Grafana 告警逻辑作为 Paperclip 核心的一部分；将其作为附加信号和问题创建保持

## 子进程 / 服务器追踪

包概念：`@paperclip/plugin-runtime-processes`

此插件追踪在工作区中启动的长期本地进程和开发服务器。它用于：

- 查看哪个 agent 启动了哪个本地服务
- 追踪端口、健康状况和正常运行时间
- 重启失败的开发服务器
- 在问题和运行状态旁边呈现进程状态
- 让 board 看到本地开发工作流

### UX

- 设置页面：`/settings/plugins/runtime-processes`
- 主页面：`/:companyPrefix/plugins/runtime-processes`
- 仪表板小部件：`/:companyPrefix/dashboard`
- 进程详情页面：`/:companyPrefix/plugins/runtime-processes/:processId`
- 项目选项卡：`/:companyPrefix/projects/:projectId?tab=processes`
- 可选 agent 选项卡：`/:companyPrefix/agents/:agentId?tab=processes`

主要屏幕和交互：

- 插件设置：
  - 是否允许手动进程注册
  - 健康检查行为
  - 操作员是否可以停止 / 重启进程
  - 日志保留偏好
- 进程列表页面：
  - 状态表，包含名称、命令、cwd、所有者 agent、端口、正常运行时间和健康状况
  - 运行 / 退出 / 崩溃进程过滤器
  - 操作：检查、停止、重启、尾日志
- 项目选项卡：
  - 将进程列表过滤到项目的工作区
  - 显示每个进程所属的工作区
  - 按项目工作区分组进程
- 进程详情页面：
  - 进程元数据
  - 实时日志尾
  - 健康检查历史
  - 链接到相关问题或运行
- Agent 选项卡：
  - 显示由该 agent 启动或分配给它的进程

核心工作流：

- Agent 启动开发服务器；插件检测并追踪它。
- Board 打开项目，立即看到附加到该项目工作区的进程。
- Board 在仪表板上看到崩溃的进程，并从插件页面重启它。
- Board 在调试失败时将进程日志附加到问题。

### 需要的钩子

推荐的能力和扩展点：

- `instance.settings.register`
- `ui.sidebar.register`
- `ui.page.register`
- `ui.dashboardWidget.register`
- `ui.detailTab.register` 用于 `project` 和 `agent`
- `projects.read`
- `project.workspaces.read`
- `plugin.state.read`
- `plugin.state.write`
- `activity.log.write`

插件通过 `ctx.projects` 解析工作区路径，并使用 Node API 直接处理进程管理（注册、列出、终止、重启、读取日志、健康探测）。

可选事件订阅：

- `events.subscribe(agent.run.started)`
- `events.subscribe(agent.run.finished)`

## Stripe 收入追踪

包概念：`@paperclip/plugin-stripe`

此插件将 Stripe 收入和订阅数据拉入 Paperclip。它用于：

- 在公司目标旁边显示 MRR 和流失
- 追踪试用、转化和失败付款
- 让 board 将收入变动与正在进行的工作联系起来
- 启用超出 token 成本的未来财务仪表板

### UX

- 设置页面：`/settings/plugins/stripe`
- 主页面：`/:companyPrefix/plugins/stripe`
- 仪表板小部件：`/:companyPrefix/dashboard`
- 可选公司 / 目标指标选项卡（如果这些表面以后存在）

主要屏幕和交互：

- 插件设置：
  - Stripe 密钥密钥引用
  - 如有需要选择账户
  - 指标定义，如 MRR 处理和试用处理
  - 同步间隔
  - webhook 签名密钥引用
- 仪表板小部件：
  - MRR 卡片
  - 活动订阅
  - 试用转付费
  - 失败付款告警
- Stripe 概览页面：
  - 时间序列图表
  - 最近的客户 / 订阅事件
  - webhook 健康状况
  - 同步历史
  - 操作：从计费异常创建问题

核心工作流：

- Board 启用插件并连接 Stripe 账户。
- Webhook 和定时协调保持插件状态最新。
- 收入小部件出现在主仪表板上，可以链接到公司目标。
- 失败付款峰值或流失事件可以生成 Paperclip 问题进行跟进。

### 需要的钩子

推荐的能力和扩展点：

- `instance.settings.register`
- `ui.dashboardWidget.register`
- `ui.page.register`
- `jobs.schedule`
- `webhooks.receive`
- `http.outbound`
- `secrets.read-ref`
- `plugin.state.read`
- `plugin.state.write`
- `metrics.write`
- 可选 `issues.create`
- `activity.log.write`

重要约束：

- Stripe 数据应作为 Paperclip 核心的附加部分保持
- 它不应渗透到核心预算逻辑中，这在 V1 中专门关于模型 / token 支出

## 来自 OpenCode 的具体值得采纳的模式

## 采纳

- 将 SDK 包与运行时加载器分离
- 确定性加载顺序和优先级
- 非常小的编写 API
- 插件输入 / config / 工具的类型化 schema
- 工具作为一等插件扩展点（命名空间，非冲突覆盖）
- 合理时内部扩展使用与外部相同的注册形状
- 可能时将插件加载错误与宿主启动隔离
- 明确的社区面向插件文档和示例模板
- 低编写摩擦的测试工具链和入门模板
- 热插件生命周期，无需服务器重启（由进程外 workers 启用）
- 正式 SDK 版本控制与多版本宿主支持

## 调整，不复制

- 本地路径加载
- 依赖自动安装
- 钩子变更模型
- 内置覆盖行为
- 广泛的运行时上下文对象

## 避免

- 项目本地任意代码加载
- 启动时对 npm 包的隐式信任
- 插件覆盖核心不变量
- 将非沙盒化进程内执行作为默认扩展模型

## 建议的推出计划

## 阶段 0：强化现有接缝

- formalize 适配器 / 存储 / 密钥 / 运行日志注册表为"平台模块"
- 尽可能移除 ad-hoc 回退行为
- 记录稳定的注册契约

## 阶段 1：首先添加连接器插件

这是最高价值、最低风险的插件类别。

构建：

- 插件 manifest
- 全局安装 / 更新生命周期
- 全局插件配置和可选公司映射存储
- 密钥引用访问
- 类型化域事件订阅
- 定时任务
- webhook 端点
- 活动日志辅助工具
- 插件 UI bundle 加载、宿主桥接、`@paperclipai/plugin-sdk/ui`
- 页面、选项卡、小部件、侧边栏条目的扩展槽挂载
- 从 `instanceConfigSchema` 自动生成设置表单
- 桥接错误传播（`PluginBridgeError`）
- 插件贡献的 agent 工具
- 插件间事件（`plugin.<pluginId>.*` 命名空间）
- 事件过滤（服务端、每次订阅）
- 带可配置截止日期的优雅关闭
- 插件日志和健康仪表板
- 带数据保留宽限期的卸载
- `@paperclipai/plugin-test-harness` 和 `create-paperclip-plugin` 入门模板
- 热插件生命周期（安装、卸载、升级、config 更改，无需服务器重启）
- SDK 版本控制与多版本宿主支持以及弃用策略

此阶段将立即覆盖：

- Linear
- GitHub
- Grafana
- Stripe
- 文件浏览器
- 终端
- git 工作流
- 子进程 / 服务器追踪

工作区插件不需要额外的宿主 API——它们通过 `ctx.projects` 解析工作区路径，直接处理文件系统、git、PTY 和进程操作。

## 阶段 2：考虑更丰富的 UI 和插件打包

仅在阶段 1 稳定后：

- 用于不受信任第三方插件 UI bundles 的基于 iframe 的隔离
- 签名 / 验证的插件包
- 插件市场
- 可选的插件存储后端或迁移

## 推荐的架构决策

如果我必须将这份报告归结为一个架构决策，那就是：

Paperclip 不应实现"OpenCode 风格的通用进程内钩子系统"。
Paperclip 应实现"具有多个信任层的插件平台"：

- 用于低级运行时集成的可信平台模块
- 用于实例范围集成和自动化的类型化进程外插件
- 插件贡献的 agent 工具（命名空间、能力门控）
- 插件打包的 UI bundles，通过类型化桥接在宿主扩展槽中呈现，具有结构化错误传播
- 用于跨插件协调的插件间事件
- 从 config schema 自动生成设置 UI
- 核心拥有的不变量，插件可以观察和围绕其行动，但不能替换
- 插件可观测性、优雅生命周期管理和低编写摩擦的测试工具链
- 热插件生命周期——安装、卸载、升级或 config 更改无需服务器重启
- 具有多版本宿主支持和明确弃用策略的 SDK 版本控制

这获得了 `opencode` 可扩展性的优势，而没有引入错误威胁模型。

## 我会在 Paperclip 中采取的具体后续步骤

1. 写一个简短的扩展架构 RFC，formalize `platform modules` 和 `plugins` 之间的区别。
2. 在 `packages/shared` 中引入一个小的插件 manifest 类型，在实例 config 中添加 `plugins` 安装 / 配置部分。
3. 在现有活动 / 实时事件模式周围构建类型化域事件总线，具有服务端事件过滤和用于跨插件事件的 `plugin.*` 命名空间。保持核心不变量不可钩子化。
4. 实现插件 MVP：全局安装 / 配置、密钥引用、任务、webhook、插件 UI bundles、扩展槽、自动生成设置表单、桥接错误传播。
5. 添加 agent 工具贡献——插件注册命名空间工具，agent 在运行期间可以调用。
6. 添加插件可观测性：通过 `ctx.logger` 的结构化日志、健康仪表板、内部健康事件。
7. 添加带数据保留宽限期的优雅关闭策略和卸载数据生命周期。
8. 打包 `@paperclipai/plugin-test-harness` 和 `create-paperclip-plugin` 入门模板。
9. 实现热插件生命周期——安装、卸载、升级和 config 更改无需服务器重启。
10. 定义 SDK 版本控制策略——semver、多版本宿主支持、弃用时间线、迁移指南、发布的兼容性矩阵。
11. 构建工作区插件（文件浏览器、终端、git、进程追踪），从宿主解析工作区路径，直接处理操作系统级操作。
