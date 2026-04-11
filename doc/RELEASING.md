# Paperclip 发布指南

面向维护者的操作手册，用于将 Paperclip 发布到 npm、GitHub 和面向网站的 changelog 平台。

发布模式现已改为 commit 驱动：

1. 每次 push 到 `master`都会自动发布 canary 版本。
2. Stable 版本从选定的经过测试的 commit 或 canary tag 手动提升。
3. Stable 版本的发布说明位于 `releases/vYYYY.MDD.P.md`。
4. 只有 stable 版本会创建 GitHub Releases。

## 版本号模型

Paperclip 使用符合 semver 语法的日历版本：

- stable: `YYYY.MDD.P`
- canary: `YYYY.MDD.P-canary.N`

示例：

- 2026年3月18日第一个 stable: `2026.318.0`
- 2026年3月18日第二个 stable: `2026.318.1`
- `2026.318.1` 系列的第四个 canary: `2026.318.1-canary.3`

重要约束：

- 中间数字槽为 `MDD`，其中 `M` 是 UTC 月份，`DD` 是补零的 UTC 日期
- 3月3日使用 `2026.303.0`，而不是 `2026.33.0`
- 不要使用前导零，如 `2026.0318.0`
- 不要使用四个数字段，如 `2026.3.18.1`
- semver 安全的 canary 形式为 `2026.318.0-canary.1`

## 发布平台

每个 stable 版本有四个独立的平台：

1. **Verification** — 确切的 git SHA 通过 typecheck、tests 和 build
2. **npm** — `paperclipai` 和公共 workspace 包被发布
3. **GitHub** — stable 版本获得一个 git tag 和 GitHub Release
4. **Website / announcements** — stable changelog 被公开发布并通知

只有当四个平台都处理完毕时，stable 发布才完成。

Canaries 只覆盖前两个平台加一个内部可追溯性 tag。

## 核心不变式

- canaries 从 `master` 发布
- stables 从明确选择的源 ref 发布
- tags 指向原始 source commit，而不是生成的 release commit
- stable notes 始终为 `releases/vYYYY.MDD.P.md`
- canaries 永不创建 GitHub Releases
- canaries 永不需要生成 changelog

## TL;DR

### Canary

每次 push 到 `master` 都会运行 [`.github/workflows/release.yml`](../.github/workflows/release.yml) 中的 canary 流程。

它会：

- 验证 push 的 commit
- 计算当前 UTC 日期的 canary 版本
- 发布到 npm dist-tag `canary`
- 创建 git tag `canary/vYYYY.MDD.P-canary.N`

用户安装 canary：

```bash
npx paperclipai@canary onboard
# or
npx paperclipai@canary onboard --data-dir "$(mktemp -d /tmp/paperclip-canary.XXXXXX)"
```

### Stable

从 Actions 标签页使用 [`.github/workflows/release.yml`](../.github/workflows/release.yml)，使用手动的 `workflow_dispatch` 输入。

