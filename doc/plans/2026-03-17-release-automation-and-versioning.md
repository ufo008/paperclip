# Release Automation and Versioning Simplification Plan

## Context

Paperclip 当前的发布流程记录在 `doc/RELEASING.md` 中，并通过以下方式实施：

- `.github/workflows/release.yml`
- `scripts/release-lib.sh`
- `scripts/release-start.sh`
- `scripts/release-preflight.sh`
- `scripts/release.sh`
- `scripts/create-github-release.sh`

今天的模型是：

1. 选择 `patch`、`minor` 或 `major`
2. 创建 `release/X.Y.Z`
3. 起草 `releases/vX.Y.Z.md`
4. 从该发布分支发布一个或多个 canary
5. 从同一分支发布 stable
6. 推送 tag + 创建 GitHub Release
7. 将发布分支合并回 `master`

这是可行的，但它在应该便宜的地方造成了摩擦：

- 决定 `patch` vs `minor` vs `major`
- 切割和携带发布分支
- 手动发布 canary
- 思考 canary 的变更日志生成
- 在公共 repo 中安全处理 npm 凭证

此讨论的目标状态更简单：

- 每次推送到 `master` 自动发布 canary
- stable 发布从经过审查的提交 deliberate 地提升
- 版本控制是日期驱动的而不是语义驱动的
- stable 发布即使在公共开源 repo 中也是安全的
- 变更日志生成仅针对真正的 stable 发布

## Recommendation In One Sentence

将 Paperclip 移至 semver 兼容的日历版本控制，从 `master` 自动发布 canary，从选定的经过测试的提交提升 stable，并使用 npm 信任发布加上 GitHub environments，这样就不需要长期存在的 npm 或 LLM token 留在 Actions 中。

## Core Decisions

### 1. Use calendar versions, but keep semver syntax

repo 和 npm 工具在许多地方仍然假设 semver 形状的版本字符串。这并不意味着 Paperclip 必须将 semver 保持为产品策略。这确实意味着版本格式应该保持 semver 有效。

推荐格式：

- stable：`YYYY.MDD.P`
- canary：`YYYY.MDD.P-canary.N`

示例：

- 2026 年 3 月 17 日第一个 stable：`2026.317.0`
- `2026.317.0` 线的第三个 canary：`2026.317.0-canary.2`

为什么这个形状：

- 它消除了 `patch/minor/major` 决策
- 它是有效的 semver 语法
- 它与 npm、dist-tags 和现有 semver 验证器兼容
- 它接近你实际想要的格式

重要约束：

- 中间数字槽应该是 `MDD`，其中 `M` 是月份，`DD` 是零填充的日期
- `2026.03.17` 不是要使用的格式
  - 数字 semver 标识符不允许前导零
- `2026.3.17.1` 不是要使用的格式
  - semver 有三个数字组件，不是四个
- 实用的 semver 安全等价物是 `2026.317.0-canary.8`

这实际上是 SemVer on rails 的 CalVer。

### 2. Accept that CalVer changes the compatibility contract

这不再是 spirit 中的 semver。它只是语法上的 semver。

这种权衡可能对 Paperclip 是可接受的，但应该是明确的：

- 消费者不再从 `major/minor/patch` 推断兼容性
- 发布说明成为兼容性信号
- 下游用户应该更喜欢精确 pins 或 deliberate 升级

这对于公共库包如 `@paperclipai/shared`、`@paperclipai/db` 和适配器包特别相关。

### 3. Drop release branches for normal publishing

如果每次合并到 `master` 都发布 canary，当前的 `release/X.Y.Z` 火车模型变得比价值更重要。

推荐的替换：

- `master` 是唯一的 canary 火车
- 每次推送到 `master` 可以发布 canary
- stable 从 `master` 上的选定提交或 canary tag 发布

这匹配你实际想要的工作流程：

- 持续合并
- 让 npm 总是有新鲜的 canary
- 稍后选择一个已知良好的 canary 并将该提交提升到 stable

### 4. Promote by source ref, not by "renaming" a canary

这是最重要的机械约束。

npm 可以移动 dist-tags，但它不允许你重命名已发布的版本。这意味着：

- 你可以将 `latest` 移动到 `paperclipai@1.2.3`
- 你不能将 `paperclipai@2026.317.0-canary.8` 变成 `paperclipai@2026.317.0`

所以"将 canary 提升到 stable"真正意味着：

1. 选择你信任的提交或 canary tag
2. 从那个精确提交重建
3. 用 stable 版本字符串再次发布

因此，stable 工作流程应该接受 source ref，而不仅仅是一个 bump 类型。

推荐的 stable 输入：

- `source_ref`
  - 提交 SHA，或
  - 一个 canary git tag 如 `canary/v2026.317.1-canary.8`

### 5. Only stable releases get release notes, tags, and GitHub Releases

Canary 应该保持轻量级：

- 在 npm 下发布，dist-tag 为 `canary`
- 可选地创建一个轻量级或注释的 git tag
- 不创建 GitHub Releases
- 不需要 `releases/v*.md`
- 不花费 LLM tokens

