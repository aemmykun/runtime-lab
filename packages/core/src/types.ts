/** Providers Runtime Lab can call directly from a browser or from Node. */
export type ProviderId = 'openai' | 'anthropic' | 'openrouter' | 'groq' | 'mistral' | 'gemini' | 'ollama';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** A small JSON Schema subset; see jsonSchema.ts for what is supported. */
export interface JsonSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null' | Array<string>;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  enum?: JsonValue[];
  const?: JsonValue;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
  description?: string;
}

/**
 * A mock tool handler, written in JSON. Runtime Lab never executes user code:
 * tools are answered from these declarative handlers.
 */
export type MockHandler =
  | { type: 'static'; result: JsonValue }
  | { type: 'match'; cases: Array<{ when: Record<string, JsonValue>; result: JsonValue }>; default?: JsonValue }
  | { type: 'error'; message: string };

export interface ToolDefinition {
  name: string;
  description?: string;
  parameters: JsonSchema;
  mock: MockHandler;
  /** Simulated latency for the mock, in ms (default 0). */
  mockLatencyMs?: number;
}

export interface ChatMessageInput {
  role: 'user' | 'assistant';
  content: string;
}


export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/* ---------- Provider adapter contract ---------- */

export interface ToolCall {
  id: string;
  name: string;
  /** Arguments exactly as the model produced them (a JSON string). */
  arguments: string;
}

export type ModelMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolCallId: string; name: string; content: string };

export interface ToolSpec {
  name: string;
  description?: string;
  parameters: JsonSchema;
}

export interface ModelRequest {
  model: string;
  system?: string;
  messages: ModelMessage[];
  tools?: ToolSpec[];
  temperature?: number;
  maxTokens?: number;
}

/** Redacted HTTP exchange, kept for the raw payload view. */
export interface HttpExchange {
  request: { url: string; method: string; headers: Record<string, string>; body: unknown };
  response?: { status: number; body: unknown };
}

export interface ModelResponse {
  text: string;
  toolCalls: ToolCall[];
  usage: TokenUsage;
  stopReason?: string;
  latencyMs: number;
  http: HttpExchange;
}

export interface ProviderAdapter {
  readonly id: ProviderId;
  execute(request: ModelRequest): Promise<ModelResponse>;
}

/* ---------- Run configuration ---------- */

export interface RunConfig {
  provider: ProviderId;
  model: string;
  system?: string;
  messages: ChatMessageInput[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  /** Maximum number of model calls in one run (default 5). */
  maxTurns?: number;
}

/* ---------- Trace model ---------- */

export interface StepError {
  source: 'provider' | 'network' | 'validation' | 'tool' | 'config';
  message: string;
  status?: number;
  code?: string;
  /** Raw (redacted) error payload exactly as received. */
  raw?: unknown;
}

export type TraceStepType = 'model' | 'tool' | 'system' | 'validation';

export interface TraceStep {
  id: string;
  type: TraceStepType;
  startedAt: number;
  endedAt: number;
  input: unknown;
  output: unknown;
  error?: StepError;
  /* Extensions beyond the base interface: */
  label: string;
  latencyMs: number;
  usage?: TokenUsage;
  /** Estimated USD, null when the model has no price entry. */
  costUsd?: number | null;
  http?: HttpExchange;
}

export interface Trace {
  id: string;
  startedAt: number;
  completedAt: number;
  totalLatencyMs: number;
  totalTokens: number;
  /** Estimated USD, null when any model step had no price entry. */
  costUsd: number | null;
  steps: TraceStep[];
  /* Extensions: */
  inputTokens: number;
  outputTokens: number;
  status: 'ok' | 'error';
  output: string;
}

export interface Run {
  schema: 'runtime-lab/run@1';
  id: string;
  createdAt: string;
  title?: string;
  projectId?: string;
  experimentId?: string;
  config: RunConfig;
  trace: Trace;
  notes?: string;
  /** Provenance, e.g. "synthetic fixture". */
  source?: string;
}

export interface Experiment {
  id: string;
  title: string;
  hypothesis: string;
  notes: string;
  /** Run ids (each run owns one trace). */
  traces: string[];
  projectId?: string;
  createdAt?: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
}

export interface PriceEntry {
  /** USD per 1M input tokens. */
  inputPerMTok: number;
  /** USD per 1M output tokens. */
  outputPerMTok: number;
}

export interface PriceTable {
  note: string;
  /** Keyed by `${provider}:${model}` or bare model id. */
  prices: Record<string, PriceEntry>;
}
