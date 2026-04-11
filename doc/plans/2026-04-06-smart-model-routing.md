# 2026-04-06 Smart Model Routing

状态：提议中
日期：2026-04-06
受众：产品和工程
相关：
- `doc/SPEC-implementation.md`
- `doc/PRODUCT.md`
- `doc/plans/2026-03-14-adapter-skill-sync-rollout.md`

## 1. 目的

本文档为 Paperclip 中的"智能模型路由"定义了一个 V1 计划。

目标不是在服务器中构建一个通用的跨提供商路由。目标是：

- 让支持的适配器使用更便宜的模型进行轻量级心跳编排工作
- 将主要任务执行保持在适配器的正常主模型上
- 保留 Paperclip 现有的任务、会话和审计不变式
- 当多个模型参与单个心跳时，如实报告成本和模型使用

激励性的用例是一个本地编码适配器，其中便宜的模型可以处理第一轮快速通过：

- 读取唤醒上下文
- 定向到任务和工作区
- 在适当时候留下即时进度评论
- 执行有界限的轻量级分类

然后主模型执行实质性工作。

## 2. Hermes 发现

Hermes 确实有一个真正的"智能模型路由"功能，但它比名称所暗示的更窄。

观察到的行为：

- `agent/smart_model_routing.py` 为"简单"轮次实现了一个保守分类器
- 便宜路径仅对简短的、单行的、非代码的、非 URL 的、非工具密集的消息触发
- 复杂度通过硬编码阈值和关键词拒绝列表检测，如 `debug`、`implement`、`test`、`plan`、`tool`、`docker` 等类似术语
- 如果便宜路由无法解析，Hermes 会静默回退到主模型

重要的架构细节：

- Hermes 在为该轮次构建代理之前应用此路由
- 路由在 `cron/scheduler.py` 中解析，并作为活动 provider/model/runtime 传递到代理创建

比路由启发式本身更有用的是 Hermes 更广泛的模型槽设计：

- 主对话模型
- 用于故障转移的回退模型
- 用于压缩和分类等辅助任务的辅助模型槽

这种分离比复制 Hermes 精确的关键词启发式更适合 Paperclip。

## 3. 当前 Paperclip 状态

Paperclip 已经有了适配器特定路由的正确执行形状，但它目前假设每个心跳运行一个模型。

当前实施事实：

- `server/src/services/heartbeat.ts` 构建丰富的运行上下文，包括 `paperclipWake`、工作区元数据和会话交接上下文
- 每个适配器接收单个解析的 `config` 对象并执行一次
- 内置本地适配器读取一个 `config.model` 并直接将其传递给底层 CLI
- UI 配置当前暴露一个主 `model` 字段以及适配器特定的 thinking-effort 控件
- 成本核算当前通过 `AdapterExecutionResult` 记录每个运行一个 provider/model 元组

这意味着：

- 服务器中目前没有共享路由层
- 模型选择已经存在于适配器边界，这是好的
- 单个心跳中的多模型执行需要明确的契约工作，否则成本报告将变得误导

## 4. 产品决策

Paperclip 应将智能模型路由实施为适配器本地的、opt-in 的执行模式。

V1 决策：

1. 不要添加试图理解每个适配器的全局服务器端路由。
2. 不要将 Hermes 的提示词关键词分类器复制为 Paperclip 的默认路由策略。
3. 为支持的适配器添加适配器特定的"便宜 preflight"阶段。
4. 保持主模型作为规范的工作模型。
5. 除非适配器可以证明跨模型会话恢复是安全的，否则仅持久化主会话。

理由：

- Paperclip 心跳是结构化的、issue 范围的，并且已经包含唤醒元数据
- 按执行阶段路由比按自由文本提示复杂度路由更可靠
- 会话语义因适配器而异，恢复行为必须保持适配器所有

## 5. 提议的 V1 行为

### 5.1 配置形状

支持的适配器应向 `adapterConfig` 添加可选路由块。

提议的形状：