Stable 发布应该保持公共叙事表面：

- git tag `v2026.317.0`
- GitHub Release `v2026.317.0`
- stable 变更日志文件 `releases/v2026.317.0.md`

## Security Model

### Recommendation

使用 npm 信任发布与 GitHub Actions OIDC，然后禁用包的基于 token 的发布访问。

为什么：

- repo 或 org secrets 中没有长期 `NPM_TOKEN`
- Actions 中没有个人 npm token
- 仅针对授权工作流程铸造的短期凭证
- 公共包在公共 repo 中的自动 npm 溯源

这是对 open-repo 安全担忧的最干净答案。

### Concrete controls

#### 1. Use one release workflow file

为 canary 和 stable 发布使用一个工作流程文件名：

- `.github/workflows/release.yml`

为什么：

- npm 信任发布按工作流程文件名配置
- npm 当前允许每个包一个信任发布者配置
- GitHub environments 仍然可以在同一工作流程内提供单独的 canary/stable 审批规则

#### 2. Use separate GitHub environments

推荐的 environments：

- `npm-canary`
- `npm-stable`

推荐策略：

- `npm-canary`
  - 允许分支：`master`
  - 不需要人工审阅者
- `npm-stable`
  - 允许分支：`master`
  - 启用需要审阅者
  - 启用防止自我审阅
  - 禁用管理员绕过

Stable 即使在工作流程手动 dispatch 时也需要明确的第二个人类 gate。

#### 3. Lock down workflow edits

为以下添加或收紧 `CODEOWNERS` 覆盖：

- `.github/workflows/*`
- `scripts/release*`
- `doc/RELEASING.md`

这很重要，因为信任发布授权一个工作流程文件。最大的剩余风险不是 fork 的秘密泄露。是维护者批准的对发布工作流程本身的更改。

#### 4. Remove traditional npm token access after OIDC works

验证信任发布后：

- 将包发布访问设置为需要 2FA 并禁止 tokens
- 撤销任何传统自动化 tokens

这消除了"有人偷了 npm token"的故障类别。

### What not to do

- 不要将你的个人 Claude 或 npm token 放入 GitHub Actions
- 不要从 `pull_request_target` 运行发布逻辑
- 如果 OIDC 可以处理，不要让 stable 发布依赖于 repo secret
- 不要创建 canary GitHub Releases

## Changelog Strategy

### Recommendation

仅生成 stable 变更日志，现在将 LLM 辅助的变更日志生成排除在 CI 之外。

理由：

- canary 发生得太频繁
- canary 不需要精炼的公共说明
- 将个人 Claude token 放入 Actions 不值得风险
- stable 发布节奏足够低，以至于人工循环步骤是可以接受的

推荐的 stable 路径：

1. 选择一个 canary 提交或 tag
2. 从可信机器上本地运行变更日志生成
3. 提交 `releases/vYYYY.MDD.P.md`
4. 运行 stable 提升

如果说明还没准备好，回退是可以接受的：

- 发布 stable
- 创建一个最小的 GitHub Release
- 之后立即更新 `releases/vYYYY.MDD.P.md`

但更好的稳定状态是在 stable 发布之前提交 stable 说明。

### Future option

如果你以后想要 CI 辅助的变更日志起草，用以下方式做：

- 一个专用服务账户
- 仅限于变更日志生成的 token
- 一个手动工作流程
- 一个有需要审阅者的专用 environment

那是第二阶段加固工作，不是第一阶段要求。

## Proposed Future Workflow

### Canary workflow

触发：

- `master` 上的 `push`

步骤：

1. 检出合并的 `master` 提交
2. 在那个精确提交上运行验证
3. 计算当前 UTC 日期的 canary 版本
4. 将公共包版本设置为 `YYYY.MDD.P-canary.N`
5. 用 dist-tag `canary` 发布到 npm
6. 为可追溯性创建一个 canary git tag

推荐的 canary tag 格式：

- `canary/v2026.317.1-canary.4`

输出：

- npm canary 已发布
- git tag 已创建
- 无 GitHub Release
- 不需要变更日志文件

### Stable workflow

触发：

- `workflow_dispatch`

输入：

- `source_ref`
- 可选的 `stable_date`
- `dry_run`

步骤：

1. 检出 `source_ref`
2. 在那个精确提交上运行验证
3. 计算 UTC 日期或提供覆盖的下一个 stable patch 槽
4. 如果 `vYYYY.MDD.P` 已存在则失败
5. 需要 `releases/vYYYY.MDD.P.md`
6. 将公共包版本设置为 `YYYY.MDD.P`
7. 在 `latest` 下发布到 npm
8. 创建 git tag `vYYYY.MDD.P`
9. 推送 tag
10. 从 `releases/vYYYY.MDD.P.md` 创建 GitHub Release

输出：

- stable npm 发布
- stable git tag
- GitHub Release
- 干净的公共变更日志表面

## Implementation Guidance

### 1. Replace bump-type version math with explicit version computation

当前发布脚本依赖：

- `patch`
- `minor`
- `major`

该逻辑应该替换为：

