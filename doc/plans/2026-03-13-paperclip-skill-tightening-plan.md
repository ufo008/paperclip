# Paperclip Skill Tightening Plan

## Status

推迟的后续。不要包含在当前 token 优化 PR 中超出记录计划。

## Why This Is Deferred

`paperclip` 技能是关键控制平面安全表面的一部分。收紧它可能减少新鲜会话 token 使用，但它也带有提示回归风险。我们还没有 eval，可以让我们安全地证明行为保存在分配处理、检出规则、评论礼仪、审批工作流和升级路径中。

当前 PR 应该首先发布较低风险的基础设施赢取：

- 遥测归一化
- 安全会话重用
- 增量 issue/comment 上下文
- bootstrap 与心跳提示分离
- Codex 工作区隔离

## Current Problem

在上下文路径修复后，新鲜运行仍然花费大量输入 token。剩余的大型启动成本似乎来自在运行开始时将完整的 `paperclip` 技能和相关指令表面加载到上下文中。

技能当前在一个文件中混合了三种内容：

- 几乎每次运行都使用的热路径心跳过程
- 关键策略和安全不变量
- 大多数运行不需要的罕见工作流/参考材料

该结构安全但昂贵。

## Goals

- 在不削弱代理安全性的情况下减少首次运行指令 token
- 保留所有当前 Paperclip 控制平面能力
- 保持常见心跳行为显式且易于代理遵循
- 将罕见工作流和参考材料移出热路径
- 创建一个以后可以系统评估的结构

## Non-Goals

- 更改 Paperclip API 语义
- 移除必需的治理规则
- 删除罕见工作流
- 在当前 PR 中更改代理默认值

## Recommended Direction

### 1. Split Hot Path From Lookup Material

将技能重构为：

```
skills/paperclip/
├── hot-path.md      # 心跳程序、关键不变量
├── policies/        # 治理规则、安全不变量
├── workflows/       # 罕见工作流
├── reference/       # 参考材料
└── SKILL.md         # 入口点
```

### 2. Incremental Loading

仅在需要时加载工作流和参考材料，而不是每次运行都加载。

### 3. Session Reuse

利用会话重用，而不是每次运行加载完整技能。

### 4. Evaluation

添加 eval 以在更改后验证行为保存。

## Implementation Plan

### Phase 1: Skill Structure

1. 创建 `skills/paperclip/` 子目录结构
2. 移动内容到适当子目录
3. 更新 `SKILL.md` 入口点

### Phase 2: Incremental Loading

1. 实现增量加载逻辑
2. 添加按需加载钩子
3. 测试行为保存

### Phase 3: Evaluation

1. 添加技能行为 eval
2. 运行 eval 验证行为保存
3. 根据需要迭代

## Open Questions

1. 何时加载工作流和参考材料？
2. 如何在不引入延迟的情况下加载？
3. 如何确保行为保存？
