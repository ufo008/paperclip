# Billing Ledger and Reporting

## Context

Paperclip 当前将模型支出存储在 `cost_events` 中，将操作运行状态存储在 `heartbeat_runs` 中。
这种分离没问题，但当前报告代码试图通过混合两个表来推断账单语义：

- `cost_events` 知道 provider、model、tokens 和 dollars
- `heartbeat_runs.usage_json` 知道一些每运行账单元数据
- `heartbeat_runs.usage_json` 当前没有携带足够的标准化账单维度来支持诚实提供商级别的报告

一旦公司使用多个 provider、多个账单渠道或多个账单模式，这就会变得不正确。

示例：

- 直接 OpenAI API 使用
- Claude 订阅使用，零边际 dollars
- 订阅超额，包含 dollars 和 tokens
- OpenRouter 账单，其中计费者是 OpenRouter 但上游 provider 是 Anthropic 或 OpenAI

系统需要支持：

- 美元报告
- token 报告
- 订阅包含的使用量
- 订阅超额
- 直接计量 API 使用
- 未来聚合商账单如 OpenRouter

## Product Decision

`cost_events` 成为报告的规范账单和使用量账本。

`heartbeat_runs` 保持作为操作执行日志。它可以保留用于调试和记录的镜像账单元数据，但报告不能从 `heartbeat_runs.usage_json` 重建账单语义。

## Decision: One Ledger Or Two

我们不需要两个表来解决当前 PR 的问题。
对于请求级推理报告，如果 `cost_events` 携带正确的维度，`cost_events` 就足够了：

- 上游 provider
- 计费者
- 账单类型
- model
- token 字段
- 账单金额

这就是为什么第一个实施阶段扩展 `cost_events` 而不是立即引入第二个表。

但是，如果 Paperclip 需要核算聚合商和托管 AI 平台的完整账单表面，那么仅 `cost_events` 是不够的。

## CostEvent Extensions

### Required Fields

当前 `cost_events` 表应该添加：

| Column | Type | Description |
|--------|------|-------------|
| upstream_provider | text | Original provider (e.g., 'anthropic', 'openai') |
| biller | text | Who is billing (e.g., 'openrouter', 'openai') |
| billing_type | text | 'subscription_included', 'subscription_overage', 'metered' |
| model | text | Normalized model identifier |

### Reporting Dimensions

报告应支持：

- 按 provider 分组
- 按 biller 分组
- 按 billing_type 分组
- 按 model 分组
- 组合维度

## Service Changes

### CostService

```ts
interface CostReport {
  companyId: string;
  period: { start: Date; end: Date };
  totalBilledCents: number;
  byProvider: Record<string, number>;
  byBiller: Record<string, number>;
  byBillingType: Record<string, number>;
  byModel: Record<string, number>;
  events: CostEvent[];
}
```

### Cost Ingestion

成本事件提取应：

- 规范化 provider 和 biller
- 分类账单类型
- 保留原始 provider 和 biller 用于调试

## Subscription Usage Separation

### Subscription Included

对于订阅包含的使用量：

- 记录在 cost_events 中
- 标记为 `billing_type: 'subscription_included'`
- 在报告中单独显示
- 不计入金钱预算

### Subscription Overage

对于订阅超额：

- 记录在 cost_events 中
- 标记为 `billing_type: 'subscription_overage'`
- 在报告中单独显示
- 计入金钱预算

### Metered API

对于计量 API：

- 记录在 cost_events 中
- 标记为 `billing_type: 'metered'`
- 在报告中单独显示
- 计入金钱预算

## Reporting Requirements

### Dashboard

- 显示当前期间的总支出
- 显示按 provider 分组的支出
- 显示订阅 vs 计量的细分
- 显示预算状态

### /costs Page

- 详细成本报告
- 可过滤 by provider, biller, billing_type, model
- 可按时间范围筛选
- 导出功能

### Agent Detail

- 显示代理的总支出
- 显示按模型分组的支出

### Project Detail

- 显示项目的总支出
- 显示按代理分组的支出

## Open Questions

1. 如何处理订阅包含使用的token？
2. 如何跨多个账期聚合使用量？
3. 如何支持未来的聚合商？
4. 如何处理退款和信用？

## Security Considerations

1. 成本数据是敏感的业务数据
2. 只有 Board 成员可以查看详细成本
3. 成本数据应被审计
