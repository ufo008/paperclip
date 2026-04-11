---
title: 架构
summary: 技术栈概述、请求流和适配器模型
---

Paperclip 是一个包含四个主要层的 monorepo。

## 技术栈概述

```
┌─────────────────────────────────────┐
│  React UI (Vite)                    │
│  Dashboard, org management, tasks     │
├─────────────────────────────────────┤
│  Express.js REST API (Node.js)      │
│  Routes, services, auth, adapters     │
├─────────────────────────────────────┤
│  PostgreSQL (Drizzle ORM)            │
│  Schema, migrations, embedded mode   │
├─────────────────────────────────────┤
│  Adapters                           │
│  Claude Local, Codex Local,          │
│  Process, HTTP                      │
└─────────────────────────────────────┘
```

## 技术栈

| 层级 | 技术 |
|-------|-----------|
| 前端 | React 19, Vite 6, React Router 7, Radix UI, Tailwind CSS 4, TanStack Query |
| 后端 | Node.js 20+, Express.js 5, TypeScript |
| 数据库 | PostgreSQL 17（或嵌入式 PGlite），Drizzle ORM |
| 认证 | Better Auth（会话 + API 密钥）|
| 适配器 | Claude Code CLI, Codex CLI, shell 进程, HTTP webhook |
| 包管理器 | pnpm 9，带 workspaces |

## 仓库结构

```
paperclip/
├── ui/                          # React 前端
│   ├── src/pages/              # 路由页面
│   ├── src/components/         # React 组件
│   ├── src/api/                # API 客户端
│   └── src/context/            # React context providers
│
├── server/                      # Express.js API
│   ├── src/routes/             # REST 端点
│   ├── src/services/           # 业务逻辑
│   ├── src/adapters/           # 智能体执行适配器
│   └── src/middleware/        # 认证、日志
│
├── packages/
│   ├── db/                      # Drizzle schema + 迁移
│   ├── shared/                  # API 类型、常量、验证器
│   ├── adapter-utils/           # 适配器接口和辅助函数
│   └── adapters/
│       ├── claude-local/        # Claude Code 适配器
│       └── codex-local/         # OpenAI Codex 适配器
│
├── skills/                      # 智能体技能
│   └── paperclip/               # 核心 Paperclip 技能（心跳协议）
│
├── cli/                         # CLI 客户端
│   └── src/                     # 设置和控制平面命令
│
└── doc/                         # 内部文档
```

## 请求流

当心跳触发时：

1. **触发**——调度器、手动调用或事件（分配、提及）触发心跳
2. **适配器调用**——服务器调用已配置适配器的 `execute()` 函数
3. **智能体进程**——适配器生成智能体（例如 Claude Code CLI），并带有 Paperclip 环境变量和提示词
4. **智能体工作**——智能体调用 Paperclip 的 REST API 来查看分配、检出任务、执行工作和更新状态
5. **结果捕获**——适配器捕获 stdout、解析使用量/成本数据、提取会话状态
6. **运行记录**——服务器记录运行结果、成本和任何会话状态以供下次心跳使用

## 适配器模型

适配器是 Paperclip 和智能体运行时之间的桥梁。每个适配器是一个包含三个模块的包：

- **服务器模块**——`execute()` 函数，用于生成/调用智能体，加上环境诊断
- **UI 模块**——用于运行查看器的 stdout 解析器，用于智能体创建的配置表单字段
- **CLI 模块**——用于 `paperclipai run --watch` 的终端格式化器

内置适配器：`claude_local`、`codex_local`、`process`、`http`。你可以为任何运行时创建自定义适配器。

## 关键设计决策

- **控制平面，而非执行平面**——Paperclip 编排智能体；它不运行它们
- **公司范围**——所有实体都属于一个公司；严格的数据边界
- **单一 assignee 任务**——原子性检出防止同时在同一任务上工作
- **适配器无关**——任何能调用 HTTP API 的运行时都可以作为智能体
- **默认嵌入式**——使用嵌入式 PostgreSQL 的零配置本地模式
