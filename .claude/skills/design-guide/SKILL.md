---
name: design-guide
description: >
  Paperclip UI 设计系统指南，用于构建一致的、可复用的前端组件。在创建新的 UI 组件、修改现有组件、
  向前端添加页面或功能、设置 UI 元素样式，或需要理解设计语言和约定时使用。涵盖：组件创建、
  设计令牌、字体排版、状态/优先级系统、组合模式，以及 /design-guide 展示页面。
  使用此技能时请同时使用 frontend-design 技能（视觉质量）和 web-design-guidelines 技能（网页最佳实践）。
---

# Paperclip 设计指南

Paperclip 的 UI 是一个专业级的控制平面——密集的、键盘驱动的、默认深色主题。每一个像素都物尽其用。

**始终配合使用：** `frontend-design`（视觉打磨）和 `web-design-guidelines`（网页最佳实践）。

---

## 1. 设计原则

- **密集但可扫描。** 最大信息量，无需点击即可揭示。空白用于分隔，而非填充。
- **键盘优先。** 全局快捷键（Cmd+K、C、[、]）。高级用户很少触碰鼠标。
- **上下文式，而非模态。** 内联编辑优于对话框。下拉菜单优于页面导航。
- **默认深色主题。** 中性灰色（OKLCH），而非纯黑。强调色仅用于状态/优先级。文本是主要的视觉元素。
- **组件驱动。** 优先使用捕获样式约定的可复用组件。在正确的抽象级别构建——不要太细粒化，也不要太整体化。

---

## 2. 技术栈

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS v4** 配合 CSS 变量（OKLCH 色彩空间）
- **shadcn/ui**（new-york 风格，中性基础，启用 CSS 变量）
- **Radix UI** 原语（无障碍、焦点管理）
- **Lucide React** 图标（导航 16px，内联 14px）
- **class-variance-authority**（CVA）用于组件变体
- **clsx + tailwind-merge** 通过 `cn()` 工具函数

配置：`ui/components.json`（别名：`@/components`、`@/components/ui`、`@/lib`、`@/hooks`）

---

## 3. 设计令牌

所有令牌定义为 `ui/src/index.css` 中的 CSS 变量。浅色和深色主题都使用 OKLCH。

### 颜色

使用语义令牌名称，绝不使用原始颜色值：

| 令牌 | 用途 |
|-------|-------|
| `--background` / `--foreground` | 页面背景和主文本 |
| `--card` / `--card-foreground` | 卡片表面 |
| `--primary` / `--primary-foreground` | 主要操作、强调 |
| `--secondary` / `--secondary-foreground` | 次要表面 |
| `--muted` / `--muted-foreground` | 淡化文本、标签 |
| `--accent` / `--accent-foreground` | 悬停状态、激活的导航项 |
| `--destructive` | 破坏性操作 |
| `--border` | 所有边框 |
| `--ring` | 焦点环 |
| `--sidebar-*` | 侧边栏特定变体 |
| `--chart-1` 到 `--chart-5` | 数据可视化 |

### 圆角

单一 `--radius` 变量（0.625rem）及其派生尺寸：

- `rounded-sm` — 小输入框、药丸形
- `rounded-md` — 按钮、输入框、小组件
- `rounded-lg` — 卡片、对话框
- `rounded-xl` — 卡片容器、大组件
- `rounded-full` — 徽章、头像、状态点

### 阴影

最小阴影：`shadow-xs`（轮廓按钮）、`shadow-sm`（卡片）。无重阴影。

---

## 4. 字体排版比例

使用这些确切模式——不要发明新的：

| 模式 | 类名 | 用途 |
|---------|---------|-------|
| 页面标题 | `text-xl font-bold` | 页面顶部 |
| 章节标题 | `text-lg font-semibold` | 主要章节 |
| 章节标题 | `text-sm font-semibold text-muted-foreground uppercase tracking-wide` | 设计指南、侧边栏中的章节标题 |
| 卡片标题 | `text-sm font-medium` 或 `text-sm font-semibold` | 卡片头部、列表项标题 |
| 正文 | `text-sm` | 默认正文文本 |
| 淡化 | `text-sm text-muted-foreground` | 描述、次要文本 |
| 微型标签 | `text-xs text-muted-foreground` | 元数据、时间戳、属性标签 |
| 单色标识符 | `text-xs font-mono text-muted-foreground` | Issue 键（PAP-001）、CSS 变量 |
| 大数字 | `text-2xl font-bold` | 仪表板指标值 |
| 代码/日志 | `font-mono text-xs` | 日志输出、代码片段 |

