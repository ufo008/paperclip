# Agent Companies 规范清单

本文档索引了 Paperclip 代码库中涉及 [Agent Companies 规范](docs/companies/companies-spec.md)（`agentcompanies/v1-draft`）的所有部分。

适用场景：

1. **更新规范** — 了解哪些实现代码必须同步变更。
2. **修改涉及规范的代码** — 快速查找所有相关文件。
3. **保持一致** — 审查实现是否符合规范。

---

## 1. 规范与设计文档

| 文件 | 职责 |
|---|---|
| `docs/companies/companies-spec.md` | **规范性规范** — 定义 markdown优先的包格式（COMPANY.md、TEAM.md、AGENTS.md、PROJECT.md、TASK.md、SKILL.md）、保留文件、frontmatter schema 和供应商扩展约定（`.paperclip.yaml`）。 |
| `doc/plans/2026-03-13-company-import-export-v2.md` | markdown优先包模型切换的实施计划 — 阶段、API 变更、UI 计划和推出策略。 |
| `doc/SPEC-implementation.md` | V1 实施契约；引用可移植性系统和 `.paperclip.yaml` sidecar 格式。 |
| `docs/specs/cliphub-plan.md` | 早期 blueprint 包计划；部分被 markdown优先规范取代（已在 v2 计划中注明）。 |
| `doc/plans/2026-02-16-module-system.md` | 模块系统计划；JSON-only 公司模板部分已被 markdown优先模型取代。 |
| `doc/plans/2026-03-14-skills-ui-product-plan.md` | Skills UI 计划；引用可移植 skill 文件和 `.paperclip.yaml`。 |
| `doc/plans/2026-03-14-adapter-skill-sync-rollout.md` | Adapter skill 同步推出；与 v2 导入/导出计划的配套计划。 |

## 2. 共享类型与验证器

这些定义了 server、CLI 和 UI 之间的契约。

| 文件 | 定义内容 |
|---|---|
| `packages/shared/src/types/company-portability.ts` | TypeScript 接口：`CompanyPortabilityManifest`、`CompanyPortabilityFileEntry`、`CompanyPortabilityEnvInput`、导出/导入/预览请求和结果类型、agents、skills、projects、issues、recurring routines、companies 的 manifest 条目类型。 |
| `packages/shared/src/validators/company-portability.ts` | 所有可移植性请求/响应形状的 Zod schema — 由 server 路由和 CLI 共同使用。 |
| `packages/shared/src/types/index.ts` | 重新导出可移植性类型。 |
| `packages/shared/src/validators/index.ts` | 重新导出可移植性验证器。 |

## 3. Server — Services

| 文件 | 职责 |
|---|---|
| `server/src/services/company-portability.ts` | **核心可移植性服务。** 导出（manifest 生成、markdown 文件输出、`.paperclip.yaml` sidecars）、导入（graph 解析、冲突处理、实体创建）、预览（计划操作摘要）。处理 skill 密钥派生、recurring task ↔ routine 映射、legacy recurrence 迁移和包 README 生成。引用 `agentcompanies/v1` 版本字符串。 |
| `server/src/services/routines.ts` | Paperclip routine 运行时服务。可移植性现在将 routines 导出为 recurring `TASK.md` 条目，并通过此服务导入 recurring tasks。 |
| `server/src/services/company-export-readme.ts` | 为导出的公司包生成 `README.md` 和 Mermaid 组织图。 |
| `server/src/services/index.ts` | 重新导出 `companyPortabilityService`。 |

## 4. Server — Routes

| 文件 | 端点 |
|---|---|
| `server/src/routes/companies.ts` | `POST /api/companies/:companyId/export` — legacy 导出 bundle<br>`POST /api/companies/:companyId/exports/preview` — 导出预览<br>`POST /api/companies/:companyId/exports` — 导出包<br>`POST /api/companies/import/preview` — 导入预览<br>`POST /api/companies/import` — 执行导入 |

路由注册在 `server/src/app.ts` 中，通过 `companyRoutes(db, storage)`。

## 5. Server — Tests

| 文件 | 覆盖范围 |
|---|---|
| `server/src/__tests__/company-portability.test.ts` | 可移植性服务的单元测试（导出、导入、预览、manifest 形状、`agentcompanies/v1` 版本）。 |
| `server/src/__tests__/company-portability-routes.test.ts` | 可移植性 HTTP 端点的集成测试。 |

