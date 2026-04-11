# 开发

本项目可以在本地开发环境中完全运行，无需手动设置 PostgreSQL。

## 部署模式

关于模式定义和预期的 CLI 行为，请参阅 `doc/DEPLOYMENT-MODES.md`。

当前实现状态：

- 规范模型：`local_trusted` 和 `authenticated`（具有 `private/public` 暴露）

## 前提条件

- Node.js 20+
- pnpm 9+

## 依赖锁文件策略

GitHub Actions 拥有 `pnpm-lock.yaml`。

- 请勿在 pull request 中提交 `pnpm-lock.yaml`。
- Pull request CI 在清单文件变更时验证依赖解析。
- 推送到 `master` 会使用 `pnpm install --lockfile-only --no-frozen-lockfile` 重新生成 `pnpm-lock.yaml`，必要时提交回滚，然后使用 `--frozen-lockfile` 运行验证。

## 启动开发

在仓库根目录执行：

```sh
pnpm install
pnpm dev
```

这将启动：

- API 服务器：`http://localhost:3100`
- UI：在开发中间件模式下由 API 服务器提供服务（与 API 同源）

`pnpm dev` 以监视模式运行服务器，并在工作区包（包括适配器包）发生变更时重启。使用 `pnpm dev:once` 可以不带文件监视运行。

`pnpm dev:once` 默认会在启动开发服务器前自动应用待处理的本地迁移。

`pnpm dev` 和 `pnpm dev:once` 对于当前仓库和实例现在是幂等的：如果匹配到的 Paperclip 开发运行器已存在，Paperclip 会报告现有进程而不是启动重复实例。

查看或停止当前仓库托管的开发运行器：

```sh
pnpm dev:list
pnpm dev:stop
```

`pnpm dev:once` 现在会跟踪后端相关文件变更和待处理迁移。当当前启动已过期时，board UI 会显示 `Restart required` 横幅。你还可以在 `Instance Settings > Experimental` 中启用受保护的自动重启，它会等待排队/运行中的本地 agent 运行完成后才重启开发服务器。

Tailscale/private-auth 开发模式：

```sh
pnpm dev --tailscale-auth
```

这会将开发运行为 `authenticated/private` 模式，并将服务器绑定到 `0.0.0.0` 以便在私有网络访问。

允许额外的私有主机名（例如自定义 Tailscale 主机名）：

```sh
pnpm paperclipai allowed-hostname dotta-macbook-pro
```

## 一命令本地运行

对于首次本地安装，你可以用一个命令引导和运行：

```sh
pnpm paperclipai run
```

`paperclipai run` 执行以下操作：

1. 如果配置缺失则自动引导
2. 启用修复的 `paperclipai doctor`
3. 当检查通过时启动服务器

## Docker 快速入门（无需本地安装 Node）

在 Docker 中构建和运行 Paperclip：

```sh
docker build -t paperclip-local .
docker run --name paperclip \
  -p 3100:3100 \
  -e HOST=0.0.0.0 \
  -e PAPERCLIP_HOME=/paperclip \
  -v "$(pwd)/data/docker-paperclip:/paperclip" \
  paperclip-local
```

或使用 Compose：

```sh
docker compose -f docker/docker-compose.quickstart.yml up --build
```

关于 API 密钥接线（`OPENAI_API_KEY` / `ANTHROPIC_API_KEY`）和持久化详情，请参阅 `doc/DOCKER.md`。

## 用于不受信任 PR 审查的 Docker

关于面向审查的独立容器，它会将 `codex`/`claude` 登录状态保存在 Docker 卷中，并将 PR 检出到隔离的 scratch 工作区，请参阅 `doc/UNTRUSTED-PR-REVIEW.md`。

## 开发中的数据库（自动处理）

对于本地开发，请不要设置 `DATABASE_URL`。
服务器将自动使用嵌入式 PostgreSQL 并将数据持久化到：

- `~/.paperclip/instances/default/db`

覆盖 home 和 instance：

```sh
PAPERCLIP_HOME=/custom/path PAPERCLIP_INSTANCE_ID=dev pnpm paperclipai run
```

此模式无需 Docker 或外部数据库。

## 开发中的存储（自动处理）

