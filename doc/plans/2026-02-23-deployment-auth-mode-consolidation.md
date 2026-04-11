# Deployment/Auth Mode Consolidation Plan

状态：提议
所有者：Server + CLI + UI
日期：2026-02-23

## Goal

保持 Paperclip 低摩擦，同时使模式模型更简单和更安全：

1. `local_trusted` 保持默认和最简单路径。
2. 一个认证运行时模式同时支持私有网络本地使用和公共云使用。
3. onboarding/configure/doctor 主要保持交互式和无标志。
4. Board 身份由数据库中的真实用户行表示，具有明确的角色/成员资格集成点。

## Product Constraints (From Review)

1. `onboard` 默认流程是交互式的（不需要标志）。
2. 第一个模式选择默认为 `local_trusted`，具有清晰的 UX 副本。
3. 认证流程为私有与公共暴露提供指导。

## Current State

当前 Paperclip 支持多种部署/认证模式：

- `local_trusted`：本地信任模式，无认证
- `local_authenticated`：本地认证模式
- `cloud`：云模式

问题是：

- 模式之间存在功能重叠
- 用户体验不一致
- 配置复杂

## Proposed Solution

### 1. 简化模式

合并 `local_trusted` 和 `local_authenticated` 为单一本地模式：

```ts
type DeploymentMode = 'local' | 'cloud';
type AuthMode = 'trusted' | 'authenticated';
```

### 2. 统一配置

```ts
interface ServerConfig {
  deployment: DeploymentMode;
  auth: AuthMode;
  host: string;
  port: number;
}
```

### 3. 改进 UX

- onboarding 默认交互式
- 配置命令引导用户
- doctor 命令验证配置

## Implementation Plan

### Phase 1: Config Consolidation

1. 统一配置 schema
2. 更新配置验证
3. 添加配置迁移

### Phase 2: UX Improvement

1. 更新 onboard 流程
2. 更新 configure 流程
3. 更新 doctor 命令

### Phase 3: Documentation

1. 更新部署文档
2. 更新认证文档
3. 添加故障排除指南

## Open Questions

1. 如何处理现有配置迁移？
2. 如何保持向后兼容性？
3. 如何测试配置更改？
