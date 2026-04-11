# PAP-1229 Agent OS Follow-up Plan

日期：2026-04-08
相关 issue：`PAP-1229`
配套分析：`doc/plans/2026-04-08-agent-os-technical-report.md`

## Goal

将 `agent-os` 研究转化为低风险的 Paperclip 执行计划，同时保留 Paperclip 的控制平面模型，同时测试少数似乎值得采用的运行时理念。

## Decision summary

Paperclip 不应将 `agent-os` 吸收为产品模型或编排层。

Paperclip 应在三个狭窄领域评估 `agent-os`：

1. 所选本地适配器的可选代理运行时
2. 基于能力的运行时权限词汇表
3. 基于快照的可丢弃执行根

除非这三个实验产生强烈证据，否则其他一切应保持在范围之外。

## Success condition

当 Paperclip 拥有以下内容时，这项工作是成功的：

- 关于 `agent-os` 是否值得作为执行底层支持的明确是/否答案
- 具有可衡量结果的具体适配器/运行时实验
- 符合当前 Paperclip 适配器的提议运行时能力模型
- 关于基于快照的执行根是否值得集成的明确决策

## Non-goals

不要：

- 用 `agent-os` 原语替换 Paperclip 心跳、issues、comments、approvals 或 budgets
- 为所有本地执行路径引入 Rust/边车要求
- 一次迁移所有适配器
- 向 Paperclip 核心添加运行时工作流/队列抽象

## Existing Paperclip integration points

计划应保持在这些现有表面上：

- `packages/adapter-utils/src/types.ts`
  - 适配器契约、运行时服务报告、会话元数据和能力标准化目标
- `server/src/services/heartbeat.ts`
  - 执行入口点、日志捕获、issue 评论摘要和成本报告
- `server/src/services/execution-workspaces.ts`
  - 当前工作区生命周期和面向 git 的清理/就绪模型
- `server/src/services/plugin-loader.ts`
  - 类型化主机能力边界和扩展加载模式
- `packages/adapters/*/src/server/` 中的本地适配器实现
  - 当前执行行为，用于与 `agent-os` 支持的路径进行比较

## Phase plan

### Phase 0: constraints and experiment design

目标：

- 在编写集成代码之前使评估可证伪

交付物：

- 添加到此文档或子 issue 的简短实验简报
- 选择的第一个运行时目标：`pi_local` 或 `opencode_local`
- 基线指标定义

要锁定的问题：

- 什么确切的开发者体验应该改善
- 我们期望获得什么安全/隔离属性
- 什么故障模式是不可接受的
- 原型是仅适配器还是更深的内部运行时抽象 spike

退出标准：

- 选择了一个单一的第一次目标
- 商定了可衡量的比较标准

推荐指标：

- 冷启动延迟
- 心跳之间会话恢复可靠性
- 记录/日志质量
- 实施复杂性
- 本地开发机器上的操作复杂性

### Phase 1: `agentos_local` spike

目标：

- 证明 Paperclip 可以通过 `agent-os` 运行时驱动一个本地代理而不破坏心跳语义

建议范围：

- 实现一个新的实验性适配器 `agentos_local`，或在一个现有适配器下实现特性标志运行时路径
- 从 `pi_local` 或 `opencode_local` 开始
- 保持 Paperclip 现有的心跳、issue、工作区和评论流程权威

最低实施形状：

- 适配器接受 model/runtime 配置
- `server/src/services/heartbeat.ts` 仍然拥有运行生命周期
- 执行结果仍然映射到现有的 `AdapterExecutionResult`
- 会话状态仍然符合当前的 `sessionParams` / `sessionDisplayId` 流程

要验证的内容：

- 检出和心跳流程仍然端到端工作
- 跨多个心跳的恢复工作
- 日志/记录在 UI 中保持可读
- 故障路径在 issue 评论和运行日志中干净地浮出

退出标准：