对于本地开发，默认存储提供者是 `local_disk`，它会将上传的图片/附件持久化到：

- `~/.paperclip/instances/default/data/storage`

配置存储提供者/设置：

```sh
pnpm paperclipai configure --section storage
```

## 默认 Agent 工作区

当本地 agent 运行没有解析的项目/会话工作区时，Paperclip 会回退到实例根目录下的 agent home 工作区：

- `~/.paperclip/instances/default/workspaces/<agent-id>`

此路径在非默认设置中遵循 `PAPERCLIP_HOME` 和 `PAPERCLIP_INSTANCE_ID`。

对于 `codex_local`，Paperclip 还会在实例根目录下管理每个公司的 Codex home，并从共享的 Codex 登录/配置 home（`$CODEX_HOME` 或 `~/.codex`）进行种子初始化：

- `~/.paperclip/instances/default/companies/<company-id>/codex-home`

如果 `codex` CLI 未安装或不在 `PATH` 上，`codex_local` agent 运行会在执行时报错并显示清晰的适配器错误。配额轮询使用短生命周期的 `codex app-server` 子进程：当无法生成 `codex` 时，该提供者在聚合配额结果中报告 `ok: false`，API 服务器继续运行（它不得因缺少二进制文件而退出）。

## 工作区本地实例

当从多个 git worktree 开发时，请勿将两个 Paperclip 服务器指向同一个嵌入式 PostgreSQL 数据目录。

请为 worktree 创建一个仓库本地的 Paperclip 配置加隔离实例：

```sh
paperclipai worktree init
# 或一步完成创建 git worktree 并初始化：
pnpm paperclipai worktree:make paperclip-pr-432
```

此命令会：

- 在 `.paperclip/config.json` 和 `.paperclip/.env` 写入仓库本地文件
- 在 `~/.paperclip-worktrees/instances/<worktree-id>/` 下创建隔离实例
- 当在链接的 git worktree 内运行时，将有效的 git hooks 镜像到该 worktree 的私有 git 目录
- 选择空闲的应用端口和嵌入式 PostgreSQL 端口
- 默认情况下通过逻辑 SQL 快照从当前有效的 Paperclip 实例/配置（存在时为仓库本地的 worktree 配置，否则为默认实例）以 `minimal` 模式初始化隔离 DB

种子模式：

- `minimal` 保留核心应用状态，如 companies、projects、issues、comments、approvals 和 auth 状态，保留所有表的 schema，但省略重量级操作历史中的行数据，如心跳运行、唤醒请求、活动日志、运行时服务和 agent 会话状态
- `full` 对源实例进行完整逻辑克隆
- `--no-seed` 创建一个空的隔离实例

在 `worktree init` 之后，当在该 worktree 内运行时，服务器和 CLI都会自动加载仓库本地的 `.paperclip/.env`，因此像 `pnpm dev`、`paperclipai doctor` 和 `paperclipai db:backup` 这样的普通命令会保持在 worktree 实例范围内。

配置好的 git worktree 默认也会暂停隔离 worktree 数据库中所有已种子化的 routine。这可以防止在开发期间意外触发复制过来的每日/cron routine。

该仓库本地的 env 还会设置：

- `PAPERCLIP_IN_WORKTREE=true`
- `PAPERCLIP_WORKTREE_NAME=<worktree-name>`
- `PAPERCLIP_WORKTREE_COLOR=<hex-color>`

服务器/UI 使用这些值进行 worktree 特定品牌标识，如顶部横幅和动态着色 favicon。

如需要，明确打印 shell 导出：

```sh
paperclipai worktree env
# 或：
eval "$(paperclipai worktree env)"
```

### Worktree CLI 参考

**`pnpm paperclipai worktree init [options]`** — 为当前 worktree 创建仓库本地 config/env 和隔离实例。

| 选项 | 描述 |
|---|---|
| `--name <name>` | 用于派生实例 ID 的显示名称 |
| `--instance <id>` | 显式隔离实例 ID |
| `--home <path>` | worktree 实例的 home 根目录（默认：`~/.paperclip-worktrees`） |
| `--from-config <path>` | 用于种子化的源 config.json |
| `--from-data-dir <path>` | 派生源配置时使用的源 PAPERCLIP_HOME |
| `--from-instance <id>` | 源实例 ID（默认：`default`） |
| `--server-port <port>` | 首选服务器端口 |
| `--db-port <port>` | 首选嵌入式 Postgres 端口 |
| `--seed-mode <mode>` | 种子配置文件：`minimal` 或 `full`（默认：`minimal`） |
| `--no-seed` | 跳过从源实例的数据库种子化 |
| `--force` | 替换现有的仓库本地配置和隔离实例数据 |

示例：

```sh
paperclipai worktree init --no-seed
paperclipai worktree init --seed-mode full
paperclipai worktree init --from-instance default
paperclipai worktree init --from-data-dir ~/.paperclip
paperclipai worktree init --force
```

修复已创建的仓库管理的 worktree 并从主默认安装重新种子化其隔离实例：

```sh
cd ~/.paperclip/worktrees/PAP-884-ai-commits-component
pnpm paperclipai worktree init --force --seed-mode minimal \
  --name PAP-884-ai-commits-component \
  --from-config ~/.paperclip/instances/default/config.json
```

这会重写 worktree 本地的 `.paperclip/config.json` + `.paperclip/.env`，在 `~/.paperclip-worktrees/instances/<worktree-id>/` 下重新创建隔离实例，并保留 git worktree 内容本身。

对于已创建的 worktree，如果你想保留现有仓库本地 config/env 而只覆盖隔离数据库，请改用 `worktree reseed`。首先停止目标 worktree 的 Paperclip 服务器，以便该命令可以安全地替换 DB。

**`pnpm paperclipai worktree reseed [options]`** — 从另一个 Paperclip 实例或 worktree 重新种子化现有 worktree 本地实例，同时保留目标 worktree 的当前配置、端口和实例标识。

| 选项 | 描述 |
|---|---|
| `--from <worktree>` | 源 worktree 路径、目录名、分支名或 `current` |
| `--to <worktree>` | 目标 worktree 路径、目录名、分支名或 `current`（默认为 `current`） |
| `--from-config <path>` | 用于种子化的源 config.json |
| `--from-data-dir <path>` | 派生源配置时使用的源 `PAPERCLIP_HOME` |
| `--from-instance <id>` | 派生源配置时的源实例 ID |
| `--seed-mode <mode>` | 种子配置文件：`minimal` 或 `full`（默认：`full`） |
| `--yes` | 跳过破坏性确认提示 |
| `--allow-live-target` | 覆盖要求首先停止目标 worktree DB 的保护 |

示例：

```sh
# 从主仓库，用当前默认/master 实例重新种子化 worktree。
cd /path/to/paperclip
pnpm paperclipai worktree reseed \
  --from current \
  --to PAP-1132-assistant-ui-pap-1131-make-issues-comments-be-like-a-chat \
  --seed-mode full \
  --yes

# 从 worktree 内部，用默认实例配置重新种子化它。
cd /path/to/paperclip/.paperclip/worktrees/PAP-1132-assistant-ui-pap-1131-make-issues-comments-be-like-a-chat
pnpm paperclipai worktree reseed \
  --from-instance default \
  --seed-mode full
```

**`pnpm paperclipai worktree:make <name> [options]`** — 将 `~/NAME` 创建为 git worktree，然后在其中初始化隔离的 Paperclip 实例。这将 `git worktree add` 和 `worktree init` 合并为一步。

| 选项 | 描述 |
|---|---|
| `--start-point <ref>` | 新分支所基于的远程 ref（例如 `origin/main`） |
| `--instance <id>` | 显式隔离实例 ID |
| `--home <path>` | worktree 实例的 home 根目录（默认：`~/.paperclip-worktrees`） |
| `--from-config <path>` | 用于种子化的源 config.json |
| `--from-data-dir <path>` | 派生源配置时使用的源 PAPERCLIP_HOME |
| `--from-instance <id>` | 源实例 ID（默认：`default`） |
| `--server-port <port>` | 首选服务器端口 |
| `--db-port <port>` | 首选嵌入式 Postgres 端口 |
| `--seed-mode <mode>` | 种子配置文件：`minimal` 或 `full`（默认：`minimal`） |
| `--no-seed` | 跳过从源实例的数据库种子化 |
| `--force` | 替换现有的仓库本地配置和隔离实例数据 |

示例：

```sh
pnpm paperclipai worktree:make paperclip-pr-432
pnpm paperclipai worktree:make my-feature --start-point origin/main
pnpm paperclipai worktree:make experiment --no-seed
```

**`pnpm paperclipai worktree env [options]`** — 打印当前 worktree 本地 Paperclip 实例的 shell 导出。

| 选项 | 描述 |
|---|---|
| `-c, --config <path>` | 配置文件路径 |
| `--json` | 打印 JSON 而不是 shell 导出 |

示例：

```sh
pnpm paperclipai worktree env
pnpm paperclipai worktree env --json
eval "$(pnpm paperclipai worktree env)"
```

对于项目执行 worktree，Paperclip 还可以在创建或复用隔离的 git worktree 后运行项目定义的 provision 命令。在项目的执行工作区策略（`workspaceStrategy.provisionCommand`）中配置此命令。该命令在派生 worktree 内运行，并接收 `PAPERCLIP_WORKSPACE_*`、`PAPERCLIP_PROJECT_ID`、`PAPERCLIP_AGENT_ID` 和 `PAPERCLIP_ISSUE_*` 环境变量，以便每个仓库可以按自己想要的方式引导自己。

## 快速健康检查

在另一个终端：

```sh
curl http://localhost:3100/api/health
curl http://localhost:3100/api/companies
```

预期结果：

- `/api/health` 返回 `{"status":"ok"}`
- `/api/companies` 返回一个 JSON 数组

## 重置本地开发数据库

要清除本地开发数据并重新开始：

```sh
rm -rf ~/.paperclip/instances/default/db
pnpm dev
```

## 可选：使用外部 Postgres

如果你设置了 `DATABASE_URL`，服务器将使用它而不是嵌入式 PostgreSQL。

## 自动数据库备份

Paperclip 可以按计时器运行自动数据库备份。默认值：

- 启用
- 每 60 分钟
- 保留 30 天
- 备份目录：`~/.paperclip/instances/default/data/backups`

配置这些：

```sh
pnpm paperclipai configure --section database
```

手动运行一次性备份：

```sh
pnpm paperclipai db:backup
# 或：
pnpm db:backup
```

环境变量覆盖：

- `PAPERCLIP_DB_BACKUP_ENABLED=true|false`
- `PAPERCLIP_DB_BACKUP_INTERVAL_MINUTES=<minutes>`
- `PAPERCLIP_DB_BACKUP_RETENTION_DAYS=<days>`
- `PAPERCLIP_DB_BACKUP_DIR=/absolute/or/~/path`

## 开发中的密钥

Agent 环境变量现在支持密钥引用。默认情况下，密钥值使用本地加密存储，只有密钥引用被持久化到 agent 配置中。

- 默认本地密钥路径：`~/.paperclip/instances/default/secrets/master.key`
- 直接覆盖密钥材料：`PAPERCLIP_SECRETS_MASTER_KEY`
- 覆盖密钥文件路径：`PAPERCLIP_SECRETS_MASTER_KEY_FILE`

严格模式（推荐在本地可信机器之外使用）：

```sh
PAPERCLIP_SECRETS_STRICT_MODE=true
```

启用严格模式后，敏感环境密钥（例如 `*_API_KEY`、`*_TOKEN`、`*_SECRET`）必须使用密钥引用而不是内联纯文本值。

CLI 配置支持：

- `pnpm paperclipai onboard` 写入默认的 `secrets` 配置部分（`local_encrypted`，严格模式关闭，设置了密钥文件路径），并在需要时创建本地密钥文件。
- `pnpm paperclipai configure --section secrets` 让你更新 provider/严格模式/密钥路径，并在需要时创建本地密钥文件。
- `pnpm paperclipai doctor` 验证密钥适配器配置，并可以使用 `--repair` 创建缺失的本地密钥文件。

现有内联 env 密钥的迁移助手：

```sh
pnpm secrets:migrate-inline-env         # 演练
pnpm secrets:migrate-inline-env --apply # 应用迁移
```

## 公司删除开关

公司删除旨在作为开发/调试功能，可以在运行时禁用：

```sh
PAPERCLIP_ENABLE_COMPANY_DELETION=false
```

默认行为：

- `local_trusted`：启用
- `authenticated`：禁用

## CLI 客户端操作

Paperclip CLI 现在除了设置命令外还包括客户端端控制平面命令。

快速示例：

```sh
pnpm paperclipai issue list --company-id <company-id>
pnpm paperclipai issue create --company-id <company-id> --title "Investigate checkout conflict"
pnpm paperclipai issue update <issue-id> --status in_progress --comment "Started triage"
```

使用上下文配置文件设置一次默认值：

```sh
pnpm paperclipai context set --api-base http://localhost:3100 --company-id <company-id>
```

然后运行命令而无需重复标志：

```sh
pnpm paperclipai issue list
pnpm paperclipai dashboard get
```

请参阅 `doc/CLI.md` 中的完整命令参考。

## OpenClaw 邀请引导端点

面向 agent 的邀请引导现在暴露机器可读的 API 文档：

- `GET /api/invites/:token` 返回邀请摘要以及引导和技能索引链接。
- `GET /api/invites/:token/onboarding` 返回引导清单详情（注册端点、声明端点模板、技能安装提示）。
- `GET /api/invites/:token/onboarding.txt` 返回面向人类操作员和 agent 的纯文本引导文档（llm.txt 风格交接），包括可选的邀请者消息和建议的网络主机候选。
- `GET /api/skills/index` 列出可用的技能文档。
- `GET /api/skills/paperclip` 返回 Paperclip 心跳技能 markdown。

## OpenClaw 加入冒烟测试

运行端到端 OpenClaw 加入冒烟测试工具：

```sh
pnpm smoke:openclaw-join
```

它验证的内容：

- 仅 agent 加入的邀请创建
- 使用 `adapterType=openclaw` 的 agent 加入请求
- board 批准 + 一次性 API 密钥声明语义
- 唤醒时回调传递到 docker 化的 OpenClaw 风格 webhook 接收器

所需权限：

- 此脚本执行 board 治理操作（创建邀请、批准加入、唤醒另一个 agent）。
- 在 authenticated 模式下，使用 `PAPERCLIP_AUTH_HEADER` 或 `PAPERCLIP_COOKIE` 通过 board 认证运行。

可选认证标志（用于 authenticated 模式）：

- `PAPERCLIP_AUTH_HEADER`（例如 `Bearer ...`）
- `PAPERCLIP_COOKIE`（会话 cookie 头值）

## OpenClaw Docker UI 一命令脚本

用一条命令在 Docker 中启动 OpenClaw 并打印主机浏览器 dashboard URL：

```sh
pnpm smoke:openclaw-docker-ui
```

此脚本位于 `scripts/smoke/openclaw-docker-ui.sh`，自动完成基于 Compose 的本地 OpenClaw UI 测试的克隆/构建/配置/启动。

此冒烟脚本的配对行为：

- 默认 `OPENCLAW_DISABLE_DEVICE_AUTH=1`（本地冒烟无 Control UI 配对提示；无需额外的配对 env 变量）
- 设置 `OPENCLAW_DISABLE_DEVICE_AUTH=0` 以要求标准设备配对

此冒烟脚本的模型行为：

- 默认为 OpenAI 模型（`openai/gpt-5.2` + OpenAI fallback），因此默认不需要 Anthropic 认证

此冒烟脚本的状态行为：

- 默认为隔离配置目录 `~/.openclaw-paperclip-smoke`
- 默认每次运行重置冒烟 agent 状态（`OPENCLAW_RESET_STATE=1`）以避免过时的 provider/auth 漂移

此冒烟脚本的网络行为：

- 自动检测并打印 OpenClaw Docker 内可访问的 Paperclip 主机 URL
- 默认容器侧主机别名是 `host.docker.internal`（使用 `PAPERCLIP_HOST_FROM_CONTAINER` / `PAPERCLIP_HOST_PORT` 覆盖）
- 如果 Paperclip 在 authenticated/private 模式下拒绝容器主机名，通过 `pnpm paperclipai allowed-hostname host.docker.internal` 允许 `host.docker.internal` 并重启 Paperclip
