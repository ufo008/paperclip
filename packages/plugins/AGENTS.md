# packages/plugins 开发指南

本文档为 Paperclip 插件系统开发提供指南。

## 1. 插件系统概述

Paperclip 插件系统允许扩展核心功能，通过标准化的 plugin interface 实现与主系统的解耦。

### 核心组件

- **plugin manifest**: 插件元数据声明
- **plugin worker**: 后台执行逻辑，运行在独立的 worker 环境中
- **plugin UI**: 可选的 UI 组件，通过 plugin runtime 渲染

## 2. 插件结构

每个插件应包含以下核心文件：

```
src/
├── index.ts        # 插件入口，注册 plugin
├── worker.ts       # worker 执行逻辑
├── manifest.ts     # 插件元数据
└── ui/
    └── index.tsx   # UI 组件（可选）
```

### manifest.ts 必需字段

```typescript
export const manifest = {
  id: 'plugin-name',           // 唯一标识符
  name: 'Plugin Name',          // 显示名称
  version: '1.0.0',             // 版本号
  description: '描述',           // 插件描述
} as const;
```

## 3. Plugin Interface

实现插件时，必须符合 `DefinePlugin` 定义的 interface：

```typescript
import { definePlugin } from '@paperclip-ui/plugins-sdk';

export default definePlugin({
  manifest,
  worker: {
    onStart: async () => {
      // 初始化逻辑
    },
    handleRPC: async (rpc, tools) => {
      // 处理 RPC 调用
    },
  },
  ui: {
    component: MyComponent,  // 可选的 UI 组件
  },
});
```

## 4. Worker RPC

插件与宿主之间通过 RPC 通信：

- 使用 `tool` 访问宿主提供的功能
- 返回序列化的结果
- 避免在 worker 中直接访问文件系统

### 常用 Tools

- `fs.readFile`, `fs.writeFile`: 文件操作
- `exec`: 执行命令
- `log`: 输出日志

## 5. UI Runtime

插件 UI 通过 plugin runtime 在宿主环境中渲染：

- 使用 `paperclip-ui/plugins-sdk` 中的 hooks
- 通过 `usePluginRPC` 调用 worker 方法
- UI 组件必须可序列化

### 示例

```typescript
import { usePluginRPC } from '@paperclip-ui/plugins-sdk';

function MyComponent() {
  const result = usePluginRPC('myMethod', { param: 'value' });
  return <div>{result}</div>;
}
```

## 6. 开发工作流

1. 使用 `create-paperclip-plugin` 创建新插件
2. 在 `examples/` 目录中参考现有实现
3. 使用 SDK 提供的 dev-server 进行调试
4. 构建时使用 SDK 的 bundlers 配置

## 7. 包结构

```
packages/plugins/
├── sdk/                          # 插件 SDK
│   └── src/
│       ├── define-plugin.ts      # 插件定义函数
│       ├── protocol.ts           # RPC 协议定义
│       ├── types.ts              # 类型定义
│       ├── dev-server.ts         # 开发服务器
│       └── ui/                   # UI runtime
├── examples/                     # 插件示例
│   ├── plugin-hello-world-example/
│   ├── plugin-file-browser-example/
│   └── plugin-authoring-smoke-example/
└── create-paperclip-plugin/      # 插件创建工具
```

## 8. 注意事项

- 插件 ID 必须唯一，避免与内置功能冲突
- worker 中的异步操作应正确处理错误
- UI 组件保持轻量，避免大型依赖
- 发布前在 `plugin-authoring-smoke-example` 中验证
