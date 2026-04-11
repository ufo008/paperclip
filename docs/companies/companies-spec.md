# Agent Companies 规范

Agent Skills 规范的扩展

版本：`agentcompanies/v1-draft`

## 1. 目的

Agent Company 包是一种基于文件系统和 GitHub 的格式，使用带有 YAML frontmatter 的 markdown 文件来描述公司、团队、智能体、项目、任务和相关技能。

本规范是 Agent Skills 规范的扩展，而非替代。

它定义了公司级、团队级和智能体级包结构如何围绕现有的 `SKILL.md` 模型进行组合。

本规范是厂商无关的。它旨在供任何 agent-company 运行时使用，不仅限于 Paperclip。

该格式设计原则：

- 人类可读和可写
- 直接从本地文件夹或 GitHub 仓库工作
- 无需中央注册表
- 支持归属和向上游文件的固定引用
- 扩展现有 Agent Skills 生态系统而不重新定义它
- 在 Paperclip 外部也有用

## 2. 核心原则

1. Markdown 是规范的。
2. Git 仓库是有效的包容器。
3. 注册表是可选的发现层，而非权威机构。
4. `SKILL.md` 仍由 Agent Skills 规范拥有。
5. 外部引用必须能够固定到不可变的 Git 提交。
6. 归属和许可证元数据必须在导入/导出时保留。
7. Slug 和相对路径是可移植的身份层，而非数据库 ID。
8. 传统文件夹结构应无需冗长连接即可工作。
9. 厂商特定保真度属于可选扩展，而非基础包的一部分。

## 3. 包类型

包根目录由一个主要 markdown 文件标识：

- `COMPANY.md` 表示公司包
- `TEAM.md` 表示团队包
- `AGENTS.md` 表示智能体包
- `PROJECT.md` 表示项目包
- `TASK.md` 表示任务包
- `SKILL.md` 表示由 Agent Skills 规范定义的技能包

GitHub 仓库可以在根目录包含一个包，也可以在子目录中包含多个包。

## 4. 保留文件和目录

常见约定：

```text
COMPANY.md
TEAM.md
AGENTS.md
PROJECT.md
TASK.md
SKILL.md

agents/<slug>/AGENTS.md
teams/<slug>/TEAM.md
projects/<slug>/PROJECT.md
projects/<slug>/tasks/<slug>/TASK.md
tasks/<slug>/TASK.md
skills/<slug>/SKILL.md
.paperclip.yaml

HEARTBEAT.md
SOUL.md
TOOLS.md
README.md
assets/
scripts/
references/
```

规则：

- 只有 markdown 文件才是规范的内容文档
- 允许使用 `assets/`、`scripts/` 和 `references/` 等非 markdown 目录
- 包工具可以生成可选的锁文件，但锁文件不是创作所必需的

## 5. 通用 Frontmatter

包文档可能支持以下字段：

```yaml
schema: agentcompanies/v1
kind: company | team | agent | project | task
slug: my-slug
name: Human Readable Name
description: Short description
version: 0.1.0
license: MIT
authors:
  - name: Jane Doe
homepage: https://example.com
tags:
  - startup
  - engineering
metadata: {}
sources: []
```

注意事项：

- `schema` 是可选的，通常只出现在包根目录
- 当文件路径和文件名已经使类型显而易见时，`kind` 是可选的
- `slug` 应该是 URL 安全且稳定的
- `sources` 用于来源和外部引用
- `metadata` 用于特定于工具的扩展
- 导出者应省略空或默认值的字段

## 6. COMPANY.md

`COMPANY.md` 是整个公司包的根入口点。

### 必填字段

```yaml
name: Lean Dev Shop
description: Small engineering-focused AI company
slug: lean-dev-shop
schema: agentcompanies/v1
```

### 推荐字段

```yaml
version: 1.0.0
license: MIT
authors:
  - name: Example Org
goals:
  - Build and ship software products
includes:
  - https://github.com/example/shared-company-parts/blob/0123456789abcdef0123456789abcdef01234567/teams/engineering/TEAM.md
requirements:
  secrets:
    - OPENAI_API_KEY
```

### 语义

- `includes` 定义包图
- 本地包内容应通过文件夹约定隐式发现
- `includes` 是可选的，主要用于外部引用或非标准位置
- 包含的项目可以是本地的或外部引用
- `COMPANY.md` 可以直接包含智能体、团队、项目、任务或技能
- 公司导入器可以将 `includes` 渲染为树/复选框导入 UI

