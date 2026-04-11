# Kitchen Sink Plugin Plan

## Goal

添加一个新的第一方示例插件，`Kitchen Sink (Example)`，在一个地方展示每个当前已实施的 Paperclip 插件 API 表面。

此插件旨在：

- 作为贡献者的活参考实现
- 作为插件运行时的手动测试工具
- 作为插件实际上今天可以做什么的可发现演示

它不旨在成为一个成熟的最终用户产品插件。

## Why

当前插件系统有真正的 API 表面，但它分布在：

- SDK 文档
- SDK 类型
- 插件规范散文
- 两个示例插件，每个只展示一个狭窄切片

这使得难以回答基本问题如：

- 插件可以渲染什么？
- 插件工作进程实际上可以做什么？
- 哪些表面是真实的 vs 理想化的？
- 新插件应该如何在此 repo 中构建？

Kitchen Sink 插件应该通过示例回答这些问题。

## Success Criteria

如果贡献者可以安装它，并且在不首先阅读 SDK 的情况下，从 Paperclip 内部发现和练习当前插件运行时表面区域，则插件是成功的。

具体来说：

- 它从捆绑示例列表安装
- 它为每个已实施的工作进程 API 表面暴露至少一个演示
- 它为每个主机挂载的 UI 表面暴露至少一个演示
- 它清楚标记本地仅/可信仅演示
- 默认情况下足够安全用于本地开发
- 它可以作为插件运行时更改的回归工具

## Constraints

- 保持实例安装，而不是公司安装。
- 将此作为可信/本地示例插件。
- 不依赖云安全运行时假设。

## Plugin Structure

### Worker Surfaces to Demo

1. **setup() / onHealth()** - Worker lifecycle
2. **onRunCreated()** - Run lifecycle hooks
3. **onCostEvent()** - Cost event processing
4. **onIssueComment()** - Issue comment hooks
5. **onAgentMessage()** - Agent message hooks
6. **Scheduled jobs** - Job scheduling
7. **Webhook endpoints** - HTTP endpoints

### UI Surfaces to Demo

1. **Plugin dashboard page** - Full page contribution
2. **Board sidebar slot** - Sidebar panel
3. **Issue detail tab** - Issue tab content
4. **Run detail panel** - Run panel content
5. **Settings page section** - Settings contribution

### Service Surfaces to Demo

1. **Tool registration** - Custom tools
2. **Memory provider** - Memory backend
3. **Adapter extension** - Adapter customization

## Implementation Plan

### Phase 1: Structure

1. Create plugin package structure
2. Set up worker initialization
3. Configure manifest

### Phase 2: Worker Demos

1. Add setup/onHealth demo
2. Add run lifecycle demo
3. Add cost event demo
4. Add job scheduling demo

### Phase 3: UI Demos

1. Add dashboard page demo
2. Add sidebar panel demo
3. Add settings section demo

### Phase 4: Tools and Services

1. Add tool registration demo
2. Add memory provider demo

## Demo Naming Conventions

Each demo should:

- Have a clear name
- Be self-contained
- Include comments explaining what it demonstrates
- Be safely executable without external dependencies

## Safety Considerations

- All demos should be local-only
- No network requests to external services
- Clear labels for what requires trust
- Easy to disable/remove

## Documentation

Each demo should include:

- What API surface it demonstrates
- How to trigger/exercise it
- What the expected behavior is
- Any security considerations
