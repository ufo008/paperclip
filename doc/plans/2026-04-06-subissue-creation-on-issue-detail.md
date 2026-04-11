# 2026-04-06 Sub-issue Creation On Issue Detail Plan

状态：提议中
日期：2026-04-06
受众：产品和工程
相关：
- `ui/src/pages/IssueDetail.tsx`
- `ui/src/components/IssueProperties.tsx`
- `ui/src/components/NewIssueDialog.tsx`
- `ui/src/context/DialogContext.tsx`
- `packages/shared/src/validators/issue.ts`
- `server/src/services/issues.ts`

## 1. 目的

本文档定义了从 issue 详情页添加手动 sub-issue 创建的实施计划。

请求的 UX：

- `Sub-issues` 选项卡应始终显示 `Add sub-issue` 操作，即使尚无子项
- 属性面板也应公开一个 `Sub-issues` 部分，具有相同的 `Add sub-issue` 入口点
- 两个入口点都应在"创建 sub-issue"模式下打开现有的 new-issue 对话框
- 对话框仅在从这些入口点之一打开时才显示 sub-issue 特定 UI

这是一个 UI 优先的更改。后端已通过 `parentId` 支持子 issue 创建。

## 2. 当前状态

### 2.1 现有子 issue 显示

`ui/src/pages/IssueDetail.tsx` 已通过在 `parentId === issue.id` 上过滤公司 issue 列表来派生 `childIssues`。

当前限制：

- `Sub-issues` 选项卡仅渲染空状态或子 issue 列表
- 该选项卡中没有创建子 issue 的操作

### 2.2 现有属性面板

`ui/src/components/IssueProperties.tsx` 显示 `Blocked by`、`Blocking` 和 `Parent`，但没有 sub-issue 部分或子 issue 功能。

### 2.3 现有对话框状态

`ui/src/context/DialogContext.tsx` 可以使用默认值（如状态、优先级、项目、受让人、标题和描述）打开全局 new-issue 对话框。

当前限制：

- 无法传递 sub-issue 上下文如 `parentId`
- 因此 `ui/src/components/NewIssueDialog.tsx` 无法提交子 issue 或渲染父级特定上下文

### 2.4 后端契约已存在

create-issue 验证器已接受 `parentId`。

`server/src/services/issues.ts` 已使用：

- `parentId` 用于父子 issue 关系
- 当未提供 `inheritExecutionWorkspaceFromIssueId` 时，`parentId` 作为默认工作区继承源

这意味着所需的 API 和工作区继承行为已存在。第一阶段不需要服务器或 schema 更改。

## 3. 提议的实施

### 3.1 扩展 sub-issue 上下文的对话框默认值

在 `ui/src/context/DialogContext.tsx` 中的 `NewIssueDefaults` 中添加：

- `parentId?: string`
- 用于对话框标题的可选父级显示元数据，例如：
  - `parentIdentifier?: string`
  - `parentTitle?: string`

这使对话框自包含，避免纯粹为呈现而重新获取父上下文。

### 3.2 添加 issue-detail 入口点

在两个位置使用 `ui/src/pages/IssueDetail.tsx` 中的 `openNewIssue(...)`：

1. `Sub-issues` 选项卡
2. 通过传递给 `IssueProperties` 的 props 的属性面板

两个入口点都应传递：

- `parentId: issue.id`
- `parentIdentifier: issue.identifier ?? issue.id`
- `parentTitle: issue.title`
- `projectId: issue.projectId ?? undefined`

使用当前 issue 的 `projectId` 保留了子 issue 保留在同一项目中的常见预期，除非操作员在对话框中更改。

V1 中不应强制特定的受让人默认值。

### 3.3 添加专用属性面板部分

扩展 `IssueProperties` 以接受：

- `childIssues: Issue[]`
- `onCreateSubissue: () => void`

在 `Blocked by` / `Blocking` 附近渲染新的 `Sub-issues` 部分：

