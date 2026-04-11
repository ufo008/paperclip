# ClipHub — 企业注册表

**下载一家企业。**

ClipHub 是一个公共注册表，人们在这里分享、发现和下载 Paperclip 企业配置。一个企业模板是一个可移植的产物，包含整个组织——智能体、汇报结构、适配器配置、角色定义、初始任务——只需一条命令即可启动。

---

## 它是什么

ClipHub 对于 Paperclip 的意义，就像包注册表对于编程语言的意义。Paperclip 已经支持可导出的组织配置（参见 [SPEC.md](./SPEC.md) §2）。ClipHub 是这些导出文件所在的公共目录。

用户在 Paperclip 中构建一家正常运转的企业——一家开发公司、一家营销机构、一家研究实验室、一家内容工作室——然后导出模板并发布到 ClipHub。任何人都可以浏览、搜索、下载，并在自己的 Paperclip 实例上启动该企业。

标语：**你真的可以下载一家企业。**

---

## 发布什么

ClipHub 包是一个**企业模板导出**——Paperclip 规范中定义的可移植产物格式。它包含：

| 组件 | 描述 |
|---|---|
| **企业元数据** | 名称、描述、预期用例、类别 |
| **组织架构图** | 完整的汇报层级——谁向谁汇报 |
| **智能体定义** | 每个智能体：名称、角色、职位、能力描述 |
| **适配器配置** | 每个智能体的适配器类型和配置（SOUL.md、HEARTBEAT.md、CLAUDE.md、进程命令、webhook URL——适配器需要的任何东西） |
| **初始任务** | 可选的启动任务和计划，用于引导企业的首次运行 |
| **预算默认值** | 每个智能体和每个企业的建议 token/成本预算 |

模板是**结构，不是状态。** 没有进行中的任务、没有历史成本数据、没有运行时产物。只有蓝图。

### 子包

并非每个用例都需要整个企业。ClipHub 也支持发布单独的组件：

- **智能体模板**——单个智能体配置（例如"高级 TypeScript 工程师"、"SEO 内容写手"、"DevOps 智能体"）
- **团队模板**——组织架构图的子树（例如"营销团队：CMO + 3 名下属"、"工程小组：技术负责人 + 4 名工程师"）
- **适配器配置**——独立于任何特定智能体角色的可重用适配器配置

这些可以混合到现有企业中。下载一个智能体，将其插入你的组织，分配一个上级，开始工作。

---

## 核心功能

### 浏览与发现

首页从多个维度展示企业：

- **精选**——编辑精选的高质量模板
- **热门**——按下载量、star 数和 fork 数排名
- **最新**——最近发布或更新的
- **类别**——按用例浏览（见下文类别）

每个列表显示：名称、简短描述、组织规模（智能体数量）、类别、使用的适配器类型、star 数量、下载数量，以及迷你组织架构图预览。

### 搜索

搜索是**语义搜索，不是仅关键词搜索。** 由向量嵌入驱动，因此你可以按意图搜索：

- "运行 facebook 广告的营销机构"→ 找到相关企业模板，即使标题中没有这些确切的词
- "用于构建 API 的小型开发团队"→ 找到精简的工程组织
- "带有写作和编辑的内容流水线"→ 找到内容工作室模板

还支持按以下条件筛选：类别、智能体数量范围、适配器类型、star 数量、最新程度。

### 企业详情页

点击进入企业模板会显示：

- **完整描述**——这家企业做什么、如何运作、期望什么
- **交互式组织架构图**——每个智能体的可视化树状图，包含角色、职位和能力
- **智能体列表**——每个智能体的可展开详情（适配器类型、配置摘要、角色描述）
- **初始任务**——包含的启动计划和任务
- **预算概览**——建议的成本结构
- **安装命令**——一行 CLI 命令用于下载和创建
- **版本历史**——变更日志、semver、可用的先前版本
- **社区**——star、评论、fork 数量

### 安装与 Fork

使用模板的两种方式：

**安装（全新开始）：**
```
paperclip install cliphub:<publisher>/<company-slug>
```
下载模板并在本地 Paperclip 实例中创建新企业。你添加自己的 API 密钥、设置预算、自定义智能体，然后启动。

