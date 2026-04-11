# 2026-04-07 Issue Detail Speed And Optimistic Inventory

状态：提议中
日期：2026-04-07
受众：产品和工程
相关：
- `ui/src/pages/IssueDetail.tsx`
- `ui/src/components/IssueProperties.tsx`
- `ui/src/api/issues.ts`
- `ui/src/lib/queryKeys.ts`
- `server/src/routes/issues.ts`
- `server/src/services/issues.ts`
- [PAP-1192](/PAP/issues/PAP-1192)
- [PAP-1191](/PAP/issues/PAP-1191)
- [PAP-1188](/PAP/issues/PAP-1188)
- [PAP-1119](/PAP/issues/PAP-1119)
- [PAP-945](/PAP/issues/PAP-945)
- [PAP-1165](/PAP/issues/PAP-1165)
- [PAP-890](/PAP/issues/PAP-890)
- [PAP-254](/PAP/issues/PAP-254)
- [PAP-138](/PAP/issues/PAP-138)

## 1. Purpose

本说明列举了指向同一 UX 问题类别的 Paperclip issues：

- 页面感觉很慢，因为它们过度获取或重新获取太多
- 操作感觉很慢，因为 UI 在反映明显的本地意图之前等待往返
- 乐观更新存在于某些地方，但不是一致的系统

直接触发是 [PAP-1192](/PAP/issues/PAP-1192)：issue 详情页现在感觉很慢。

## 2. Short Answer

issue 详情页没有被一个病态端点明显阻塞。主要问题是页面的形状：

- `IssueDetail` 在挂载时发出许多独立查询
- 其中一些查询获取整个公司范围的集合，而数据是本地到一个 issue 的
- 常见 mutation 使几乎每个 issue 相关查询失效，这创造了可避免的重新获取风暴
- 页面只有一个最小的顶级 `Loading...` 回退，几乎没有分阶段或分段加载 UX

针对本地 dev 上当前分配的 issue（`PAP-1191`）测量，最慢的单个请求是整个公司 issues 列表：

- `GET /api/issues/:id` 约 `18ms`
- `GET /api/issues/:id/comments|activity|approvals|attachments` 约 `6-8ms`
- `GET /api/companies/:companyId/agents|projects` 约 `9-11ms`
- `GET /api/companies/:companyId/issues` 约 `76ms`

这强烈表明当前的痛苦是聚合客户端扇出加上过度广泛的失效，而不是一个明显损坏的端点。

## 3. Similar Issue Inventory

### 3.1 Issue-detail and issue-action siblings

- [PAP-1192](/PAP/issues/PAP-1192)：issue 页面加载感觉永久
- [PAP-1188](/PAP/issues/PAP-1188)：issue 属性面板中的受让人变更很慢，需要乐观 UI
- [PAP-945](/PAP/issues/PAP-945)：乐观评论渲染
- [PAP-1003](/PAP/issues/PAP-1003)：乐观评论有重复的草稿/待处理行为
- [PAP-947](/PAP/issues/PAP-947)：乐观评论的后续破坏
- [PAP-254](/PAP/issues/PAP-254)：长 issue 线程在添加评论时变得缓慢
- [PAP-189](/PAP/issues/PAP-189)：issue 有实时运行时的评论语义

模式：issue 页面已经有一系列需要乐观行为和有界线程/加载行为的历史。`PAP-1192` 是同一个家族，不是新类别。

### 3.2 Inbox and list-view siblings

- [PAP-1119](/PAP/issues/PAP-1119)：乐观归档有淡出然后 snap-back
- [PAP-1165](/PAP/issues/PAP-1165)：issue 搜索慢
- [PAP-890](/PAP/issues/PAP-1188)：issue 搜索慢，使其非常快
- [PAP-138](/PAP/issues/PAP-138)：inbox 加载感觉卡住
- [PAP-470](/PAP/issues/PAP-470)：create-issue 保存状态感觉很慢和尴尬

