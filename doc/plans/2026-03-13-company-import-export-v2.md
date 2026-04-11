# 2026-03-13 Company Import / Export V2 Plan

状态：提议实施计划
日期：2026-03-13
受众：产品和工程
包格式方向的替代：
- `doc/plans/2026-02-16-module-system.md` 中描述公司模板为仅 JSON 的部分
- `doc/specs/cliphub-plan.md` 中关于蓝图捆绑形状的假设，其中与 markdown 优先包模型冲突

## 1. Purpose

本文档定义了 Paperclip 公司导入/导出的下一阶段计划。

核心转变是：

- 从 Paperclip 特定的 JSON 优先可移植包转向 markdown 优先包格式
- 让 GitHub 仓库成为一流包源
- 将公司包模型视为现有 Agent Skills 生态系统的扩展，而不是发明单独的技能格式
- 支持公司、团队、代理和技能重用，而不需要中央注册表

规范包格式草案位于：

- `docs/companies/companies-spec.md`

本计划是关于 Paperclip 内部的实施和推广。

适配器范围技能推广细节位于：

- `doc/plans/2026-03-14-adapter-skill-sync-rollout.md`

## 2. Core Concepts

### 2.1 Package Format

包是一个包含以下内容的 GitHub 仓库：

```
company-template/
├── README.md           # 包描述
├── SKILL.md           # 技能定义
├── agents/            # 代理配置
│   ├── ceo.yaml
│   └── engineer.yaml
├── projects/          # 项目配置
│   └── project.yaml
└── settings/          # 公司设置
    └── settings.yaml
```

### 2.2 Package Sources

包可以来自：

- 本地 GitHub 仓库
- ClipHub 注册表（未来）

### 2.3 Package Import

导入包：

1. 指定 GitHub 仓库 URL 或 ClipHub ID
2. Paperclip 克隆仓库
3. 验证包格式
4. 导入公司配置
5. 创建代理和项目

### 2.4 Package Export

导出公司：

1. Paperclip 生成包格式
2. 推送到 GitHub 仓库
3. 返回仓库 URL

## 3. Data Model

### CompanyPackage

```ts
interface CompanyPackage {
  id: string;
  source: 'github' | 'cliphub';
  url: string;
  version: string;
  metadata: {
    name: string;
    description: string;
    author: string;
  };
  agents: AgentConfig[];
  projects: ProjectConfig[];
  settings: CompanySettings;
}
```

### PackageImport

```ts
interface PackageImport {
  id: string;
  companyId: string;
  packageId: string;
  status: 'pending' | 'importing' | 'completed' | 'failed';
  importedAt: Date;
  error?: string;
}
```

## 4. Implementation Plan

### Phase 1: GitHub Package Import

1. 添加 GitHub 仓库克隆逻辑
2. 添加包格式验证
3. 添加代理和项目导入
4. 添加公司设置导入

### Phase 2: GitHub Package Export

1. 添加包生成逻辑
2. 添加 GitHub 推送
3. 添加包版本控制

### Phase 3: ClipHub Integration

1. 添加 ClipHub API 客户端
2. 添加包搜索和发现
3. 添加一键导入

## 5. Security Considerations

1. 包内容需要验证
2. GitHub 凭证需要安全存储
3. 包导入需要授权
