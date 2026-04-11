# Humans and Permissions Plan

状态：草案
日期：2026-02-21
所有者：Server + UI + Shared + DB

## Goal

添加一流人类用户和权限，同时保留两种部署模式：

- 本地信任单用户模式，无登录摩擦
- 云托管多用户模式，具有强制认证和授权

## Why this plan

当前 V1 假设集中在一个 board 操作员。我们现在需要：

- 具有每用户权限的多人协作
- 安全的云部署默认值（无意外的无登录生产）
- 仍然感觉即时的本地模式（`npx paperclipai run` 然后运行）

## Proposed Solution

### 1. Two Deployment Modes

```ts
type DeploymentMode = 'local_trusted' | 'cloud_hosted';
```

### 2. User Model

```ts
interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member' | 'viewer';
}
```

### 3. Permissions

```ts
type Permission = 
  | 'manage_users'
  | 'manage_agents'
  | 'manage_projects'
  | 'view_logs'
  | 'manage_budget';
```

## Implementation Plan

### Phase 1: User Model

1. 添加用户数据模型
2. 创建用户服务
3. 实现用户 CRUD

### Phase 2: Authentication

1. 实现认证
2. 添加会话管理
3. 实现权限检查

### Phase 3: UI Integration

1. 添加用户管理 UI
2. 添加权限管理 UI
3. 添加登录/注销 UI

## Open Questions

1. 如何处理用户邀请？
2. 如何处理密码重置？
3. 如何处理会话过期？
