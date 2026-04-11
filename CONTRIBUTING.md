# 贡献指南

感谢您愿意贡献！

我们非常感谢小型修复和深思熟虑的大型改进。

## 两种方式让您的 Pull Request 被接受

### 方式一：小而精的修改（最快合并方式）

- 选择**一个**明确的修复/改进点
- 修改**尽可能少**的文件
- 确保改动精准且易于审核
- 所有测试通过且 CI 状态为绿色
- Greptile 评分为 5/5，且所有评论均已处理
- 使用 [PR 模板](.github/PULL_REQUEST_TEMPLATE.md)

符合这些条件的 PR 几乎总能快速合并。

### 方式二：更大或更有影响力的改动

- **首先**在 Discord → #dev 频道讨论
  → 描述您想要解决的问题
  → 分享大致想法/方案
- 初步达成一致后，开始开发
- 在您的 PR 中包含：
  - 修改前/后的截图（如果是 UI/行为变化，可使用短视频）
  - 清晰的改动说明及原因
  - 功能验证证明（手动测试说明）
  - 所有测试通过且 CI 状态为绿色
  - Greptile 评分 5/5，且所有评论均已处理
  - [PR 模板](.github/PULL_REQUEST_TEMPLATE.md) 完整填写

遵循此方式的 PR **更有可能**被接受，即使改动较大。

## PR 要求（所有 PR 适用）

### 使用 PR 模板

每个 pull request **必须**遵循 [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) 中的 PR 模板。如果您通过 GitHub API 或其他工具创建 PR 时跳过了模板，请手动将其内容复制到您的 PR 描述中。模板包含必填部分：Thinking Path、What Changed、Verification、Risks、Model Used 和 Checklist。

### Model Used（必填）

每个 PR 必须包含 **Model Used** 部分，说明是哪个 AI 模型协助产生了本次改动。请包含提供商、准确的模型 ID/版本、上下文窗口大小以及任何相关能力细节（如推理模式、工具使用）。如果未使用 AI，请填写"None — human-authored"。这适用于所有贡献者——无论人类还是 AI。

### 测试必须通过

所有测试必须在 PR 合并前通过。先在本地运行测试验证，确保推送后 CI 状态为绿色。

### Greptile 审核

我们使用 [Greptile](https://greptile.com) 进行自动化代码审核。您的 PR 必须达到 **5/5 的 Greptile 评分**且**所有 Greptile 评论均已处理**后方可合并。如果 Greptile 留下了评论，请修复或回复每一条评论，并请求重新审核。

## 通用规则（两种方式都适用）

- 编写清晰的 commit 消息
- PR 标题和描述要有意义
- 一个 PR = 一个逻辑改动（除非是一组相关的小改动）
- 先在本地运行测试
- 讨论时保持友善 😄

## 编写优质的 PR 消息

您的 PR 描述必须遵循 [PR 模板](.github/PULL_REQUEST_TEMPLATE.md)。所有部分都是必填的。顶部的 "thinking path" 从项目顶部开始解释，一直讲到您的修复内容。例如：

### Thinking Path 示例 1：

> - Paperclip 为零人类公司编排 AI agents
> - 每个 LLM 模型提供商都有多种适配器类型
> - 但 LLM 有上下文限制，并非所有 agents 都能自动压缩其上下文
> - 因此我们需要为适配器配置特定设置，决定哪些适配器可以或不能自动压缩上下文
> - 本 pull request 为每个适配器添加了压缩配置，可设为自动或由 Paperclip 管理
> - 这样我们就能从任何适配器/提供商中获得最优性能

### Thinking Path 示例 2：

> - Paperclip 为零人类公司编排 AI agents
> - 但人类想要观察 agents 的工作并进行监督
> - 人类用户也以团队形式工作，所以他们需要自己的登录账户、个人资料、视图等
> - 因此我们有人类的多用户系统
> - 但人类希望能更新自己的个人资料照片和头像
> - 但头像上传表单没有将头像保存到文件存储系统
> - 因此本 PR 修复了头像上传表单，使其使用文件存储服务
> - 这样我们就不会为系统的某个部分单独建立一套文件存储，避免混淆和额外配置

在 Thinking Path 之后，继续写您正常的 PR 消息。

这应该包括您做了什么、为什么这样做、为什么重要及带来的好处、如何验证它可以正常工作，以及任何风险。

如果您的改动涉及可见变化，请尽可能包含截图。（可使用 [agent-browser skill](https://github.com/vercel-labs/agent-browser/blob/main/skills/agent-browser/SKILL.md) 或类似工具来截图）。最好包含修改前后的对比截图。

有问题？直接在 #dev 提问——我们很乐意帮忙。

祝您 coding 愉快！
