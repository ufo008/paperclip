# 2026-03-14 Skills UI Product Plan

状态：提议中
日期：2026-03-14
受众：产品和工程
相关：
- `doc/plans/2026-03-13-company-import-export-v2.md`
- `doc/plans/2026-03-14-adapter-skill-sync-rollout.md`
- `docs/companies/companies-spec.md`
- `ui/src/pages/AgentDetail.tsx`

## 1. Purpose

本文档为 Paperclip 中的技能管理和 UI 定义了产品和 UI 计划。

目标是使技能在网站中易于理解和管理，而不假装所有适配器行为相同。

本计划假设：

- `SKILL.md` 保持 Agent Skills 兼容
- `skills.sh` 兼容性是一个 V1 要求
- Paperclip 公司导入/导出可以将技能作为包内容包含
- 适配器可以支持持久化技能同步、临时技能挂载、只读技能发现，或根本没有技能集成

## 2. Current State

`AgentDetail` 上已经有一个第一版代理级技能同步 UI。

今天它支持：

- 加载适配器技能同步状态
- 清楚地显示不支持的适配器
- 将托管技能显示为复选框
- 将外部技能单独显示
- 为实现新 API 的适配器同步所需技能

当前限制：

1. 没有公司级技能库 UI。
2. 网站中没有技能包导入流程。
3. 技能包管理和每代理技能附件之间没有区分。
4. 没有多代理 desired-vs-actual 视图。
5. 当前 UI 是适配器同步导向的，而不是包导向的。
6. 不支持的适配器安全降级，但不优雅。

## 2.1 V1 Decisions

对于 V1，本计划假设以下产品决策已经做出：

1. `skills.sh` 兼容性是必需的。
2. 公司可以有多个代理。
3. 代理可以有不同的技能需求。
4. 技能包可以发布到公司库。
5. 技能同步是持久化的。

## 3. Proposed Data Model

### SkillPackage

```ts
interface SkillPackage {
  id: string;
  companyId: string;
  name: string;
  version: string;
  description: string;
  skills: Skill[];
  createdAt: Date;
  updatedAt: Date;
}
```

### AgentSkill

```ts
interface AgentSkill {
  id: string;
  agentId: string;
  skillPackageId: string;
  skillName: string;
  status: 'active' | 'pending' | 'failed';
  lastSyncedAt: Date;
}
```

## 4. Proposed UI

### 4.1 Skills Page (Company-level)

`/settings/skills`

显示：

- 公司技能库中的所有技能包
- 每个包的版本和描述
- 每个包的技能数量
- 添加/删除/编辑按钮

操作：

- 添加技能包（从 marketplace 或上传）
- 删除技能包
- 编辑技能包元数据
- 查看技能详情

### 4.2 Agent Detail Skills Tab

`/agents/:id/skills`

显示：

- 代理当前安装的技能
- 每个技能的状态
- 所需技能与实际技能的比较
- 同步按钮

操作：

- 添加/删除代理技能
- 手动同步技能
- 查看技能使用统计

### 4.3 Skill Detail Modal

显示：

- 技能名称、版本和描述
- 技能包含的命令和工具
- 使用技能的代理列表
- 最后同步时间

## 5. Implementation Plan

### Phase 1: Data Model

1. 添加 `skill_packages` 表
2. 添加 `agent_skills` 表
3. 创建 SkillService
4. 实现包 CRUD 操作

### Phase 2: Agent Skills UI

1. 在 AgentDetail 上添加 Skills 选项卡
2. 显示代理当前技能
3. 显示所需与实际技能比较
4. 添加同步按钮

### Phase 3: Company Skills Library

1. 在设置中添加技能页面
2. 显示公司技能库
3. 添加包导入/导出
4. 添加包管理操作

### Phase 4: Skill Sync

1. 实现技能同步逻辑
2. 处理同步错误
3. 添加重试机制
4. 显示同步状态

## 6. Open Questions

1. 如何处理技能版本控制？
2. 技能冲突时该怎么办？
3. 如何在技能之间共享配置？
4. 技能使用如何计费？

## 7. Security Considerations

1. 只有 Board 可以管理技能包
2. 技能同步需要认证
3. 技能内容需要验证
