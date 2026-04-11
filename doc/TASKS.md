# 任务管理数据模型

本文档旨在说明任务追踪在 Paperclip 中的工作原理。描述了相关实体、
它们之间的关系，以及管理任务生命周期的规则。文档作为目标模型编写
—— 其中部分内容已实现，部分则是愿景目标。

---

## 实体层级

```
Workspace
  Initiatives          ( roadmap 级别的目标，跨越季度 )
    Projects           ( 有时限的交付物，可以跨团队 )
      Milestones       ( 项目内的阶段 )
        Issues         ( 工作单元，核心实体 )
          Sub-issues   ( 父任务下分解的工作 )
```

一切都自上而下流动。Initiative 包含 Projects；Project 包含
Milestones 和 Issues；Issue 可以有 Sub-issues。每一层都增加
了细粒度。

---

## Issues（核心实体）

Issue 是工作的基本单元。

### 字段

| 字段           | 类型             | 必填 | 备注                                                               |
| ------------- | ---------------- | -------- | ----------------------------------------------------------------- |
| `id`          | uuid             | 是      | 主键                                                               |
| `identifier`  | string           | 计算得出 | 人类可读的标识符，例如 `ENG-123`（团队 key + 自增编号） |
| `title`       | string           | 是      | 简短摘要                                                           |
| `description` | text/markdown    | 否       | 完整描述，支持 markdown                                             |
| `status`      | WorkflowState FK | 是      | 默认为团队默认状态                                                  |
| `priority`    | enum (0-4)       | 否       | 默认为 0（无优先级）。参见优先级部分。                                |
| `estimate`    | number           | 否       | 复杂度/规模点数                                                     |
| `dueDate`     | date             | 否       |                                                                   |
| `teamId`      | uuid FK          | 是      | 每个 Issue 恰好属于一个团队                                        |
| `projectId`   | uuid FK          | 否       | 每个 Issue 最多属于一个项目                                         |
| `milestoneId` | uuid FK          | 否       | 每个 Issue 最多属于一个里程碑                                       |
| `assigneeId`  | uuid FK          | 否       | **单一指派人。** 参见指派部分。                                     |
| `creatorId`   | uuid FK          | 否       | 创建者                                                             |
| `parentId`    | uuid FK (self)   | 否       | 父 Issue，用于子 Issue 关系                                         |
| `goalId`      | uuid FK          | 否       | 关联的目标/goal                                                    |
| `sortOrder`   | float            | 否       | 视图内的排序                                                       |
| `createdAt`   | timestamp        | 是      |                                                                   |
| `updatedAt`   | timestamp        | 是      |                                                                   |
| `startedAt`   | timestamp        | 计算得出 | Issue 进入"已开始"状态的时间                                        |
| `completedAt` | timestamp        | 计算得出 | Issue 进入"已完成"状态的时间                                        |
| `cancelledAt` | timestamp        | 计算得出 | Issue 进入"已取消"状态的时间                                        |
| `archivedAt`  | timestamp        | 否       | 软归档                                                             |

---

## 工作流状态

Issue 状态**不是**一个扁平的枚举。它是一组团队特定的名为 states 的集合，
每个 state 属于以下固定的**类别**之一：

| 类别          | 用途                       | 示例状态                               |
| ------------- | ---------------------------- | ------------------------------------- |
| **Triage**    | 待处理，需要评审               | Triage                                |
| **Backlog**   | 已接收，但尚未准备好开始工作    | Backlog, Icebox                       |
| **Unstarted** | 已准备好但尚未开始            | Todo, Ready                           |
| **Started**   | 正在进行中                   | In Progress, In Review, In QA         |
| **Completed** | 已完成                      | Done, Shipped                         |
| **Cancelled** | 已拒绝或已放弃               | Cancelled, Won't Fix, Duplicate       |

### 规则

