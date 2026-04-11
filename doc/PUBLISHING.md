# 发布到 npm

Paperclip 包如何准备并发布到 npm 的低级参考文档。

关于维护者工作流，请使用 [doc/RELEASING.md](RELEASING.md)。本文档专注于打包内部实现。

## 当前的发布入口点

使用以下脚本：

- [`scripts/release.sh`](../scripts/release.sh) 用于 canary 和 stable 发布流程
- [`scripts/create-github-release.sh`](../scripts/create-github-release.sh) 用于推送 stable tag 之后
- [`scripts/rollback-latest.sh`](../scripts/rollback-latest.sh) 用于重新指向 `latest`
- [`scripts/build-npm.sh`](../scripts/build-npm.sh) 用于 CLI 打包构建

Paperclip 不再使用 release 分支或 Changesets 进行发布。

## 为什么 CLI 需要特殊的打包方式

CLI 包 `paperclipai` 从 workspace 包中导入代码，例如：

- `@paperclipai/server`
- `@paperclipai/db`
- `@paperclipai/shared`
- `packages/adapters/` 下的适配器包

这些 workspace 引用在开发环境中有效，但在可发布的 npm 包中无效。发布流程会临时重写版本，然后构建可发布的 CLI bundle。

## `build-npm.sh`

运行：

```bash
./scripts/build-npm.sh
```

此脚本：

1. 运行 forbidden token 检查，除非提供了 `--skip-checks`
2. 运行 `pnpm -r typecheck`
3. 使用 esbuild 将 CLI 入口点打包到 `cli/dist/index.js`
4. 使用 `node --check` 验证打包后的入口点
5. 将 `cli/package.json` 重写为可发布的 npm manifest，并将开发副本存储为 `cli/package.dev.json`
6. 将仓库的 `README.md` 复制到 `cli/README.md` 作为 npm 元数据

发布脚本退出后，开发 manifest 和临时文件会自动恢复。

## 包发现和版本控制

公共包从以下位置发现：

- `packages/`
- `server/`
- `ui/`
- `cli/`

版本重写步骤现在使用 [`scripts/release-package-map.mjs`](../scripts/release-package-map.mjs)，它会：

- 找到所有公共包
- 按内部依赖关系进行拓扑排序
- 将每个包版本重写为目标发布版本
- 将内部 `workspace:*` 依赖引用重写为目标版本的确切版本
- 更新 CLI 显示的版本字符串

这些重写是临时的。发布或 dry-run 后，工作树会被恢复。

## `@paperclipai/ui` 打包

UI 包发布预构建的静态资源，而不是 source workspace。

`ui` 包在 `prepack` 时使用 [`scripts/generate-ui-package-json.mjs`](../scripts/generate-ui-package-json.mjs) 来切换到精简的发布 manifest，它会：

- 保留发布管理的 `name` 和 `version`
- 仅发布 `dist/`
- 从下游安装中省略 source-only 依赖图

打包或发布后，`postpack` 会自动恢复开发 manifest。

### `@paperclipai/ui` 的首次手动发布

如果你需要手动发布一次 UI 包，请使用真实的包名：

- `@paperclipai/ui`

从仓库根目录推荐的流程：

```bash
# 可选的完整性检查：在首次发布存在之前这会 404
npm view @paperclipai/ui version

# 确保 dist payload 是最新的
pnpm --filter @paperclipai/ui build

# 在真正发布之前确认你的本地 npm 认证
npm whoami

# 安全预览确切的发布 payload
cd ui
pnpm publish --dry-run --no-git-checks --access public

# 真正发布
pnpm publish --no-git-checks --access public
```

注意事项：

- 从 `ui/` 发布，而不是从仓库根目录。
- `prepack` 会自动将 `ui/package.json` 重写为精简的发布 manifest，`postpack` 会在命令完成后恢复开发 manifest。
- 如果 `npm view @paperclipai/ui version` 已经返回与 [`ui/package.json`](../ui/package.json) 中相同的版本，请勿重新发布。升级版本或使用 [`scripts/release.sh`](../scripts/release.sh) 中的正常仓库范围发布流程。

