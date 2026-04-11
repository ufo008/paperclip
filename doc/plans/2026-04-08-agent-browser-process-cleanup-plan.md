# PAP-1231 Agent Browser Process Cleanup Plan

状态：提议中
日期：2026-04-08
相关 issue：`PAP-1231`
受众：工程

## Goal

解释为什么浏览器进程在本地代理运行期间积累，并定义一个修复通用进程所有权问题的清理计划，而不是将 `agent-browser` 视为一次性的。

## Short answer

是的，Paperclip 本地执行模型中可能存在一个可能的根本原因。

今天，心跳运行的本地适配器仅持久化和管理顶层派生的 PID。它们的超时/取消路径使用直接的 `child.kill()` 语义。这比运行时服务路径弱，后者已经跟踪并终止整个进程组。

如果 Codex、Claude、Cursor 或通过它们启动的技能启动了 Chrome 或 Chromium 帮助进程，Paperclip 可能会失去对这些后代的所有权，即使它仍然认为正确处理了运行。

## Observed implementation facts

### 1. Heartbeat-run local adapters track only one PID

`packages/adapter-utils/src/server-utils.ts`

- `runChildProcess()` 生成适配器命令并仅记录 `child.pid`
- 超时处理向直接子进程发送 `SIGTERM`，然后发送 `SIGKILL`
- 今天在那里没有进程组创建或进程组 kill 路径

`packages/db/src/schema/heartbeat_runs.ts`

- `heartbeat_runs` 存储 `process_pid`
- 没有持久化的 `process_group_id`

`server/src/services/heartbeat.ts`

- 取消逻辑使用内存中的 child handle 并调用 `child.kill()`
- 孤儿运行恢复检查记录的 direct PID 是否存活
- 恢复模型建立在跟踪一个进程而不是后代树的基础上

### 2. Workspace runtime already uses stronger ownership

`server/src/services/workspace-runtime.ts`

- 运行时服务使用 `detached: process.platform !== "win32"` 生成
- 服务记录存储 `processGroupId`
- 关闭使用组感知的 killing 调用 `terminateLocalService()`

`server/src/services/local-service-supervisor.ts`

- `terminateLocalService()` 在 POSIX 上首选 `process.kill(-processGroupId, signal)`
- 它从 `SIGTERM` 升级到 `SIGKILL`

这是最清晰的内部比较点：Paperclip 已经有了一个将进程组所有权视为正确抽象的本地进程子系统。

### 3. The current recovery path explains why leaks would be visible but hard to reason about

如果直接适配器进程退出、挂起或在启动浏览器子树后被取消：

- Paperclip 可能认为它取消了运行，因为父进程已消失
- 后代 Chrome 帮助进程可能仍在运行
- 孤儿恢复没有持久化的进程组标识来协调或稍后回收

这使得失败看起来像 `agent-browser` 问题，而更一般的 bug 是"执行器后代没有被足够强地拥有"。

## Why `agent-browser` makes the problem obvious

推断：

- Chromium 是有意多进程的
- 浏览器自动化经常留下浏览器进程加上渲染器、GPU、实用程序和 crashpad/帮助子进程
- 重复打开浏览器的技能放大了症状，因为每次运行可以产生多个后代进程

所以 `agent-browser` 可能不是根本原因。它是最快暴露弱所有权模型的工作负载。

## Success condition

当 Paperclip 可以做到时，这项工作是成功的：

1. 启动本地适配器运行并拥有其创建的完整后代树
2. 取消、超时或恢复该运行而不在 POSIX 上留下 Chrome 后代
3. 在服务器重启后检测和清理过期的本地后代
4. 暴露足够的元数据，以便操作员可以看到哪个运行拥有哪个生成的进程树

## Non-goals

不要：

- 仅 special-case `agent-browser`
- 将手动 `pkill chrome` 清理作为主要修复依赖
- 在 Paperclip 可以正确清理之前要求每个技能作者添加定制的浏览器拆卸逻辑
- 作为第一阶段的一部分更改远程/HTTP 适配器行为

## Proposed plan

### Phase 0: reproduce and instrument

目标：

- 在更改执行语义之前，使泄漏可从 Paperclip 方面衡量

工作：

