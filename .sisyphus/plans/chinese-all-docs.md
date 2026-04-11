# Plan: 全部文档中文化

## TL;DR
**Summary**: 创建新分支 `docs/chinese-all`，将整个项目所有文档翻译成中文。
**Deliverables**: 
- 新分支 `docs/chinese-all`
- 根目录 AGENTS.md 中文化
- 6 个子目录 AGENTS.md（中文化）
- doc/ 核心文档中文化
- 其他文档分批中文化
**Effort**: XL (巨大 — 约 100 个文件)
**Parallel**: YES — 多波次并行翻译
**Critical Path**: 创建分支 → 核心文档 → 子目录 AGENTS → doc/ → 其他

## Context
### Original Request (Chinese)
用户要求：
1. 从最新稳定分支创建新分支
2. 实现 AGENTS.md 子目录文档
3. **整个项目所有文档都要用中文（全部文档中文化）**

### Scope Analysis
项目约有 100 个 .md 文件：

| Category | Count | Priority |
|----------|-------|----------|
| 核心项目文档 | ~15 | P0 |
| AGENTS.md (root + 6 subdirs) | 7 | P0 |
| doc/ 核心文档 | ~12 | P0 |
| doc/plans 历史计划 | ~30 | P1 |
| releases/ 发布日志 | ~6 | P2 |
| skills/ 技能文档 | ~7 | P2 |
| packages/*/README | ~8 | P2 |
| 其他 | ~15 | P3 |

## Work Objectives
### Core Objective
将项目所有 .md 文档翻译成中文，保持文档结构和技术准确性。

### Deliverables
- [ ] 创建新分支 `docs/chinese-all`
- [ ] 根目录 AGENTS.md 中文化
- [ ] 6 个子目录 AGENTS.md（中文化）
- [ ] doc/ 核心文档中文化
- [ ] 分批翻译其他文档

### Must Have
- 所有核心文档完整中文翻译
- 技术术语保持一致
- 代码块和命令保持原样

### Must NOT Have
- 翻译不完整就提交
- 遗漏关键配置说明
- 改变文档结构

## Translation Priority

### Phase 1: 核心文档 (P0)
1. `README.md` — 项目主 README
2. `AGENTS.md` (root) — 代理指南
3. `doc/GOAL.md` — 项目目标
4. `doc/PRODUCT.md` — 产品说明
5. `doc/SPEC.md` — 长期产品规格
6. `doc/SPEC-implementation.md` — V1 实现规范
7. `doc/DEVELOPING.md` — 开发指南
8. `doc/DATABASE.md` — 数据库说明
9. `doc/CLI.md` — 命令行文档
10. `doc/DEPLOYMENT-MODES.md` — 部署模式

### Phase 2: AGENTS.md 子目录 (P0)
11. `server/AGENTS.md`
12. `ui/AGENTS.md`
13. `packages/db/AGENTS.md`
14. `packages/shared/AGENTS.md`
15. `packages/adapters/AGENTS.md`
16. `packages/plugins/AGENTS.md`

### Phase 3: doc/ 核心文档 (P1)
17. `doc/DOCKER.md`
18. `doc/PUBLISHING.md`
19. `doc/RELEASING.md`
20. `doc/RELEASE-AUTOMATION-SETUP.md`
21. `doc/CONTRIBUTING.md`
22. `doc/OPENCLAW_ONBOARDING.md`
23. `doc/TASKS.md`
24. `doc/TASKS-mcp.md`
25. `doc/MEMORY-LANDSCAPE.md`
26. `doc/CLIPHUB.md`
27. `doc/AGENTCOMPANIES_SPEC_INVENTORY.md`
28. `doc/UNTRUSTED-PR-REVIEW.md`
29. `doc/README-draft.md`

### Phase 4: doc/spec/ 技术规格 (P1)
30. `doc/spec/ui.md`
31. `doc/spec/agents-runtime.md`
32. `doc/spec/agent-runs.md`

### Phase 5: doc/plugins/ 插件文档 (P2)
33. `doc/plugins/PLUGIN_SPEC.md`
34. `doc/plugins/PLUGIN_AUTHORING_GUIDE.md`
35. `doc/plugins/ideas-from-opencode.md`

### Phase 6: doc/plans/ 历史计划 (P2)
~30 个历史计划文档，按时间排序翻译

### Phase 7: releases/ 发布日志 (P3)
发布日志翻译

### Phase 8: skills/ 技能文档 (P3)
技能文档翻译

### Phase 9: packages/ 子包文档 (P3)
各子包的 README 和 CHANGELOG

## Verification Strategy
- 每个文件翻译后验证完整性
- 技术术语一致性检查
- 代码块保持原样

## Execution Strategy
### Parallel Execution Waves
Wave 1: Phase 1 (核心文档) — 10 个文件并行
Wave 2: Phase 2 (AGENTS.md 子目录) — 6 个文件并行
Wave 3: Phase 3-5 (doc/ 文档) — 多批并行
Wave 4+: 后续阶段

### Agent Dispatch Summary
每波 3-5 个翻译任务并行执行

## TODOs

### 创建分支
- [ ] 0. 从 master 创建新分支 `docs/chinese-all`

  **What to do**: 
  - git checkout master
  - git pull origin master
  - git checkout -b docs/chinese-all

  **Commit**: NO (new branch already created)

### Phase 1: 核心文档

- [x] 1. 翻译 README.md

  **What to do**: 完整翻译 README.md 为中文
  - 项目介绍保持准确
  - 特性列表完整翻译
  - 安装和快速开始命令保持原样
  - 徽章和链接保持原样

  **Must NOT do**: 改变文档结构；修改代码示例

  **References**: 原 README.md 内容

  **Commit**: YES | Message: `docs(i18n): translate README.md to Chinese` | Files: [README.md]

- [x] 2. 翻译 AGENTS.md (root)

  **What to do**: 将根目录 AGENTS.md 完整翻译为中文
  - 保持所有技术规则和约定
  - 准确翻译工程规范
  - 命令保持原样

  **Commit**: YES | Message: `docs(i18n): translate AGENTS.md to Chinese` | Files: [AGENTS.md]

- [x] 3. 翻译 doc/GOAL.md

  **Commit**: YES | Message: `docs(i18n): translate doc/GOAL.md` | Files: [doc/GOAL.md]

- [x] 4. 翻译 doc/PRODUCT.md

  **Commit**: YES | Message: `docs(i18n): translate doc/PRODUCT.md` | Files: [doc/PRODUCT.md]

- [x] 5. 翻译 doc/SPEC.md

  **Commit**: YES | Message: `docs(i18n): translate doc/SPEC.md` | Files: [doc/SPEC.md]

- [x] 6. 翻译 doc/SPEC-implementation.md

  **Commit**: YES | Message: `docs(i18n): translate doc/SPEC-implementation.md` | Files: [doc/SPEC-implementation.md]

- [x] 7. 翻译 doc/DEVELOPING.md

  **Commit**: YES | Message: `docs(i18n): translate doc/DEVELOPING.md` | Files: [doc/DEVELOPING.md]

- [x] 8. 翻译 doc/DATABASE.md

   **Commit**: YES | Message: `docs(i18n): translate doc/DATABASE.md` | Files: [doc/DATABASE.md]

- [x] 9. 翻译 doc/CLI.md

  **Commit**: YES | Message: `docs(i18n): translate doc/CLI.md` | Files: [doc/CLI.md]

- [x] 10. 翻译 doc/DEPLOYMENT-MODES.md

  **Commit**: YES | Message: `docs(i18n): translate doc/DEPLOYMENT-MODES.md` | Files: [doc/DEPLOYMENT-MODES.md]

### Phase 2: AGENTS.md 子目录

- [x] 11. 创建并翻译 server/AGENTS.md

   **Commit**: YES | Message: `docs(i18n): create and translate server/AGENTS.md` | Files: [server/AGENTS.md]

- [x] 12. 创建并翻译 ui/AGENTS.md

   **Commit**: YES | Message: `docs(i18n): create and translate ui/AGENTS.md` | Files: [ui/AGENTS.md]

- [x] 13. 创建并翻译 packages/db/AGENTS.md

   **Commit**: YES | Message: `docs(i18n): create and translate packages/db/AGENTS.md` | Files: [packages/db/AGENTS.md]

- [x] 14. 创建并翻译 packages/shared/AGENTS.md

   **Commit**: YES | Message: `docs(i18n): create and translate packages/shared/AGENTS.md` | Files: [packages/shared/AGENTS.md]

- [x] 15. 创建并翻译 packages/adapters/AGENTS.md

   **Commit**: YES | Message: `docs(i18n): create and translate packages/adapters/AGENTS.md` | Files: [packages/adapters/AGENTS.md]

- [x] 16. 创建并翻译 packages/plugins/AGENTS.md

   **Commit**: YES | Message: `docs(i18n): create and translate packages/plugins/AGENTS.md` | Files: [packages/plugins/AGENTS.md]

### Phase 3: doc/ 核心文档

- [ ] 17. 翻译 doc/DOCKER.md

  **Commit**: YES | Message: `docs(i18n): translate doc/DOCKER.md` | Files: [doc/DOCKER.md]

- [ ] 18. 翻译 doc/PUBLISHING.md

  **Commit**: YES | Message: `docs(i18n): translate doc/PUBLISHING.md` | Files: [doc/PUBLISHING.md]

- [ ] 19. 翻译 doc/RELEASING.md

  **Commit**: YES | Message: `docs(i18n): translate doc/RELEASING.md` | Files: [doc/RELEASING.md]

- [ ] 20. 翻译 doc/RELEASE-AUTOMATION-SETUP.md

  **Commit**: YES | Message: `docs(i18n): translate doc/RELEASE-AUTOMATION-SETUP.md` | Files: [doc/RELEASE-AUTOMATION-SETUP.md]

- [ ] 21. 翻译 doc/CONTRIBUTING.md

  **Commit**: YES | Message: `docs(i18n): translate doc/CONTRIBUTING.md` | Files: [doc/CONTRIBUTING.md]

- [ ] 22. 翻译 doc/OPENCLAW_ONBOARDING.md

  **Commit**: YES | Message: `docs(i18n): translate doc/OPENCLAW_ONBOARDING.md` | Files: [doc/OPENCLAW_ONBOARDING.md]

- [ ] 23. 翻译 doc/TASKS.md

  **Commit**: YES | Message: `docs(i18n): translate doc/TASKS.md` | Files: [doc/TASKS.md]

- [ ] 24. 翻译 doc/TASKS-mcp.md

  **Commit**: YES | Message: `docs(i18n): translate doc/TASKS-mcp.md` | Files: [doc/TASKS-mcp.md]

- [ ] 25. 翻译 doc/MEMORY-LANDSCAPE.md

  **Commit**: YES | Message: `docs(i18n): translate doc/MEMORY-LANDSCAPE.md` | Files: [doc/MEMORY-LANDSCAPE.md]

- [ ] 26. 翻译 doc/CLIPHUB.md

  **Commit**: YES | Message: `docs(i18n): translate doc/CLIPHUB.md` | Files: [doc/CLIPHUB.md]

- [ ] 27. 翻译 doc/AGENTCOMPANIES_SPEC_INVENTORY.md

  **Commit**: YES | Message: `docs(i18n): translate doc/AGENTCOMPANIES_SPEC_INVENTORY.md` | Files: [doc/AGENTCOMPANIES_SPEC_INVENTORY.md]

- [ ] 28. 翻译 doc/UNTRUSTED-PR-REVIEW.md

  **Commit**: YES | Message: `docs(i18n): translate doc/UNTRUSTED-PR-REVIEW.md` | Files: [doc/UNTRUSTED-PR-REVIEW.md]

- [ ] 29. 翻译 doc/README-draft.md

  **Commit**: YES | Message: `docs(i18n): translate doc/README-draft.md` | Files: [doc/README-draft.md]

### Phase 4: doc/spec/ 技术规格

- [ ] 30. 翻译 doc/spec/ui.md

  **Commit**: YES | Message: `docs(i18n): translate doc/spec/ui.md` | Files: [doc/spec/ui.md]

- [ ] 31. 翻译 doc/spec/agents-runtime.md

  **Commit**: YES | Message: `docs(i18n): translate doc/spec/agents-runtime.md` | Files: [doc/spec/agents-runtime.md]

- [ ] 32. 翻译 doc/spec/agent-runs.md

  **Commit**: YES | Message: `docs(i18n): translate doc/spec/agent-runs.md` | Files: [doc/spec/agent-runs.md]

### Phase 5: doc/plugins/ 插件文档

- [ ] 33. 翻译 doc/plugins/PLUGIN_SPEC.md

  **Commit**: YES | Message: `docs(i18n): translate doc/plugins/PLUGIN_SPEC.md` | Files: [doc/plugins/PLUGIN_SPEC.md]

- [ ] 34. 翻译 doc/plugins/PLUGIN_AUTHORING_GUIDE.md

  **Commit**: YES | Message: `docs(i18n): translate doc/plugins/PLUGIN_AUTHORING_GUIDE.md` | Files: [doc/plugins/PLUGIN_AUTHORING_GUIDE.md]

- [ ] 35. 翻译 doc/plugins/ideas-from-opencode.md

  **Commit**: YES | Message: `docs(i18n): translate doc/plugins/ideas-from-opencode.md` | Files: [doc/plugins/ideas-from-opencode.md]

### Phase 6: doc/plans/ 历史计划
(约 30 个历史计划文档，按批次翻译)

### Phase 7: releases/ 发布日志
(发布日志翻译)

### Phase 8: skills/ 技能文档
(技能文档翻译)

### Phase 9: packages/ 子包文档
(各子包的 README 和 CHANGELOG)

## Final Verification
- [ ] F1. 所有 Phase 1-5 核心文档翻译完成
- [ ] F2. Phase 6-9 按批次完成
- [ ] F3. 术语一致性检查

## Commit Strategy
每完成一批提交一次：
```
docs(i18n): translate core docs batch 1 (Phase 1)
docs(i18n): translate AGENTS.md subdirectories (Phase 2)
docs(i18n): translate doc/ core docs (Phase 3-5)
...
```

## Success Criteria
```
- [ ] 新分支 docs/chinese-all 创建成功
- [ ] 所有约 100 个 .md 文件翻译完成
- [ ] 技术术语翻译一致
- [ ] 代码块和命令保持原样
- [ ] 每个文件有完整的中文内容
- [ ] 提交历史清晰记录翻译过程
```
