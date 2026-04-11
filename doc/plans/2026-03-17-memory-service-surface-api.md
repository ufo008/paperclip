# Paperclip Memory Service Plan

## Goal

定义一个 Paperclip 记忆服务和表面 API，它可以位于多个记忆后端之上，同时保留 Paperclip 的控制平面要求：

- 公司范围
- 可审计性
- 追溯到 Paperclip 工作对象
- 预算/成本可见性
- 插件优先的可扩展性

本计划基于 `doc/memory-landscape.md` 中总结的外部景观以及当前 Paperclip 架构：

- `doc/SPEC-implementation.md`
- `doc/plugins/PLUGIN_SPEC.md`
- `doc/plugins/PLUGIN_AUTHORING_GUIDE.md`
- `packages/plugins/sdk/src/types.ts`

## One-Sentence Recommendation

Paperclip 不应在核心中嵌入一个固执的记忆引擎。它应该添加一个公司范围的记忆控制平面，具有小型标准化适配器契约，然后让内置和插件实现提供商特定的行为。

## Product Decisions

### 1. Memory is company-scoped by default

每个记忆绑定恰好属于一个公司。

该绑定可以：

- 作为公司默认值
- 作为代理覆盖
- 以后如果需要，作为项目覆盖

初始设计中没有跨公司记忆共享。

### 2. Providers are selected by key

每个配置的内存 provider 在公司内获得一个稳定的 key，例如：

- `default`
- `mem0-prod`
- `local-markdown`
- `research-kb`

代理和服务通过 key 解析活动的 provider，而不是通过硬编码的 vendor 逻辑。

### 3. Plugins are the primary provider path

内置对零配置本地路径有用，但大多数 provider 应该通过现有的 Paperclip 插件运行时到达。

这保持了核心的小型化，并匹配当前可选知识类系统位于边缘的方向。

### 4. Paperclip owns routing, provenance, and accounting

Provider 不应决定 Paperclip 实体如何映射到治理。

Paperclip 核心应该拥有：

- 谁被允许调用记忆操作
- 哪个公司/代理/项目范围是活动的
- 该操作属于哪个 issue / run / comment / document
- 如何记录使用量

### 5. Automatic memory should be narrow at first

自动捕获有用，但广泛的静默捕获是危险的。

初始自动钩子应该是：

- 来自代理运行的运行后捕获
- 当绑定启用时的 issue 评论/文档捕获
- 用于代理上下文水合的运行前回忆

其他一切初始应该是显式的。

## Proposed Concepts

### Memory provider

存储和检索记忆的内置或插件提供的实现。

示例：

- 本地 markdown + 向量索引
- mem0 适配器
- supermemory 适配器
- MemOS 适配器

### Memory binding

指向 provider 并携带 provider 特定配置的公司范围配置记录。

这是通过 key 选择的对象。

### Memory scope

传入 provider 请求的标准化 Paperclip 范围。

### Memory operation

一种标准化的记忆操作类型。

### Memory record

存储在 provider 中的单个记忆条目。

### Semantic recall

语义回忆操作。

### Keyword recall

关键词回忆操作。

## Proposed API Shape

### MemoryProvider interface

```ts
interface MemoryProvider {
  // Provider metadata
  readonly key: string;
  readonly label: string;
  readonly capabilities: MemoryCapabilities;

  // Connect/disconnect lifecycle
  connect(binding: MemoryBinding, scope: MemoryScope): Promise<void>;
  disconnect(binding: MemoryBinding): Promise<void>;

  // Operations
  store(records: MemoryRecord[], scope: MemoryScope): Promise<void>;
  recall(query: MemoryQuery, scope: MemoryScope): Promise<MemoryRecord[]>;
  forget(keys: string[], scope: MemoryScope): Promise<void>;
  stats(scope: MemoryScope): Promise<MemoryStats>;
}
```

### MemoryService API

