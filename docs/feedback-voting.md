# 反馈投票 — 本地数据指南

当你对智能体的响应评价为**有帮助**（竖起大拇指）或**需要改进**（大拇指朝下）时，Paperclip 会将你的投票本地保存到你的运行实例中。本指南涵盖存储了什么、如何访问它以及如何导出它。

## 投票如何工作

1. 在任何智能体评论或文档修订上点击**有帮助**或**需要改进**。
2. 如果你点击**需要改进**，会出现一个可选的文本提示：_"有什么可以改进的？"_ 你可以输入原因或关闭它。
3. 一个同意对话框询问是将投票保存在本地还是分享。你的选择会被记住以用于未来的投票。

### 存储了什么

每次投票创建两个本地记录：

| 记录 | 包含内容 |
|--------|-----------------|
| **投票** | 你的投票（赞成/反对）、可选的原因文本、分享偏好、同意版本、时间戳 |
| **追踪包** | 完整的上下文快照：被投票的评论/修订文本、工单标题、智能体信息、你的投票和原因——理解反馈所需的一切 |

所有数据都保存在你的本地 Paperclip 数据库中。除非你明确选择分享，否则任何内容都不会离开你的机器。

当投票被标记为分享时，Paperclip 会立即尝试通过遥测后端上传追踪包。传输过程中进行压缩，因此完整的追踪包保持在网关大小限制内。如果即时推送失败，追踪会处于可重试的失败状态以供后续刷新。应用服务器永远不会将原始反馈追踪包直接上传到对象存储。

## 查看你的投票

### 快速报告（终端）

```bash
pnpm paperclipai feedback report
```

显示颜色编码的摘要：投票计数、每个追踪的详情及原因，以及导出状态。

```bash
# 已安装 CLI
paperclipai feedback report

# 指向不同的服务器或公司
pnpm paperclipai feedback report --api-base http://127.0.0.1:3000 --company-id <company-id>

# 在报告中包含原始载荷转储
pnpm paperclipai feedback report --payloads
```

### API 端点

所有端点都需要 board 用户访问（本地开发中自动）。

**列出工单的投票：**
```bash
curl http://127.0.0.1:3102/api/issues/<issueId>/feedback-votes
```

**列出工单的追踪包（带有完整载荷）：**
```bash
curl 'http://127.0.0.1:3102/api/issues/<issueId>/feedback-traces?includePayload=true'
```

**列出全公司范围的追踪：**
```bash
curl 'http://127.0.0.1:3102/api/companies/<companyId>/feedback-traces?includePayload=true'
```

**获取单个追踪信封记录：**
```bash
curl http://127.0.0.1:3102/api/feedback-traces/<traceId>
```

**获取追踪的完整导出包：**
```bash
curl http://127.0.0.1:3102/api/feedback-traces/<traceId>/bundle
```

#### 过滤

追踪端点接受查询参数：

| 参数 | 值 | 描述 |
|-----------|--------|-------------|
| `vote` | `up`, `down` | 按投票方向过滤 |
| `status` | `local_only`, `pending`, `sent`, `failed` | 按导出状态过滤 |
| `targetType` | `issue_comment`, `issue_document_revision` | 按被投票的内容过滤 |
| `sharedOnly` | `true` | 仅显示用户选择分享的投票 |
| `includePayload` | `true` | 包含完整上下文快照 |
| `from` / `to` | ISO 日期 | 日期范围过滤 |

## 导出你的数据

### 导出到文件 + zip

```bash
pnpm paperclipai feedback export
```

创建带时间戳的目录：

```
feedback-export-20260331T120000Z/
  index.json                    # 带有摘要统计的清单
  votes/
    PAP-123-a1b2c3d4.json      # 投票元数据（每个投票一个）
  traces/
    PAP-123-e5f6g7h8.json      # Paperclip 反馈信封（每个追踪一个）
  full-traces/
    PAP-123-e5f6g7h8/
      bundle.json              # 追踪的完整导出清单
      ...raw adapter files     # 可用时的 codex / claude / opencode 会话制品
feedback-export-20260331T120000Z.zip
```

