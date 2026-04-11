# AGENTS.md

本文件为在此仓库工作的人类和 AI 贡献者提供指导。

## 1. 目的

Paperclip 是 AI Agent 公司的控制平面。
当前的实现目标版本为 V1，定义在 `doc/SPEC-implementation.md` 中。

## 2. 优先阅读

在进行任何修改之前，请按以下顺序阅读：

1. `doc/GOAL.md`
2. `doc/PRODUCT.md`
3. `doc/SPEC-implementation.md`
4. `doc/DEVELOPING.md`
5. `doc/DATABASE.md`

`doc/SPEC.md` 是长期产品背景文档。
`doc/SPEC-implementation.md` 是 V1 构建的具体契约。

## 3. 仓库结构

- `server/`：Express REST API 和编排服务
- `ui/`：React + Vite 面板 UI
- `packages/db/`：Drizzle schema、数据库迁移和数据库客户端
- `packages/shared/`：共享类型、常量、验证器和 API 路径常量
- `packages/adapters/`：Agent 适配器实现（Claude、Codex、Cursor 等）
- `packages/adapter-utils/`：共享适配器工具
- `packages/plugins/`：插件系统包
- `doc/`：运维和产品文档

## 4. 开发设置（自动数据库）

开发时使用嵌入式 PGlite，无需设置 `DATABASE_URL` 环境变量。

```sh
pnpm install
pnpm dev
```

这将启动：

- API：`http://localhost:3100`
- UI：`http://localhost:3100`（在开发中间件模式下由 API 服务器提供服务）

快速验证：

```sh
curl http://localhost:3100/api/health
curl http://localhost:3100/api/companies
```

重置本地开发数据库：

```sh
rm -rf data/pglite
pnpm dev
```

## 5. 核心工程规则

1. **保持变更在公司范围内。**
   每个领域实体都应该属于某个公司，路由/服务中必须强制执行公司边界。

2. **保持契约同步。**
   如果修改了 schema 或 API 行为，请更新所有受影响的层：
   - `packages/db` 的 schema 和导出
   - `packages/shared` 的类型/常量/验证器
   - `server` 的路由/服务
   - `ui` 的 API 客户端和页面

3. **保持控制平面不变式。**
   - 单人任务模型
   - 原子性问题检出语义
   - 治理操作的审批门禁
   - 预算硬性自动暂停行为
   - 变更操作的活动日志

4. **除非被要求，否则不要全面替换战略文档。**
   优先进行增量更新。保持 `doc/SPEC.md` 和 `doc/SPEC-implementation.md` 同步。

5. **保持仓库计划文档的日期化和集中管理。**
   当在仓库内创建计划文档时，新计划文档应放在 `doc/plans/` 目录下，文件名格式为 `YYYY-MM-DD-slug.md`。这不替代 Paperclip 问题规划：如果 Paperclip issue 要求提供计划，请根据 `paperclip` skill 更新 issue 的 `plan` 文档，而不是创建仓库 markdown 文件。

## 6. 数据库变更工作流

修改数据模型时：

1. 编辑 `packages/db/src/schema/*.ts`
2. 确保新表从 `packages/db/src/schema/index.ts` 导出
3. 生成迁移：

```sh
pnpm db:generate
```

4. 验证编译：

```sh
pnpm -r typecheck
```

注意事项：
- `packages/db/drizzle.config.ts` 从 `dist/schema/*.js` 读取编译后的 schema
- `pnpm db:generate` 会先编译 `packages/db`

## 7. 交付前验证

在声称完成之前，运行完整的检查：

```sh
pnpm -r typecheck
pnpm test:run
pnpm build
```

如果有任何无法运行的步骤，明确报告哪些未运行及原因。

## 8. API 和认证期望

- 基础路径：`/api`
- Board 访问被视为完全控制操作员上下文
- Agent 访问使用 bearer API 密钥（`agent_api_keys`），在存储时进行哈希处理
- Agent 密钥不得访问其他公司

添加端点时：

- 应用公司访问检查
- 强制执行执行者权限（board vs agent）
- 为变更操作写入活动日志
- 返回一致的 HTTP 错误（`400/401/403/404/409/422/500`）

