# Agent OS Technical Report for Paperclip

日期：2026-04-08
分析的上游：`rivet-dev/agent-os` at commit `0063cdccd1dcb1c8e211670cd05482d70d26a5c4` (`0063cdc`)，日期为 2026-04-06

## Executive summary

`agent-os` 不是 Paperclip 核心产品的竞争对手。它是一个执行底层：用于代理、工具、文件系统和会话编排的嵌入式类 VM 运行时。Paperclip 是一个控制平面：公司范围、任务层级、审批、预算、活动日志、工作区和管理。

最重要的收获不是"全盘复制 agent-os"。最重要的收获是 Paperclip 可以有选择地使用其运行时理念来提高本地代理执行的安全性、可重复性和可移植性，同时将所有公司/任务/治理逻辑保留在 Paperclip 中。

我的建议是：

1. 不要将 agent-os 概念合并到 Paperclip 核心产品模型中。
2. 应该评估可选的 `agentos_local` 执行适配器或内部运行时实验。
3. 积极借鉴一些设计模式：
   - 分层/快照化执行文件系统
   - 基于显式能力的运行时权限
   - 用于受控工具执行的更好主机工具桥接
   - 用于代理适配器的标准化会话能力模型
4. 在将 agent-os 的工作流/cron/队列抽象与 Paperclip 的 issue/comment/治理模型协调之前，不要将它们导入 Paperclip 核心。

## What agent-os actually is

从代码库布局和实现来看，`agent-os` 是一个混合 TypeScript/Rust 系统，提供：

- 用于创建隔离代理 VM 的 `AgentOs` TypeScript API
- 一个 Rust 内核/边车，可虚拟化文件系统、进程、PTY、管道、权限和网络
- 用于 Pi、OpenCode 和类 Claude 适配器等代理运行时的基于 ACP 的会话模型
- WASM 命令包和挂载插件的注册表
- 可选的主机工具包、cron 调度和文件系统挂载

该代码库已经相当庞大：

- 包含 `packages/`、`crates/` 和 `registry/` 的 monorepo
- 仅在 `packages/`、`crates/` 和 `registry/` 中就有约 1,200 个文件
- 混合实现模型：TypeScript 公共 API 加上 Rust 内核/边车内部实现

## Architecture notes

### 1. Public runtime surface

主要 API 位于 `packages/core/src/agent-os.ts`，导出一个 `AgentOs` 类，包含以下方法：

- `create()`
- `createSession()`
- `prompt()`
- `exec()`
- `spawn()`
- `snapshotRootFilesystem()`
- cron 调度辅助函数

这是一个执行 API，而不是协调 API。

### 2. Virtualized kernel model

内核在 Rust 的 `crates/kernel/src/` 中实现，建模：

- 虚拟文件系统
- 进程表
- PTY 和管道
- 资源计算
- 权限化文件系统访问
- 网络权限检查

这使得 `agent-os` 比 Paperclip 当前"在工作区中启动主机 CLI"的本地适配器方法具有更强的隔离性。

### 3. Layered filesystem and snapshots

文件系统设计是最可重用的想法之一。`agent-os` 使用：

- 捆绑的基础文件系统
- 可写覆盖层
- 可选挂载文件系统
- 用于重用根状态的快照导出/导入

这比为每个执行工作区创建可变检出加上临时清理更清晰。它支持可重复的起始状态和廉价的隔离。

### 4. Capability-based permissions

内核级权限词汇表强大且具体：

- 文件系统操作
- 网络操作
- 子进程执行
- 环境访问

Rust 内核默认为拒绝导向，但高级 JS API 当前序列化宽松默认值，除非调用者提供策略。这是一个重要的细微差别：原语是安全导向的，但产品表面仍然是便利性优先。

### 5. Host-tools bridge

`agent-os` 通过工具包抽象（`hostTool`、`toolKit`）和本地 RPC 桥接暴露主机端工具。这是一个很强的模式，因为它为代理提供了显式的类型化工具，而不是对主机上所有内容的动态 shell 访问。

### 6. ACP session abstraction

会话模型比大多数代理包装器更统一。它包括：

- 能力
- 模式/配置选项
- 权限请求
- 序列化的会话事件
- 通过 ACP 适配器的 JSON-RPC 传输

这与 Paperclip 直接相关，因为我们的适配器层仍然以相当定制的方式标准化每个 CLI 代理。

## Paperclip anchor points

任何未来 `agent-os` 集成最相关的当前 Paperclip 表面：

- `packages/adapter-utils/src/types.ts`
  - 共享适配器契约、会话元数据、运行时服务报告、环境测试和可选的 `detectModel()`
- `server/src/services/heartbeat.ts`
  - 心跳执行、适配器调用、成本捕获、工作区实现和 issue-comment 摘要
