# Agent Chat UI and Issue-Backed Conversations

## Context

`PAP-475` 提出两个相关问题：

1. 如果我们添加带有代理的聊天表面，Paperclip 应该使用什么 UI kit？
2. 聊天如何适应产品而不破坏当前的 issue 中心模型？

这不仅仅是组件库决策。今天在 Paperclip 中：

- V1 明确说通信是`任务+评论 only`，没有单独的聊天系统。
- Issues 已经携带分配、审计跟踪、账单代码、项目链接、目标链接和活动运行链接。
- 实时运行流已经存在于 issue 详情页上。
- 代理会话已经通过 `taskKey` 持久化，今天 `taskKey` 回退到 `issueId`。
- OpenClaw 网关适配器已经支持 issue 范围会话键策略。

这意味着最便宜的有用路径不是"在 Paperclip 内部添加第二个消息产品"。它是"在我们已经拥有的 issue 和运行原语之上添加更好的对话 UI"。

## Current Constraints From the Codebase

### Durable work object

Paperclip 中的持久对象是 issue，而不是聊天线程。

- `IssueDetail` 已经将评论、链接的运行、实时运行和活动组合成一个时间线。
- `CommentThread` 已经渲染 markdown 评论并支持回复/重新分配流程。
- `LiveRunWidget` 已经为活动运行渲染流式助手/工具/系统输出。

### Session behavior

会话通过 `taskKey` 持久化，今天回退到 `issueId`。

这意味着：

- 每个 issue 有一个会话
- 会话在心跳之间保持
- 代理可以跨心跳记住上下文

## Proposed Implementation

### Chat Panel on Issue Detail

在 `IssueDetail` 上添加聊天面板：

```tsx
<IssueDetail>
  <Header />
  <Properties />
  <Tabs>
    <Tab id="comments">Comments</Tab>
    <Tab id="chat">Chat</Tab>
    <Tab id="runs">Runs</Tab>
  </Tabs>
  <ChatPanel agentId={issue.assigneeId} />
</IssueDetail>
```

### Chat Message

```tsx
interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  createdAt: Date;
}
```

### Chat Panel

聊天面板显示：

- Issue 相关聊天消息
- 链接运行的实时输出
- 代理工具调用

## Implementation Plan

### Phase 1: Basic Chat UI

1. 在 IssueDetail 上添加聊天面板
2. 显示聊天消息
3. 发送消息到代理

### Phase 2: Session Integration

1. 将聊天链接到 issue 会话
2. 在心跳之间保持聊天历史
3. 显示实时运行输出

### Phase 3: Advanced Features

1. 添加聊天命令
2. 添加聊天技巧
3. 添加聊天分析

## Open Questions

1. 聊天如何与评论共存？
2. 聊天消息如何计费？
3. 聊天如何与运行交互？
