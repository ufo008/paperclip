# AGENTS.md

`packages/adapters/` 目录的 Agent Adapter 开发指南。

## 1. 目录概述

`packages/adapters/` 包含多种 Agent Adapter 实现，每个 Adapter 都是一个独立的 package：

| Adapter | 描述 | 类型 |
|---------|------|------|
| `claude-local` | Anthropic Claude Code 本地适配器 | CLI-based |
| `codex-local` | OpenAI Codex 适配器 | CLI-based |
| `cursor-local` | Cursor IDE 适配器 | CLI-based |
| `gemini-local` | Google Gemini 适配器 | CLI-based |
| `opencode-local` | OpenCode 适配器 | CLI-based |
| `openclaw-gateway` | OpenClaw Gateway 适配器 | HTTP-based |
| `pi-local` | Pi 适配器 | CLI-based |

## 2. Adapter 架构

每个 Adapter 都遵循统一的目录结构：

```
<adapter-name>/
├── src/
│   ├── index.ts          # Package 入口
│   ├── cli/              # CLI 命令实现
│   │   ├── index.ts
│   │   └── format-event.ts
│   ├── server/           # Server-side 执行逻辑
│   │   ├── index.ts      # createServerAdapter() 工厂函数
│   │   ├── execute.ts    # 任务执行逻辑
│   │   ├── parse.ts      # stdout 解析器
│   │   ├── skills.ts     # Skills 集成
│   │   ├── models.ts     # Model 检测/配置
│   │   ├── quota.ts      # Quota 管理
│   │   └── test.ts       # 测试工具
│   └── ui/               # UI 配置解析
│       ├── index.ts
│       ├── parse-stdout.ts
│       └── build-config.ts
├── vitest.config.ts      # 测试配置
└── package.json
```

## 3. 创建新 Adapter

### 3.1 必须实现的核心接口

每个 Adapter 必须导出 `createServerAdapter()` 函数，签名为：

```typescript
function createServerAdapter(config: {
  adapterId: string;
  adapterType: string;
  execute: (options: ExecuteOptions) => Promise<ExecuteResult>;
  parse?: (output: string, role: 'assistant' | 'tool') => ParsedEvent[];
  detectModel?: (config: Record<string, unknown>) => Promise<string | null>;
  ui?: {
    parseStdout: (stdout: string, context: UIParseContext) => Promise<UIEvent[]>;
    buildConfig: (config: Record<string, unknown>) => Promise<UIConfig>;
  };
  skills?: {
    list: () => Promise<Skill[]>;
    execute: (skillId: string, context: Record<string, unknown>) => Promise<SkillResult>;
  };
  quota?: {
    probe: () => Promise<QuotaInfo>;
    getRemaining: () => Promise<number>;
  };
}): ServerAdapter;
```

### 3.2 Execute 函数

`execute` 是核心函数，负责启动 Agent 并处理任务：

```typescript
interface ExecuteOptions {
  prompt: string;
  context: {
    taskId: string;
    companyId: string;
    userId: string;
    goalId?: string;
    projectPath: string;
    metadata?: Record<string, unknown>;
  };
  config: AdapterConfig;
  signal?: AbortSignal;
  onEvent: (event: AdapterEvent) => void;
}
```

### 3.3 Event 类型

Adapter 通过 `onEvent` 回调发送以下事件：

- `tool_call` - Agent 调用工具
- `tool_result` - 工具执行结果
- `message` - 文本消息
- `error` - 错误信息
- `complete` - 任务完成
- `heartbeat` - 心跳信号

## 4. UI Parse 规范

### 4.1 stdout 解析

UI 层需要解析 Agent 的 stdout 来提取可渲染的事件：

```typescript
interface UIEvent {
  type: 'tool_call' | 'tool_result' | 'message' | 'error' | 'checkpoint';
  data: unknown;
  timestamp: number;
}
```

### 4.2 Config Schema

每个 Adapter 应提供 JSON Schema 格式的 config schema，用于 UI 配置表单：

```typescript
interface UIConfig {
  schema: JSONSchema;
  defaultValues?: Record<string, unknown>;
  uiSchema?: Record<string, UISchemaNode>;
}
```

## 5. Skills 集成

Adapter 可选的 Skills 支持允许 Agent 调用预定义的技能：

```typescript
interface Skill {
  id: string;
  name: string;
  description: string;
  config?: Record<string, unknown>;
}

interface SkillResult {
  success: boolean;
  output?: string;
  error?: string;
}
```

## 6. Quota 管理

支持 quota probe 的 Adapter 可以实现 `quota` 接口：

```typescript
interface QuotaInfo {
  total: number;
  used: number;
  remaining: number;
  resetAt?: Date;
}
```

## 7. 开发规范

### 7.1 错误处理

- 所有 async 函数必须 try/catch
- 使用 `AdapterError` 类型包装特定错误
- 在 `onEvent` 回调中发送 `error` 事件，而不是 throw

### 7.2 日志记录

使用 `logger` 工具记录关键操作：

- Agent 启动/停止
- 配置加载
- 错误和警告

### 7.3 测试

每个 Adapter 必须包含：

- `vitest.config.ts` - 测试配置
- `src/server/parse.test.ts` - 解析器测试
- `src/server/models.test.ts` - Model 检测测试（如适用）

### 7.4 类型安全

- 所有公开接口必须使用 TypeScript 类型
- 避免使用 `any` 类型
- 导出所有必要的类型供外部使用

## 8. 已知 Adapter 特性

### Claude Local

- 使用 `claude` CLI
- 支持 `CLAUDE_API_KEY` 环境变量
- 模型检测通过 `claude models list` 实现

### Codex Local

- 使用 `codex` CLI
- 支持 quota probe
- 支持技能调用

### Cursor Local

- 使用 Cursor IDE 的 MCP 协议
- 支持 trust 验证
- 支持流式输出

### Gemini Local

- 使用 `gemini` CLI
- 特殊的消息格式处理

### OpenCode Local

- 使用 OpenCode CLI
- 支持运行时配置

### OpenClaw Gateway

- HTTP-based adapter
- 使用 WebSocket 进行事件传输
- 支持远程 Agent 连接

## 9. 参考资料

- 主项目 AGENTS.md: `../../AGENTS.md`
- Adapter 工具库: `../adapter-utils/`
- Shared 类型定义: `../shared/`