- `server/src/services/execution-workspaces.ts`
  - 执行工作区生命周期和 git 就绪/清理逻辑
- `server/src/services/plugin-loader.ts`
  - 动态插件激活、主机能力边界和运行时扩展加载
- `packages/adapters/codex-local/src/server/execute.ts` 等本地适配器
  - 当前主机 CLI 执行模型，`agent-os` 运行时实验可以补充或替换所选代理的模型

## What Paperclip can learn from it

### 1. A safer local execution substrate

Paperclip 的本地适配器目前在工作区中运行主机 CLI，并依赖适配器特定行为加上进程级控制。这是务实的，但隔离性较弱。

`agent-os` 展示了一条通向以下目标的路径：

- 在约束运行时中运行本地代理工具
- 应用显式的网络/文件系统/环境策略
- 减少意外的主机泄漏
- 使适配器行为在不同机器之间更具可移植性

Paperclip 中的最佳用途：

- 作为本地适配器下的可选运行时
- 或作为可以在 ACP 兼容 `agent-os` 会话中运行的代理的新适配器系列

这适合 Paperclip，因为它提高了执行安全性而无需更改控制平面模型。

### 2. Snapshotted execution roots instead of only mutable workspaces

Paperclip 已经有强大的执行工作区概念，但它们是基于 repo/worktree 的。`agent-os` 添加了更强的"从已知底层开始，在一次性上层写入"模型。

这可以改善：

- 可重复的 issue 起始
- 可丢弃的任务沙箱
- 更快的重置/清理
- 用于重复例程的"从快照恢复"行为
- 用于危险代理操作的安全预览环境

这对于不需要完整 git 工作树的任务特别有趣。

### 3. A capability vocabulary for runtime governance

Paperclip 在公司/任务级别有治理：

- 审批
- 预算
- 活动日志
- 执行者权限
- 公司范围

它在运行时能力级别结构较少。`agent-os` 提供了一个 Paperclip 可以采用的可词汇表，即使不采用运行时本身：

- `fs.read`、`fs.write`、`fs.mount_sensitive`
- `network.fetch`、`network.http`、`network.listen`、`network.dns`
- 子进程执行
- 环境访问

该词汇表可以改善：

- 适配器配置 schema
- 策略 UI
- 执行审查表面
- 用于治理操作的未来审批门禁

### 4. Typed host tools instead of shelling out for everything

Paperclip 的插件系统和适配器已经有了受控扩展表面的开端。`agent-os` 强化了将能力公开为类型化工具而不是原始 shell 访问的价值。

具体的 Paperclip 用途：

- 用于敏感操作的公司批准工具包
- 公司范围的服务工具
- 具有显式 schema 的插件定义工具
- 用于常见操作（如 git 元数据检查、预览查找、部署状态检查或文档生成）的更安全执行

这与 Paperclip 的治理故事很好地契合。

### 5. Better adapter normalization around sessions and capabilities

Paperclip 的适配器契约已经支持执行结果、会话参数、环境测试、技能同步、配额窗口和可选的 `detectModel()`。但很多每代理行为仍然是适配器特定的。

`agent-os` 建议了一个更清晰标准化目标：

- 标准能力映射
- 一致的事件流模型
- 显式的模式/配置表面
- 显式的权限请求语义

Paperclip 不需要到处使用 ACP，但会从受此启发更正式的内部会话能力模型中受益。

### 6. On-demand heavy sandbox escalation

`agent-os` 中最好的架构选择之一是它并不假装每个工作负载都适合轻量级运行时。它有一个用于需要更完整环境的工作负载的沙箱扩展。

Paperclip 可以直接采用这种理念：

- 默认使用轻量级执行
- 仅在需要时升级到完整 worktree / 容器 / 远程沙箱
- 在 issue/run 模型中保持升级是显式的

这比一开始就强制所有任务进入最重环境更好。

## What does not fit Paperclip well

### 1. Its built-in orchestration primitives overlap the wrong layer

`agent-os` 在运行时包中包含 cron/会话/工作流风格的原语。Paperclip 已经有更高级别的编排概念：

- issues/comments
- 心跳运行
- 审批
- 公司/组织结构
- 执行工作区
- 预算执行

如果 Paperclip 直接将 `agent-os` cron/工作流/队列想法复制到核心，我们可能会在两个层中重复编排。这会使所有权模糊，使调试更难。

Paperclip 应在控制平面层保持编排权威。

### 2. It is not company-scoped or governance-native

`agent-os` 是运行时优先，而不是公司优先。它没有本地的概念用于：

- 公司边界
- board/operator 执行者类型
- 业务操作的审计日志
- issue 层级
- 审批路由
- 预算硬性停止行为