---

## 5. 状态和优先级系统

### 状态颜色（跨所有实体一致）

定义在 `StatusBadge.tsx` 和 `StatusIcon.tsx` 中：

| 状态 | 颜色 | 实体类型 |
|--------|-------|-------------|
| active, achieved, completed, succeeded, approved, done | 绿色系 | 智能体、目标、issue、审批 |
| running | 青色 | 智能体 |
| paused | 橙色 | 智能体 |
| idle, pending | 黄色 | 智能体、审批 |
| failed, error, rejected, blocked | 红色系 | 运行、智能体、审批、issue |
| archived, planned, backlog, cancelled | 中性灰色 | 各处 |
| todo | 蓝色 | Issue |
| in_progress | 靛蓝色 | Issue |
| in_review | 紫罗兰色 | Issue |

### 优先级图标

定义在 `PriorityIcon.tsx` 中：critical（红色/AlertTriangle）、high（橙色/ArrowUp）、medium（黄色/Minus）、low（蓝色/ArrowDown）。

### 智能体状态点

内联彩色点：running（青色，animate-pulse）、active（绿色）、paused（黄色）、error（红色）、offline（中性）。

---

## 6. 组件层级

三个层级：

1. **shadcn/ui 原语**（`ui/src/components/ui/`）—— Button、Card、Input、Badge、Dialog、Tabs 等。不要直接修改这些；通过组合进行扩展。
2. **自定义复合组件**（`ui/src/components/`）—— StatusBadge、EntityRow、MetricCard 等。这些捕获了 Paperclip 特定的设计语言。
3. **页面组件**（`ui/src/pages/`）—— 将原语和复合组件组合成完整视图。

**参见 [references/component-index.md](references/component-index.md) 获取完整的组件清单和使用指导。**

### 何时创建新组件

在以下情况下创建可复用组件：
- 同一视觉模式出现在 2+ 个地方
- 该模式具有交互行为（状态变化、内联编辑）
- 该模式编码了领域逻辑（状态颜色、优先级图标）

**不要**为以下情况创建组件：
- 特定于单个页面的一次性布局
- 简单的 className 组合（直接使用 Tailwind）
- 没有添加任何语义价值的薄封装

---

## 7. 组合模式

这些模式描述了组件如何协同工作。它们可能不是自己的组件，但必须在整个应用中一致使用。

### 带状态和优先级的实体行

Issue 和类似实体的标准列表项：

```tsx
<EntityRow
  leading={<><StatusIcon status="in_progress" /><PriorityIcon priority="high" /></>}
  identifier="PAP-001"
  title="Implement authentication flow"
  subtitle="Assigned to Agent Alpha"
  trailing={<StatusBadge status="in_progress" />}
  onClick={() => {}}
/>
```

前导槽始终：StatusIcon 在前，然后是 PriorityIcon。尾部槽：StatusBadge 或时间戳。

### 分组列表

按状态头 + 实体行分组的 Issue：

```tsx
<div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-t-md">
  <StatusIcon status="in_progress" />
  <span className="text-sm font-medium">In Progress</span>
  <span className="text-xs text-muted-foreground ml-1">2</span>
</div>
<div className="border border-border rounded-b-md">
  <EntityRow ... />
  <EntityRow ... />
</div>
```

### 属性行

属性面板中的键值对：

```tsx
<div className="flex items-center justify-between py-1.5">
  <span className="text-xs text-muted-foreground">Status</span>
  <StatusBadge status="active" />
</div>
```

标签始终是 `text-xs text-muted-foreground`，值在右侧。用 `space-y-1` 的容器包装。

### 指标卡片网格

仪表板指标在响应式网格中：

```tsx
<div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
  <MetricCard icon={Bot} value={12} label="Active Agents" description="+3 this week" />
  ...
</div>
```

### 进度条（预算）

按阈值变色：绿色（<60%）、黄色（60-85%）、红色（>85%）：

```tsx
<div className="w-full h-2 bg-muted rounded-full overflow-hidden">
  <div className="h-full rounded-full bg-green-400" style={{ width: `${pct}%` }} />
</div>
```

### 评论线程

作者头（姓名 + 时间戳），然后是正文，放在带 `space-y-3` 的边框卡片中。在下方添加评论文本区 + 按钮。

### 成本表

