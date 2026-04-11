# Docker 快速入门

无需在本地安装 Node 或 pnpm，即可通过 Docker 运行 Paperclip。

以下所有命令均假设你在**项目根目录**（即包含 `package.json` 的目录），而不是在 `docker/` 目录内。

## 构建镜像

```sh
docker build -t paperclip-local .
```

Dockerfile 会安装常用的 agent 工具（`git`、`gh`、`curl`、`wget`、`ripgrep`、`python3`）以及 Claude、Codex 和 OpenCode CLI。

构建参数：

| 参数 | 默认值 | 用途 |
|-----|---------|---------|
| `USER_UID` | `1000` | 容器内 `node` 用户的 UID（请与主机 UID 匹配，以避免绑定挂载上的权限问题） |
| `USER_GID` | `1000` | 容器内 `node` 组的 GID |

```sh
docker build -t paperclip-local \
  --build-arg USER_UID=$(id -u) --build-arg USER_GID=$(id -g) .
```

## 一键运行（构建 + 运行）

```sh
docker build -t paperclip-local . && \
docker run --name paperclip \
  -p 3100:3100 \
  -e HOST=0.0.0.0 \
  -e PAPERCLIP_HOME=/paperclip \
  -e BETTER_AUTH_SECRET=$(openssl rand -hex 32) \
  -v "$(pwd)/data/docker-paperclip:/paperclip" \
  paperclip-local
```

打开浏览器访问：`http://localhost:3100`

数据持久化：

- 嵌入式 PostgreSQL 数据
- 上传的资源文件
- 本地密钥文件
- 本地 agent 工作区数据

以上所有数据均通过绑定挂载持久化（示例中为 `./data/docker-paperclip`）。

## Docker Compose

### 快速入门（嵌入式 SQLite）

单容器运行，无需外部数据库。数据通过绑定挂载实现持久化。

```sh
BETTER_AUTH_SECRET=$(openssl rand -hex 32) \
  docker compose -f docker/docker-compose.quickstart.yml up --build
```

默认配置：

- 主机端口：`3100`
- 持久化数据目录：`./data/docker-paperclip`

可选覆盖配置：

```sh
PAPERCLIP_PORT=3200 PAPERCLIP_DATA_DIR=../data/pc \
  docker compose -f docker/docker-compose.quickstart.yml up --build
```

**注意：** `PAPERCLIP_DATA_DIR` 相对于 compose 文件（`docker/`）进行解析，因此 `../data/pc` 对应项目根目录下的 `data/pc`。

如果修改了主机端口或使用了非本地域名，请将 `PAPERCLIP_PUBLIC_URL` 设置为你将在浏览器和认证流程中使用的外部 URL。

传递 `OPENAI_API_KEY` 和/或 `ANTHROPIC_API_KEY` 以启用本地 adapter 运行。

### 全栈模式（带 PostgreSQL）

Paperclip 服务器 + PostgreSQL 17。数据库在服务器启动前会进行健康检查。

```sh
BETTER_AUTH_SECRET=$(openssl rand -hex 32) \
  docker compose -f docker/docker-compose.yml up --build
```

PostgreSQL 数据保存在 Docker 命名卷（`pgdata`）中。Paperclip 数据保存在 `paperclip-data` 中。

### 不可信 PR 审查

使用 Codex 或 Claude 审查不可信的 pull request 的隔离容器，不会暴露你的主机。完整工作流程见 `doc/UNTRUSTED-PR-REVIEW.md`。

```sh
docker compose -f docker/docker-compose.untrusted-review.yml build
docker compose -f docker/docker-compose.untrusted-review.yml run --rm --service-ports review
```

## 认证部署（单公网 URL）

对于需要认证的部署，请设置一个规范的公网 URL，让 Paperclip 自动推导认证/回调默认值：

```yaml
services:
  paperclip:
    environment:
      PAPERCLIP_DEPLOYMENT_MODE: authenticated
      PAPERCLIP_DEPLOYMENT_EXPOSURE: private
      PAPERCLIP_PUBLIC_URL: https://desk.koker.net
```

`PAPERCLIP_PUBLIC_URL` 作为以下各项的主要数据源：

- 认证公网基础 URL
- Better Auth 基础 URL 默认值
- 引导邀请 URL 默认值
- 主机名允许列表默认值（从 URL 中提取主机名）

如需要，可使用细粒度覆盖配置（`PAPERCLIP_AUTH_PUBLIC_BASE_URL`、`BETTER_AUTH_URL`、`BETTER_AUTH_TRUSTED_ORIGINS`、`PAPERCLIP_ALLOWED_HOSTNAMES`）。

仅在需要公网 URL 主机名之外的其他主机名时明确设置 `PAPERCLIP_ALLOWED_HOSTNAMES`（例如 Tailscale/LAN 别名或多个私有主机名）。

## Docker 中的 Claude + Codex 本地适配器

镜像预装了：

- `claude`（Anthropic Claude Code CLI）
- `codex`（OpenAI Codex CLI）

如果你想在容器内进行本地 adapter 运行，请在启动容器时传入 API 密钥：

```sh
docker run --name paperclip \
  -p 3100:3100 \
  -e HOST=0.0.0.0 \
  -e PAPERCLIP_HOME=/paperclip \
  -e OPENAI_API_KEY=... \
  -e ANTHROPIC_API_KEY=... \
  -v "$(pwd)/data/docker-paperclip:/paperclip" \
  paperclip-local
```

注意事项：

- 没有 API 密钥时，应用仍可正常运行。
- Paperclip 中的 adapter 环境检查会提示缺失的认证/CLI 前置条件。

## Podman Quadlet（systemd）

