# Pi Hook Survey

状态：调查说明
日期：2026-04-07

## Why this exists

我们被要求找到 `pi` 和 `pi-mono` 暴露的 hook 表面，然后决定哪些理念可以干净地转移到 Paperclip。

本文档基于对以下内容的直接源码检查：

- `badlogic/pi` 默认分支和 `pi2` 分支
- `badlogic/pi-mono` `packages/coding-agent`
- 此 repo 中当前的 Paperclip 插件和适配器表面

## Short answer

- 当前的 `pi` 不暴露可比的扩展 hook API。它今天暴露的是来自 `pi-agent` 的 JSON 事件流。
- `pi-mono` 确实暴露了一个真正的扩展 hook 系统。它广泛、类型化，并有意允许改变代理/运行时行为。
- Paperclip 应该只复制安全的子集：
  - 类型化事件订阅
  - 只读运行生命周期事件
  - 显式工作进程生命周期 hook
  - 插件到插件事件
- Paperclip 不应该复制危险的子集：
  - 对核心控制平面决策的任意变更 hook
  - 项目本地插件加载
  - 通过名称冲突的内置工具遮蔽

## What `pi` has today

当前的 `badlogic/pi` 主要是一个 GPU pod 管理器加上轻量级代理运行器。它不暴露像 `pi-mono` 那样的 `pi.on(...)` 风格扩展 API。

最接近 hook 的是 `pi-agent --json` 事件流：

- `session_start`
- `user_message`
- `assistant_start`
- `assistant_message`
- `thinking`
- `tool_call`
- `tool_result`
- `token_usage`
- `error`
- `interrupted`

这使得 `pi` 作为事件生产者有用，但不是作为第三方运行时拦截的主机。

## What `pi-mono` has

`pi-mono` 通过 `packages/coding-agent/src/core/extensions/types.ts` 暴露了一个真正的扩展 API。

### Extension event hooks

验证的 `pi.on(...)` hook 名称：

- `resources_discover`
- `session_start`
- `session_before_switch`
- `session_before_fork`
- `session_before_compact`
- `session_compact`
- `session_shutdown`
- `session_before_tree`
- `session_tree`
- `context`
- `before_provider_request`
- `before_agent_start`
- `agent_start`
- `agent_end`
- `turn_start`
- `turn_end`
- `message_start`
- `message_update`
- `message_end`
- `tool_execution_start`
- `tool_execution_update`
- `tool_execution_end`
- `model_select`
- `tool_call`
- `tool_result`
- `user_bash`
- `input`

### Other extension surfaces

`pi-mono` 扩展也可以：

- `registerTool(...)`
- `registerCommand(...)`
- `registerShortcut(...)`
- `registerFlag(...)`
- `registerMessageRenderer(...)`
- `registerProvider(...)`
- `unregisterProvider(...)`
- 通过 `pi.events` 使用插件间事件总线

### Important behavior

`pi-mono` hook 不仅仅是观察者。有几个可以主动改变行为：

- `before_agent_start` 可以重写有效系统提示并注入消息
- `context` 可以替换 LLM 调用前的消息集
- `before_provider_request` 可以重写序列化的 provider 有效载荷
- `tool_call` 可以变更工具输入并阻止执行
- `tool_result` 可以重写工具输出
- `user_bash` 可以完全替换 shell 执行
- `input` 可以转换或在正常处理之前完全处理用户输入

这非常适合本地编码工具。这不是自动适合公司控制平面的。

## What Paperclip already has

Paperclip 已经有了一些 hook 类似的表面，但它们更窄且更安全：

- 插件工作进程生命周期 hook，如 `setup()` 和 `onHealth()`
- 为插件声明的 webhook 端点
- 调度作业
- 带过滤和插件命名空间的类型化插件事件总线
- 运行管道中用于日志/状态/使用量的适配器运行时 hook

插件事件总线已经指向正确的方向：

- 可以订阅核心领域事件
- 过滤器在服务器端应用
- 插件发出的事件在 `plugin.<pluginId>.*` 下命名空间
- 插件不会通过名称冲突覆盖核心行为

## What transfers well to Paperclip

这些来自 `pi-mono` 的理念与 Paperclip 几乎没有概念风险：

### 1. Read-only run lifecycle subscriptions

Paperclip 应继续向插件暴露运行和记录事件，例如：

- 运行开始/结束
- 工具开始/结束
- 使用量报告
- issue 评论创建

这与 Paperclip 的控制平面姿态匹配：观察、反应、自动化。

### 2. Plugin-to-plugin events

Paperclip 已经有了。这是值得保持和扩展的。

这是许多临时 hook 链的干净替代品。

### 3. Explicit worker lifecycle hooks

Paperclip 已经有 `setup()` 和 `onHealth()`。这是正确的形状。

如果需要更多生命周期，它应该保持显式和主机控制。

### 4. Trusted adapter-level prompt/runtime middleware

一些 `pi-mono` 理念确实属于 Paperclip，但仅在可信适配器/运行时代码内部：

- 运行开始前的提示塑造
- provider 请求定制
- 本地编码适配器的工具执行包装器

这应该是适配器表面，而不是通用公司插件表面。

## What should not transfer directly

这些 `pi-mono` 能力不适合 Paperclip 核心：

### 1. Arbitrary mutation hooks on control-plane decisions

Paperclip 不应让通用插件重写：

- issue 检出语义
- 审批结果
- 预算执行
- 分配规则
- 公司范围

这些是核心不变量。

### 2. Tool shadowing by name collision

`pi-mono` 的低摩擦覆盖模型对个人编码工具很好。

Paperclip 应保持插件工具命名空间和非遮蔽。

### 3. Project-local plugin loading

Paperclip 是一个操作员控制的控制平面。Repo 本地插件自动加载会使行为太隐式和太难管理。

### 4. UI-session-specific hooks as first-class product surface

像这样的 hook：

- `session_before_switch`
- `session_before_fork`
- `session_before_tree`
- `model_select`
- `input`
- `user_bash`

与 `pi-mono` 作为交互式终端编码工具绑定。

它们不直接映射到 Paperclip 的 board-and-issues 模型。

## Recommended Paperclip direction

如果我们想要受 `pi-mono` 启发的"hooks"故事，它应该分成两层：

### Layer 1: safe control-plane plugins

允许的表面：

- 类型化领域事件订阅
- 作业
- Webhooks
- 插件到插件事件
- UI 槽和桥接动作
- 插件拥有的工具和数据端点

不允许：

- 对核心 issue/approval/budget 不变量的变更

### Layer 2: trusted runtime middleware

仅适用于适配器和其他可信运行时包：

- 提示组装 hook
- provider 有效载荷 hook
- 工具执行包装器
- 记录渲染辅助器

这是最好的 `pi-mono` 运行时理念所属的地方。

## Bottom line

如果问题是"`pi` 和 `pi-mono` 有什么 hooks？"

- `pi`：JSON 输出事件，不是通用扩展 hook 系统
- `pi-mono`：广泛的扩展 hook API，有 27 个命名事件 hook 加上工具/命令/provider 注册

如果问题是"什么对 Paperclip 也有效？"

- 是：类型化事件订阅、工作进程生命周期 hook、命名空间插件事件、只读运行生命周期事件
- 也许，但仅可信：围绕适配器执行的提示/provider/工具中间件
- 否：对控制平面不变量的任意变更 hook、项目本地插件加载、工具遮蔽
