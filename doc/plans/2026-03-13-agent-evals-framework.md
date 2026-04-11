# Agent Evals Framework Plan

日期：2026-03-13

## Context

我们需要对 Paperclip 实际交付的东西进行 eval：

- 适配器配置产生的代理行为
- 提示模板和引导提示
- 技能集和技能指令
- 模型选择
- 影响结果和成本的运行时策略选择

我们**主要不**需要微调管道。
我们需要一个回归框架，可以回答：

- 如果我们更改提示或技能，代理仍然做正确的事情吗？
- 如果我们切换模型，什么变好了、变坏了或变贵了？
- 如果我们优化 token，我们是否保留了任务结果？
- 我们可以从真实的 Paperclip 使用中随时间增长测试套件吗？

本计划基于：

- `doc/GOAL.md`
- `doc/PRODUCT.md`
- `doc/SPEC-implementation.md`
- `docs/agents-runtime.md`
- `doc/plans/2026-03-13-TOKEN-OPTIMIZATION-PLAN.md`
- 讨论 #449: https://github.com/paperclipai/paperclip/discussions/449

## Core Concepts

### Eval

一个 eval 是一个测试，验证代理行为：

```ts
interface Eval {
  id: string;
  name: string;
  description: string;
  prompt: string;
  expectedBehavior: string;
  metrics: EvalMetric[];
}
```

### EvalMetric

```ts
interface EvalMetric {
  name: string;
  type: 'boolean' | 'numeric' | 'categorical';
  threshold: number;
}
```

### EvalResult

```ts
interface EvalResult {
  evalId: string;
  runAt: Date;
  passed: boolean;
  metrics: Record<string, number>;
  output: string;
  cost: number;
}
```

## Proposed Implementation

### Eval Runner

```ts
class EvalRunner {
  async runEval(eval: Eval, config: RunConfig): Promise<EvalResult>;
  async runSuite(suite: EvalSuite): Promise<EvalResult[]>;
}
```

### Eval Suite

```ts
interface EvalSuite {
  id: string;
  name: string;
  evals: Eval[];
}
```

### Eval Storage

```ts
interface EvalStore {
  saveResult(result: EvalResult): Promise<void>;
  getResults(suiteId: string): Promise<EvalResult[]>;
  getMetrics(suiteId: string): Promise<MetricSummary>;
}
```

## Implementation Plan

### Phase 1: Core Eval Infrastructure

1. 添加 Eval 数据模型
2. 创建 EvalRunner 类
3. 实现 Eval 存储

### Phase 2: Basic Eval Suite

1. 添加基本代理行为 eval
2. 添加提示模板 eval
3. 添加技能指令 eval

### Phase 3: Regression Testing

1. 添加回归测试工作流程
2. 在 PR 中运行 eval
3. 发布 eval 报告

### Phase 4: Continuous Improvement

1. 从真实使用中收集 eval
2. 添加新 eval 到套件
3. 发布 eval 仪表板

## Open Questions

1. 如何选择 eval 阈值？
2. 如何处理 eval 失败？
3. 如何衡量代理行为变化？