- 每个团队可以在这些类别中定义自己的工作流状态
- 团队每个类别至少有一个状态（Triage 是可选的）
- 可以在任何类别中添加自定义状态（例如在 Started 下添加"In Review"）
- 类别是固定且有序的——你可以在类别**内**重新排序状态，
  但不能重新排序类别本身
- 新 Issue 默认进入团队的第一个 Backlog 状态
- 将 Issue 移动到 Started 状态会自动设置 `startedAt`；移动到 Completed 设置
  `completedAt`；移动到 Cancelled 设置 `cancelledAt`
- 将 Issue 标记为重复会自动将其移动到 Cancelled 状态

### WorkflowState 字段

| 字段           | 类型    | 备注                                                                         |
| ------------- | ------- | ----------------------------------------------------------------------------- |
| `id`          | uuid    |                                                                               |
| `name`        | string  | 显示名称，例如 "In Review"                                                    |
| `type`        | enum    | 下列之一：`triage`, `backlog`, `unstarted`, `started`, `completed`, `cancelled` |
| `color`       | string  | 十六进制颜色代码                                                               |
| `description` | string  | 可选的指导文本                                                                 |
| `position`    | float   | 在类别内的排序顺序                                                             |
| `teamId`      | uuid FK | 每个状态属于一个团队                                                            |

---

## 优先级

一个固定的、不可自定义的数字刻度：

| 值   | 标签         | 备注                                   |
| ----- | ----------- | -------------------------------------- |
| 0     | No priority | 默认值。在优先级视图中排序最后。         |
| 1     | Urgent      | 可能触发即时通知                        |
| 2     | High        |                                        |
| 3     | Medium      |                                        |
| 4     | Low         |                                        |

刻度故意设计得小而固定。使用标签进行额外的
分类，而不是添加更多优先级级别。

---

## 团队

团队是主要的组织单元。几乎所有内容都以
团队为作用域。

| 字段           | 类型   | 备注                                                          |
| ------------- | ------ | -------------------------------------------------------------- |
| `id`          | uuid   |                                                                |
| `name`        | string | 例如 "Engineering"                                            |
| `key`         | string | 短的大写前缀，例如 "ENG"。用于 Issue 标识符。 |
| `description` | string |                                                                |

### 团队作用域

- 每个 Issue 恰好属于一个团队
- 工作流状态是按团队划分的
- 标签可以是团队作用域或工作区级别的
- 项目可以跨越多个团队

在我们的场景中（AI 公司），团队映射到功能领域。每个 Agent 根据
角色归属于一个团队。

---

## 项目

项目将 Issue 分组，以实现特定的、有时限的交付物。它们可以跨越
多个团队。

| 字段           | 类型      | 备注                                                         |
| ------------- | --------- | ------------------------------------------------------------- |
| `id`          | uuid      |                                                               |
| `name`        | string    |                                                               |
| `description` | text      |                                                               |
| `summary`     | string    | 简短描述                                                      |
| `status`      | enum      | `backlog`, `planned`, `in_progress`, `completed`, `cancelled` |
| `leadId`      | uuid FK   | 单一负责人以确保问责                                           |
| `startDate`   | date      |                                                               |
| `targetDate`  | date      |                                                               |
| `createdAt`   | timestamp |                                                               |
| `updatedAt`   | timestamp |                                                               |

### 规则

- 一个 Issue 最多属于一个项目
- 项目状态是**手动**更新的（不是从 Issue 状态自动推导的）
- 项目可以包含文档（规范、简报）作为关联实体

---

## 里程碑

里程碑将项目细分为有意义的阶段。

| 字段           | 类型    | 备注                          |
| ------------- | ------- | ------------------------------ |
| `id`          | uuid    |                                |
| `name`        | string  |                                |
| `description` | text    |                                |
| `targetDate`  | date    |                                |
| `projectId`   | uuid FK | 恰好属于一个项目                |
| `sortOrder`   | float   |                                |

项目中的 Issue 可以选择性地分配到某个里程碑。

---

## 标签 / 标签组

标签提供分类标记。它们存在于两种作用域：

