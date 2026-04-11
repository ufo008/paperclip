---
title: 快速开始
summary: 在几分钟内运行 Paperclip
---

在 5 分钟内在本地运行 Paperclip。

## 快速开始（推荐）

```sh
npx paperclipai onboard --yes
```

这将引导你完成设置、配置环境并运行 Paperclip。

如果你已经安装了 Paperclip，重新运行 `onboard` 会保留当前的配置和数据路径。如果你想编辑设置，请使用 `paperclipai configure`。

之后再次启动 Paperclip：

```sh
npx paperclipai run
```

> **注意：** 如果你使用 `npx` 进行设置，请始终使用 `npx paperclipai` 来运行命令。`pnpm paperclipai` 形式仅在克隆的 Paperclip 仓库内有效（请参阅下面的本地开发）。

## 本地开发

适用于为 Paperclip 本身做出贡献的开发人员。前提条件：Node.js 20+ 和 pnpm 9+。

克隆仓库，然后：

```sh
pnpm install
pnpm dev
```

这将在 [http://localhost:3100](http://localhost:3100) 启动 API 服务器和 UI。

无需外部数据库——Paperclip 默认使用嵌入式 PostgreSQL 实例。

在克隆的仓库中工作时，你也可以使用：

```sh
pnpm paperclipai run
```

如果配置缺失，这会自动引导、运行健康检查并进行自动修复，然后启动服务器。

## 下一步

Paperclip 运行后：

1. 在 Web UI 中创建你的第一个公司
2. 定义公司目标
3. 创建一个 CEO 智能体并配置其适配器
4. 用更多智能体构建组织结构图
5. 设置预算并分配初始任务
6. 点击运行——智能体开始发送心跳，公司开始运作

<Card title="核心概念" href="/start/core-concepts">
  了解 Paperclip 背后的关键概念
</Card>
