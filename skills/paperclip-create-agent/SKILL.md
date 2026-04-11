---
name: paperclip-create-agent
description: >
  在 Paperclip 中创建具有治理感知的新智能体。当你需要检查适配器配置选项、比较现有智能体配置、
  起草新智能体提示/配置，并提交招聘请求时使用。
---

# Paperclip 创建智能体技能

当被要求招聘/创建智能体时使用此技能。

## 前置条件

你需要以下之一：

- board 访问权限，或
- 你公司中的智能体权限 `can_create_agents=true`

如果你没有此权限，升级到你的 CEO 或 board。

## 工作流

1. 确认身份和公司上下文。

```sh
curl -sS "$PAPERCLIP_API_URL/api/agents/me" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

2. 发现此 Paperclip 实例可用的适配器配置文档。

```sh
curl -sS "$PAPERCLIP_API_URL/llms/agent-configuration.txt" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

3. 阅读特定于适配器的文档（示例：`claude_local`）。

```sh
curl -sS "$PAPERCLIP_API_URL/llms/agent-configuration/claude_local.txt" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

4. 比较你公司中现有的智能体配置。

```sh
curl -sS "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/agent-configurations" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

5. 发现允许的智能体图标并选择与角色匹配的一个。

```sh
curl -sS "$PAPERCLIP_API_URL/llms/agent-icons.txt" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

6. 起草新招聘配置：
- role/title/name
- icon（在实践中必需；从 `/llms/agent-icons.txt` 中使用一个）
- 汇报线（`reportsTo`）
- 适配器类型
- 当此角色需要在第一天安装技能时，从公司技能库中使用可选的 `desiredSkills`
-与此环境对齐的适配器和运行时配置
- capabilities
- 适配器配置中的运行提示（适用时 `promptTemplate`）
- 当此招聘来自 issue 时的源 issue 链接（`sourceIssueId` 或 `sourceIssueIds`）

7. 提交招聘请求。

```sh
curl -sS -X POST "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/agent-hires" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CTO",
    "role": "cto",
    "title": "Chief Technology Officer",
    "icon": "crown",
    "reportsTo": "<ceo-agent-id>",
    "capabilities": "Owns technical roadmap, architecture, staffing, execution",
    "desiredSkills": ["vercel-labs/agent-browser/agent-browser"],
    "adapterType": "codex_local",
    "adapterConfig": {"cwd": "/abs/path/to/repo", "model": "o4-mini"},
    "runtimeConfig": {"heartbeat": {"enabled": true, "intervalSec": 300, "wakeOnDemand": true}},
    "sourceIssueId": "<issue-id>"
  }'
```

8. 处理治理状态：
- 如果响应有 `approval`，招聘是 `pending_approval`
- 在审批线程上监控和讨论
- 当 board 批准时，你将被唤醒并包含 `PAPERCLIP_APPROVAL_ID`；阅读相关 issues 并关闭/评论后续

```sh
curl -sS "$PAPERCLIP_API_URL/api/approvals/<approval-id>" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"

curl -sS -X POST "$PAPERCLIP_API_URL/api/approvals/<approval-id>/comments" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"body":"## CTO hire request submitted\n\n- Approval: [<approval-id>](/approvals/<approval-id>)\n- Pending agent: [<agent-ref>](/agents/<agent-url-key-or-id>)\n- Source issue: [<issue-ref>](/issues/<issue-identifier-or-id>)\n\nUpdated prompt and adapter config per board feedback."}'
```

如果审批已存在且需要手动链接到 issue：

```sh
curl -sS -X POST "$PAPERCLIP_API_URL/api/issues/<issue-id>/approvals" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"approvalId":"<approval-id>"}'
```

在授予审批后，运行此后续循环：

```sh
curl -sS "$PAPERCLIP_API_URL/api/approvals/$PAPERCLIP_APPROVAL_ID" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"

curl -sS "$PAPERCLIP_API_URL/api/approvals/$PAPERCLIP_APPROVAL_ID/issues" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

对于每个相关 issue，要么：
- 如果审批解决了请求，则关闭它，或
- 在 markdown 中评论并链接到审批和下一步行动。

## 质量标准

在发送招聘请求之前：

- 如果角色需要技能，确保它们已存在于公司库中，或首先使用 Paperclip 公司技能工作流安装它们
- 尽可能重用来自相关智能体的经过验证的配置模式。
- 从 `/llms/agent-icons.txt` 设置具体的 `icon`，以便新招聘在组织和任务视图中可识别。
- 除非适配器行为需要，否则避免明文中的秘密。
- 确保汇报线正确且在公司内。
- 确保提示是特定于角色的且在操作范围内。
- 如果 board 请求修改，更新有效载荷并通过审批流程重新提交。

有关端点有效载荷形状和完整示例，请阅读：
`skills/paperclip-create-agent/references/api-reference.md`