如果首次真正发布返回 npm `E404`，在重试之前请检查 npm 端的前提条件：

- `npm whoami` 必须先成功。过期的或缺失的 npm 登录会阻止发布。
- 对于像 `@paperclipai/ui` 这样的组织范围包，`paperclipai` npm 组织必须存在，且发布者必须是拥有该 scope 发布权限的成员。
- 首次发布必须包含 `--access public` 才能发布公开的范围包。
- npm 还需要账户 2FA 用于发布，或者一个允许绕过 2FA 的精细化 token。

### `@paperclipai/mcp-server` 的首次手动发布

如果你需要手动发布一次 MCP server 包，请使用：

- `@paperclipai/mcp-server`

从仓库根目录推荐的流程：

```bash
# 可选的完整性检查：在首次发布存在之前这会 404
npm view @paperclipai/mcp-server version

# 确保构建输出是最新的
pnpm --filter @paperclipai/mcp-server build

# 在真正发布之前确认你的本地 npm 认证
npm whoami

# 安全预览确切的发布 payload
cd packages/mcp-server
pnpm publish --dry-run --no-git-checks --access public

# 真正发布
pnpm publish --no-git-checks --access public
```

注意事项：

- 从 `packages/mcp-server/` 发布，而不是从仓库根目录。
- 如果 `npm view @paperclipai/mcp-server version` 已经返回与 [`packages/mcp-server/package.json`](../packages/mcp-server/package.json) 中相同的版本，请勿重新发布。升级版本或使用 [`scripts/release.sh`](../scripts/release.sh) 中的正常仓库范围发布流程。
- 相同的 npm 端前提条件适用：有效的 npm 认证、`@paperclipai` scope 的发布权限、`--access public` 以及所需的发布认证/2FA 策略。

## 版本格式

Paperclip 使用日历版本：

- stable: `YYYY.MDD.P`
- canary: `YYYY.MDD.P-canary.N`

示例：

- stable: `2026.318.0`
- canary: `2026.318.1-canary.2`

## 发布模型

### Canary

Canary 发布使用 npm dist-tag `canary`。

示例：

- `paperclipai@2026.318.1-canary.2`

这使得默认安装路径保持不变，同时允许使用以下命令进行显式安装：

```bash
npx paperclipai@canary onboard
```

### Stable

Stable 发布使用 npm dist-tag `latest`。

示例：

- `paperclipai@2026.318.0`

Stable 发布不会创建 release commit。相反：

- 包版本会被临时重写
- 包从选定的源 commit 发布
- git tag `vYYYY.MDD.P` 指向该原始 commit

## 可信发布

预期的 CI 模型是通过 GitHub OIDC 的 npm 可信发布。

这意味着：

- 仓库 secrets 中没有长期存在的 `NPM_TOKEN`
- GitHub Actions 获取短期发布凭证
- 每个 workflow 文件中配置了可信发布者规则

有关 GitHub/npm 设置步骤，请参阅 [doc/RELEASE-AUTOMATION-SETUP.md](RELEASE-AUTOMATION-SETUP.md)。

## 回滚模型

回滚不会取消发布任何内容。

它将 `latest` dist-tag 重新指向之前的稳定版本：

```bash
./scripts/rollback-latest.sh 2026.318.0
```

这是如果 stable release 有问题，恢复默认安装路径的最快方式。

## 相关文件

- [`scripts/build-npm.sh`](../scripts/build-npm.sh)
- [`scripts/generate-npm-package-json.mjs`](../scripts/generate-npm-package-json.mjs)
- [`scripts/generate-ui-package-json.mjs`](../scripts/generate-ui-package-json.mjs)
- [`scripts/release-package-map.mjs`](../scripts/release-package-map.mjs)
- [`cli/esbuild.config.mjs`](../cli/esbuild.config.mjs)
- [`doc/RELEASING.md`](RELEASING.md)
