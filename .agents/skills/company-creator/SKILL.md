---
name: company-creator
description: >
  创建符合 Agent Companies 规范（agentcompanies/v1）的智能体公司包。当用户想要从零开始创建新的智能体公司、
  基于现有 git 仓库或技能集合构建公司，或搭建智能体团队/部门时使用。触发词包括："create a company"、"make me
  a company"、"build a company from this repo"、"set up an agent company"、"create a team of agents"、"hire some agents"，
  或当收到仓库 URL 并要求将其转换为公司时使用。不要用于导入已存在的公司包（改用 CLI 导入命令）或修改已在 Paperclip 中运行的公司。
---

# 公司创建器

创建符合 Agent Companies 规范的智能体公司包。

规范参考：

- 规范性规范：`docs/companies/companies-spec.md`（生成文件前先阅读此文件）
- Web 规范：https://agentcompanies.io/specification
- 协议网站：https://agentcompanies.io/

## 两种模式

### 模式一：从零开始创建公司

用户描述他们想要什么。采访他们以充实愿景，然后生成包。

### 模式二：从仓库创建公司

用户提供 git 仓库 URL、本地路径或 tweet。分析仓库，然后创建包装它的公司。

参见 [references/from-repo-guide.md](references/from-repo-guide.md) 获取详细的仓库分析步骤。

## 流程

### 步骤 1：收集上下文

确定适用哪种模式：

- **从零开始**：什么类型的公司或团队？什么领域？智能体应该做什么？
- **从仓库**：克隆/读取仓库。扫描现有技能、智能体配置、README、源码结构。

### 步骤 2：采访（使用 AskUserQuestion）

不要跳过此步骤。在写入任何文件之前，使用 AskUserQuestion 与用户对齐。

**对于从零开始创建的公司**，询问：

- 公司目的和领域（1-2 句话即可）
- 他们需要什么智能体——根据他们描述的内容提出招聘计划
- 这是完整公司（需要 CEO）还是团队/部门（不需要 CEO）
- 智能体应该具备的任何特定技能
- 工作如何流经组织（见下文"工作流"）
- 是否需要项目和初始任务

**对于从仓库创建的公司**，展示你的分析并询问：

- 确认你计划创建的智能体及其角色
- 是否引用或 vendoring 任何发现的技能（默认：引用）
- 除了仓库提供的之外，是否有其他额外的智能体或技能
- 公司名称和任何自定义
- 确认你从仓库推断的工作流（见下文"工作流"）

**工作流——工作如何在这个公司中流动？**

公司不仅仅是具有技能的智能体列表。它是一个将想法转化为工作产品的组织。你需要理解工作流，以便每个智能体知道：

- 谁给他们工作，以什么形式（任务、分支、问题、审查请求）
- 他们用它做什么
- 完成后交给谁，以及那个交接是什么样的
- 对于他们的角色来说，"完成"意味着什么

**并非所有公司都是流水线。** 从上下文推断正确的工作流模式：

- **流水线** — 顺序阶段，每个智能体交接给下一个。当仓库/领域有清晰的线性流程时使用（例如 plan → build → review → ship → QA，或 content ideation → draft → edit → publish）。
- **中心辐射型** — 经理委派给独立汇报的专家。当智能体做不同类型的工作且不相互依赖时使用（例如 CEO 分配给研究员、营销员和分析师）。
- **协作型** — 智能体作为同伴共同处理相同的事物。用于小型团队，每个人都为同一输出做出贡献（例如设计工作室、集思广益团队）。
- **按需型** — 智能体根据需要被召唤，没有固定流程。当智能体更像是用户直接调用的专家工具箱时使用。

对于从零开始创建的公司，根据他们描述的内容提出工作流模式，并询问是否合适。

对于从仓库创建的公司，从仓库结构推断模式。如果技能有清晰的顺序依赖关系（如 `plan-ceo-review → plan-eng-review → review → ship → qa`），那就是流水线。如果技能是独立的能力，则更可能是中心辐射型或按需型。在采访中陈述你的推断，以便用户确认或调整。

**关键采访原则：**

- 提出具体的招聘计划。不要问开放性的"你想要什么智能体？"——根据上下文建议具体的智能体，让用户调整。
- 保持精简。大多数用户对智能体公司是新手。3-5 个智能体是初创公司的典型数量。除非范围要求，否则不要建议 10+ 个智能体。
- 从零开始创建的公司应该从管理所有人的 CEO 开始。团队/部门不需要 CEO。
- 每轮问 2-3 个重点问题，而不是 10 个。

### 步骤 3：阅读规范

在生成任何文件之前，阅读规范性规范：

```
docs/companies/companies-spec.md
```

还要阅读快速参考：[references/companies-spec.md](references/companies-spec.md)

以及示例：[references/example-company.md](references/example-company.md)

### 步骤 4：生成包

创建目录结构和所有文件。严格遵循规范的约定。

**目录结构：**

```
<company-slug>/
├── COMPANY.md
├── agents/
│   └── <slug>/AGENTS.md
├── teams/
│   └── <slug>/TEAM.md        （如果需要团队）
├── projects/
│   └── <slug>/PROJECT.md     （如果需要项目）
├── tasks/
│   └── <slug>/TASK.md        （如果需要任务）
├── skills/
│   └── <slug>/SKILL.md       （如果需要自定义技能）
└── .paperclip.yaml            （Paperclip vendor 扩展）
```

**规则：**