## 6. CLI

| 文件 | 命令 |
|---|---|
| `cli/src/commands/client/company.ts` | `company export` — 将公司包导出到磁盘（flags: `--out`, `--include`, `--projects`, `--issues`, `--projectIssues`）。<br>`company import <fromPathOrUrl>` — 从文件或文件夹导入公司包（flags: positional source path/URL 或 GitHub shorthand, `--include`, `--target`, `--companyId`, `--newCompanyName`, `--agents`, `--collision`, `--ref`, `--dryRun`）。<br>读取/写入可移植文件条目并处理 `.paperclip.yaml` 过滤。 |

## 7. UI — Pages

| 文件 | 职责 |
|---|---|
| `ui/src/pages/CompanyExport.tsx` | 导出 UI：预览、manifest 显示、文件树可视化、ZIP 归档创建和下载。根据选择过滤 `.paperclip.yaml`。在编辑器中显示 manifest 和 README。 |
| `ui/src/pages/CompanyImport.tsx` | 导入 UI：源输入（上传/文件夹/GitHub URL/通用 URL）、ZIP 读取、带有依赖树的预览窗格、实体选择复选框、信任/许可警告、secrets 要求、冲突策略、adapter 配置。 |

## 8. UI — Components

| 文件 | 职责 |
|---|---|
| `ui/src/components/PackageFileTree.tsx` | 可重用的文件树组件，适用于导入和导出。从 `CompanyPortabilityFileEntry` 项目构建树，解析 frontmatter，显示操作指示符（create/update/skip），并映射 frontmatter 字段标签。 |

## 9. UI — Libraries

| 文件 | 职责 |
|---|---|
| `ui/src/lib/portable-files.ts` | 可移植文件条目的辅助函数：`getPortableFileText`、`getPortableFileDataUrl`、`getPortableFileContentType`、`isPortableImageFile`。 |
| `ui/src/lib/zip.ts` | ZIP 归档创建（`createZipArchive`）和读取（`readZipArchive`）— 为公司包从头实现 ZIP 格式。CRC32、DOS 日期/时间编码。 |
| `ui/src/lib/zip.test.ts` | ZIP 工具的测试；练习可移植性文件条目和 `.paperclip.yaml` 内容的往返。 |

## 10. UI — API Client

| 文件 | 函数 |
|---|---|
| `ui/src/api/companies.ts` | `companiesApi.exportBundle`、`companiesApi.exportPreview`、`companiesApi.exportPackage`、`companiesApi.importPreview`、`companiesApi.importBundle` — 可移植性端点的类型化 fetch 包装器。 |

## 11. Skills & Agent Instructions

| 文件 | 相关性 |
|---|---|
| `skills/paperclip/references/company-skills.md` | 公司 skill 库工作流的参考文档 — 安装、检查、更新、分配。Skill 包是 agent companies 规范的子集。 |
| `server/src/services/company-skills.ts` | 公司 skill 管理服务 — 处理基于 SKILL.md 的导入和公司级 skill 库。 |
| `server/src/services/agent-instructions.ts` | Agent 指令服务 — 解析用于 agent 指令加载的 AGENTS.md 路径。 |

## 12. 规范概念的快速交叉引用

| 规范概念 | 主要实现文件 |
|---|---|
| `COMPANY.md` frontmatter & body | `company-portability.ts`（导出 emitter + 导入 parser） |
| `AGENTS.md` frontmatter & body | `company-portability.ts`、`agent-instructions.ts` |
| `PROJECT.md` frontmatter & body | `company-portability.ts` |
| `TASK.md` frontmatter & body | `company-portability.ts` |
| `SKILL.md` 包 | `company-portability.ts`、`company-skills.ts` |
| `.paperclip.yaml` 供应商 sidecar | `company-portability.ts`、`routines.ts`、`CompanyExport.tsx`、`company.ts`（CLI） |
| `manifest.json` | `company-portability.ts`（生成）、共享类型（schema） |
| ZIP 包格式 | `zip.ts`（UI）、`company.ts`（CLI 文件 I/O） |
| 冲突解决 | `company-portability.ts`（server）、`CompanyImport.tsx`（UI） |
| Env/secrets 声明 | 共享类型（`CompanyPortabilityEnvInput`）、`CompanyImport.tsx`（UI） |
| README + 组织图 | `company-export-readme.ts` |

（文件结束 — 共 115 行）