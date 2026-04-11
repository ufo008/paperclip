# Token Optimization Plan

日期：2026-03-13
相关讨论：https://github.com/paperclipai/paperclip/discussions/449

## Goal

在不影响代理能力、控制平面可见性或任务完成质量的情况下，实质性减少 token 消耗。

本计划基于：

- 当前 V1 控制平面设计
- 当前适配器和心跳实施
- 链接的用户讨论
- 2026-03-13 默认 Paperclip 实例上的本地运行数据

## Executive Summary

讨论对两件事的方向是正确的：

1. 我们应该更积极地保留会话和提示缓存局部性。
2. 我们应该将稳定启动指令与每心跳动态上下文分开。

但仅靠这还不够。

在审查代码和本地运行数据后，token 问题似乎有四个不同的原因：

1. **会话适配器上的测量膨胀。** 一些 token 计数器，特别是对于 `codex_local`，似乎被记录为累积会话总数而不是每心跳增量。
2. **可避免的会话重置。** 任务会话在计时器唤醒和手动唤醒时故意重置，这会破坏常见心跳路径的缓存局部性。
3. **重复上下文重新获取。** `paperclip` 技能告诉代理在每次心跳时重新获取分配、issue 详情、祖先和完整评论线程。API 当前不提供高效的增量导向替代方案。

## Root Cause Analysis

### 1. Measurement Inflation

`codex_local` 适配器将 token 计数记录为会话级累积值，而不是每心跳增量。

这导致：

- 仪表板显示的运行成本高于实际每心跳成本
- 预算执行基于膨胀的数字
- 难以准确衡量优化效果

### 2. Avoidable Session Resets

当前，心跳唤醒会重置任务会话，即使任务上下文没有改变。

这导致：

- 每次心跳的完整上下文加载
- 代理重新处理他们已经知道的信息
- 增加的 token 使用

### 3. Repeated Context Reacquisition

`paperclip` 技能告诉代理：

- 在每次心跳时获取分配
- 在每次心跳时获取 issue 详情
- 在每次心跳时获取祖先
- 在每次心跳时获取完整评论线程

API 不提供：

- 增量上下文更新
- 缓存的上下文重用
- 更改检测

### 4. Startup Instruction Volume

完整的 `paperclip` 技能加载到每次运行的上下文中。

这包括：

- 心跳程序
- 关键策略
- 安全不变量
- 罕见工作流
- 参考材料

## Proposed Solutions

### 1. Fix Token Measurement

在 `codex_local` 适配器中实施每心跳 token 计数。

### 2. Preserve Session State

在计时器唤醒时保留任务会话，而不是重置它。

### 3. Add Delta Context API

添加 API 端点，用于增量上下文更新而不是完整重新获取。

### 4. Split Skill Loading

将 `paperclip` 技能拆分为：

- 热路径（心跳程序、关键策略）
- 按需（罕见工作流、参考材料）

## Implementation Plan

### Phase 1: Fix Token Measurement

1. 在 `codex_local` 中添加每心跳 token 计数
2. 更新成本报告以使用每心跳数字
3. 验证测量准确性

### Phase 2: Session Preservation

1. 在计时器唤醒时保留任务会话
2. 添加会话有效性检查
3. 测试会话重用

### Phase 3: Delta Context API

1. 添加 `/api/context/delta` 端点
2. 在适配器中使用增量 API
3. 验证上下文准确性

### Phase 4: Skill Splitting

1. 将技能拆分为热路径和冷路径
2. 实施按需加载
3. 验证行为保存

## Expected Impact

基于本地运行数据：

- 每次运行的 token 减少：30-50%
- 启动成本减少：20-30%
- 会话重用增加：40-60%

## Open Questions

1. 会话保留多长时间？
2. 如何处理会话失效？
3. 增量上下文如何版本控制？