```ts
smartModelRouting?: {
  enabled: boolean;
  cheapModel: string;
  cheapThinkingEffort?: string;
  maxPreflightTurns?: number;
  allowInitialProgressComment?: boolean;
}
```

注：

- 将现有的 `model` 保持为主模型
- `cheapModel` 是适配器特定的，不是全局的
- 无法安全支持此块的适配器只需忽略它

对于以后具有提供商特定模型字段的适配器，形状可以扩展以包含 provider/base-url 覆盖。V1 应该从简单的开始。

### 5.2 路由策略

支持的适配器仅在以下全部为真时才运行便宜 preflight：

- `smartModelRouting.enabled` 为 true
- `cheapModel` 已配置
- 运行是 issue 范围的
- 适配器正在启动新的会话，而不是恢复持久化的会话
- 运行预计要做真正的任务工作，而不是仅恢复现有线程

支持的适配器在以下任一情况为真时跳过便宜 preflight：

- 持久化任务会话已存在
- 适配器无法安全地将 preflight 与主会话隔离
- issue 或唤醒类型暗示任务已经中途飞行，延续性比首次响应速度更重要

这是有意按阶段而非按文本启发式。

### 5.3 便宜 preflight 职责

便宜阶段应该是狭窄的和有界限的。

允许的职责：

- 接收唤醒上下文和 issue 摘要
- 浅层检查工作区
- 在适当时留下简短的"开始调查"风格评论
- 为主阶段收集紧凑的交接摘要

V1 中不允许：

- 长的工具循环
- 危险的文件变更
- 成为规范持久化任务会话
- 在没有明确适配器支持或平凡成功案例的情况下决定最终完成

实施细节：

- 适配器应注入明确的 preflight 提示，告诉模型这是一个有界限的编排传递
- preflight 应使用非常小的轮次预算，例如 1-2 轮

### 5.4 主执行职责

preflight 后，适配器使用现有提示和主模型启动正常的主执行。

主阶段应接收：

- 正常 Paperclip 提示
- 任何 preflight 生成的交接摘要
- 正常的工作区和唤醒上下文

主阶段仍是以下方面的真实来源：

- 持久化的会话状态
- 最终任务完成
- 大部分文件变更
- 大部分成本

## 6. 需要的契约更改

当前的 `AdapterExecutionResult` 对于如实的多模型核算来说太窄了。

添加可选的分段执行报告，例如：

```ts
executionSegments?: Array<{
  phase: "cheap_preflight" | "primary";
  provider?: string | null;
  biller?: string | null;
  model?: string | null;
  billingType?: AdapterBillingType | null;
  usage?: UsageSummary;
  costUsd?: number | null;
  summary?: string | null;
}>
```

V1 服务器行为：

- 如果 `executionSegments` 不存在，保持当前单结果行为不变
- 如果存在，为每个有成本或 token 使用量的分段写入一个 `cost_events` 行
- 在运行 usage/result 元数据中存储分段数组以供后续 UI 检查
- 保持现有的顶级 `provider` / `model` 字段作为摘要，最好是主阶段（当存在时）

这避免破坏现有适配器，同时为路由适配器提供如实的报告。

## 7. 适配器推广计划

### 7.1 阶段 1：契约和服务器管道

工作：

1. 使用分段执行元数据扩展适配器结果类型。
2. 更新心跳成本记录以在存在分段时发出多个成本事件。
3. 在记录/调试视图的运行元数据中包含分段摘要。

成功标准：

- 现有适配器行为完全相同
- 路由适配器可以报告便宜加主使用量，而不会将它们折叠成一个假模型

### 7.2 阶段 2：`codex_local`

为什么优先：

- Codex 已经有丰富的提示/交接处理
- 适配器已经干净地注入 Paperclip 技能和工作区元数据
- 当前实现已经区分了 bootstrap、wake delta 和交接提示部分

实施工作：

1. 添加对 `smartModelRouting` 的配置支持。
2. 添加便宜-preflight 提示构建器。
3. 仅在新会话上运行便宜 preflight。
4. 将紧凑的 preflight 交接说明传递到主提示中。
5. 报告分段的 usage 和模型元数据。

