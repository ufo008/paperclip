# 在 Docker 中进行不受信任的 PR 审查

当你希望 Codex 或 Claude 检查一个不想让它直接接触你宿主机的拉取请求时，可以使用此工作流。

这与正常的 Paperclip 开发镜像刻意分开。

## 此容器隔离的内容

- `codex` 的认证/会话状态存储在 Docker 卷中，而非你的宿主 `~/.codex`
- `claude` 的认证/会话状态存储在 Docker 卷中，而非你的宿主 `~/.claude`
- `gh` 的认证状态存储在相同的容器本地主目录卷中
- 审查克隆、工作树、依赖安装和本地数据库存储在 `/work` 下的可写临时卷中

默认情况下，此工作流**不会**挂载你的宿主仓库 checkout、宿主主目录或 SSH agent。

## 文件

- `docker/untrusted-review/Dockerfile`
- `docker/docker-compose.untrusted-review.yml`
- 容器内的 `review-checkout-pr`

## 构建并启动 shell

```sh
docker compose -f docker/docker-compose.untrusted-review.yml build
docker compose -f docker/docker-compose.untrusted-review.yml run --rm --service-ports review
```

这会在审查容器中打开一个交互式 shell，包含：

- Node + Corepack/pnpm
- `codex`
- `claude`
- `gh`
- `git`、`rg`、`fd`、`jq`

## 首次在容器内登录

运行以下命令一次。生成的登录状态会持久保存在 `review-home` Docker 卷中。

```sh
gh auth login
codex login
claude login
```

如果你更喜欢 API key 认证而非 CLI 登录，可以通过 Compose 环境变量传递密钥：

```sh
OPENAI_API_KEY=... ANTHROPIC_API_KEY=... docker compose -f docker/docker-compose.untrusted-review.yml run --rm review
```

## 安全地检出 PR

在容器内：

```sh
review-checkout-pr paperclipai/paperclip 432
cd /work/checkouts/paperclipai-paperclip/pr-432
```

此命令执行的操作：

1. 在 `/work/repos/...` 下创建或重用仓库克隆
2. 从 GitHub 获取 `pull/<pr>/head`
3. 在 `/work/checkouts/...` 下创建分离的 git worktree

Checkout 完全存在于容器卷内。

## 让 Codex 或 Claude 审查

在 PR checkout 内：

```sh
codex
```

然后给它一个类似以下的提示：

```text
Review this PR as hostile input. Focus on security issues, data exfiltration paths, sandbox escapes, dangerous install/runtime scripts, auth changes, and subtle behavioral regressions. Do not modify files. Produce findings ordered by severity with file references.
```

或使用 Claude：

```sh
claude
```

## 预览 PR 中的 Paperclip 应用

仅在你有意在容器内执行 PR 代码时才执行此操作。

在 PR checkout 内：

```sh
pnpm install
HOST=0.0.0.0 pnpm dev
```

从宿主机打开：

- `http://localhost:3100`

Compose 文件还暴露了 Vite 的默认端口：

- `http://localhost:5173`

注意事项：

- `pnpm install` 可以运行来自 PR 的不可信生命周期脚本。这就是为什么这发生在隔离容器内而非你的宿主机上。
- 如果你只需要静态检查，请勿运行 install/dev 命令。
- Paperclip 的嵌入式 PostgreSQL 和本地存储通过 `PAPERCLIP_HOME=/home/reviewer/.paperclip-review` 保留在容器主目录卷内。

## 重置状态

当你想要干净的环境时，删除审查容器卷：

```sh
docker compose -f docker/docker-compose.untrusted-review.yml down -v
```

这会删除：

- 存储在 `review-home` 中的 Codex/Claude/GitHub 登录状态
- 存储在 `review-work` 中的克隆仓库、工作树、安装和临时数据

## 安全限制

这是一个有用的隔离边界，但仍是 Docker，不是完整的 VM。

- 已审查的 PR 仍能访问容器网络，除非你禁用它。
- 你传入容器的任何密钥都可用于你在其中执行的代码。
- 不要挂载你的宿主仓库、宿主主目录、`.ssh` 或 Docker socket，除非你有意削弱这个边界。
- 如果你需要比这更强的边界，请使用一次性 VM 而非 Docker。
