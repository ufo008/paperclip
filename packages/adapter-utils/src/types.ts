// ---------------------------------------------------------------------------
// 最小适配器接口（无 drizzle 依赖）
// ---------------------------------------------------------------------------

export interface AdapterAgent {
  id: string;
  companyId: string;
  name: string;
  adapterType: string | null;
  adapterConfig: unknown;
}

export interface AdapterRuntime {
  /**
   * 旧版单一会话 ID 视图。建议使用 sessionParams + sessionDisplayId。
   */
  sessionId: string | null;
  sessionParams: Record<string, unknown> | null;
  sessionDisplayId: string | null;
  taskKey: string | null;
}

// ---------------------------------------------------------------------------
// 执行类型（从 server/src/adapters/types.ts 移出）
// ---------------------------------------------------------------------------

export interface UsageSummary {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}

export type AdapterBillingType =
  | "api"
  | "subscription"
  | "metered_api"
  | "subscription_included"
  | "subscription_overage"
  | "credits"
  | "fixed"
  | "unknown";

export interface AdapterRuntimeServiceReport {
  id?: string | null;
  projectId?: string | null;
  projectWorkspaceId?: string | null;
  issueId?: string | null;
  scopeType?: "project_workspace" | "execution_workspace" | "run" | "agent";
  scopeId?: string | null;
  serviceName: string;
  status?: "starting" | "running" | "stopped" | "failed";
  lifecycle?: "shared" | "ephemeral";
  reuseKey?: string | null;
  command?: string | null;
  cwd?: string | null;
  port?: number | null;
  url?: string | null;
  providerRef?: string | null;
  ownerAgentId?: string | null;
  stopPolicy?: Record<string, unknown> | null;
  healthStatus?: "unknown" | "healthy" | "unhealthy";
}

export interface AdapterExecutionResult {
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  errorMessage?: string | null;
  errorCode?: string | null;
  errorMeta?: Record<string, unknown>;
  usage?: UsageSummary;
  /**
   * 旧版单一会话 ID 输出。建议使用 sessionParams + sessionDisplayId。
   */
  sessionId?: string | null;
  sessionParams?: Record<string, unknown> | null;
  sessionDisplayId?: string | null;
  provider?: string | null;
  biller?: string | null;
  model?: string | null;
  billingType?: AdapterBillingType | null;
  costUsd?: number | null;
  resultJson?: Record<string, unknown> | null;
  runtimeServices?: AdapterRuntimeServiceReport[];
  summary?: string | null;
  clearSession?: boolean;
  question?: {
    prompt: string;
    choices: Array<{
      key: string;
      label: string;
      description?: string;
    }>;
  } | null;
}

export interface AdapterSessionCodec {
  deserialize(raw: unknown): Record<string, unknown> | null;
  serialize(params: Record<string, unknown> | null): Record<string, unknown> | null;
  getDisplayId?: (params: Record<string, unknown> | null) => string | null;
}

export interface AdapterInvocationMeta {
  adapterType: string;
  command: string;
  cwd?: string;
  commandArgs?: string[];
  commandNotes?: string[];
  env?: Record<string, string>;
  prompt?: string;
  promptMetrics?: Record<string, number>;
  context?: Record<string, unknown>;
}

export interface AdapterExecutionContext {
  runId: string;
  agent: AdapterAgent;
  runtime: AdapterRuntime;
  config: Record<string, unknown>;
  context: Record<string, unknown>;
  onLog: (stream: "stdout" | "stderr", chunk: string) => Promise<void>;
  onMeta?: (meta: AdapterInvocationMeta) => Promise<void>;
  onSpawn?: (meta: { pid: number; processGroupId: number | null; startedAt: string }) => Promise<void>;
  authToken?: string;
}

export interface AdapterModel {
  id: string;
  label: string;
}

export type AdapterEnvironmentCheckLevel = "info" | "warn" | "error";

export interface AdapterEnvironmentCheck {
  code: string;
  level: AdapterEnvironmentCheckLevel;
  message: string;
  detail?: string | null;
  hint?: string | null;
}

export type AdapterEnvironmentTestStatus = "pass" | "warn" | "fail";

export interface AdapterEnvironmentTestResult {
  adapterType: string;
  status: AdapterEnvironmentTestStatus;
  checks: AdapterEnvironmentCheck[];
  testedAt: string;
}

export type AdapterSkillSyncMode = "unsupported" | "persistent" | "ephemeral";

export type AdapterSkillState =
  | "available"
  | "configured"
  | "installed"
  | "missing"
  | "stale"
  | "external";

export type AdapterSkillOrigin =
  | "company_managed"
  | "paperclip_required"
  | "user_installed"
  | "external_unknown";

