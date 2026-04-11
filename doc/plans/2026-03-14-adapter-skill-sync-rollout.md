# 2026-03-14 Adapter Skill Sync Rollout

状态：提议中
日期：2026-03-14
受众：产品和工程
相关：
- `doc/plans/2026-03-14-skills-ui-product-plan.md`
- `doc/plans/2026-03-13-company-import-export-v2.md`
- `docs/companies/companies-spec.md`

## 1. Purpose

本文档定义了 Paperclip 中适配器范围技能支持的推广计划。

目标不仅仅是"显示技能选项卡"。目标是：

- 每个适配器都有一个深思熟虑的技能同步真实模型
- UI 为该适配器显示真实情况
- Paperclip 一致地存储所需技能状态，即使适配器不能完全协调它
- 不支持的适配器清楚和安全地降级

## 2. Current Adapter Matrix

Paperclip 当前有这些适配器：

- `claude_local`
- `codex_local`
- `cursor_local`
- `gemini_local`
- `opencode_local`
- `pi_local`
- `openclaw_gateway`

当前技能 API 支持：

- `unsupported`
- `persistent`
- `ephemeral`

当前实施状态：

- `codex_local`：已实施，`persistent`
- `claude_local`：已实施，`ephemeral`
- `cursor_local`：尚未实施，但技术上适合 `persistent`
- `gemini_local`：尚未实施，但技术上适合 `persistent`
- `pi_local`：尚未实施，但技术上适合 `persistent`
- `opencode_local`：尚未实施；可能是 `persistent`，但有特殊处理，因为它目前注入到 Claude 的共享技能主目录
- `openclaw_gateway`：尚未实施；被网关协议支持阻止，所以目前是 `unsupported`

## 3. Product Principles

### 3.1 Truth per adapter

每个适配器应该公开它实际支持的内容。UI 应该显示该适配器的真实状态，而不是假装所有适配器都一样。

### 3.2 Graceful degradation

不支持技能的适配器应该清楚地向用户显示，而不是静默失败。

### 3.3 Consistent state

Paperclip 应该存储所需技能状态的一致表示，即使适配器不能完全协调它。

### 3.4 Safe by default

默认情况下，技能同步应该是安全的，而不是要求用户手动配置。

## 4. Proposed Implementation

### 4.1 Adapter Skill Support Level

每个适配器应该声明其技能支持级别：

```ts
type SkillSupport = 'unsupported' | 'persistent' | 'ephemeral';
```

### 4.2 Skill Sync State

```ts
interface AgentSkillState {
  agentId: string;
  desiredSkills: string[];
  actualSkills: string[];
  syncStatus: 'synced' | 'pending' | 'failed';
  lastSyncedAt: Date;
  error?: string;
}
```

### 4.3 UI Behavior

对于每个适配器级别：

**Persistent**：

- 显示已安装技能列表
- 显示所需与实际技能比较
- 提供添加/删除技能控件
- 显示同步状态

**Ephemeral**：

- 显示可用技能列表
- 显示当前加载的技能
- 提供重新加载技能控件
- 显示临时技能状态

**Unsupported**：

- 清楚显示适配器不支持技能
- 提供链接到文档
- 不显示技能控件

## 5. Rollout Plan

### Phase 1: CodeX Local (Complete)

`codex_local` 已实施 `persistent` 技能同步。

### Phase 2: Claude Local

`claude_local` 实施 `ephemeral` 技能同步。

### Phase 3: Other Local Adapters

为以下适配器实施 `persistent` 技能同步：

- `cursor_local`
- `gemini_local`
- `pi_local`

### Phase 4: OpenCode Local

`opencode_local` 实施 `persistent` 技能同步，注意共享技能主目录。

### Phase 5: OpenClaw Gateway

`openclaw_gateway` 在网关协议支持可用时实施技能同步。

## 6. Open Questions

1. 如何处理技能冲突？
2. 技能版本如何管理？
3. 如何在技能之间共享配置？
4. 技能使用如何计费？

## 7. Security Considerations

1. 技能同步需要认证
2. 技能内容需要验证
3. 技能安装需要授权
