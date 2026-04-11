# 插件编写指南

本指南描述了在此仓库中创建 Paperclip 插件的当前已实现方式。

它比 [PLUGIN_SPEC.md](./PLUGIN_SPEC.md) 故意更窄。规范中包含未来的想法；本指南仅涵盖目前已存在的 alpha 接口。

## 当前现实

- 将插件 worker 和插件 UI 视为可信代码。
- 插件 UI 以同源 JavaScript 形式在 Paperclip 主应用内运行。
- Worker 端 host API 具备能力限制。
- 插件 UI 未被 manifest capabilities 沙箱化。
- 目前还没有 host 提供的供插件使用的共享 React 组件库。
- 当前运行时不支持 `ctx.assets`。

## 脚手架插件

使用 scaffold 包：

```bash
pnpm --filter @paperclipai/create-paperclip-plugin build
node packages/plugins/create-paperclip-plugin/dist/index.js @yourscope/plugin-name --output ./packages/plugins/examples
```

对于位于 Paperclip 仓库之外的插件：

```bash
pnpm --filter @paperclipai/create-paperclip-plugin build
node packages/plugins/create-paperclip-plugin/dist/index.js @yourscope/plugin-name \
  --output /absolute/path/to/plugin-repos \
  --sdk-path /absolute/path/to/paperclip/packages/plugins/sdk
```

这会创建一个包含以下内容的包：

- `src/manifest.ts`
- `src/worker.ts`
- `src/ui/index.tsx`
- `tests/plugin.spec.ts`
- `esbuild.config.mjs`
- `rollup.config.mjs`

在此 monorepo 内部，scaffold 使用 `workspace:*` 作为 `@paperclipai/plugin-sdk`。

在此 monorepo 外部，scaffold 会从本地 Paperclip checkout 中将 `@paperclipai/plugin-sdk` 快照到一个 `.paperclip-sdk/` tarball 中，这样你就可以在发布到 npm 之前构建和测试插件。

## 推荐的本地工作流程

从生成的插件文件夹中：

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

对于本地开发，通过插件管理器或 API 从绝对本地路径安装到 Paperclip。服务器支持本地文件系统安装，并监视本地路径插件的文件更改，因此重建后会自动重启 worker。

示例：

```bash
curl -X POST http://127.0.0.1:3100/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"packageName":"/absolute/path/to/your-plugin","isLocalPath":true}'
```

## 支持的 alpha 接口

Worker：

- config
- events
- jobs
- launchers
- http
- secrets
- activity
- state
- entities
- projects and project workspaces
- companies
- issues and comments
- agents and agent sessions
- goals
- data/actions
- streams
- tools
- metrics
- logger

UI：

- `usePluginData`
- `usePluginAction`
- `usePluginStream`
- `usePluginToast`
- `useHostContext`
- 来自 `@paperclipai/plugin-sdk/ui` 的类型化 slot props

目前已在 host 中连接 Mount surfaces 包括：

- `page`
- `settingsPage`
- `dashboardWidget`
- `sidebar`
- `sidebarPanel`
- `detailTab`
- `taskDetailView`
- `projectSidebarItem`
- `globalToolbarButton`
- `toolbarButton`
- `contextMenuItem`
- `commentAnnotation`
- `commentContextMenuItem`

## 公司路由

插件可以声明带有 `routePath` 的 `page` slot 来拥有公司路由，如下：

```text
/:companyPrefix/<routePath>
```

规则：

- `routePath` 必须是单个小写 slug
- 不能与保留的 host 路由冲突
- 不能重复其他已安装插件页面路由

## 发布指南

- 使用 npm 包作为部署产物。
- 将仓库本地示例安装仅视为开发工作流程。
- 优先保持插件 UI 自包含在包内。
- 不要依赖 host 设计系统组件或未记录的应用程序内部结构。
- GitHub 仓库安装目前不是一等公民工作流程。对于本地开发，请使用检出的本地路径。对于生产环境，请发布到 npm 或私有 npm 兼容注册表。

## 交付前验证

至少运行：

```bash
pnpm --filter <your-plugin-package> typecheck
pnpm --filter <your-plugin-package> test
pnpm --filter <your-plugin-package> build
```

如果你也更改了 host 集成，还要运行：

```bash
pnpm -r typecheck
pnpm test:run
pnpm build
```