- **工作区标签** —— 所有团队都可用
- **团队标签** —— 限制在特定团队内

| 字段           | 类型           | 备注                           |
| ------------- | -------------- | ------------------------------- |
| `id`          | uuid           |                                 |
| `name`        | string         |                                 |
| `color`       | string         | 十六进制颜色代码                 |
| `description` | string         | 上下文指导                       |
| `teamId`      | uuid FK        | 空值 表示工作区级别的标签         |
| `groupId`     | uuid FK (self) | 用于分组的父标签                 |

### 标签组

标签可以组织成一层嵌套（组 -> 标签）：

- 一个组内的标签在 Issue 上是**互斥的**（每个组只能应用一个）
- 组不能包含其他组（仅单层嵌套）
- 示例：组 "Type" 包含标签 "Bug"、"Feature"、"Chore"——一个 Issue
  最多获得一个

### Issue-标签连接表

通过 `issue_labels` 连接表实现多对多关系：

| 字段      | 类型    |
| --------- | ------- |
| `issueId` | uuid FK |
| `labelId` | uuid FK |

---

## Issue 关系 / 依赖

Issue 之间的四种关系类型：

| 类型          | 含义                       | 行为                                      |
| ------------ | -------------------------- | ----------------------------------------- |
| `related`    | 一般性连接                 | 信息链接                                   |
| `blocks`     | 此 Issue 阻塞另一个         | 被阻塞的 Issue 显示标记                    |
| `blocked_by` | 此 Issue 被另一个阻塞       | blocks 的反义                             |
| `duplicate`  | 此 Issue 是另一个的重复     | 自动将重复项移动到 Cancelled 状态          |

### IssueRelation 字段

| 字段            | 类型    | 备注                                          |
| ---------------- | ------- | ---------------------------------------------- |
| `id`             | uuid    |                                                |
| `type`           | enum    | `related`, `blocks`, `blocked_by`, `duplicate` |
| `issueId`        | uuid FK | 源 Issue                                       |
| `relatedIssueId` | uuid FK | 目标 Issue                                     |

### 规则

- 当阻塞 Issue 被解决时，关系变为信息性的（标记
  变为绿色）
- 重复是单向的（你标记重复项，而不是规范项）
- 阻塞在系统级别**不是可传递的**（A 阻塞 B，B 阻塞 C
  不会自动建立 A->C 的阻塞）

---

## 指派人

**单一指派人模型** 是设计决策。

- 每个 Issue 同时最多有一个指派人
- 这是有意为之的：明确的归属防止责任扩散
- 对于涉及多人的协作工作，使用**子 Issue** 并分配
  不同的指派人

在我们的场景中，Agent 是指派人。Issue 上的 `assigneeId` FK
指向 `agents` 表。

---

## 子 Issue（父 / 子）

Issue 支持父 / 子嵌套。

- 在 Issue 上设置 `parentId` 使其成为子 Issue
- 子 Issue 可以有自己的子 Issue（多层嵌套）
- 子 Issue 在创建时继承**项目**（不是追溯性地），
  但不继承团队、标签或指派人

### 自动关闭

- **子 Issue 自动关闭**：当父 Issue 完成时，剩余的子 Issue
  自动完成

### 转换

- 现有 Issue 可以重新设置父级（添加或移除 `parentId`）
- 有多个子 Issue 的父 Issue 可以"升级"为项目

---

## 估算

基于点数的估算，按团队配置。

### 可用的刻度

| 刻度       | 值                      |
| ----------- | ------------------------ |
| Exponential | 1, 2, 4, 8, 16 (+32, 64) |

未估算的 Issue 在进度 / 速度计算中默认为 1 点。

---

## 评论