## 9. UI 期望

- 保持路由和导航与可用的 API 表面对齐
- 为公司范围的页面使用公司选择上下文
- 明确展示失败情况，不要静默忽略 API 错误

## 10. 拉取请求要求

创建拉取请求时（通过 `gh pr create` 或其他方式），**必须**阅读并填写 [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) 的每个部分。不要编写临时 PR 正文——使用模板作为 PR 描述的结构。必需部分：

- **Thinking Path** — 从项目上下文到此次变更的推理过程（参见 `CONTRIBUTING.md` 中的示例）
- **What Changed** — 具体变更的要点列表
- **Verification** — 审查者如何确认其正常工作
- **Risks** — 可能出现什么问题
- **Model Used** — 生成或辅助此次变更的 AI 模型（提供商、确切模型 ID、上下文窗口、功能）。如果没有使用 AI，请写 "None — human-authored"。
- **Checklist** — 所有条目已勾选

## 11. 完成定义

当以下全部为真时，变更才算完成：

1. 行为符合 `doc/SPEC-implementation.md`
2. Typecheck、测试和构建均通过
3. 契约在 db/shared/server/ui 各层同步
4. 行为或命令变更时文档已更新
5. PR 描述遵循 [PR 模板](.github/PULL_REQUEST_TEMPLATE.md) 且所有部分已填写（包括 Model Used）

## 11. Fork 特定：HenkDz/paperclip

这是 `paperclipai/paperclip` 的分支，包含 QoL 补丁和一个**仅外部**的 Hermes 适配器方案，位于分支 `feat/externalize-hermes-adapter`（[tree](https://github.com/HenkDz/paperclip/tree/feat/externalize-hermes-adapter)）。

### 分支策略

- `feat/externalize-hermes-adapter` → 核心**没有** `hermes-paperclip-adapter` 依赖，也**没有**内置的 `hermes_local` 注册。通过适配器插件管理器安装 Hermes（`@henkey/hermes-paperclip-adapter` 或 `file:` 路径）。
- 较早的分支可能仍记录内置 Hermes；以本文件作为 externalize 分支的权威版本。

### Hermes（仅插件）

- 通过 **Board → Adapter manager** 注册（与 Droid 相同）。包加载后类型仍为 `hermes_local`。
- UI 使用包中的通用 **config-schema** + **ui-parser.js**——`server/` 或 `ui/` 源码中无 Hermes 导入。
- 可选：在 `~/.paperclip/adapter-plugins.json` 中添加 `file:` 条目，用于适配器仓库的本地开发。

### 本地开发

- Fork 在端口 3101+ 上运行（如果上游实例占用 3100，会自动检测）
- `npx vite build` 在 NTFS 上会挂起——改用 `node node_modules/vite/bin/vite.js build`
- NTFS 上服务器启动需要 30-60 秒——不要立即判定为失败
- 启动前终止所有 paperclip 进程：`pkill -f "paperclip"; pkill -f "tsx.*index.ts"`
- Vite 缓存会在 `rm -rf dist` 后保留——需同时删除：`rm -rf ui/dist ui/node_modules/.vite`

### Fork QoL 补丁（不在上游）

这些是 fork UI 的本地修改。如果重新复制源码，必须重新应用：

1. **stderr_group** — `RunTranscriptView.tsx` 中 MCP 初始化噪音的琥珀色手风琴
2. **tool_group** — 连续非终端工具（write、read、search、browser）的手风琴
3. **Dashboard excerpt** — `LatestRunCard` 去除 markdown，只显示前 3 行/280 字符

### 插件系统

PR #2218（`feat/external-adapter-phase1`）添加了外部适配器支持。参见根 `AGENTS.md` 的完整详情。

- 适配器可以通过 `~/.paperclip/adapter-plugins.json` 作为外部插件加载
- 插件加载器应该**零硬编码**适配器导入——纯动态加载
- `createServerAdapter()` 必须包含**所有**可选字段（尤其是 `detectModel`）
- 内置 UI 适配器可以遮盖外部插件解析器——完全外部化时移除内置版本
- 参考外部适配器：Hermes（`@henkey/hermes-paperclip-adapter` 或 `file:`）和 Droid（npm）