- 添加可重现的本地测试脚本或fixture，启动一个子进程，该子进程启动后代并在正常父退出时忽略
- 在本地适配器执行期间在日志中捕获父 PID、后代 PID 和运行 ID
- 单独记录当前行为用于：
  - 正常完成
  - 超时
  - 显式取消
  - 运行期间的服务器重启

交付物：

- 附加到实施 issue 或子 issue 的一个简短 repro 说明

### Phase 1: give heartbeat-run local adapters process-group ownership

目标：

- 将适配器运行执行与更强的运行时服务模型对齐

工作：

- 更新 `runChildProcess()` 在 POSIX 上创建专用进程组
- 持久化两者：
  - direct PID
  - 进程组 ID
- 更新运行取消和超时路径以首先 kill 组，然后升级
- 为不支持组 kill 的平台保持 direct-PID 回退行为

可能触摸的表面：

- `packages/adapter-utils/src/server-utils.ts`
- `packages/db/src/schema/heartbeat_runs.ts`
- `packages/shared/src/types/heartbeat.ts`
- `server/src/services/heartbeat.ts`

重要设计选择：

- 为所有本地子进程适配器使用相同的所有权模型，而不仅仅是 Codex 或 Claude

### Phase 2: make restart recovery group-aware

目标：

- 防止过时后代在服务器崩溃或重启时无限期地存活

工作：

- 教孤儿协调检查持久化的进程组 ID，而不仅是 direct PID
- 如果直接父已消失但组仍然存在，将运行标记为 detached-orphaned，并带有更清晰的元数据
- 决定重启恢复应该：
  - 采用仍在运行的组，或
  - 将其终止为不可恢复

建议：

- 对于心跳运行，倾向于终止不可恢复的孤儿组，除非我们可以证明适配器会话保持安全和可观察

原因：

- 运行时服务是长寿的且可采用的
- 心跳运行是具有更严格审计和取消语义的任务执行

### Phase 3: add operator-visible cleanup tools

目标：

- 当所有权仍然失败时使系统可诊断

工作：

- 在运行详情或调试端点中显示跟踪的进程元数据
- 为 Paperclip 拥有的过时本地运行进程添加控制平面清理操作或 CLI 实用程序
- 按运行/代理/公司范围清理，而不是广泛的浏览器名称匹配

这应该替换临时脚本作为通用逃生舱。

### Phase 4: cover platform and regression cases

目标：

- 防止修复回归并明确平台行为

要添加的测试：

- 适配器执行工具中进程组感知取消的单元测试
- 心跳恢复测试用于：
  - 父丢失后存活后代树
  - 超时清理
  - 取消清理
- Windows 的平台条件行为说明，其中负 PID 组 kill 不适用

## Recommended first implementation slice

第一个 shipping slice 应该狭窄：

1. 在 POSIX 上为本地心跳运行适配器引入进程组所有权
2. 在 `heartbeat_runs` 上持久化组元数据
3. 将超时/取消路径从 direct-child kill 切换到组 kill
4. 添加一个回归测试，证明后代与父运行一起死亡

这应该解决主要 Chrome 积累路径，而不在同一补丁中承担完整的重启恢复设计。

## Risks

### 1. Over-killing unrelated processes

如果进程组边界创建不正确，清理可能终止比运行拥有的更多进程。

缓解：

- 仅为生成的适配器命令创建一个新的进程组
- 持久化并精确目标该组

### 2. Cross-platform differences

Windows 不支持 repo 中其他地方使用的 POSIX 负 PID kill 模式。

缓解：

- 首先 shipping POSIX
- 在 Windows 上保持 direct-child 回退
- 将 Windows 记录为部分，直到设计了 job-object 或等效处理

### 3. Session recovery complexity

采用仍在运行的孤儿组可能看起来有吸引力，但如果 stdout/stderr 管道已经消失，可能会破坏可观察性。

缓解：

- 默认为心跳运行进行确定性清理，除非采用被明确证明安全

## Recommendation

将这视为 Paperclip 执行器所有权 bug，而不是 `agent-browser` bug。

`agent-browser` 应该保持作为一个有用的 repro case，但实施应该在所有本地子进程适配器之间共享，以便 Codex、Claude、Cursor、Gemini、Pi 或 OpenCode 生成的任何后代进程树被一致地拥有和清理。