重要的保护栏：

- 在 V1 中不要将便宜模型会话恢复为主会话

### 7.3 阶段 3：`claude_local`

实施工作类似，但会话模型切换风险更没有吸引力。

同样规则：

- 便宜 preflight 是短暂的
- 主 Claude 会话保持规范

### 7.4 阶段 4：其他适配器

候选：

- `cursor`
- `gemini_local`
- `opencode_local`
- 通过 `createServerAdapter()` 的外部插件适配器

这些应该晚些来，因为每个运行时都有不同的会话和模型切换语义。

## 8. UI 和配置更改

对于支持的内置适配器，代理配置 UI 应暴露：

- `model` 作为主模型
- `smart model routing` 切换
- `cheap model`
- 可选的便宜 thinking effort
- 可选的 `allow initial progress comment` 切换

运行详情 UI 也应显示路由发生的时间，例如：

- 便宜 preflight 模型
- 主模型
- token/成本分拆

这很重要，因为 Paperclip 的 board UI 应该使成本和行为清晰可见。

## 9. 为什么不完全复制 Hermes

Hermes 的便宜路由启发式是有用的先例，但 Paperclip 不应该从这里开始。

原因：

- Hermes 正在优化自由形式的对话轮次
- Paperclip 代理运行结构化的、issue 范围的心跳，具有明确的 task 和工作区上下文
- Paperclip 已经知道运行是新的还是恢复的、issue 范围还是审批后续，以及存在什么工作区/会话
- 那些执行事实是比提示词关键词匹配更强的路由信号

如果 Paperclip 以后想要用于平凡运行的便宜唯一完成路径，那可以是在观察到的运行数据之上的第二阶段功能，而不是第一个实施。

## 10. 风险

### 10.1 重复或嘈杂的评论

如果便宜阶段发布更新，而主阶段发布另一个几乎相同的更新，issue 线程会变得更糟。

缓解：

- 保持便宜评论可选
- 使 preflight 提示明确避免在已发布有用评论时重复状态

### 10.2 误导性成本报告

如果我们只记录主模型，board 会失去对路由成本权衡的可见性。

缓解：

- 在发布适配器行为之前添加分段执行报告

### 10.3 会话损坏

跨模型会话重用可能失败或降低上下文质量。

缓解：

- V1 不持久化或恢复便宜 preflight 会话

### 10.4 便宜模型越权

具有完整工具和权限的便宜模型可能做太多低质量工作。

缓解：

- 硬性限制 preflight 轮次
- 使用明确的仅编排提示
- 从我们能很好测试行为的支持适配器开始

## 11. 验证计划

需要的测试：

- 路由资格的适配器单元测试
- "新会话 -> 便宜 preflight + 主"的适配器单元测试
- "恢复会话 -> 仅主"的适配器单元测试
- 分段 cost-event 创建的心跳测试
- cheap-model 字段配置保存/加载的 UI 测试

手动检查：

- 为路由 Codex 或 Claude 代理创建新的 issue
- 验证运行元数据显示两个阶段
- 验证仅主会话被持久化
- 验证成本行反映两个模型
- 验证 issue 线程不会收到重复的启动评论

## 12. 推荐顺序

1. 向适配器/服务器契约添加分段执行报告。
2. 实施 `codex_local` 便宜 preflight。
3. 验证成本可见性和记录 UX。
4. 实施 `claude_local` 便宜 preflight。
5. 稍后决定是否有任何适配器除了基于阶段的路由还需要 Hermes 风格的文本启发式。

## 13. 建议

Paperclip 应按以下方式交付智能模型路由：

- 适配器特定
- opt-in
- 基于阶段
- 会话安全
- 成本如实

正确的 V1 不是"为简单提示选择最便宜的模型"。正确的 V1 是"在新运行上使用便宜模型进行有界限的编排工作，然后交接给主模型执行真正的任务"。