**Fork：**
Fork 会在你自己的 ClipHub 账户下创建模板的副本。你可以修改它，将你自己的变体重新发布，而 fork 的 lineage 会被跟踪。这使得演进式改进成为可能——有人发布了一家营销机构，你 fork 它，添加一个社交媒体团队，重新发布。

### Stars 与评论

- **Stars**——书签和信号质量。Star 数量是主要的排名信号。
- **评论**——每个列表的线程讨论。提问、分享结果、提出改进建议。

### 下载数量与信号

每次安装都会被计数。注册表跟踪：

- 总下载量（所有时间）
- 每个版本的下载量
- Fork 数量
- Star 数量

这些信号会影响搜索排名和发现。

---

## 发布

### 谁可以发布

任何拥有 GitHub 账户的人都可以发布到 ClipHub。身份验证通过 GitHub OAuth。

### 如何发布

在 Paperclip 内部，将你的企业导出为模板，然后发布：

```
paperclip export --template my-company
paperclip publish cliphub my-company
```

或者使用网页 UI 直接上传模板导出。

### 你提供什么

发布时，你需要指定：

| 字段 | 必填 | 描述 |
|---|---|---|
| `slug` | 是 | URL 安全的标识符（例如 `lean-dev-shop`） |
| `name` | 是 | 显示名称 |
| `description` | 是 | 这家企业做什么以及适用对象 |
| `category` | 是 | 主要类别（见下文） |
| `tags` | 否 | 用于发现的附加标签 |
| `version` | 是 | Semver（例如 `1.0.0`） |
| `changelog` | 否 | 此版本的变更内容 |
| `readme` | 否 | 扩展文档（markdown） |
| `license` | 否 | 使用条款 |

### 版本控制

模板使用语义版本控制。每次发布都会创建一个不可变版本。用户可以安装任何版本或默认为 `latest`。版本历史和变更日志在详情页可见。

### `sync` 命令

对于维护多个模板的高级用户：

```
paperclip cliphub sync
```

扫描你本地导出的模板并发布任何新的或更新的。这对于从单个仓库维护企业模板组合很有用。

---

## 类别

企业模板按用例组织：

| 类别 | 示例 |
|---|---|
| **软件开发** | 全栈开发公司、API 开发团队、移动应用工作室 |
| **营销与增长** | 效果营销机构、内容营销团队、SEO 公司 |
| **内容与媒体** | 内容工作室、播客制作、通讯运营 |
| **研究与分析** | 市场研究公司、竞争情报、数据分析团队 |
| **运营** | 客户支持组织、内部运营团队、QA/测试公司 |
| **销售** | 外呼销售团队、潜在客户开发、客户管理 |
| **财务与法务** | 记账服务、合规监控、财务分析 |
| **创意** | 设计机构、文案工作室、品牌开发 |
| **通用** | 入门模板、精简组织、单智能体设置 |

类别不是互斥的——一个模板可以有一个主要类别加上用于跨领域问题的标签。

---

## 审核与信任

### 认证发布者

满足特定阈值（账户年龄、具有良好信号的已发布模板）的发布者会获得认证徽章。认证模板在搜索中排名更高。

### 安全审查

企业模板包含适配器配置，可能包括可执行命令（进程适配器）或 webhook URL（HTTP 适配器）。审核系统：

1. **自动扫描**——检查适配器配置中是否有可疑模式（任意代码执行、数据泄露 URL、凭证收集）
2. **社区举报**——任何登录用户都可以标记模板。多次举报后自动隐藏，等待审核。
3. **人工审核**——审核员可以批准、拒绝或请求更改

### 账户限制

新账户在发布前有等待期。这可以防止路过式垃圾信息。

---

## 架构

ClipHub 是一个与 Paperclip **独立的服务**。Paperclip 是自托管的；ClipHub 是一个托管注册表，Paperclip 实例与之通信。

### 集成点

| 层 | 角色 |
|---|---|
| **ClipHub Web** | 浏览、搜索、发现、评论、star——网站 |
| **ClipHub API** | 用于程序化发布、下载、搜索的注册表 API |
| **Paperclip CLI** | `paperclipai install`、`paperclipai publish`、`paperclipai cliphub sync`——内置于 Paperclip |
| **Paperclip UI** | Paperclip 网页 UI 中的"Browse ClipHub"面板，无需离开应用即可发现模板 |