export interface AdapterSkillEntry {
  key: string;
  runtimeName: string | null;
  desired: boolean;
  managed: boolean;
  required?: boolean;
  requiredReason?: string | null;
  state: AdapterSkillState;
  origin?: AdapterSkillOrigin;
  originLabel?: string | null;
  locationLabel?: string | null;
  readOnly?: boolean;
  sourcePath?: string | null;
  targetPath?: string | null;
  detail?: string | null;
}

export interface AdapterSkillSnapshot {
  adapterType: string;
  supported: boolean;
  mode: AdapterSkillSyncMode;
  desiredSkills: string[];
  entries: AdapterSkillEntry[];
  warnings: string[];
}

export interface AdapterSkillContext {
  agentId: string;
  companyId: string;
  adapterType: string;
  config: Record<string, unknown>;
}

export interface AdapterEnvironmentTestContext {
  companyId: string;
  adapterType: string;
  config: Record<string, unknown>;
  deployment?: {
    mode?: "local_trusted" | "authenticated";
    exposure?: "private" | "public";
    bindHost?: string | null;
    allowedHostnames?: string[];
  };
}

/** onHireApproved 适配器生命周期 hook 的载荷（例如 join-request 或 hire_agent 审批）。 */
export interface HireApprovedPayload {
  companyId: string;
  agentId: string;
  agentName: string;
  adapterType: string;
  /** "join_request" | "approval" */
  source: "join_request" | "approval";
  sourceId: string;
  approvedAt: string;
  /** 云适配器向用户显示的标准操作员界面消息。 */
  message: string;
}

/** onHireApproved hook 的结果；失败对该审批流程非致命。 */
export interface HireApprovedHookResult {
  ok: boolean;
  error?: string;
  detail?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// 配额窗口类型 — 用于能报告提供商配额/速率限制状态的适配器
// ---------------------------------------------------------------------------

/** 提供商配额 API 返回的单个速率限制或使用量窗口 */
export interface QuotaWindow {
  /** 人工标签，例如 "5h"、"7d"、"Sonnet 7d"、"Credits" */
  label: string;
  /** 已消耗窗口的百分比（0-100），未报告时为 null */
  usedPercent: number | null;
  /** 此窗口重置的 ISO 时间戳，未报告时为 null */
  resetsAt: string | null;
  /** 信用风格窗口的免费格式值标签，例如 "$4.20 remaining" */
  valueLabel: string | null;
  /** 可选的 Supporting 文本，例如重置详情或提供商特定备注 */
  detail?: string | null;
}

/** getQuotaWindows() 一个提供商的结果 */
export interface ProviderQuotaResult {
  /** 提供商 slug，例如 "anthropic"、"openai" */
  provider: string;
  /** 提供商报告配额数据来源时的源标签 */
  source?: string | null;
  /** 获取成功且窗口已填充时为 true */
  ok: boolean;
  /** ok 为 false 时的错误消息 */
  error?: string;
  windows: QuotaWindow[];
}

// ---------------------------------------------------------------------------
// 适配器配置模式 — 外部适配器的声明式 UI 配置
// ---------------------------------------------------------------------------

export interface ConfigFieldOption {
  label: string;
  value: string;
  /** 用于对选项进行分组的可选组键（例如提供商名称） */
  group?: string;
}

export interface ConfigFieldSchema {
  key: string;
  label: string;
  type: "text" | "select" | "toggle" | "number" | "textarea" | "combobox";
  options?: ConfigFieldOption[];
  default?: unknown;
  hint?: string;
  required?: boolean;
  group?: string;
  /** 可选元数据 — 不渲染，但可供自定义 UI 逻辑使用 */
  meta?: Record<string, unknown>;
}

export interface AdapterConfigSchema {
  fields: ConfigFieldSchema[];
}

export interface ServerAdapterModule {
  type: string;
  execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult>;
  testEnvironment(ctx: AdapterEnvironmentTestContext): Promise<AdapterEnvironmentTestResult>;
  listSkills?: (ctx: AdapterSkillContext) => Promise<AdapterSkillSnapshot>;
  syncSkills?: (ctx: AdapterSkillContext, desiredSkills: string[]) => Promise<AdapterSkillSnapshot>;
  sessionCodec?: AdapterSessionCodec;
  sessionManagement?: import("./session-compaction.js").AdapterSessionManagement;
  supportsLocalAgentJwt?: boolean;
  models?: AdapterModel[];
  listModels?: () => Promise<AdapterModel[]>;
  agentConfigurationDoc?: string;
  /**
   * 可选：代理被批准/雇用时的生命周期 hook（join-request 或 hire_agent 审批）。
   * adapterConfig 是代理的适配器配置，以便适配器可以向配置的 URL 发送回调等。
   */
  onHireApproved?: (
    payload: HireApprovedPayload,
    adapterConfig: Record<string, unknown>,
  ) => Promise<HireApprovedHookResult>;
  /**
   * 可选：获取此适配器的实时提供商配额/速率限制窗口。
   * 返回 ProviderQuotaResult，以便服务器可以在不知道提供商特定凭证路径或 API 形状的情况下跨适配器聚合。
   */
  getQuotaWindows?: () => Promise<ProviderQuotaResult>;
  /**
   * 可选：从本地配置文件检测当前配置的模型。
   * 返回检测到的模型/提供商和配置源，如果适配器不支持检测或未找到配置则返回 null。
   */
  detectModel?: () => Promise<{ model: string; provider: string; source: string; candidates?: string[] } | null>;
  /**
   * 可选：返回声明式配置模式，以便 UI 可以渲染
   * 适配器特定的表单字段，而无需发布 React 组件。
   * 动态选项（例如扫描 profiles 目录）应在
   * 此方法内解析 — 调用方接收完全填充的模式。
   */
  getConfigSchema?: () => Promise<AdapterConfigSchema> | AdapterConfigSchema;