[在此运行 action](https://github.com/paperclipai/paperclip/actions/workflows/release.yml)

输入：

- `source_ref`
  - commit SHA、branch 或 tag
- `stable_date`
  - 可选的 UTC 日期覆盖，格式为 `YYYY-MM-DD`
  - 输入如 `2026-03-18` 这样的日期，而不是 `2026.318.0` 这样的版本号
- `dry_run`
  - 为 true 时仅预览

运行 stable 之前：

1. 选择你信任的 canary commit 或 tag
2. 使用 `./scripts/release.sh stable --date "$(date +%F)" --print-version` 解析目标 stable 版本
3. 在该源 ref 上创建或更新 `releases/vYYYY.MDD.P.md`
4. 从该源 ref 运行 stable workflow

示例：

- `source_ref`: `master`
- `stable_date`: `2026-03-18`
- 生成的 stable 版本: `2026.318.0`

该 workflow：

- 重新验证确切的源 ref
- 为选定的 UTC 日期计算下一个 stable patch 槽位
- 将 `YYYY.MDD.P` 发布到 npm dist-tag `latest`
- 创建 git tag `vYYYY.MDD.P`
- 根据 `releases/vYYYY.MDD.P.md` 创建或更新 GitHub Release

## 本地命令

### 本地预览 canary

```bash
./scripts/release.sh canary --dry-run
```

### 本地预览 stable

```bash
./scripts/release.sh stable --dry-run
```

### 本地发布 stable

这主要用于紧急/手动使用。正常路径是 GitHub workflow。

```bash
./scripts/release.sh stable
git push public-gh refs/tags/vYYYY.MDD.P
PUBLISH_REMOTE=public-gh ./scripts/create-github-release.sh YYYY.MDD.P
```

## Stable Changelog 工作流

Stable changelog 文件位于：

- `releases/vYYYY.MDD.P.md`

Canaries 不生成 changelog 文件。

推荐的本地生成流程：

```bash
VERSION="$(./scripts/release.sh stable --date 2026-03-18 --print-version)"
claude --print --output-format stream-json --verbose --dangerously-skip-permissions --model claude-opus-4-6 "Use the release-changelog skill to draft or update releases/v${VERSION}.md for Paperclip. Read doc/RELEASING.md and .agents/skills/release-changelog/SKILL.md, then generate the stable changelog for v${VERSION} from commits since the last stable tag. Do not create a canary changelog."
```

仓库有意不通过 GitHub Actions 运行此流程，因为：

- canaries 太过频繁
- stable notes 是唯一需要 LLM 帮助的公共叙述平台
- 维护者的 LLM tokens 不应存在于 Actions 中

## 烟雾测试

对于 canary：

```bash
PAPERCLIPAI_VERSION=canary ./scripts/docker-onboard-smoke.sh
```

对于当前 stable：

```bash
PAPERCLIPAI_VERSION=latest ./scripts/docker-onboard-smoke.sh
```

有用的隔离变体：

```bash
HOST_PORT=3232 DATA_DIR=./data/release-smoke-canary PAPERCLIPAI_VERSION=canary ./scripts/docker-onboard-smoke.sh
HOST_PORT=3233 DATA_DIR=./data/release-smoke-stable PAPERCLIPAI_VERSION=latest ./scripts/docker-onboard-smoke.sh
```

自动浏览器烟雾测试也可用：

```bash
gh workflow run release-smoke.yml -f paperclip_version=canary
gh workflow run release-smoke.yml -f paperclip_version=latest
```

最低检查：

- `npx paperclipai@canary onboard` 安装成功
- onboarding 完成无崩溃
- 使用烟雾测试凭证进行身份验证登录成功
- 浏览器在全新实例上进入 onboarding
- 公司创建成功
- 第一个 CEO agent 被创建
- 第一个 CEO heartbeat run 被触发

## 回滚

回滚不会取消发布版本。

它只是将 `latest` dist-tag 移回之前的 stable：

```bash
./scripts/rollback-latest.sh 2026.318.0 --dry-run
./scripts/rollback-latest.sh 2026.318.0
```

然后使用新的 stable patch 槽位或发布日期进行修复。

## 故障处理手册

### 如果 canary 发布成功但烟雾测试失败

不要运行 stable。

而是：

1. 在 `master` 上修复问题
2. 合并修复
3. 等待下一个自动 canary
4. 重新运行烟雾测试

### 如果 stable npm 发布成功但 tag push 或 GitHub release 创建失败

这是部分发布。npm 已经上线。

立即执行：

1. push 缺失的 tag
2. 重新运行 `PUBLISH_REMOTE=public-gh ./scripts/create-github-release.sh YYYY.MDD.P`
3. 验证 GitHub Release notes 指向 `releases/vYYYY.MDD.P.md`

不要重新发布相同版本。

### 如果 stable 发布后 `latest` 损坏

回滚 dist-tag：

```bash
./scripts/rollback-latest.sh YYYY.MDD.P
```

然后使用新的 stable 发布进行修复。

## 相关文件

- [`scripts/release.sh`](../scripts/release.sh)
- [`scripts/release-package-map.mjs`](../scripts/release-package-map.mjs)
- [`scripts/create-github-release.sh`](../scripts/create-github-release.sh)
- [`scripts/rollback-latest.sh`](../scripts/rollback-latest.sh)
- [`doc/PUBLISHING.md`](PUBLISHING.md)
- [`doc/RELEASE-AUTOMATION-SETUP.md`](RELEASE-AUTOMATION-SETUP.md)