### 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React + Vite（与 Paperclip 一致） |
| 后端 | TypeScript + Hono（与 Paperclip 一致） |
| 数据库 | PostgreSQL |
| 搜索 | 用于语义搜索的向量嵌入 |
| 认证 | GitHub OAuth |
| 存储 | 模板 zip 存储在对象存储（S3 或同等服务）中 |

### 数据模型（草稿）

```
Publisher
  id, github_id, username, display_name, verified, created_at

Template
  id, publisher_id, slug, name, description, category,
  tags[], readme, license, created_at, updated_at,
  star_count, download_count, fork_count,
  forked_from_id (nullable)

Version
  id, template_id, version (semver), changelog,
  artifact_url (zip), agent_count, adapter_types[],
  created_at

Star
  id, publisher_id, template_id, created_at

Comment
  id, publisher_id, template_id, body, parent_id (nullable),
  created_at, updated_at

Report
  id, reporter_id, template_id, reason, created_at
```

---

## 用户流程

### "我想创建一家企业"

1. 打开 ClipHub，按类别浏览或搜索"用于构建 SaaS 的开发公司"
2. 找到合适的模板——"精简 SaaS 开发公司（CEO + CTO + 3 名工程师）"
3. 阅读描述，检查组织架构图，查看评论
4. 运行 `paperclipai install cliphub:acme/lean-saas-shop`
5. Paperclip 在本地创建包含所有预配置智能体的企业
6. 设置你的 API 密钥，调整预算，添加你的初始任务
7. 启动

### "我做出了很棒的东西，想分享它"

1. 在 Paperclip 中构建和迭代企业，直到运行良好
2. 导出：`paperclipai export --template my-agency`
3. 发布：`paperclipai publish cliphub my-agency`
4. 在网页 UI 上填写描述、类别、标签
5. 模板上线——其他人可以找到并安装它

### "我想改进别人创建的企业"

1. 在 ClipHub 上找到一个接近你需求的模板
2. Fork 到你的账户
3. 在本地安装你的 fork，修改组织（添加智能体、更改配置、重构团队）
4. 导出并作为你自己的变体重新发布
5. Fork lineage 在原始版本和你自己的版本上都可见

### "我只需要一个优秀的智能体，不需要整个企业"

1. 在 ClipHub 上搜索智能体模板："高级 python 工程师"
2. 找到一个 star 多的智能体配置
3. 只安装那个智能体：`paperclipai install cliphub:acme/senior-python-eng --agent`
4. 在你现有企业中为其分配一个上级
5. 完成

---

## 与 Paperclip 的关系

ClipHub **不是使用 Paperclip 所必需的**。你完全可以从零开始构建企业，而无需接触 ClipHub。但 ClipHub 大大降低了入门门槛：

- **新用户**可以在几分钟内获得一个工作企业，而不是几个小时
- **有经验的用户**与社区分享经过验证的配置
- **生态系统**不断积累——每一个好的模板都让下一个企业更容易构建

ClipHub 对于 Paperclip 的意义，就像包注册表对于语言运行时的意义：可选，但变革性。

---

## V1 范围

### 必须有

- [ ] 模板发布（通过 CLI 或网页上传）
- [ ] 模板浏览（列表、按类别筛选）
- [ ] 模板详情页（描述、组织架构图、智能体列表、安装命令）
- [ ] 语义搜索（向量嵌入）
- [ ] `paperclipai install cliphub:<publisher>/<slug>` CLI 命令
- [ ] GitHub OAuth 身份验证
- [ ] Stars
- [ ] 下载计数
- [ ] 版本控制（semver、版本历史）
- [ ] 基本审核（社区举报、自动隐藏）

### V2

- [ ] 评论/线程讨论
- [ ] 带 lineage 跟踪的 Forking
- [ ] 智能体和团队子包
- [ ] 认证发布者徽章
- [ ] 适配器配置的自动化安全扫描
- [ ] Paperclip 网页 UI 中的"Browse ClipHub"面板
- [ ] 用于批量发布的 `paperclipai cliphub sync`
- [ ] 发布者资料和作品集

### 范围外

- 付费/高级模板（一切都是免费和公开的，至少最初是这样）
- 私有注册表（可能是未来的企业功能）
- 在 ClipHub 上运行企业（它是一个注册表，不是运行时——与 Paperclip 自身的理念一致）
