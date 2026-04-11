# Memory Landscape

日期：2026-03-17

本文件总结了任务 `PAP-530` 中引用的 memory 系统，并提取了对 Paperclip 重要的设计模式。

## Paperclip 从本次调研中需要什么

Paperclip 并不试图成为一个单一观点的 memory 引擎。更实用的目标是成为一个控制平面 memory 层，该层：

- 保持公司范围作用域
- 让每个公司选择默认的 memory 提供者
- 让特定 agent 可以覆盖该默认值
- 保持追溯到 Paperclip runs、issues、comments 和 documents 的来源
- 以与控制平面记录其他工作相同的方式记录 memory 相关的成本和延迟
- 与插件提供的提供者配合工作，而不仅仅是内置的

问题不是"哪个 memory 项目会赢？"问题是"什么是能够位于多个截然不同的 memory 系统之上而不会抹平有用差异的最小 Paperclip 契约？"

## 快速分组

### Hosted memory API

- `mem0`
- `supermemory`
- `Memori`

这些优化了简单的应用集成体验：发送对话/内容加上身份标识，然后稍后查询相关的 memory 或用户上下文。

### 以 agent 为中心的 memory 框架 / memory OSes

- `MemOS`
- `memU`
- `EverMemOS`
- `OpenViking`

这些将 memory 视为 agent 运行时子系统，而不仅仅是搜索索引。它们通常添加 task memory、profiles、文件系统风格的组织、异步摄取或 skill/资源管理。

### 本地优先的 memory 存储 / 索引

- `nuggets`
- `memsearch`

这些强调本地持久化、可检查性和低运维开销。它们很有用，因为 Paperclip 今天就是本地优先的，需要至少一条零配置路径。

## 各项目笔记

