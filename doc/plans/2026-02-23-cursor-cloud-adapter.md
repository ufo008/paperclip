# Cursor Cloud Agent Adapter — Technical Plan

## Overview

本文档定义了与 Cursor REST API 集成的 Paperclip 适配器的 V1 设计，用于 Cursor Background Agents。

主要参考：

- https://docs.cursor.com/background-agent/api/overview
- https://docs.cursor.com/background-agent/api
- https://docs.cursor.com/background-agent/api/webhooks

与 `claude_local` 和 `codex_local` 不同，此适配器不是本地子进程。
它是一个远程编排适配器，具有：

1. 通过 HTTP 启动/后续
2. 可能的 webhook 驱动状态更新
3. 轮询回退以提高可靠性
4. 为 Paperclip UI/CLI 合成的 stdout 事件

## Architecture

### Adapter Interface

```ts
interface CursorCloudAdapter {
  // 启动代理
  launch(config: CursorConfig): Promise<AgentSession>;
  
  // 获取状态
  getStatus(sessionId: string): Promise<SessionStatus>;
  
  // 发送消息
  sendMessage(sessionId: string, message: string): Promise<void>;
  
  // 终止会话
  terminate(sessionId: string): Promise<void>;
}
```

### Config

```ts
interface CursorConfig {
  apiKey: string;
  workspaceId: string;
  model?: string;
}
```

## Implementation Plan

### Phase 1: Basic Integration

1. 实现 Cursor API 客户端
2. 实现启动/终止
3. 实现状态轮询

### Phase 2: Webhook Support

1. 实现 webhook 处理器
2. 添加 webhook 验证
3. 添加轮询回退

### Phase 3: UI Integration

1. 添加适配器配置 UI
2. 添加会话管理 UI
3. 添加日志/输出 UI

## Open Questions

1. 如何处理 Cursor API 速率限制？
2. 如何处理会话恢复？
3. 如何处理错误？