`docker/quadlet/` 目录包含通过 Podman Quadlet 将 Paperclip + PostgreSQL 作为 systemd 服务运行的单元文件。

| 文件 | 用途 |
|------|---------|
| `docker/quadlet/paperclip.pod` | Pod 定义——将容器分组到共享网络命名空间 |
| `docker/quadlet/paperclip.container` | Paperclip 服务器——加入 Pod，连接到 `127.0.0.1` 的 Postgres |
| `docker/quadlet/paperclip-db.container` | PostgreSQL 17——加入 Pod，带健康检查 |

### 设置步骤

1. 构建镜像（见上文）。

2. 将 quadlet 文件复制到你的 systemd 目录：

   ```sh
   # 无 root 模式（推荐）
   cp docker/quadlet/*.pod docker/quadlet/*.container \
     ~/.config/containers/systemd/

   # 或 rootful 模式
   sudo cp docker/quadlet/*.pod docker/quadlet/*.container \
     /etc/containers/systemd/
   ```

3. 创建 secrets 环境文件（不要提交到版本控制）：

   ```sh
   cat > ~/.config/containers/systemd/paperclip.env <<EOL
   BETTER_AUTH_SECRET=$(openssl rand -hex 32)
   POSTGRES_USER=paperclip
   POSTGRES_PASSWORD=paperclip
   POSTGRES_DB=paperclip
   DATABASE_URL=postgres://paperclip:paperclip@127.0.0.1:5432/paperclip
   # OPENAI_API_KEY=sk-...
   # ANTHROPIC_API_KEY=sk-...
   EOL
   ```

4. 创建数据目录并启动：

   ```sh
   mkdir -p ~/.local/share/paperclip
   systemctl --user daemon-reload
   systemctl --user start paperclip-pod
   ```

### Quadlet 管理命令

```sh
journalctl --user -u paperclip -f        # 应用日志
journalctl --user -u paperclip-db -f     # 数据库日志
systemctl --user status paperclip-pod    # Pod 状态
systemctl --user restart paperclip-pod   # 重启所有
systemctl --user stop paperclip-pod      # 停止所有
```

### Quadlet 注意事项

- **首次启动**：与 Docker Compose 的 `condition: service_healthy` 不同，Quadlet 的 `After=` 仅等待 DB 单元*启动*，而非等待 PostgreSQL 就绪。在冷启动首次启动时，你可能在 `journalctl --user -u paperclip` 中看到一两次重启尝试，这是 PostgreSQL 初始化过程中的正常现象，会通过 `Restart=on-failure` 自动恢复。
- Pod 中的容器共享 `localhost`，因此 Paperclip 通过 `127.0.0.1:5432` 访问 Postgres。
- PostgreSQL 数据保存在 `paperclip-pgdata` 命名卷中。
- Paperclip 数据保存在 `~/.local/share/paperclip`。
- 对于 rootful quadlet 部署，请移除 `%h` 前缀并使用绝对路径。

## 上线冒烟测试（Ubuntu + npm）

当你希望模拟一台只有 Ubuntu + npm 的全新机器并验证以下内容时使用：

- `npx paperclipai onboard --yes` 完成
- 服务器绑定到 `0.0.0.0:3100`，以便主机访问
- onboard/run 横幅和启动日志可在终端中看到

构建 + 运行：

```sh
./scripts/docker-onboard-smoke.sh
```

打开浏览器访问：`http://localhost:3131`（默认冒烟测试主机端口）

常用覆盖配置：

```sh
HOST_PORT=3200 PAPERCLIPAI_VERSION=latest ./scripts/docker-onboard-smoke.sh
PAPERCLIP_DEPLOYMENT_MODE=authenticated PAPERCLIP_DEPLOYMENT_EXPOSURE=private ./scripts/docker-onboard-smoke.sh
SMOKE_DETACH=true SMOKE_METADATA_FILE=/tmp/paperclip-smoke.env PAPERCLIPAI_VERSION=latest ./scripts/docker-onboard-smoke.sh
```

注意事项：

- 持久化数据默认挂载在 `./data/docker-onboard-smoke`。
- 容器运行时用户 ID 默认使用本地 `id -u`，以便挂载的数据目录保持可写，同时避免运行时使用 root。
- 冒烟测试脚本默认使用 `authenticated/private` 模式，因此 `HOST=0.0.0.0` 可以暴露给主机。
- 冒烟测试脚本默认主机端口为 `3131`，以避免与本地 Paperclip 的 `3100` 端口冲突。
- 冒烟测试脚本还将 `PAPERCLIP_PUBLIC_URL` 默认为 `http://localhost:<HOST_PORT>`，以便引导邀请 URL 和认证回调使用可访问的主机端口，而非容器的内部 `3100`。
- 在认证模式下，冒烟测试脚本默认 `SMOKE_AUTO_BOOTSTRAP=true`，并自动执行真实的引导流程：注册一个真实用户，在容器内运行 `paperclipai auth bootstrap-ceo` 来生成真实的引导邀请，通过 HTTP 接受该邀请，并验证 board 会话访问。
- 在前台运行脚本以观察上线流程；验证完成后用 `Ctrl+C` 停止。
- 设置 `SMOKE_DETACH=true` 可让容器保持运行以供自动化使用，并可选择将 shell 可用的元数据写入 `SMOKE_METADATA_FILE`。
- 镜像定义位于 `docker/Dockerfile.onboard-smoke`。

## 通用说明

- `docker-entrypoint.sh` 会在启动时调整容器内 `node` 用户的 UID/GID，使其与通过 `USER_UID`/`USER_GID` 传入的值匹配，从而避免绑定挂载卷上的权限问题。
- Paperclip 数据通过 Docker volume/绑定挂载（compose）或 `~/.local/share/paperclip`（quadlet）进行持久化。