模式：Paperclip 已经有几个地方，正确的修复是"立即显示意图，然后协调"，而不是"等待重新获取"。

### 3.3 Broader app-loading siblings

- [PAP-472](/PAP/issues/PAP-472)：仪表板图表加载非常慢
- [PAP-797](/PAP/issues/PAP-797)：通过静态生成/缓存减少加载状态（如果可能）
- [PAP-799](/PAP/issues/PAP-799)：在构建时嵌入公司数据以消除加载状态
- [PAP-703](/PAP/issues/PAP-703)：更快的聊天和更好的视觉反馈

模式：产品在整个应用中有减少空白/加载状态的持续压力，所以 issue-detail 工作应该符合更广泛的方向。

## 4. Current Issue Detail Findings

### 4.1 Mount query fan-out is high

`ui/src/pages/IssueDetail.tsx` 预先挂载所有这些数据源：

- issue 详情
- 评论
- 活动
- 链接的运行
- 链接的审批
- 附件
- 实时运行
- 活动运行
- 完整公司 issues 列表
- 代理列表
- 认证会话
- 项目列表
- 反馈投票
- 实例常规设置
- 插件槽

对于单个 issue 的初始视图来说，这太多了。

### 4.2 The page fetches full company issue data just to derive child issues

`IssueDetail` 当前做：

- `issuesApi.list(selectedCompanyId!)`
- 然后在客户端过滤 `parentId === issue.id`

相对于需要来说，这是昂贵的。

重要细节：

- 服务器路由已经支持 `parentId`
- `server/src/services/issues.ts` 已经支持 `parentId`
- 但 `ui/src/api/issues.ts` 在过滤类型中没有暴露 `parentId`

所以客户端缺少一个已经支持的窄查询路径。

### 4.3 Comments are still fetched as full-thread loads

`server/src/routes/issues.ts` 和 `server/src/services/issues.ts` 已经支持：

- `after`
- `order`
- `limit`

但 `IssueDetail` 仍然调用 `issuesApi.listComments(issueId)` 没有游标或限制，然后在常见评论操作后重新验证整个线程。

这意味着我们已经有增量评论加载的服务器端构建块，但页面没有使用它们。

### 4.4 Cache invalidation is broader than necessary

`IssueDetail` 中的 `invalidateIssue()` 使以下失效：

- 详情
- 活动
- 运行
- 审批
- 反馈投票
- 附件
- 文档
- 实时运行
- 活动运行
- 多个 issue 集合
- 侧边栏徽章

正确性可接受，但对于感知速度来说是昂贵的，并使乐观工作感觉不那么稳定，因为页面不断从新鲜网络结果重新绘制。

### 4.5 Live run state is fetched twice

页面同时轮询：

- `issues.liveRuns(issueId)` 每 3 秒
- `issues.activeRun(issueId)` 每 3 秒

这是紧密相关状态的重复轮询。

### 4.6 Properties panel duplicates more list fetching

`ui/src/components/IssueProperties.tsx` 获取：

- 会话
- 代理列表
- 项目列表
- 标签
- 并且当阻止者选择器打开时，获取完整公司 issues 列表

页面和面板各自做自己的列表工作，而不是共享一个更窄的 issue-detail 数据模型。

### 4.7 The perceived loading UX is too thin

`IssueDetail` 仅显示：

- 当主 issue 查询待处理时的普通 `Loading...`

之后，许多子部分可以出现空或不完整，直到它们自己的查询解析。这使得页面感觉比原始请求时间建议的更慢。

## 5. Recommended Plan

### 5.1 Phase 1: Fix perceived speed first

在更深的后端重塑之前，ship 使页面感觉即时的 UX 更改：

- 用 issue-detail 骨架替换普通 `Loading...` 状态
- 给评论、活动、附件和子 issues 自己的骨架/空/加载状态
- 在重新获取期间保留可见的过时数据，而不是清除部分
- 为已经乐观的本地操作显示明确的待处理状态