标准 `<table>`，`text-xs`，表头行带 `bg-accent/20`，数字值用 `font-mono`。

### 日志查看器

`bg-neutral-950 rounded-lg p-3 font-mono text-xs` 容器。按级别着色行：默认（foreground）、WARN（yellow-400）、ERROR（red-400）、SYS（blue-300）。流式传输时包含实时指示器点。

---

## 8. 交互模式

### 悬停状态

- 实体行：`hover:bg-accent/50`
- 导航项：`hover:bg-accent/50 hover:text-accent-foreground`
- 激活的导航：`bg-accent text-accent-foreground`

### 焦点

`focus-visible:ring-ring focus-visible:ring-[3px]` —— 标准 Tailwind focus-visible 环。

### 禁用

`disabled:opacity-50 disabled:pointer-events-none`

### 内联编辑

使用 `InlineEditor` 组件——点击文本编辑，Enter 保存，Escape 取消。

### Popover 选择器

StatusIcon 和 PriorityIcon 使用 Radix Popover 进行内联选择。对于任何打开选择器的可点击属性，遵循此模式。

---

## 9. 布局系统

`Layout.tsx` 中定义的三区域布局：

```
┌──────────┬──────────────────────────────┬──────────────────────┐
│ Sidebar  │  Breadcrumb bar              │                      │
│ (w-60)   ├──────────────────────────────┤  Properties panel    │
│          │  Main content (flex-1)       │  (w-80, optional)    │
└──────────┴──────────────────────────────┴──────────────────────┘
```

- 侧边栏：`w-60`，可折叠，包含 CompanySwitcher + SidebarSections
- 属性面板：`w-80`，显示在详情视图，列表上隐藏
- 主内容：可滚动，`flex-1`

---

## 10. /design-guide 页面

**位置：** `ui/src/pages/DesignGuide.tsx`
**路由：** `/design-guide`

这是应用中每个组件和模式的活展示。它是事物外观的真相来源。

### 规则

1. **当你添加新的可复用组件时，你必须将其添加到设计指南页面。** 展示所有变体、尺寸和状态。
2. **当你修改现有组件的 API 时，更新其设计指南部分。**
3. **当你添加新的组合模式时，添加演示它的部分。**
4. 遵循现有结构：`<Section title="...">` 包装器，带 `<SubSection>` 用于分组。
5. 保持章节逻辑顺序：基础（颜色、字体排版）在前，然后是原语，然后是复合组件，然后是模式。

### 添加新章节

```tsx
<Section title="My New Component">
  <SubSection title="Variants">
    {/* Show all variants */}
  </SubSection>
  <SubSection title="Sizes">
    {/* Show all sizes */}
  </SubSection>
  <SubSection title="States">
    {/* Show interactive/disabled states */}
  </SubSection>
</Section>
```

---

## 11. 组件索引

**参见 [references/component-index.md](references/component-index.md) 获取完整的组件清单。**

当你创建新的可复用组件时：
1. 将其添加到组件索引参考文件
2. 将其添加到 /design-guide 页面
3. 遵循现有的命名和文件约定

---

## 12. 文件约定

- **shadcn 原语：** `ui/src/components/ui/{component}.tsx` — 小写、kebab-case
- **自定义组件：** `ui/src/components/{ComponentName}.tsx` — PascalCase
- **页面：** `ui/src/pages/{PageName}.tsx` — PascalCase
- **工具函数：** `ui/src/lib/{name}.ts`
- **Hooks：** `ui/src/hooks/{useName}.ts`
- **API 模块：** `ui/src/api/{entity}.ts`
- **上下文提供者：** `ui/src/context/{Name}Context.tsx`

所有组件使用 `@/lib/utils` 的 `cn()` 进行 className 合并。当组件有多个视觉变体时，所有组件使用 CVA 进行变体定义。

---

## 13. 应避免的常见错误

- 使用原始 hex/rgb 颜色而不是 CSS 变量令牌
- 创建临时字体排版样式而不是使用既定的比例
- 硬编码状态颜色而不是使用 StatusBadge/StatusIcon
- 当存在可复用组件时构建一次性的样式元素
- 添加组件而不更新设计指南页面
- 使用 `shadow-md` 或更重的阴影——保持阴影最小（仅 xs、sm）
- 使用 `rounded-2xl` 或更大——最大是 `rounded-xl`（药丸形除外 `rounded-full`）
- 忘记深色模式——始终使用语义令牌，绝不硬编码浅色/深色值