导出默认是完整的。`traces/` 保存 Paperclip 信封，而 `full-traces/` 包含更丰富的每追踪包以及任何可恢复的适配器本机文件。

```bash
# 自定义服务器和输出目录
pnpm paperclipai feedback export --api-base http://127.0.0.1:3000 --company-id <company-id> --out ./my-export
```

### 读取导出的追踪

打开 `traces/` 中的任何文件可以看到：

```json
{
  "id": "trace-uuid",
  "vote": "down",
  "issueIdentifier": "PAP-123",
  "issueTitle": "Fix login timeout",
  "targetType": "issue_comment",
  "targetSummary": {
    "label": "Comment",
    "excerpt": "The first 80 chars of the comment that was voted on..."
  },
  "payloadSnapshot": {
    "vote": {
      "value": "down",
      "reason": "Did not address the root cause"
    },
    "target": {
      "body": "Full text of the agent comment..."
    },
    "issue": {
      "identifier": "PAP-123",
      "title": "Fix login timeout"
    }
  }
}
```

打开 `full-traces/<issue>-<trace>/bundle.json` 可以看到扩展的导出元数据，包括捕获笔记、适配器类型、完整性元数据以及随其写入的原始文件清单。

`bundle.json.files[]` 中的每个条目在 `contents` 下包含实际捕获的文件载荷，而不仅仅是路径名。对于文本制品，这存储为 UTF-8 文本；二进制制品使用 base64 加上 `encoding` 标记。

内置本地适配器现在更直接地导出它们的本机会话制品：

- `codex_local`：`adapter/codex/session.jsonl`
- `claude_local`：`adapter/claude/session.jsonl`，加上任何 `adapter/claude/session/...` 边车文件和 `adapter/claude/debug.txt`（当存在时）
- `opencode_local`：`adapter/opencode/session.json`、`adapter/opencode/messages/*.json` 和 `adapter/opencode/parts/<messageId>/*.json`，带有可选的 `project.json`、`todo.json` 和 `session-diff.json`

## 分享偏好

第一次投票时，会出现一个同意对话框：

- **保存在本地** — 投票仅保存在本地（`sharedWithLabs: false`）
- **分享此投票** — 投票被标记为分享（`sharedWithLabs: true`）

你的偏好按公司保存。你可以通过反馈设置随时更改它。标记为"保存在本地"的投票永远不会排队等待导出。

## 数据生命周期

| 状态 | 含义 |
|--------|---------|
| `local_only` | 投票保存在本地，未标记分享 |
| `pending` | 标记为分享，保存本地，等待即时上传尝试 |
| `sent` | 成功传输 |
| `failed` | 尝试传输但失败（例如后端不可达或未配置）；当后端可用时，后续刷新重试 |

无论分享状态如何，你的本地数据库始终保留完整的投票和追踪数据。

## 远程同步

你选择分享的投票会从投票请求立即发送到遥测后端。服务器还保持后台刷新工作器，以便后续重试失败的追踪。遥测后端验证请求，然后将包持久化到其配置的对象存储中。

- 应用服务器责任：构建包、POST 到遥测后端、更新追踪状态
- 遥测后端责任：认证请求、验证载荷形状、压缩/存储包、返回最终对象键
- 重试行为：失败的上传会移动到 `failed`，并在 `failureReason` 中带有错误消息，工作器在后续 tick 时重试
- 默认端点：当未配置反馈导出后端 URL 时，Paperclip 回退到 `https://telemetry.paperclip.ing`
- 重要细节：上传的对象是投票时完整包的快照。如果你稍后获取本地包，但底层适配器会话文件继续增长，本地重新生成的包可能比同一追踪的已上传快照更大

导出的对象使用确定性键模式，因此易于检查：

```text
feedback-traces/<companyId>/YYYY/MM/DD/<exportId-or-traceId>.json
```