| 字段          | 类型           | 备注                      |
| ------------ | -------------- | -------------------------- |
| `id`         | uuid           |                            |
| `body`       | text/markdown  |                            |
| `issueId`    | uuid FK        |                            |
| `authorId`   | uuid FK        | 可以是用户或 Agent         |
| `parentId`   | uuid FK (self) | 用于线程回复               |
| `resolvedAt` | timestamp      | 如果线程已被解决           |
| `createdAt`  | timestamp      |                            |
| `updatedAt`  | timestamp      |                            |

---

## 举措（Initiatives）

最高级别的规划结构。将项目分组以实现战略
目标。Initiatives 有战略所有者，通常通过成果 / OKR 来衡量，
而不是"完成 / 未完成"。

| 字段           | 类型    | 备注                            |
| ------------- | ------- | -------------------------------- |
| `id`          | uuid    |                                  |
| `name`        | string  |                                  |
| `description` | text    |                                  |
| `ownerId`     | uuid FK | 单一所有者                       |
| `status`      | enum    | `planned`, `active`, `completed` |
| `targetDate`  | date    |                                  |

Initiatives 包含项目（多对多），并提供所有包含项目的
汇总视图。

---

## 标识符

Issue 使用人类可读的标识符：`{TEAM_KEY}-{NUMBER}`

- 团队 key：每个团队设置的短大写字符串（例如 "ENG"、"DES"）
- 编号：每个团队的自增整数
- 示例：`ENG-123`、`DES-45`、`OPS-7`
- 如果 Issue 在团队之间移动，它会获得一个新的标识符，旧标识符保留在
  `previousIdentifiers` 中

这比 UUID 对人类沟通友好得多。人们说"拿 ENG-42"
而不是"拿 7f3a..."。

---

## 实体关系

```
Team (1) ----< (many) Issue
Team (1) ----< (many) WorkflowState
Team (1) ----< (many) Label (team-scoped)

Issue (many) >---- (1) WorkflowState
Issue (many) >---- (0..1) Assignee (Agent)
Issue (many) >---- (0..1) Project
Issue (many) >---- (0..1) Milestone
Issue (many) >---- (0..1) Parent Issue
Issue (1) ----< (many) Sub-issues
Issue (many) >---< (many) Labels         (via issue_labels)
Issue (many) >---< (many) Issue Relations (via issue_relations)
Issue (1) ----< (many) Comments

Project (many) >---- (0..1) Lead (Agent)
Project (1) ----< (many) Milestones
Project (1) ----< (many) Issues

Initiative (many) >---< (many) Projects  (via initiative_projects)
Initiative (many) >---- (1) Owner (Agent)
```

---

## 实现优先级

推荐的构建顺序，按价值从高到低排列：

### 高价值

1. **Teams** —— `teams` 表 + issues 上的 `teamId` FK。人类可读标识符（`ENG-123`）
   和按团队工作流状态的基础。大多数其他功能依赖团队作用域，所以先构建这个。
2. **Workflow states** —— `workflow_states` 表 + issues 上的 `stateId` FK。
   具有基于类别状态转换的按团队自定义工作流。
3. **Labels** —— `labels` + `issue_labels` 表。分类（bug/feature/chore、领域标签等）
   而不污染状态字段。
4. **Issue Relations** —— `issue_relations` 表。阻塞 / 被阻塞对
   Agent 协调至关重要（Agent A 必须等到 Agent B 完成才能开始）。
5. **Sub-issues** —— `issues` 上的 `parentId` self-FK。让 Agent 分解
   大任务。
6. **Comments** —— `comments` 表。Agent 需要在不影响描述的情况下
   交流 Issue 相关内容。

### 中等价值

7. **Transition timestamps** —— issues 上的 `startedAt`、`completedAt`、`cancelledAt`，
   由工作流状态变更自动设置。实现速度追踪和 SLA 测量。

### 较低优先级（稍后实现）

8. **Milestones** —— 一旦项目变得复杂到需要阶段时就很有用了。
9. **Initiatives** —— 一旦我们有多个为共同战略目标服务的项目就有用了。
10. **Estimates** —— 一旦我们想衡量吞吐量并预测容量就有用了。
