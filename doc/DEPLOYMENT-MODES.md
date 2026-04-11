# 部署模式

状态：规范部署和认证模式模型
日期：2026-02-23

## 1. 目的

Paperclip 支持两种运行时模式：

1. `local_trusted`
2. `authenticated`

`authenticated` 支持两种暴露策略：

1. `private`
2. `public`

这保持了一个认证 auth 栈，同时仍将低摩擦的私有网络默认值与面向互联网的安全强化要求分开。

## 2. 规范模型

| 运行时模式 | 暴露 | 人类认证 | 主要用途 |
|---|---|---|---|
| `local_trusted` | n/a | 无需登录 | 单操作员本地机器工作流程 |
| `authenticated` | `private` | 需要登录 | 私有网络访问（例如 Tailscale/VPN/LAN） |
| `authenticated` | `public` | 需要登录 | 面向互联网/云部署 |

## 3. 安全策略

## `local_trusted`

- 仅限回环主机绑定
- 无人类登录流程
- 优化以实现最快的本地启动

## `authenticated + private`

- 需要登录
- 低摩擦 URL 处理（`auto` 基础 URL 模式）
- 需要私有主机信任策略

## `authenticated + public`

- 需要登录
- 需要显式公共 URL
- 更严格的部署检查和 doctor 中的失败

## 4. Onboarding UX 契约

默认 onboarding 保持交互式且无需标志：

```sh
pnpm paperclipai onboard
```

服务器提示行为：

1. 询问模式，默认 `local_trusted`
2. 选项复制：
- `local_trusted`："最简单的本地设置（无需登录，仅限 localhost）"
- `authenticated`："需要登录；用于私有网络或公共托管"
3. 如果是 `authenticated`，询问暴露：
- `private`："私有网络访问（例如 Tailscale），设置摩擦较小"
- `public`："面向互联网部署，更严格的安全要求"
4. 仅针对 `authenticated + public` 询问显式公共 URL

`configure --section server` 遵循相同的交互行为。

## 5. Doctor UX 契约

默认 doctor 保持无需标志：

```sh
pnpm paperclipai doctor
```

Doctor 读取配置的 mode/exposure 并应用模式感知检查。可选的覆盖标志是辅助的。

## 6. 董事会/用户集成契约

董事会身份必须由真实的 DB 用户主体表示，以便基于用户的功能能够一致地工作。

必需的集成点：

- `authUsers` 中董事会身份的真实用户行
- `instance_user_roles` 中董事会管理员权限条目
- `company_memberships` 集成，用于用户级任务分配和访问

这是必需的，因为用户分配路径验证 `assigneeUserId` 的活跃成员资格。

## 7. 本地信任 -> 认证声明流程

当以 `authenticated` 模式运行时，如果唯一的实例管理员是 `local-board`，Paperclip 会发出启动警告，其中包含一次性的高熵声明 URL。

- URL 格式：`/board-claim/<token>?code=<code>`
- 预期用途：已登录人类声明董事会所有权
- 声明操作：
  - 将当前已登录用户提升为 `instance_admin`
  - 降级 `local-board` 管理员角色
  - 确保声明用户在现有公司中的活跃所有者成员资格

这可以防止用户从长期运行的本地信任使用迁移到认证模式时锁定。

## 8. 当前代码现实（截至 2026-02-23）

- 运行时值为 `local_trusted | authenticated`
- `authenticated` 使用 Better Auth 会话和 bootstrap 邀请流程
- `local_trusted` 确保 `authUsers` 中具有 `instance_user_roles` 管理员访问权限的真实本地董事会用户主体
- 公司创建确保创建者在 `company_memberships` 中的成员资格，以便用户分配/访问流程保持一致

## 9. 命名和兼容性策略

- 规范命名是 `local_trusted` 和 `authenticated`，带有 `private/public` 暴露
- 不为丢弃的命名变体提供长期兼容性别名层

## 10. 与其他文档的关系

- 实现计划：`doc/plans/deployment-auth-mode-consolidation.md`
- V1 合同：`doc/SPEC-implementation.md`
- 运营商工作流程：`doc/DEVELOPING.md` 和 `doc/CLI.md`