| 项目 | 形态 | 值得注意的 API / 模型 | 对 Paperclip 的适配度 | 主要不匹配点 |
|---|---|---|---|---|
| [nuggets](https://github.com/NeoVertex1/nuggets) | 本地 memory 引擎 + 消息网关 | 主题作用域的 HRR memory，包含 `remember`、`recall`、`forget`，事实提升到 `MEMORY.md` | 轻量级本地 memory 和自动提升的良好示例 | 非常特定的架构；不是通用的多租户服务 |
| [mem0](https://github.com/mem0ai/mem0) | 托管 + OSS SDK | `add`、`search`、`getAll`、`get`、`update`、`delete`、`deleteAll`；通过 `user_id`、`agent_id`、`run_id`、`app_id` 进行实体分区 | 最接近带有身份标识和元数据过滤器的干净提供者 API | 提供者严重拥有提取权；Paperclip 不应假设每个后端都像 mem0 一样行为 |
| [MemOS](https://github.com/MemTensor/MemOS) | memory OS / 框架 | 统一的 add-retrieve-edit-delete、memory cubes、多模态 memory、tool memory、异步调度器、反馈/修正 | 可选功能（超越普通搜索）的强大来源 | 比 Paperclip 首先应该标准化的最小契约要广泛得多 |
| [supermemory](https://github.com/supermemoryai/supermemory) | 托管 memory + context API | `add`、`profile`、`search.memories`、`search.documents`、文档上传、设置；自动 profile 构建和遗忘 | "context bundle"而非原始搜索结果的强示例 | 围绕自己的本体论和托管流程严重产品化 |
| [memU](https://github.com/NevaMind-AI/memU) | 主动式 agent memory 框架 | 文件系统隐喻、主动循环、意图预测、始终在线的 companion model | 当 memory 应该触发 agent 行为（而不仅仅是检索）时的良好来源 | 主动助手框架比 Paperclip 以 task 为中心的控制平面更宽泛 |
| [Memori](https://github.com/MemoriLabs/Memori) | 托管 memory 结构 + SDK 包装器 | 针对 LLM SDK 注册，通过 `entity_id` + `process_id` 进行归属、会话、云 + BYODB | 模型客户端周围自动捕获的强示例 | 包装器中心的设计无法一对一映射到 Paperclip 的 run / issue / comment 生命周期 |
| [EverMemOS](https://github.com/EverMind-AI/EverMemOS) | 对话式长期 memory 系统 | MemCell 提取、结构化 narratives、用户 profiles、混合检索/重排序 | 可追溯的 结构化 memories 和演化 profiles 的有用模型 | 专注于对话 memory 而非通用控制平面事件 |
| [memsearch](https://github.com/zilliztech/memsearch) | markdown 优先的本地 memory 索引 | markdown 作为事实来源、`index`、`search`、`watch`、transcript 解析、插件钩子 | 本地内置提供者和可检查来源的优秀基线 | 有意简化；没有托管服务语义或丰富的修正工作流 |
| [OpenViking](https://github.com/volcengine/OpenViking) | context 数据库 | memories/resources/skills 的文件系统风格组织、分层加载、可视化的检索轨迹 | browse/inspect UX 和 context 来源的强大来源 | 将 "context 数据库" 视为比 Paperclip 应该拥有的更大的产品表面 |

## 跨 Landscape 的共同原语

尽管这些系统在架构上存在分歧，但它们在几个原语上趋于一致：

- `ingest`：从文本、消息、文档或 transcripts 添加 memory
- `query`：给定 task、问题或作用域搜索或检索 memory
- `scope`：按 user、agent、project、process 或 session 分区 memory
- `provenance`：携带足够的元数据来解释 memory 的来源
- `maintenance`：随时间更新、遗忘、去重、压缩或修正 memories
- `context assembly`：将原始 memories 转换为可供 agent 使用的 prompt -ready bundle

如果 Paperclip 不暴露这些，它将无法很好地适应上述系统。

## 系统差异所在

这些差异正是 Paperclip 需要分层契约而不是单一硬编码引擎的原因。

### 1. 谁拥有提取权？

- `mem0`、`supermemory` 和 `Memori` 期望提供者从对话中推断 memories。
- `memsearch` 期望主机决定要写入哪些 markdown，然后为其建立索引。
- `MemOS`、`memU`、`EverMemOS` 和 `OpenViking` 处于中间位置，通常暴露更丰富的 memory 构建管道。

Paperclip 应该同时支持：
- 提供者管理的提取
- Paperclip 管理的提取，配合提供者管理的存储/检索

### 2. 什么是事实来源？

- `memsearch` 和 `nuggets` 使来源可在磁盘上检查。
- 托管 API 通常使提供者的存储成为规范。
- 像 `OpenViking` 和 `memU` 这样的文件系统风格系统将层次结构本身视为 memory 模型的一部分。

Paperclip 不应要求单一存储形态。它应该要求能够规范化地追溯到 Paperclip 实体的引用。

### 3. Memory 仅仅是搜索，还是也包括 profile 和规划状态？

- `mem0` 和 `memsearch` 以搜索和 CRUD 为中心。
- `supermemory` 添加用户 profiles 作为一流输出。
- `MemOS`、`memU`、`EverMemOS` 和 `OpenViking` 扩展到 tool traces、task memory、resources 和 skills。

Paperclip 应该将普通搜索作为最低契约，使更丰富的输出成为可选功能。

### 4. Memory 是同步还是异步？

- 本地工具通常在进程内同步工作。
- 更大的系统添加调度器、后台索引、压缩或同步任务。

Paperclip 需要同时支持直接请求/响应操作和后台维护钩子。

## Paperclip 特定的收获

### Paperclip 应该拥有这些关注点

- 将提供者绑定到公司并可选地在每个 agent 覆盖它
- 将 Paperclip 实体映射到提供者作用域
- 追溯到 issue comments、documents、runs 和 activity 的来源
- memory 工作的成本 / token / 延迟报告
- Paperclip UI 中的 browse 和 inspect 界面
- 破坏性操作的治理

### 提供者应该拥有这些关注点

- 提取启发式
- embedding / 索引策略
- 排序和重排序
- profile 综合
- 矛盾解决和遗忘逻辑
- 存储引擎细节

### 控制平面契约应该保持精简

Paperclip 不需要标准化每个提供者的每个功能。它需要：

- 一个可移植的必需核心
- 更丰富提供者的可选功能标志
- 一种记录提供者原生 ID 和元数据的方式，而不假装所有提供者在内部是等效的

## 建议方向

Paperclip 应该采用双层 memory 模型：

1. `Memory binding + 控制平面层`
   Paperclip 决定哪个 provider key 对公司、agent 或项目生效，并记录每个 memory 操作及其来源和使用情况。

2. `Provider 适配器层`
   内置或插件提供的适配器将 Paperclip memory 请求转换为提供者特定的调用。

可移植核心应涵盖：

- ingest / write
- search / recall
- browse / inspect
- get by provider record handle
- forget / correction
- usage reporting

可选功能可涵盖：

- profile synthesis
- async ingestion
- multimodal content
- tool / resource / skill memory
- provider-native graph browsing

这足以支持：

- 类似于 `memsearch` 的本地 markdown 优先基线
- 类似于 `mem0`、`supermemory` 或 `Memori` 的托管服务
- 像 `MemOS` 或 `OpenViking` 这样更丰富的 agent-memory 系统

而不会迫使 Paperclip 本身成为一个单一的 memory 引擎。

（文件结束 - 共 172 行）