## 7. TEAM.md

`TEAM.md` 定义一个组织子树。

### 示例

```yaml
name: Engineering
description: Product and platform engineering team
schema: agentcompanies/v1
slug: engineering
manager: ../cto/AGENTS.md
includes:
  - ../platform-lead/AGENTS.md
  - ../frontend-lead/AGENTS.md
  - ../../skills/review/SKILL.md
tags:
  - team
  - engineering
```

### 语义

- 团队包是一个可重用的子树，不一定是运行时数据库表
- `manager` 标识子树的根智能体
- `includes` 可以包含子智能体、子团队或共享技能
- 团队包可以导入到现有公司并附加到目标管理器下

## 8. AGENTS.md

`AGENTS.md` 定义一个智能体。

### 示例

```yaml
name: CEO
title: Chief Executive Officer
reportsTo: null
skills:
  - plan-ceo-review
  - review
```

### 语义

- 正文内容是智能体规范的默认指令内容
- `docs` 在存在时指向兄弟 markdown 文档
- `skills` 通过技能短名称或 slug 引用可重用的 `SKILL.md` 包
- 像 `review` 这样的裸技能条目应按约定解析为 `skills/review/SKILL.md`
- 如果包引用外部技能，智能体仍应通过短名称引用技能；技能包本身拥有任何源引用、固定或归属详情
- 工具可以允许路径或 URL 条目作为逃生舱口，但导出者应在 `AGENTS.md` 中优先使用基于短名称的技能引用
- 厂商特定的适配器/运行时配置不应放在基础包中
- 不得将本地绝对路径、机器特定的 cwd 值和秘密值导出为规范的包数据

### 技能解析

智能体和技能之间的首选关联标准是技能短名称。

智能体技能条目的建议解析顺序：

1. `skills/<shortname>/SKILL.md` 处的本地包技能
2. 其声明的 slug 或短名称匹配的引用或包含的技能包
3. 具有相同短名称的工具管理的公司技能库条目

规则：

- 导出者应尽可能在 `AGENTS.md` 中发出短名称
- 导入者不应要求普通技能引用的完整文件路径
- 技能包本身应携带关于外部引用、vendoring、镜像或固定上游内容的任何复杂性
- 这使 `AGENTS.md` 保持可读性，并与 `skills.sh` 风格的共享保持一致

## 9. PROJECT.md

`PROJECT.md` 定义一个轻量级项目包。

### 示例

```yaml
name: Q2 Launch
description: Ship the Q2 launch plan and supporting assets
owner: cto
```

### 语义

- 项目包将相关启动任务和支持性 markdown 分组
- 当有明确的项目所有者时，`owner` 应引用智能体 slug
- 传统的 `tasks/` 子文件夹应被隐式发现
- 当需要明确连接时，`includes` 可以包含 `TASK.md`、`SKILL.md` 或支持文档
- 项目包旨在播下计划工作的种子，而不是表示运行时任务状态

## 10. TASK.md

`TASK.md` 定义一个轻量级启动任务。

### 示例

```yaml
name: Monday Review
assignee: ceo
project: q2-launch
recurring: true
```

### 语义

- 正文内容是规范的 markdown 任务描述
- `assignee` 应引用包内的智能体 slug
- 当任务属于 `PROJECT.md` 时，`project` 应引用项目 slug
- `recurring: true` 将任务标记为持续性 recurring 工作，而非一次性启动任务
- 任务故意设计为基本的启动工作：标题、markdown 正文、 assignee、项目链接和可选的 `recurring: true`
- 工具也可以支持 `priority`、`labels` 或 `metadata` 等可选字段，但它们不应在基础包中要求它们

### 周期性任务

- 基础包只需要说明任务是否是周期性的
- 厂商可以在供应商扩展中附加实际的 schedule / trigger / 运行时保真度，例如 `.paperclip.yaml`
- 这使 `TASK.md` 保持可移植性，同时允许更丰富的运行时系统往返其自身的自动化细节
- 旧包在过渡期间仍可使用 `schedule.recurrence`，但导出者应优先使用更简单的 `recurring: true` 基础字段

Paperclip 扩展示例：

```yaml
routines:
  monday-review:
    triggers:
      - kind: schedule
        cronExpression: "0 9 * * 1"
        timezone: America/Chicago
```

- 厂商应忽略它们不理解的未知周期性任务扩展
- 导入旧 `schedule.recurrence` 数据的厂商可以将其转换为自己运行时 trigger 模型，但新导出应优先使用更简单的 `recurring: true` 基础字段