- `compute_canary_version_for_date`
- `compute_stable_version_for_date`

例如：

- `next_stable_version(2026-03-17) -> 2026.317.0`
- `next_canary_for_utc_date(2026-03-17) -> 2026.317.0-canary.0`

### 2. Stop requiring `release/X.Y.Z`

这些当前不变量应从快乐路径中移除：

- "必须从分支 `release/X.Y.Z` 运行"
- "`X.Y.Z` 的 stable 和 canary 来自同一发布分支"
- `release-start.sh`

替换为：

- canary 必须从 `master` 运行
- stable 可以从固定的 `source_ref` 运行

### 3. Keep Changesets only if it stays helpful

当前系统使用 Changesets 来：

- 重写包版本
- 维护包级 `CHANGELOG.md` 文件
- 发布包

使用 CalVer，Changesets 可能对发布编排仍然有用，但不应该再拥有版本选择。

推荐实施顺序：

1. 如果与显式设置的版本一起工作则保留 `changeset publish`
2. 用小的显式版本控制脚本替换版本计算
3. 如果 Changesets 继续对抗模型，从发布中完全移除它

Paperclip 的发布问题现在是"以一个显式版本发布整个固定包集合"，而不是"从人类意图派生下一个语义 bump"。

### 4. Add a dedicated versioning script

推荐的新脚本：

- `scripts/set-release-version.mjs`

职责：

- 在所有公共可发布包中设置版本
- 更新发布所需的任何内部精确版本引用
- 更新 CLI 版本字符串
- 避免在无关文件上进行广泛字符串替换

这比保持面向 bump 的 changeset 流程然后强制它进入基于日期的方案更安全。

### 5. Keep rollback based on dist-tags

`rollback-latest.sh` 应该保留，但它应该停止假设超出语法的 semver 含义。

它应该继续：

- 将 `latest` 重新指向之前的 stable 版本
- 从不取消发布

## Tradeoffs and Risks

### 1. The stable patch slot is now part of the version contract

使用 `YYYY.MDD.P`，同日热修复支持，但 stable patch 槽现在是可见版本格式的一部分。

这是正确的权衡因为：

1. npm 仍然获得 semver 有效版本
2. 同日热修复保持可能
3. 只要日期在 `MDD` 内零填充，日历顺序仍然有效

### 2. Public package consumers lose semver intent signaling

这是 CalVer 的主要缺点。

如果这成为问题，一个替代方案是：

- 仅对 CLI 包使用 CalVer
- 对库包保持 semver

这在操作上更复杂，所以我不应该从这里开始，除非包消费者实际需要它。

### 3. Auto-canary means more publish traffic

每次 `master` 合并时发布意味着：

- 更多 npm 版本
- 更多 git tags
- 更多注册表噪音

如果 canary 保持明确分离，这是可接受的：

- npm dist-tag `canary`
- 无 GitHub Release
- 无外部公告

## Rollout Plan

### Phase 1: Security foundation

1. 创建 `release.yml`
2. 为所有公共包配置 npm 信任发布者
3. 创建 `npm-canary` 和 `npm-stable` environments
4. 为发布文件添加 `CODEOWNERS` 保护
5. 验证 OIDC 发布有效
6. 禁用基于 token 的发布访问并撤销旧 tokens

### Phase 2: Canary automation

1. 在 `master` 的 `push` 上添加 canary 工作流程
2. 添加显式日历版本计算
3. 添加 canary git 标记
4. 从 canary 中移除变更日志要求
5. 更新 `doc/RELEASING.md`

### Phase 3: Stable promotion

1. 用 `source_ref` 添加手动 stable 工作流程
2. 需要 stable 说明文件
3. 发布 stable + tag + GitHub Release
4. 更新回滚文档和脚本
5. 退役发布分支假设

### Phase 4: Cleanup

1. 从主要路径移除 `release-start.sh`
2. 从维护者文档中移除 `patch/minor/major`
3. 决定是否从发布中保留或移除 Changesets
4. 公开记录 CalVer 兼容性契约

## Concrete Recommendation

Paperclip 应该采用此模型：

- stable 版本：`YYYY.MMDD.P`
- canary 版本：`YYYY.MMDD.P-canary.N`
- canary 在每次推送到 `master` 时自动发布
- stable 从选定的经过测试的提交或 canary tag 手动提升
- 默认路径中无发布分支
- 无 canary 变更日志文件
- 无 canary GitHub Releases
- GitHub Actions 中无 Claude token
- GitHub Actions 中无 npm 自动化 token
- npm 信任发布加上 GitHub environments 用于发布安全

这消除了 semver 的烦人部分而不与 npm 对抗，使 canary 便宜，使 stable deliberate，并实质性改善了公共 repository 的安全姿态。

## External References

- npm trusted publishing: https://docs.npmjs.com/trusted-publishers/
- npm dist-tags: https://docs.npmjs.com/adding-dist-tags-to-packages/
- npm semantic versioning guidance: https://docs.npmjs.com/about-semantic-versioning/
- GitHub environments and deployment protection rules: https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments
- GitHub secrets behavior for forks: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets
