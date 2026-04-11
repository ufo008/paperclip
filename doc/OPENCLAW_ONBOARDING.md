请按照此清单进行操作。

1. 以 auth 模式启动 Paperclip。
```bash
cd <paperclip-repo-root>
pnpm dev --tailscale-auth
```
然后验证：
```bash
curl -sS http://127.0.0.1:3100/api/health | jq
```

2. 启动一个干净的/标准的 OpenClaw Docker。
```bash
OPENCLAW_RESET_STATE=1 OPENCLAW_BUILD=1 ./scripts/smoke/openclaw-docker-ui.sh
```
在浏览器中打开打印出的 `Dashboard URL`（包含 `#token=...`）。

3. 在 Paperclip UI 中，转到 `http://127.0.0.1:3100/CLA/company/settings`。

4. 使用 OpenClaw 邀请提示流程。
- 在 Invites 部分，点击 `Generate OpenClaw Invite Prompt`。
- 从 `OpenClaw Invite Prompt` 复制生成的提示。
- 将其作为一条消息粘贴到 OpenClaw 主聊天中。
- 如果卡住了，发送一条跟进消息：`How is onboarding going? Continue setup now.`

安全/控制说明：
- OpenClaw 邀请提示来自受控端点：
  - `POST /api/companies/{companyId}/openclaw/invite-prompt`
  - 具有邀请权限的 board 用户可以调用它
  - agent 调用者仅限于公司 CEO agent

5. 在 Paperclip UI 中批准加入请求，然后确认 OpenClaw agent 出现在 CLA agents 中。

6. Gateway 预检（任务测试前必需）。
- 确认创建的 agent 使用的是 `openclaw_gateway`（而不是 `openclaw`）。
- 确认 gateway URL 是 `ws://...` 或 `wss://...`。
- 确认 gateway token 是有效的（非空/不是单字符占位符）。
- OpenClaw Gateway 适配器 UI 不应为正常 onboarding 暴露 `disableDeviceAuth`。
- 确认配对模式是明确的：
  - 必需的默认设置：启用设备认证（`adapterConfig.disableDeviceAuth` 为 false/不存在）且有持久化的 `adapterConfig.devicePrivateKeyPem`
  - 不要依赖 `disableDeviceAuth` 进行正常 onboarding
- 如果可以使用 board auth 运行 API 检查：
```bash
AGENT_ID="<newly-created-agent-id>"
curl -sS -H "Cookie: $PAPERCLIP_COOKIE" "http://127.0.0.1:3100/api/agents/$AGENT_ID" | jq '{adapterType,adapterConfig:{url:.adapterConfig.url,tokenLen:(.adapterConfig.headers["x-openclaw-token"] // .adapterConfig.headers["x-openclaw-auth"] // "" | length),disableDeviceAuth:(.adapterConfig.disableDeviceAuth // false),hasDeviceKey:(.adapterConfig.devicePrivateKeyPem // "" | length > 0)}}'
```
- 预期结果：`adapterType=openclaw_gateway`、`tokenLen >= 16`、`hasDeviceKey=true`，且 `disableDeviceAuth=false`。

配对握手说明：
- 正常流程预期：第一个任务应成功完成，无需手动配对命令。
- 适配器在首次遇到 `pairing required` 时尝试一次自动配对批准 + 重试（当共享 gateway auth token/password 有效时）。
- 如果自动配对无法完成（例如 token 不匹配或没有待处理请求），第一个 gateway 运行可能仍会返回 `pairing required`。
- 这与 Paperclip 邀请批准是分开的。你必须在 OpenClaw 本身中批准待处理的设备。
- 在 OpenClaw 中批准，然后重试任务。
- 对于本地 docker smoke，你可以从主机批准：
```bash
docker exec openclaw-docker-openclaw-gateway-1 sh -lc 'openclaw devices approve --latest --json --url "ws://127.0.0.1:18789" --token "$(node -p \"require(process.env.HOME+\\\"/.openclaw/openclaw.json\\\").gateway.auth.token\")"'
```
- 你可以检查待处理 vs 已配对的设备：
```bash
docker exec openclaw-docker-openclaw-gateway-1 sh -lc 'TOK="$(node -e \"const fs=require(\\\"fs\\\");const c=JSON.parse(fs.readFileSync(\\\"/home/node/.openclaw/openclaw.json\\\",\\\"utf8\\\"));process.stdout.write(c.gateway?.auth?.token||\\\"\\\");\""); openclaw devices list --json --url \"ws://127.0.0.1:18789\" --token \"$TOK\"'
```

7. 场景 A（手动问题测试）。
- 创建一个分配给 OpenClaw agent 的 issue。
- 添加指示：`post comment `OPENCLAW_CASE_A_OK_<timestamp>` and mark done.`
- 在 UI 中验证：issue 状态变为 `done` 且评论存在。

8. 场景 B（消息工具测试）。
- 创建另一个分配给 OpenClaw 的 issue。
- 指示：`send `OPENCLAW_CASE_B_OK_<timestamp>` to main webchat via message tool, then comment same marker on issue, then mark done.`
- 验证两者：
  - issue 上的标记评论
  - 标记文本出现在 OpenClaw 主聊天中

9. 场景 C（新会话内存/技能测试）。
- 在 OpenClaw 中，启动 `/new` 会话。
- 要求它在 Paperclip 中创建一个新的 CLA issue，标题为 `OPENCLAW_CASE_C_CREATED_<timestamp>`。
- 在 Paperclip UI 中验证新 issue 存在。

10. 测试期间观察日志（可选但有帮助）：
```bash
docker compose -f /tmp/openclaw-docker/docker-compose.yml -f /tmp/openclaw-docker/.paperclip-openclaw.override.yml logs -f openclaw-gateway
```

11. 预期通过标准。
- 预检：`openclaw_gateway` + 非占位符 token（`tokenLen >= 16`）。
- 配对模式：配置了稳定的 `devicePrivateKeyPem` 且启用了设备认证（默认路径）。
- 场景 A：`done` + 标记评论。
- 场景 B：`done` + 标记评论 + 主聊天消息可见。
- 场景 C：原始任务完成且从 `/new` 会话创建了新 issue。

如果需要，我还可以提供一个"观察者模式"命令，让你在 UI 中实时观看相同步骤的同时运行标准 smoke 测试套件。

（文件结束 - 共 94 行）