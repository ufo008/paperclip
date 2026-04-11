---
name: para-memory-files
description: >
  使用 Tiago Forte 的 PARA 方法的基于文件的记忆系统。每当你需要在会话之间存储、
  检索、更新或组织知识时使用此技能。涵盖三个记忆层：（1）PARA 文件夹中的知识图谱，
  带有原子 YAML 事实，（2）作为原始时间线的每日笔记，（3）关于用户模式的隐性知识。
  还处理规划文件、记忆衰减、每周综合和通过 qmd 召回。
  触发于任何记忆操作：保存事实、编写每日笔记、创建实体、运行每周综合、
  召回过去上下文或管理计划。
---

# PARA 记忆文件

使用 Tiago Forte 的 PARA 方法组织的持久化、基于文件的记忆。三个层次：知识图谱、每日笔记和隐性知识。所有路径都相对于 `$AGENT_HOME`。

## 三个记忆层次

### 层次 1：知识图谱（`$AGENT_HOME/life/` -- PARA）

基于实体的存储。每个实体获得一个带两层的文件夹：

1. `summary.md` -- 快速上下文，首先加载。
2. `items.yaml` -- 原子事实，按需加载。

```text
$AGENT_HOME/life/
  projects/          # 具有明确目标/截止日期的 active 工作
    <name>/
      summary.md
      items.yaml
  areas/             # 正在进行的责任，无结束日期
    people/<name>/
    companies/<name>/
  resources/         # 参考材料，感兴趣的主题
    <topic>/
  archives/          # 其他三个中的非活动项目
  index.md
```

**PARA 规则：**

- **Projects** -- 具有目标或截止日期的 active 工作。完成后移至 archives。
- **Areas** -- 正在进行的（人员、公司、责任）。无结束日期。
- **Resources** -- 参考材料，感兴趣的主题。
- **Archives** -- 任何类别中的非活动项目。

**事实规则：**

- 立即将持久事实保存到 `items.yaml`。
- 每周：从活动事实重写 `summary.md`。
- 永远不删除事实。改为替代（`status: superseded`，添加 `superseded_by`）。
- 当实体变为非活动时，将其文件夹移至 `$AGENT_HOME/life/archives/`。

**何时创建实体：**

- 被提及 3 次以上，或
- 与用户直接相关（家人、同事、合作伙伴、客户），或
- 用户生活中的重要项目或公司。
- 否则，在每日笔记中记录。

有关原子事实 YAML 模式和记忆衰减规则，请参阅 [references/schemas.md](references/schemas.md)。

### 层次 2：每日笔记（`$AGENT_HOME/memory/YYYY-MM-DD.md`）

事件的原始时间线 -- "何时"层。

- 在对话期间持续编写。
- 在心跳期间将持久事实提取到层次 1。

### 层次 3：隐性知识（`$AGENT_HOME/MEMORY.md`）

用户操作方式 -- 模式、偏好、经验教训。

- 不是关于世界的事实；而是关于用户的事实。
- 每当你学习新的操作模式时更新。

## 写下来 -- 不要 Mental Notes

记忆不会在会话重启时存活。文件会。

- 想要记住某事 -> 写入文件。
- "记住这个" -> 更新 `$AGENT_HOME/memory/YYYY-MM-DD.md` 或相关实体文件。
- 学到教训 -> 更新 AGENTS.md、TOOLS.md 或相关技能文件。
- 犯错误 -> 记录它，以便未来的你不会重复它。
- 磁盘上的文本文件总是比保存在临时上下文中更好。

## 记忆召回 -- 使用 qmd

使用 `qmd` 而不是 grep 文件：

```bash
qmd query "what happened at Christmas"   # 带重新排名的语义搜索
qmd search "specific phrase"              # BM25 关键词搜索
qmd vsearch "conceptual question"         # 纯向量相似性
```

索引你的个人文件夹：`qmd index $AGENT_HOME`

向量 + BM25 + 重新排名可以找到措辞不同的事物。

## 规划

将计划保存在项目根目录下 `plans/` 中的时间戳文件中（个人记忆之外，以便其他智能体可以访问）。使用 `qmd` 搜索计划。计划会过时 -- 如果存在更新的计划，不要用旧版本迷惑自己。如果你注意到过时，更新文件以注明它被什么替代了。