- 如果存在子项，显示现有 sub-issues 的紧凑链接或药片
- 始终显示 `Add sub-issue` 按钮

这使子 issue 功能在属性区域可见，而无需通用父选择器。

### 3.4 更新 sub-issues 选项卡布局

重构 `IssueDetail` 中的 `Sub-issues` 选项卡以渲染：

- 带子项计数的小标题行
- 一个 `Add sub-issue` 按钮
- 其下方是现有空状态或子 issue 列表

这满足了无论 sub-issues 是否已存在操作都可见的要求。

### 3.5 在 new-issue 对话框中添加 sub-issue 模式

更新 `ui/src/components/NewIssueDialog.tsx`，使当 `newIssueDefaults.parentId` 存在时：

- 对话框提交 `parentId`
- 标题/按钮副本可切换为 `New sub-issue` / `Create sub-issue`
- 显示紧凑父上下文行，例如 `Parent: PAP-1150 add the ability...`

重要约束：

- 此父上下文行仅在使用 sub-issue 默认值打开对话框时渲染
- 从全局创建操作打开对话框应保持不变，不应暴露通用父控件

这保留了请求的 UX 边界：sub-issue 创建是有意为之，而非默认创建 issue 表面的一部分。

### 3.6 查询失效和刷新行为

不需要新的数据获取路径。

`NewIssueDialog` 中的现有创建成功处理程序已失效：

- `queryKeys.issues.list(companyId)`
- issue 相关列表徽章

对于父 `IssueDetail` 视图，在创建后重新计算 `childIssues` 应该足够了，因为它从公司 issue 列表查询派生子项。

如果详情页将来离开完整公司 issue 列表，应重新审视，但这不需要对当前架构进行额外工作。

## 4. 实施顺序

1. 使用 sub-issue 字段扩展 `DialogContext` issue 默认值。
2. 从 `Sub-issues` 选项卡将 `IssueDetail` 连接为以 sub-issue 模式打开对话框。
3. 扩展 `IssueProperties` 以显示子 issues 和 `Add sub-issue` 操作。
4. 更新 `NewIssueDialog` 提交和 sub-issue 模式的标题 UI。
5. 为新入口点和有效载荷行为添加 UI 测试。

## 5. 测试计划

添加覆盖以下内容的专注 UI 测试：

1. `IssueDetail`
   - `Sub-issues` 选项卡在有零个子项时显示 `Add sub-issue`
   - 点击操作会使用父默认值打开对话框

2. `IssueProperties`
   - 属性面板渲染 sub-issue 部分
   - 在没有子 issues 时 `Add sub-issue` 保持可用

3. `NewIssueDialog`
   - 使用 `parentId` 打开时，提交有效载荷包含 `parentId`
   - 仅在该模式下出现 sub-issue 特定副本
   - 正常打开时，不显示父 UI 且有效载荷不变

除非实施发现客户端/服务器契约差距，否则不需要后端测试扩展。

## 6. 风险和决策

### 6.1 父元数据源

决策：通过对话框默认值传递父标签元数据，而不是让 `NewIssueDialog` 获取父 issue。

原因：

- 更少的耦合
- 对话框内没有加载状态
- 更简单的测试

### 6.2 项目继承

决策：从父 issue 预填充 `projectId`，但保持可编辑。

原因：

- 符合预期的操作员行为
- 避免默认情况下将 sub-issue 静默移出当前项目

### 6.3 将父选择保留在通用对话框之外

决策：在此更改中不要添加自由格式的父选择器。

原因：

- 请求明确要求仅当流程从 sub-issue 操作开始时才显示 sub-issue 控件
- 这使默认 issue 创建表面更简单

## 7. 成功标准

当操作员可以执行以下操作时，此计划完成：

1. 打开任何 issue 详情页
2. 从 `Sub-issues` 选项卡或属性面板点击 `Add sub-issue`
3. 进入现有 new-issue 对话框，并显示清晰的父上下文
4. 创建子 issue 并看到它出现在父项下，无需重新加载页面