- 一种代理类型可以通过新路径可靠地运行
- 针对现有本地适配器路径记录了比较文档
- 明确的建议：继续、暂停或放弃

### Phase 2: 基于能力的运行时权限

目标：

- 引入 Paperclip 原生的能力词汇表，而不将产品耦合到 `agent-os`

建议范围：

- 扩展适配器配置 schema 词汇表用于运行时权限
- 为运行时权限原型标准化能力，例如：
  - `fs.read`
  - `fs.write`
  - `network.fetch`
  - `network.listen`
  - `process.spawn`
  - `env.read`

集成目标：

- `packages/adapter-utils/src/types.ts`
- 适配器 config-schema 支持
- 服务器端运行时配置验证
- 如果需要，未来面向 board 的权限 UI

要避免的内容：

- 在词汇表被证明有用之前构建完整的 human 策略 UI
- 强制每个适配器立即实施能力执行

退出标准：

- 记录的能力 schema
- 一个适配器路径有意义地使用它
- 非 `agent-os` 适配器的清晰兼容性故事

### Phase 3: 基于快照的执行根实验

目标：

- 确定分层/快照根模型是否改善某些 Paperclip 工作负载

建议范围：

- 首先仅针对可丢弃或非 repo 密集型任务进行评估
- 将 git worktree 基于的 repo 编辑保持为代码库任务的默认

有前景的用例：

- Routine 风格的运行
- 短暂的预览/测试环境
- 隔离的文档/工件生成
- 不需要完整 git 历史或分支语义的任務

集成目标：

- `server/src/services/execution-workspaces.ts`
- 从 `server/src/services/heartbeat.ts` 调用的工作区实现路径

退出标准：

- 关于哪些工作负载类别受益的清晰声明
- 关于哪些工作负载应保持在 worktree 上的清晰声明
- 更广泛实施的 go/no-go 决策

### Phase 4: 类型化主机工具评估

目标：

- 确定 Paperclip 何时应优先考虑显式类型化工具而不是动态 shell 访问

建议范围：

- 将 `agent-os` 主机工具包理念与现有插件和运行时服务表面进行比较
- 选择 1-2 个应成为类型化工具的敏感操作

好的候选者：

- git 元数据/状态检查
- 运行时服务检查
- 部署/预览状态检索
- 工件生成的发布

退出标准：

- Paperclip 中类型化工具采用的一个具体提案
- 关于这属于插件、适配器还是核心服务的清晰声明

## Recommended sequencing

推荐顺序：

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4

理由：

- Phase 1 是使整个 `agent-os` 方向无效或验证的最快方式
- 即使 Phase 1 被放弃，Phase 2 也有价值
- Phase 3 应等到有信心运行时方法在操作上值得
- Phase 4 独立有用，但应由 Phase 1 和 Phase 2 暴露的内容提供信息

## Risks

### Technical risk

- `agent-os` 引入了可能超过运行时优势的 Rust 边车和打包复杂性

### Product risk

- 运行时实验可能模糊 Paperclip 作为控制平面和 Paperclip 作为执行平台之间的界限

### Integration risk

- 会话语义、日志格式和故障行为可能相对于当前本地适配器降级

### Scope risk

- 如果不严格绑定，较小的运行时 spike 可能扩展为适配器系统重写

## Guardrails

为了保持此工作受控：

- 将所有实验保持在明确的实验性适配器或特性标志后面
- 不要更改 issue/comment/approval/budget 语义以适应运行时
- 针对当前本地适配器而不是孤立判断进行衡量
- 如果操作负担已经明显太高，请在 Phase 1 后停止

## Proposed next action

下一个具体行动应该是一个小的实施 spike issue：

- 标题：`Prototype experimental agentos_local runtime for one local adapter`
- 目标适配器：`opencode_local`，除非 `pi_local` 明显更容易
- 预期输出：代码 spike、简短的验证笔记和继续/停止建议

如果领导层只想要规划而不是 spike，本文是该决策的移交工件。