这些是 Paperclip 的差异化因素。它们不应被运行时抽象所取代。

### 3. It introduces meaningful implementation complexity

深度采用 `agent-os` 会增加：

- Rust 构建/运行时复杂性
- 边车生命周期管理
- JS/Rust 边界上的新故障模式
- 更多的打包和平台兼容性工作
- 用于已经复杂的本地适配器调试的另一个抽象层

只有在我们要更强的本地隔离或可移植性时才合理。作为通用重构则不合理。

### 4. Its security model is not a drop-in governance solution

权限模型很好，但它很低级。Paperclip 仍然需要回答：

- 谁可以授权能力
- 审批决策如何记录
- 策略如何按公司/项目/issue/代理范围
- 运行时权限如何与预算和任务状态交互

换句话说，`agent-os` 可以提供执行原语，而不是控制策略系统本身。

### 5. The agent compatibility story is still selective

代码库明确指出某些运行时是计划的、部分实现的或仍在适配中的。实际上这意味着：

- ACP 原生或兼容代理的好想法
- 对我们今天支持的每个 CLI 代理的确定性较低
- 用于 Codex/Cursor/Gemini 风格 Paperclip 适配器的真正集成工作

因此，主要的近期价值不是通用替换。而是在兼容性较强的地方有选择地使用。

## Concrete recommendations for Paperclip

### Recommendation A: prototype an optional `agentos_local` adapter

这是最高价值的实验。

目标：

- 通过 `agent-os` 运行时运行一个支持的代理类型
- 保持 Paperclip 的现有心跳/任务/工作区/预算逻辑不变
- 评估启动时间、隔离性、记录质量 和运营复杂性

好的首个目标：

- `pi_local` 或 `opencode_local`

为什么不从 Codex 开始：

- Paperclip 的 Codex 适配器已经很重要，并且带有 repo 特定行为
- `agent-os` 的 Codex 故事在 registry/docs 中存在，但最安全的路径是先在较不核心的适配器上验证运行时

成功标准：

- 心跳可以可靠地调用适配器
- 会话在心跳之间恢复
- Paperclip 仍然正常记录日志、摘要、成本元数据和 issue 注释
- 运行时权限可以配置而不会破坏常见任务

### Recommendation B: adopt capability vocabulary into adapter configs

即使不使用 `agent-os`，Paperclip 也应考虑围绕以下词汇表标准化适配器/运行时权限：

- 文件系统
- 网络
- 子进程/工具执行
- 环境访问

这可以改善：

- schema 驱动的适配器 UI
- 未来审批
- 可观察性
- 跨适配器的策略可移植性

### Recommendation C: explore snapshot-backed execution workspaces

Paperclip 应评估某些执行工作区是否可以由以下支持：

- 可重用的下层快照
- 可丢弃的上层
- 用于项目数据或工件的可选挂载

这对以下情况最有价值：

- 非 repo 任务
- 可重复的例程
- 预览/测试环境
- 隔离密集型本地执行

对于已经受益于 git worktree 的完整 repo 编辑流程，它不那么紧急。

### Recommendation D: strengthen typed tool surfaces

Paperclip 插件和适配器应继续向显式类型化工具发展，而不是临时 shell 访问。`agent-os` 确认这是正确的方向。

这适合：

- 插件工具
- 工作区运行时服务
- 需要审批或可审计性的治理操作

### Recommendation E: do not import runtime-level workflows into Paperclip core

Paperclip 不应将 `agent-os` cron/工作流/队列概念复制到核心编排中。

如果以后想要，它们必须干净地映射到：

- issues
- comments
- 心跳
- 审批
- 预算
- 活动日志

如果没有这种映射，它们会在产品中创建第二个编排系统。

## A practical integration map

### Best near-term fits

- 可选本地适配器运行时
- 运行时能力 schema
- 用于插件/适配器的类型化主机工具理念
- 用于可丢弃执行根的快照理念

### Medium-term fits

- 跨适配器更强的会话能力标准化
- 策略感知运行时权限 UI
- 选择性 ACP 启发的事件标准化

### Poor fits right now

- 将 Paperclip 编排移动到 agent-os 工作流
- 用运行时构造替换公司/任务/治理模型
- 使 Rust 边车成为所有本地执行的强制依赖

## Bottom line

`agent-os` 作为执行技术参考对 Paperclip 有用，而不是作为产品模型。

Paperclip 应该像对待沙箱或代理 CLI 一样对待它：

- 控制平面下的执行底层
- 在权衡值得的地方是可选的
- 永远不是公司/任务/治理状态的真实来源

如果我们从这份报告做一件事，应该是狭窄范围的 `agentos_local` 实验，加上基于能力的运行时权限的设计通过。这两个想法具有最好的优势和最低的架构风险。
