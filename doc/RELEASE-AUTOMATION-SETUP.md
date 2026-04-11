# 发布自动化设置

本文档涵盖当前 Paperclip 发布模型所需的 GitHub 和 npm 设置：

- 来自 `master` 的自动 canary 版本
- 来自选定源引用的手动 stable promotion
- 通过 GitHub OIDC 进行 npm trusted publishing
- 公共仓库中的受保护发布基础设施

依赖此设置的仓库端文件：

- `.github/workflows/release.yml`
- `.github/CODEOWNERS`

注意：

- 发布 workflow 故意使用 `pnpm install --no-frozen-lockfile`
- 这符合仓库当前的策略，即 `pnpm-lock.yaml` 在 manifest 变更合并到 `master` 后由 GitHub automation 刷新
- 然后发布 job 在运行 `scripts/release.sh` 之前恢复 `pnpm-lock.yaml`，因此发布脚本仍然看到干净的工作树

## 1. 首先合并仓库变更

在接触 GitHub 或 npm 设置之前，先合并发布自动化代码，使引用的 workflow 文件名已存在于默认分支上。

所需文件：

- `.github/workflows/release.yml`
- `.github/CODEOWNERS`

## 2. 配置 npm Trusted Publishing

对 Paperclip 发布的每个公共包执行此操作。

最少包括：

- `paperclipai`
- `@paperclipai/server`
- `@paperclipai/ui`
- `packages/` 下的公共包

### 2.1. 在 npm 中打开每个包的设置页面

对于每个包：

1. 以包所有者的身份打开 npm
2. 进入包的设置/发布访问区域
3. 为 GitHub 仓库 `paperclipai/paperclip` 添加 trusted publisher

### 2.2. 为每个包添加一个 trusted publisher 条目

npm 目前允许每个包配置一个 trusted publisher。

配置：

- workflow: `.github/workflows/release.yml`

仓库：

- `paperclipai/paperclip`

环境名称：

- 将 npm trusted-publisher 环境字段留空

原因：

- 单一的 `release.yml` workflow 处理 canary 和 stable 发布
- GitHub environments `npm-canary` 和 `npm-stable` 仍然在 GitHub 端强制执行不同的审批规则

### 2.3. 在移除旧认证之前验证 trusted publishing

workflow 上线后：

1. 运行一次 canary 发布
2. 确认 npm 发布成功且没有任何 `NPM_TOKEN`
3. 运行一次 stable dry-run
4. 运行一次真正的 stable 发布

只有在完成上述步骤后才应移除基于 token 的旧访问权限。

## 3. 移除遗留的 npm Tokens

Trusted publishing 正常工作后：

1. 撤销用于发布的任何仓库或组织的 `NPM_TOKEN` secrets
2. 撤销任何曾经用于发布 Paperclip 的个人 automation token
3. 如果 npm 提供包级别设置以限制仅允许 trusted publishers 发布，请启用它

目标：

- 不应在 GitHub Actions 中保留任何长期有效的 npm 发布 token

## 4. 创建 GitHub Environments

在 GitHub 仓库中创建两个 environments：

- `npm-canary`
- `npm-stable`

路径：

1. GitHub 仓库
2. `Settings`
3. `Environments`
4. `New environment`

## 5. 配置 `npm-canary`

`npm-canary` 建议设置：

- environment name: `npm-canary`
- required reviewers: 无
- wait timer: 无
- deployment branches and tags:
  - 仅 selected branches
  - 允许 `master`

原因：

- 每次推送到 `master` 都应能够自动发布 canary
- canary 不需要人工审批

## 6. 配置 `npm-stable`

`npm-stable` 建议设置：

- environment name: `npm-stable`
- required reviewers: 至少一名 maintainer，且尽可能不要由触发 workflow 的人审批
- prevent self-review: 启用
- admin bypass: 如果团队能接受则禁用
- wait timer: 可选
- deployment branches and tags:
  - 仅 selected branches
  - 允许 `master`

原因：

- stable 发布应需要明确的人工审批门禁
- workflow 是手动的，但 environment 仍然是真正的控制点

## 7. 保护 `master`

打开 `master` 的分支保护设置。

建议规则：

1. 合并前需要 pull requests
2. 合并前需要 status checks 通过
3. 需要 code owners 审查
4. 推送新 commits 时清除过期的 approvals
5. 限制谁能直接推送到 `master`

至少确保 workflow 和发布脚本变更不能在没有审查的情况下合并。