- Slug 必须是 URL 安全的、小写、带连字符
- COMPANY.md 获取 `schema: agentcompanies/v1` - 其他文件继承它
- 智能体指令放在 AGENTS.md 正文中，而不是 .paperclip.yaml 中
- AGENTS.md 中按简写名称引用的技能解析为 `skills/<shortname>/SKILL.md`
- 对于外部技能，使用 `sources` 和 `usage: referenced`（见规范第 12 节）
- 不要导出秘密、机器本地路径或数据库 ID
- 省略空/默认字段
- 对于从仓库生成的公司，在 COMPANY.md 正文底部添加参考 footer：
  `Generated from [repo-name](repo-url) with the company-creator skill from [Paperclip](https://github.com/paperclipai/paperclip)`

**汇报结构：**

- 除 CEO 外，每个智能体都应该将 `reportsTo` 设置为其经理的 slug
- CEO 的 `reportsTo: null`
- 对于没有 CEO 的团队，顶层智能体的 `reportsTo: null`

**编写具有工作流意识的智能体指令：**

每个 AGENTS.md 正文不仅应包含智能体做什么，还应包含他们如何融入组织的工作流。包括：

1. **工作从哪里来** — "你从用户那里接收功能想法"或"你接收 CTO 分配给你的任务"
2. **你产出什么** — "你产出带有架构图的技术计划"或"你产出经过审查、批准的、可以发布的分支"
3. **你交给谁** — "当你的计划锁定后，交给 Staff Engineer 实现"或"当审查通过后，交给 Release Engineer 发布"
4. **什么触发你** — "当新功能想法需要产品级思考时，你被激活"或"当分支准备好预上线审查时，你被激活"

这将智能体集合转变为能够真正协同工作的组织。没有工作流上下文，智能体会孤立运作——他们做自己的工作，但不知道之前或之后会发生什么。

### 步骤 5：确认输出位置

询问用户将包写入到哪里。常见选项：

- 当前仓库的子目录
- 用户指定的新目录
- 当前目录（如果是空的或用户确认）

### 步骤 6：编写 README.md 和 LICENSE

**README.md** — 每个公司包都需要 README。它应该是一个很好的、可读的 introduction，浏览 GitHub 的人会欣赏。包括：

- 公司名称及其用途
- 工作流/公司如何运作
- 组织结构图，作为 markdown 列表或表格，显示智能体、职位、汇报结构和技能
- 每个智能体角色的简要描述
- 引用和参考：链接到源仓库（如果是从仓库）、链接到 Agent Companies 规范（https://agentcompanies.io/specification）、以及 Paperclip（https://github.com/paperclipai/paperclip）
- "入门"部分，解释如何导入：`paperclipai company import --from <path>`

**LICENSE** — 包含 LICENSE 文件。版权持有者是创建公司的用户，而不是上游仓库作者（他们制作了技能，用户在制作公司）。使用与源仓库相同的许可证类型（如果是从仓库）或询问用户（如果是从零开始）。如果不明确，默认为 MIT。

### 步骤 7：写入文件并总结

写入所有文件，然后给出简要总结：

- 公司名称及其用途
- 智能体名单及其角色和汇报结构
- 技能（自定义 + 引用）
- 项目和任务（如果有的话）
- 输出路径

## .paperclip.yaml 指南

`.paperclip.yaml` 文件是 Paperclip vendor 扩展。它为每个智能体配置适配器和环境输入。

### 适配器规则

**不要指定适配器，除非仓库或用户上下文需要。** 如果你不知道用户想要什么适配器，完全省略适配器块——Paperclip 将使用其默认适配器。指定未知的适配器类型会导致导入错误。

Paperclip 支持的适配器类型（这些是唯一有效的值）：
- `claude_local` — Claude Code CLI
- `codex_local` — Codex CLI
- `opencode_local` — OpenCode CLI
- `pi_local` — Pi CLI
- `cursor` — Cursor
- `gemini_local` — Gemini CLI
- `openclaw_gateway` — OpenClaw gateway

仅在以下情况下设置适配器：
- 仓库或其技能明确针对特定运行时（例如 gstack 为 Claude Code 构建，所以 `claude_local` 是合适的）
- 用户明确请求特定适配器
- 智能体的角色需要特定的运行时能力

### 环境输入规则

**不要添加样板环境变量。** 仅添加智能体根据其技能或角色实际需要的环境输入：
- `GH_TOKEN` 用于推送代码、创建 PR 或与 GitHub 交互的智能体
- 仅当技能明确需要时才添加 API 密钥
- 永远不要将 `ANTHROPIC_API_KEY` 作为默认空环境变量设置——运行时处理这个

带适配器的示例（仅在必要时）：
```yaml
schema: paperclip/v1
agents:
  release-engineer:
    adapter:
      type: claude_local
      config:
        model: claude-sonnet-4-6
    inputs:
      env:
        GH_TOKEN:
          kind: secret
          requirement: optional
```

示例——仅出现具有实际覆盖的智能体：
```yaml
schema: paperclip/v1
agents:
  release-engineer:
    inputs:
      env:
        GH_TOKEN:
          kind: secret
          requirement: optional
```

在此示例中，仅 `release-engineer` 出现，因为它需要 `GH_TOKEN`。其他智能体（ceo、cto 等）没有覆盖，因此从 `.paperclip.yaml` 中完全省略。

## 外部技能引用

当引用 GitHub 仓库中的技能时，始终使用引用模式：

```yaml
metadata:
  sources:
    - kind: github-file
      repo: owner/repo
      path: path/to/SKILL.md
      commit: <full SHA from git ls-remote or the repo>
      attribution: Owner or Org Name
      license: <from the repo's LICENSE>
      usage: referenced
```

获取提交 SHA：

```bash
git ls-remote https://github.com/owner/repo HEAD
```

除非用户明确要求，否则不要将外部技能内容复制到包中。