## 11. SKILL.md 兼容性

技能包必须保持有效的 Agent Skills 包。

规则：

- `SKILL.md` 应遵循 Agent Skills 规范
- Paperclip 不得要求额外的顶级字段来保证技能有效性
- Paperclip 特定扩展必须存在于 `metadata.paperclip` 或 `metadata.sources` 下
- 技能目录可以包含 `scripts/`、`references/` 和 `assets/`，正如 Agent Skills 生态系统所期望的那样
- 实现此规范的工具应将 `skills.sh` 兼容性作为一等目标，而不是发明并行技能格式

换句话说，本规范将 Agent Skills 向上扩展到公司/团队/智能体组合。它不重新定义技能包语义。

### 兼容扩展示例

```yaml
---
name: review
description: Paranoid code review skill
allowed-tools:
  - Read
  - Grep
metadata:
  paperclip:
    tags:
      - engineering
      - review
  sources:
    - kind: github-file
      repo: vercel-labs/skills
      path: review/SKILL.md
      commit: 0123456789abcdef0123456789abcdef01234567
      sha256: 3b7e...9a
      attribution: Vercel Labs
      usage: referenced
---
```

## 12. 源引用

包可以指向上游内容而不是 vendoring 它。

### Source 对象

```yaml
sources:
  - kind: github-file
    repo: owner/repo
    path: path/to/file.md
    commit: 0123456789abcdef0123456789abcdef01234567
    blob: abcdef0123456789abcdef0123456789abcdef01
    sha256: 3b7e...9a
    url: https://github.com/owner/repo/blob/0123456789abcdef0123456789abcdef01234567/path/to/file.md
    rawUrl: https://raw.githubusercontent.com/owner/repo/0123456789abcdef0123456789abcdef01234567/path/to/file.md
    attribution: Owner Name
    license: MIT
    usage: referenced
```

### 支持的类型

- `local-file`
- `local-dir`
- `github-file`
- `github-dir`
- `url`

### 使用模式

- `vendored`：字节包含在包中
- `referenced`：包指向上游不可变内容
- `mirrored`：字节在本地缓存，但上游归属保持规范

### 规则

- 在严格模式下，`github-file` 和 `github-dir` 需要 `commit`
- 强烈建议使用 `sha256`，并在获取时进行验证
- 仅分支引用可能在开发模式下允许，但必须警告
- 对于第三方内容，导出者应默认使用 `referenced`，除非明确允许重新分发

## 13. 解析规则

给定包根目录，导入者按以下顺序解析：

1. 本地相对路径
2. 如果导入工具明确允许，则使用本地绝对路径
3. 固定的 GitHub 引用
4. 通用 URL

对于固定的 GitHub 引用：

1. 解析 `repo + commit + path`
2. 获取内容
3. 如果存在则验证 `sha256`
4. 如果存在则验证 `blob`
5. 不匹配时失败关闭

导入者必须显示：

- 缺失文件
- 哈希不匹配
- 缺失许可证
- 需要网络获取的引用上游内容
- 技能或脚本中的可执行内容

## 14. 导入图

包导入者应从以下内容构建图：

- `COMPANY.md`
- `TEAM.md`
- `AGENTS.md`
- `PROJECT.md`
- `TASK.md`
- `SKILL.md`
- 本地和外部引用

建议的导入 UI 行为：

- 将图渲染为树
- 在实体级别而非原始文件级别使用复选框
- 选择智能体会自动选择所需文档和引用的技能
- 选择团队会自动选择其子树
- 选择项目会自动选择其包含的任务
- 选择周期性任务时，应明确说明导入目标是 routine / automation，而非一次性任务
- 选择引用的第三方内容时，显示归属、许可证和获取策略

## 15. 厂商扩展

厂商特定数据应存在于基础包形状之外。

对于 Paperclip，首选的保真度扩展是：

```text
.paperclip.yaml
```

示例用途：

- 适配器类型和适配器配置
- 适配器环境输入和默认值
- 运行时设置
- 权限
- 预算
- 审批策略
- 项目执行工作区策略
- issue/task Paperclip 专用元数据

规则：

- 基础包在没有扩展的情况下必须保持可读
- 不理解厂商扩展的工具应忽略它
- Paperclip 工具默认可以将厂商扩展作为 sidecar 发出，同时保持基础 markdown 干净

建议的 Paperclip 形状：

