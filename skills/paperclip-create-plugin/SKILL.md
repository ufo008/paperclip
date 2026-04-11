---
name: paperclip-create-plugin
description: >
  使用当前的 alpha SDK/runtime 创建新的 Paperclip 插件。当你需要搭建插件包、
  添加新的示例插件或更新插件创作文档时使用。涵盖支持的 worker/UI 表面、
  路由约定、搭建流程和验证步骤。
---

# 创建 Paperclip 插件

当任务是创建、搭建或记录 Paperclip 插件时使用此技能。

## 1. 基本规则

需要时首先阅读：

1. `doc/plugins/PLUGIN_AUTHORING_GUIDE.md`
2. `packages/plugins/sdk/README.md`
3. 仅当需要面向未来的上下文时阅读 `doc/plugins/PLUGIN_SPEC.md`

当前运行时假设：

- 插件 worker 是可信代码
- 插件 UI 是可信的同源主机代码
- worker API 是能力门控的
- 插件 UI 不通过 manifest capabilities 进行沙箱处理
- 尚无主机提供的共享插件 UI 组件工具包
- 当前运行时不支持 `ctx.assets`

## 2. 首选工作流

使用 scaffold 包而不是手写样板：

```bash
pnpm --filter @paperclipai/create-paperclip-plugin build
node packages/plugins/create-paperclip-plugin/dist/index.js <npm-package-name> --output <target-dir>
```

对于位于 Paperclip 仓库之外的插件，传递 `--sdk-path` 并让 scaffold 将本地 SDK/shared 包快照到 `.paperclip-sdk/`：

```bash
pnpm --filter @paperclipai/create-paperclip-plugin build
node packages/plugins/create-paperclip-plugin/dist/index.js @acme/plugin-name \
  --output /absolute/path/to/plugin-repos \
  --sdk-path /absolute/path/to/paperclip/packages/plugins/sdk
```

此仓库中的推荐目标：

- `packages/plugins/examples/` 用于示例插件
- 如果它正在成为真正的包，则是另一个 `packages/plugins/<name>/` 文件夹

## 3. 搭建后

检查并调整：

- `src/manifest.ts`
- `src/worker.ts`
- `src/ui/index.tsx`
- `tests/plugin.spec.ts`
- `package.json`

确保插件：

- 仅声明支持的 capabilities
- 不使用 `ctx.assets`
- 不导入主机 UI 组件 stub
- 保持 UI 自包含
- 仅在 `page` 插槽上使用 `routePath`
- 在开发期间从绝对本地路径安装到 Paperclip

## 4. 如果插件应该出现在应用中

对于捆绑示例/可发现行为，更新相关的主机接线：

- `server/src/routes/plugins.ts` 中的捆绑示例列表
- 列出仓库内示例的任何文档

仅当用户希望将插件作为捆绑示例展示时才能执行此操作。

## 5. 验证

始终运行：

```bash
pnpm --filter <plugin-package> typecheck
pnpm --filter <plugin-package> test
pnpm --filter <plugin-package> build
```

如果你也更改了 SDK/主机/插件运行时代码，也要运行更广泛的仓库检查。

## 6. 文档期望

在创作或更新插件文档时：

- 区分当前实现和未来规范想法
- 明确说明可信代码模型
- 不承诺主机 UI 组件或资产 API
- 对于生产环境，优先使用 npm 包部署指导而不是仓库本地工作流