## 8. 强制执行 CODEOWNERS 审查

此仓库现在包含 `.github/CODEOWNERS`，但 GitHub 只有在分支保护要求 code owner 审查时才会执行它。

在 `master` 的分支保护中，启用：

- `Require review from Code Owners`

然后验证所有者条目对您的实际 maintainer 集是正确的。

当前文件：

- `.github/CODEOWNERS`

如果 `@cryppadotta` 在公共仓库中不是正确的审查者身份，请在启用强制执行之前进行更改。

## 9. 特别保护发布基础设施

这些文件应始终触发 code owner 审查：

- `.github/workflows/release.yml`
- `scripts/release.sh`
- `scripts/release-lib.sh`
- `scripts/release-package-map.mjs`
- `scripts/create-github-release.sh`
- `scripts/rollback-latest.sh`
- `doc/RELEASING.md`
- `doc/PUBLISHING.md`

如果您需要更强的控制，请添加一个仓库 ruleset，明确阻止直接推送至：

- `.github/workflows/**`
- `scripts/release*`

## 10. 不要在 GitHub Actions 中存储 Claude Token

不要添加个人 Claude 或 Anthropic token 用于自动 changelog 生成。

建议策略：

- stable changelog 生成在可信的 maintainer 机器上本地进行
- canary 永不生成 changelog

这保持 LLM 消费是有意的，并避免高价值 token 暴露在 Actions 中。

## 11. 验证 Canary Workflow

设置完成后：

1. 向 `master` 合并一个无害的 commit
2. 打开由该推送触发的 `Release` workflow run
3. 确认它通过验证
4. 确认在 `npm-canary` environment 下发布成功
5. 确认 npm 现在显示一个新的 `canary` 版本
6. 确认推送了一个名为 `canary/vYYYY.MDD.P-canary.N` 的 git tag

安装路径检查：

```bash
npx paperclipai@canary onboard
```

## 12. 验证 Stable Workflow

在至少有一个好的 canary 存在后：

1. 使用 `./scripts/release.sh stable --date YYYY-MM-DD --print-version` 确定目标 stable 版本
2. 在要 promote 的源 commit 上准备 `releases/vYYYY.MDD.P.md`
3. 打开 `Actions` -> `Release`
4. 使用以下参数运行：
   - `source_ref`: 测试过的 commit SHA 或 canary tag 源 commit
   - `stable_date`: 留空或设置预期的 UTC 日期如 `2026-03-18`
     不要输入类似 `2026.318.0` 的版本号；workflow 从日期计算版本
   - `dry_run`: `true`
5. 确认 dry-run 成功
6. 使用 `dry_run: false` 重新运行
7. 提示时批准 `npm-stable` environment
8. 确认 npm `latest` 指向新的 stable 版本
9. 确认 git tag `vYYYY.MDD.P` 存在
10. 确认 GitHub Release 已创建

实现说明：

- GitHub Actions stable workflow 使用 `PUBLISH_REMOTE=origin` 调用 `create-github-release.sh`
- 本地 maintainer 使用时仍可在需要时显式传递 `PUBLISH_REMOTE=public-gh`

## 13. 建议的 Maintainer 策略

今后使用此策略：

- canary 是自动的且成本低廉
- stable 是手动的且需要审批
- 只有 stable 才有公共说明和公告
- 发布说明在 stable 发布之前提交
- rollback 使用 `npm dist-tag`，而不是 unpublish

## 14. 故障排除

### Trusted publishing 因认证错误失败

检查：

1. GitHub 上的 workflow 文件名与 npm 中配置的文件名完全匹配
2. 该包为正确的仓库设置了 trusted publisher 条目
3. job 有 `id-token: write`
4. job 正在预期仓库中运行，而不是 fork

### Stable workflow 运行但从不请求审批

检查：

1. `publish` job 使用 environment `npm-stable`
2. 该 environment 实际配置了 required reviewers
3. workflow 在规范仓库中运行，而不是 fork

### CODEOWNERS 不触发

检查：

1. `.github/CODEOWNERS` 在默认分支上
2. `master` 的分支保护需要 code owner 审查
3. 文件中的所有者身份是具有仓库访问权限的有效审查者

## 相关文档

- [doc/RELEASING.md](RELEASING.md)
- [doc/PUBLISHING.md](PUBLISHING.md)
- [doc/plans/2026-03-17-release-automation-and-versioning.md](plans/2026-03-17-release-automation-and-versioning.md)