```yaml
schema: paperclip/v1
agents:
  claudecoder:
    adapter:
      type: claude_local
      config:
        model: claude-opus-4-6
    inputs:
      env:
        ANTHROPIC_API_KEY:
          kind: secret
          requirement: optional
          default: ""
        GH_TOKEN:
          kind: secret
          requirement: optional
        CLAUDE_BIN:
          kind: plain
          requirement: optional
          default: claude
routines:
  monday-review:
    triggers:
      - kind: schedule
        cronExpression: "0 9 * * 1"
        timezone: America/Chicago
```

Paperclip 导出者的附加规则：

- 当 `AGENTS.md` 已包含智能体指令时，不要复制 `promptTemplate`
- 不要导出特定于提供商的秘密绑定，例如 `secretId`、`version` 或 `type: secret_ref`
- 将环境输入导出为具有 `required` 或 `optional` 语义和可选默认值的可移植声明
- 警告系统依赖值，例如绝对命令和绝对 `PATH` 覆盖
- 尽可能省略空和默认值的 Paperclip 字段

## 16. 导出规则

合规的导出者应该：

- 发出 markdown 根和相对文件夹布局
- 省略本地机器 ID 和时间戳
- 省略秘密值
- 省略机器特定路径
- 导出任务时保留任务描述和周期性任务声明
- 省略空/默认字段
- 默认为厂商无关的基础包
- Paperclip 导出者默认应将 `.paperclip.yaml` 作为 sidecar 发出
- 保留归属和源引用
- 对于第三方内容，优先使用 `referenced` 而非 silent vendoring
- 导出兼容技能时保留 `SKILL.md` 原样

## 17. 许可和归属

合规工具必须：

- 导入和导出时保留 `license` 和 `attribution` 元数据
- 区分 vendored 和 referenced 内容
- 导出时不要 silent inline 引用的第三方内容
- 将缺失的许可证元数据显示为警告
- 如果内容是 vendored 或 mirrored，在安装/导入之前显示限制性或未知许可证

## 18. 可选锁文件

创作不需要锁文件。

工具可以生成可选的锁文件，例如：

```text
company-package.lock.json
```

目的：

- 缓存解析的引用
- 记录最终哈希
- 支持可重复的安装

规则：

- 锁文件是可选的
- 锁文件是生成的工件，而非规范的创作输入
- markdown 包仍然是事实来源

## 19. Paperclip 映射

Paperclip 可以将此规范映射到其运行时模型，如下所示：

- 基础包：
  - `COMPANY.md` -> 公司元数据
  - `TEAM.md` -> 可导入的组织子树
  - `AGENTS.md` -> 智能体身份和指令
  - `PROJECT.md` -> 启动项目定义
  - `TASK.md` -> 启动 issue/task 定义，或当 `recurring: true` 时的周期性任务模板
  - `SKILL.md` -> 导入的技能包
  - `sources[]` -> 出处和固定的上游引用
- Paperclip 扩展：
  - `.paperclip.yaml` -> 适配器配置、运行时配置、环境输入声明、权限、预算、routine triggers 和其他 Paperclip 特定保真度

必须存在于共享 markdown 文件内的内联 Paperclip 专用元数据应使用：

- `metadata.paperclip`

这使基础格式比 Paperclip 更广泛。

本规范本身保持厂商无关，旨在供任何 agent-company 运行时使用，不仅限于 Paperclip。

## 20. 过渡

Paperclip 应切换到这个 markdown-first 包模型作为主要的可移植性格式。

`paperclip.manifest.json` 不需要作为未来包系统的兼容性要求来保留。

对于 Paperclip，这应该被视为产品方向的硬切换，而不是长期的双格式策略。

## 21. 最小示例

```text
lean-dev-shop/
├── COMPANY.md
├── agents/
│   ├── ceo/AGENTS.md
│   └── cto/AGENTS.md
├── projects/
│   └── q2-launch/
│       ├── PROJECT.md
│       └── tasks/
│           └── monday-review/
│               └── TASK.md
├── teams/
│   └── engineering/TEAM.md
├── tasks/
│   └── weekly-review/TASK.md
└── skills/
    └── review/SKILL.md

Optional:

```text
.paperclip.yaml
```
```

**建议**

这是我要采取的方向：

- 使这成为面向人类的规范
- 将 `SKILL.md` 兼容性定义为不可协商的
- 将本规范视为 Agent Skills 的扩展，而非并行格式
- 使 `companies.sh` 成为实现本规范的仓库的发现层，而非发布权威
