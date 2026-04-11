# Workspace Strategy and Git Worktrees

## Context

`PAP-447` 问 Paperclip 如何支持本地编码代理的工作树驱动编码工作流，而不将其变成通用产品要求。

激励性用例很强：

- 当 issue 启动时，本地编码代理可能需要自己的隔离检出
- 代理可能需要一个专用分支和稍后推送的可预测路径
- 代理可能需要启动一个或多个长寿工作区运行时服务，发现可达端口或 URL，并将它们报告回 issue
- 工作流应该重用相同的 Paperclip 实例和嵌入式数据库，而不是创建空白环境
- 本地代理 auth 应该保持低摩擦

同时，我们不想将"每个代理使用 git worktree"硬编码到 Paperclip 中：

- 一些操作员使用 Paperclip 管理 Paperclip 并大量使用 worktree
- 其他操作员根本不需要 worktree
- 不是每个适配器都在本地 git 仓库中运行
- 不是每个适配器都在与 Paperclip 相同的机器上运行
- Claude 和 Codex 暴露不同的内置功能，所以 Paperclip 不应该过度适应一个工具

## Core Product Decision

Paperclip 应该建模**执行工作区**，而不是**工作树**。

更具体地说：

- 持久锚是**项目工作区**或仓库检出
- issue 可能从该项目工作区派生一个临时的**执行工作区**

## Proposed Architecture

### Project Workspace

项目工作区是项目的主要 Git 仓库。

```ts
interface ProjectWorkspace {
  id: string;
  projectId: string;
  repoUrl: string;
  defaultBranch: string;
  worktreeCount: number;
}
```

### Execution Workspace

执行工作区是从项目工作区派生的临时工作区。

```ts
interface ExecutionWorkspace {
  id: string;
  projectWorkspaceId: string;
  issueId: string;
  branchName: string;
  worktreePath: string;
  status: 'pending' | 'active' | 'completed';
  createdAt: Date;
}
```

## Implementation Plan

### Phase 1: Workspace Model

1. 添加项目工作区数据模型
2. 添加执行工作区数据模型
3. 创建工作区服务

### Phase 2: Worktree Management

1. 实现 worktree 创建/删除
2. 实现分支管理
3. 添加工作区生命周期

### Phase 3: Runtime Integration

1. 将运行时服务链接到工作区
2. 添加端口发现
3. 添加工作区报告

## Open Questions

1. 如何处理 worktree 冲突？
2. 如何在代理之间共享工作区？
3. 如何处理长时间运行的代理？