  // ---------------------------------------------------------------------------
  // Adapter capability flags
  //
  // These allow adapter plugins to declare what "local" capabilities they
  // support, replacing hardcoded type lists in the server and UI.
  // All flags are optional — when undefined, the server falls back to
  // legacy hardcoded lists for built-in adapters.
  // ---------------------------------------------------------------------------

  /**
   * Adapter supports managed instructions bundle (AGENTS.md files).
   * When true, the server uses instructionsPathKey (default "instructionsFilePath")
   * to resolve the instructions config key, and the UI shows the bundle editor.
   * Built-in local adapters default to true; external plugins must opt in.
   */
  supportsInstructionsBundle?: boolean;

  /**
   * The adapterConfig key that holds the instructions file path.
   * Defaults to "instructionsFilePath" when supportsInstructionsBundle is true.
   */
  instructionsPathKey?: string;

  /**
   * Adapter needs runtime skill entries materialized (written to disk)
   * before being passed via config. Used by adapters that scan a directory
   * rather than reading config.paperclipRuntimeSkills.
   */
  requiresMaterializedRuntimeSkills?: boolean;
}

// ---------------------------------------------------------------------------
// UI 类型（从 ui/src/adapters/types.ts 移出）
// ---------------------------------------------------------------------------

export type TranscriptEntry =
  | { kind: "assistant"; ts: string; text: string; delta?: boolean }
  | { kind: "thinking"; ts: string; text: string; delta?: boolean }
  | { kind: "user"; ts: string; text: string }
  | { kind: "tool_call"; ts: string; name: string; input: unknown; toolUseId?: string }
  | { kind: "tool_result"; ts: string; toolUseId: string; toolName?: string; content: string; isError: boolean }
  | { kind: "init"; ts: string; model: string; sessionId: string }
  | { kind: "result"; ts: string; text: string; inputTokens: number; outputTokens: number; cachedTokens: number; costUsd: number; subtype: string; isError: boolean; errors: string[] }
  | { kind: "stderr"; ts: string; text: string }
  | { kind: "system"; ts: string; text: string }
  | { kind: "stdout"; ts: string; text: string }
  | { kind: "diff"; ts: string; changeType: "add" | "remove" | "context" | "hunk" | "file_header" | "truncation"; text: string };

export type StdoutLineParser = (line: string, ts: string) => TranscriptEntry[];

// ---------------------------------------------------------------------------
// CLI 类型（从 cli/src/adapters/types.ts 移出）
// ---------------------------------------------------------------------------

export interface CLIAdapterModule {
  type: string;
  formatStdoutEvent: (line: string, debug: boolean) => void;
}

// ---------------------------------------------------------------------------
// UI 配置表单值（从 ui/src/components/AgentConfigForm.tsx 移出）
// ---------------------------------------------------------------------------

export interface CreateConfigValues {
  adapterType: string;
  cwd: string;
  instructionsFilePath?: string;
  promptTemplate: string;
  model: string;
  thinkingEffort: string;
  chrome: boolean;
  dangerouslySkipPermissions: boolean;
  search: boolean;
  fastMode: boolean;
  dangerouslyBypassSandbox: boolean;
  command: string;
  args: string;
  extraArgs: string;
  envVars: string;
  envBindings: Record<string, unknown>;
  url: string;
  bootstrapPrompt: string;
  payloadTemplateJson?: string;
  workspaceStrategyType?: string;
  workspaceBaseRef?: string;
  workspaceBranchTemplate?: string;
  worktreeParentDir?: string;
  runtimeServicesJson?: string;
  maxTurnsPerRun: number;
  heartbeatEnabled: boolean;
  intervalSec: number;
  /** 由模式驱动的配置字段填充的任意键值对。 */
  adapterSchemaValues?: Record<string, unknown>;
}