```ts
class MemoryService {
  // Admin
  listProviders(companyId: string): MemoryProviderInfo[];
  createBinding(companyId: string, config: MemoryBindingConfig): Promise<MemoryBinding>;
  updateBinding(id: string, config: Partial<MemoryBindingConfig>): Promise<void>;
  deleteBinding(id: string): Promise<void>;

  // Agent-facing
  store(agentId: string, records: MemoryRecord[]): Promise<void>;
  recall(agentId: string, query: MemoryQuery): Promise<MemoryRecord[]>;
  forget(agentId: string, keys: string[]): Promise<void>;

  // Scope helpers
  setDefaultBinding(companyId: string, bindingKey: string): Promise<void>;
  getActiveBinding(companyId: string, agentId?: string): MemoryBinding | null;
}
```

## Proposed Data Model

### memory_bindings

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| company_id | uuid | Company FK |
| key | text | Unique per-company key |
| provider | text | Provider type identifier |
| config | jsonb | Provider-specific config |
| is_default | boolean | Company default |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update |

### memory_usage_log

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| company_id | uuid | Company FK |
| agent_id | uuid | Agent FK |
| binding_id | uuid | Binding FK |
| operation | text | store/recall/forget |
| record_count | integer | Records affected |
| provider_ms | integer | Provider latency |
| error | text | Error message if any |
| created_at | timestamp | When logged |

## Implementation Priorities

### Phase 1: Core plumbing

1. Add memory_bindings and memory_usage_log tables.
2. Add MemoryService with basic CRUD.
3. Add agent service integration points.
4. Add company-scoped routing.

### Phase 2: Built-in providers

1. Local markdown provider (zero-config).
2. In-memory vector provider for testing.
3. Plugin SDK types for MemoryProvider.

### Phase 3: Agent integration

1. Post-run automatic capture.
2. Pre-run context hydration.
3. Issue comment/document capture.

### Phase 4: Advanced features

1. Project-level overrides.
2. Cross-provider search.
3. Memory retention policies.

## Open Questions

1. How should we handle provider-specific config schemas?
2. Should we normalize vector embeddings across providers?
3. How do we handle memory migration between providers?
4. What's the interaction with existing workspace files?
5. How do we handle provider-specific capability discovery?

## Appendix: Provider Contract

### MemoryCapabilities

```ts
interface MemoryCapabilities {
  store: boolean;
  recall: boolean;
  forget: boolean;
  semanticSearch: boolean;
  keywordSearch: boolean;
  maxRecordSize: number;
  maxBatchSize: number;
}
```

### MemoryQuery

```ts
interface MemoryQuery {
  type: 'semantic' | 'keyword' | 'mixed';
  text: string;
  filters?: {
    source?: 'run' | 'comment' | 'document';
    runId?: string;
    timeRange?: { start: Date; end: Date };
  };
  limit?: number;
  offset?: number;
}
```

### MemoryRecord

```ts
interface MemoryRecord {
  key: string;
  type: 'text' | 'code' | 'data';
  content: string;
  source: {
    type: 'run' | 'comment' | 'document';
    id: string;
    companyId: string;
    agentId?: string;
    issueId?: string;
    runId?: string;
  };
  metadata?: Record<string, unknown>;
  embedding?: number[];
  createdAt: Date;
}
```

## Provider Implementation Notes

### Local Markdown Provider

- Stores memories as markdown files in the workspace
- Maintains a simple keyword index
- No external dependencies
- Good for zero-config and testing

### Vector Provider Interface

- Providers can implement semantic search
- Embeddings stored per-provider
- Normalized embedding format TBD

## Security Considerations

1. All operations must be company-scoped
2. Agents can only access memories for their company
3. Audit log for all memory operations
4. Provider configs may contain sensitive data (API keys)
5. Provider configs should be encrypted at rest

## Cost Considerations

1. Memory operations should be cheap
2. Provider costs vary significantly
3. Need per-company usage tracking
4. Budget limits for memory storage