为什么优先：

- 它立即改善用户面对的感觉
- 它减少了后来数据更改仍然因为页面闪烁空白而感觉慢的机会

### 5.2 Phase 2: Stop fetching the full company issues list for child issues

将 `parentId` 添加到 `issuesApi.list(...)` 过滤类型并切换 `IssueDetail` 到：

- 仅获取子 issues
- 在页面挂载时停止加载完整公司 issue 集合

这是最高置信度的窄胜利，因为服务器路径已经存在。

### 5.3 Phase 3: Convert comments to a bounded + incremental model

使用现有的服务器支持：

- 来自身跳上下文或 issue bootstrap 的最新评论游标
- 使用 `after` 的增量获取
- 使用 `limit` 的有界初始获取

建议行为：

- 首次加载：获取最新的 N 条评论
- 为长线程提供"加载更早"
- 发布时或实时更新后：增量附加，而不是使整个线程失效

这应该解决与 [PAP-254](/PAP/issues/PAP-254) 相同的性能家族。

### 5.4 Phase 4: Reduce duplicate polling and invalidation

收紧页面的运行时端：

- 如果可能，将 `liveRuns` 和 `activeRun` 折叠成一个客户端源
- 在 mutation 后停止使无关 issue 集合失效，仅影响当前 issue
- 在我们已经足够信息的地方将服务器响应合并到缓存

示例：

- 发布评论不应强制广泛的公司 issue 列表重新获取，除非列表可见的元数据更改
- 附件更改不应使审批或无关实时运行查询失效

### 5.5 Phase 5: Consider an issue-detail bootstrap contract

如果页面在客户端修复后仍然太冗长，为 issue 详情页添加一个量身定制的 bootstrap 表面。

潜在的 bootstrap 有效载荷：

- issue 核心数据
- 子 issue 摘要
- 最新评论游标和最近评论页面
- 实时运行摘要
- 附件摘要
- 审批摘要
- 真正在首次绘制时需要的任何轻量级提及/选择器元数据

这应该在明显的客户端过度获取修复之后发生，而不是之前。

## 6. Concrete Opportunities By Surface

### 6.1 Issue detail page

- 将子 issue 获取从完整列表缩小到 `parentId`
- 按部分而不是全有或全无感知来分阶段加载
- 有界初始评论有效载荷
- 减少重复的实时运行轮询
- 用定向缓存写入替换广泛失效

### 6.2 Issue properties panel

- 在可能的地方重用页面级代理/项目数据
- 懒惰和窄获取阻止者
- 在广泛页面失效的情况下保持本地乐观字段更新

### 6.3 Thread/comment UX

- 直接将乐观评论追加到可见线程
- 在协调期间保持排队/待处理评论状态稳定
- 在最后已知游标之后仅获取新评论

### 6.4 Cross-app optimistic consistency

相同的标准应适用于：

- issue 归档/取消归档
- issue 属性编辑
- 创建 issue/sub-issue 流程
- 评论发布
- 附件/文档操作，其中本地结果是明显的

## 7. Suggested Execution Order

1. `PAP-1192`：issue-detail 骨架和分阶段加载
2. 将 `parentId` 支持添加到 `ui/src/api/issues.ts` 并切换子 issue 获取到窄查询
3. 将评论移动到有界初始加载加增量更新
4. 缩小失效和轮询范围
5. 仅在那时决定是否仍需要新的 issue-detail bootstrap 端点

## 8. Success Criteria

当后续实施使 issue 页面表现如下时，本清单是成功的：

1. 导航到 issue 立即显示成形骨架，而不是普通文本
2. 页面不再仅为渲染 sub-issues 获取完整公司 issue 列表
3. 长线程不在每次加载或评论 mutation 时需要全线程获取
4. 本地操作感觉即时，不会因为广泛失效而 snap back
5. 即使绝对后端计时已经合理，issue 页面也感觉更快
