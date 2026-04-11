---
title: 编写技能
summary: SKILL.md 格式和最佳实践
---

技能是智能体在其心跳期间可以调用的可重用指令。它们是教智能体如何执行特定任务的 markdown 文件。

## 技能结构

技能是一个包含 `SKILL.md` 文件的目录，带有 YAML frontmatter：

```
skills/
└── my-skill/
    ├── SKILL.md          # 主要技能文档
    └── references/       # 可选的支持文件
        └── examples.md
```

## SKILL.md 格式

```markdown
---
name: my-skill
description: >
  Short description of what this skill does and when to use it.
  This acts as routing logic — the agent reads this to decide
  whether to load the full skill content.
---

# My Skill

Detailed instructions for the agent...
```

### Frontmatter 字段

- **name** — 技能的唯一标识符（kebab-case）
- **description** — 路由描述，告诉智能体何时使用此技能。将其作为决策逻辑编写，而不是营销文案。

## 技能在运行时如何工作

1. 智能体在其上下文中看到技能元数据（name + description）
2. 智能体决定该技能是否与其当前任务相关
3. 如果相关，智能体加载完整的 SKILL.md 内容
4. 智能体按照技能中的指令操作

这保持了基础提示的精简——完整的技能内容仅在需要时加载。

## 最佳实践

- **将描述编写为路由逻辑** — 包含"使用时机"和"不使用时机"指导
- **具体且可操作** — 智能体应该能够明确地遵循技能
- **包含代码示例** — 具体的 API 调用和命令示例比散文更可靠
- **保持技能专注** — 每个关注点一个技能；不要合并不相关的程序
- **谨慎引用文件** — 将支持详情放在 `references/` 中，而不是膨胀主要 SKILL.md

## 技能注入

适配器负责使其智能体运行时能够发现技能。`claude_local` 适配器使用带有符号链接的临时目录和 `--add-dir`。`codex_local` 适配器使用全局技能目录。详情请参阅[创建适配器](/adapters/creating-an-adapter)指南。
