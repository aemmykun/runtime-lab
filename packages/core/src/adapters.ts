import { PROVIDERS } from './providers.js';
import type { FetchLike } from './network.js';
import { redactDeep, redactHeaders } from './redact.js';
import type { HttpExchange, ModelMessage, ModelRequest, ModelResponse, ProviderAdapter, ProviderId, ToolCall } from './types.js';

export interface AdapterOptions {
  apiKey?: string;
  fetch: FetchLike;
  /** Override the base URL (e.g. a different Ollama host). Must still be allowed by the fetch guard. */
  baseUrl?: string;
  /** Monotonic clock in ms, injectable for tests. */
  now?: () => number;
}

/** A provider or network failure, carrying the exact error the provider returned. */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly source: 'provider' | 'network',
    public readonly details: { status?: number; code?: string; raw?: unknown; http?: HttpExchange; latencyMs?: number } = {},
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

interface WireRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

interface Parsed {
  text: string;
  toolCalls: ToolCall[];
  usage: { inputTokens: number; outputTokens: number };
  stopReason?: string;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/* ---------------- OpenAI-compatible chat completions ---------------- */

function toOpenAIMessages(req: ModelRequest): unknown[] {
  const out: unknown[] = [];
  if (req.system) out.push({ role: 'system', content: req.system });
  for (const m of req.messages) {
    if (m.role === 'user') out.push({ role: 'user', content: m.content });
    else if (m.role === 'assistant') {
      const msg: Record<string, unknown> = { role: 'assistant', content: m.content || null };
      if (m.toolCalls?.length) {
        msg.tool_calls = m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments } }));
      }
      out.push(msg);
    } else out.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content });
  }
  return out;
}

export function buildOpenAIRequest(baseUrl: string, req: ModelRequest, apiKey: string | undefined, provider: ProviderId): WireRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  if (provider === 'openrouter') headers['x-title'] = 'Runtime Lab';
  const body: Record<string, unknown> = { model: req.model, messages: toOpenAIMessages(req) };
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description ?? '', parameters: t.parameters } }));
  }
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.maxTokens !== undefined) body[provider === 'openai' ? 'max_completion_tokens' : 'max_tokens'] = req.maxTokens;
  return { url: `${baseUrl}/chat/completions`, headers, body };
}

export function parseOpenAIResponse(json: unknown): Parsed {
  const j = json as {
    choices?: Array<{ message?: { content?: string | null; tool_calls?: Array<{ id: string; function?: { name?: string; arguments?: string } }> }; finish_reason?: string }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const choice = j.choices?.[0];
  if (!choice) throw new ProviderError('Provider response had no choices', 'provider', { raw: json });
  return {
    text: choice.message?.content ?? '',
    toolCalls: (choice.message?.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function?.name ?? '', arguments: c.function?.arguments ?? '' })),
    usage: { inputTokens: num(j.usage?.prompt_tokens), outputTokens: num(j.usage?.completion_tokens) },
    stopReason: choice.finish_reason,
  };
}

/* ---------------- Anthropic messages ---------------- */

function toAnthropicMessages(messages: ModelMessage[]): unknown[] {
  const out: Array<{ role: string; content: unknown }> = [];
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', content: m.content });
    else if (m.role === 'assistant') {
      const blocks: unknown[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const c of m.toolCalls ?? []) {
        let input: unknown;
        try {
          input = JSON.parse(c.arguments || '{}');
        } catch {
          input = {};
        }
        blocks.push({ type: 'tool_use', id: c.id, name: c.name, input });
      }
      out.push({ role: 'assistant', content: blocks });
    } else {
      const block = { type: 'tool_result', tool_use_id: m.toolCallId, content: m.content };
      const last = out[out.length - 1];
      // Consecutive tool results must share one user turn.
      if (last && last.role === 'user' && Array.isArray(last.content)) (last.content as unknown[]).push(block);
      else out.push({ role: 'user', content: [block] });
    }
  }
  return out;
}

export function buildAnthropicRequest(baseUrl: string, req: ModelRequest, apiKey: string | undefined): WireRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  if (apiKey) headers['x-api-key'] = apiKey;
  const body: Record<string, unknown> = {
    model: req.model,
    max_tokens: req.maxTokens ?? 1024,
    messages: toAnthropicMessages(req.messages),
  };
  if (req.system) body.system = req.system;
  if (req.tools?.length) body.tools = req.tools.map((t) => ({ name: t.name, description: t.description ?? '', input_schema: t.parameters }));
  if (req.temperature !== undefined) body.temperature = req.temperature;
  return { url: `${baseUrl}/messages`, headers, body };
}

export function parseAnthropicResponse(json: unknown): Parsed {
  const j = json as {
    content?: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
    usage?: { input_tokens?: number; output_tokens?: number };
    stop_reason?: string;
  };
  if (!Array.isArray(j.content)) throw new ProviderError('Provider response had no content array', 'provider', { raw: json });
  return {
    text: j.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join(''),
    toolCalls: j.content
      .filter((b) => b.type === 'tool_use')
      .map((b) => ({ id: b.id ?? '', name: b.name ?? '', arguments: JSON.stringify(b.input ?? {}) })),
    usage: { inputTokens: num(j.usage?.input_tokens), outputTokens: num(j.usage?.output_tokens) },
    stopReason: j.stop_reason,
  };
}

/* ---------------- Gemini generateContent ---------------- */

function toGeminiContents(messages: ModelMessage[]): unknown[] {
  const out: Array<{ role: string; parts: unknown[] }> = [];
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', parts: [{ text: m.content }] });
    else if (m.role === 'assistant') {
      const parts: unknown[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const c of m.toolCalls ?? []) {
        let args: unknown;
        try {
          args = JSON.parse(c.arguments || '{}');
        } catch {
          args = {};
        }
        parts.push({ functionCall: { name: c.name, args } });
      }
      out.push({ role: 'model', parts });
    } else {
      let response: unknown;
      try {
        response = JSON.parse(m.content);
      } catch {
        response = { result: m.content };
      }
      if (!response || typeof response !== 'object' || Array.isArray(response)) response = { result: response };
      const part = { functionResponse: { name: m.name, response } };
      const last = out[out.length - 1];
      if (last && last.role === 'user' && (last.parts[0] as { functionResponse?: unknown })?.functionResponse) last.parts.push(part);
      else out.push({ role: 'user', parts: [part] });
    }
  }
  return out;
}

export function buildGeminiRequest(baseUrl: string, req: ModelRequest, apiKey: string | undefined): WireRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (apiKey) headers['x-goog-api-key'] = apiKey;
  const body: Record<string, unknown> = { contents: toGeminiContents(req.messages) };
  if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };
  if (req.tools?.length) {
    body.tools = [{ functionDeclarations: req.tools.map((t) => ({ name: t.name, description: t.description ?? '', parameters: t.parameters })) }];
  }
  const gen: Record<string, unknown> = {};
  if (req.temperature !== undefined) gen.temperature = req.temperature;
  if (req.maxTokens !== undefined) gen.maxOutputTokens = req.maxTokens;
  if (Object.keys(gen).length) body.generationConfig = gen;
  return { url: `${baseUrl}/models/${encodeURIComponent(req.model)}:generateContent`, headers, body };
}

export function parseGeminiResponse(json: unknown): Parsed {
  const j = json as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string; functionCall?: { name?: string; args?: unknown } }> }; finishReason?: string }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const cand = j.candidates?.[0];
  if (!cand) throw new ProviderError('Provider response had no candidates', 'provider', { raw: json });
  const parts = cand.content?.parts ?? [];
  return {
    text: parts.map((p) => p.text ?? '').join(''),
    toolCalls: parts
      .filter((p) => p.functionCall)
      .map((p, i) => ({ id: `gemini-call-${i}`, name: p.functionCall?.name ?? '', arguments: JSON.stringify(p.functionCall?.args ?? {}) })),
    usage: { inputTokens: num(j.usageMetadata?.promptTokenCount), outputTokens: num(j.usageMetadata?.candidatesTokenCount) },
    stopReason: cand.finishReason,
  };
}

/* ---------------- Errors ---------------- */

/** Pulls the provider's own error message/code out of an error body, without rewording it. */
export function extractProviderError(body: unknown, status: number): { message: string; code?: string } {
  const b = body as { error?: { message?: string; type?: string; code?: string | number; status?: string } | string; message?: string };
  if (b && typeof b === 'object') {
    if (typeof b.error === 'object' && b.error) {
      const code = b.error.code ?? b.error.type ?? b.error.status;
      return { message: b.error.message ?? JSON.stringify(b.error), code: code === undefined ? undefined : String(code) };
    }
    if (typeof b.error === 'string') return { message: b.error };
    if (typeof b.message === 'string') return { message: b.message };
  }
  if (typeof body === 'string' && body) return { message: body };
  return { message: `HTTP ${status}` };
}

/* ---------------- Adapter factory ---------------- */

export function createAdapter(provider: ProviderId, opts: AdapterOptions): ProviderAdapter {
  const info = PROVIDERS[provider];
  const baseUrl = (opts.baseUrl ?? info.baseUrl).replace(/\/+$/, '');
  const now = opts.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  const secrets = opts.apiKey ? [opts.apiKey] : [];

  const build = (req: ModelRequest): WireRequest => {
    switch (info.protocol) {
      case 'anthropic-messages':
        return buildAnthropicRequest(baseUrl, req, opts.apiKey);
      case 'gemini-generate':
        return buildGeminiRequest(baseUrl, req, opts.apiKey);
      default:
        return buildOpenAIRequest(baseUrl, req, opts.apiKey, provider);
    }
  };
  const parse = (json: unknown): Parsed => {
    switch (info.protocol) {
      case 'anthropic-messages':
        return parseAnthropicResponse(json);
      case 'gemini-generate':
        return parseGeminiResponse(json);
      default:
        return parseOpenAIResponse(json);
    }
  };

  return {
    id: provider,
    async execute(req: ModelRequest): Promise<ModelResponse> {
      if (info.requiresKey && !opts.apiKey) throw new ProviderError(`No API key set for ${info.label}`, 'network');
      const wire = build(req);
      const http: HttpExchange = {
        request: { url: wire.url, method: 'POST', headers: redactHeaders(wire.headers), body: redactDeep(wire.body, secrets) },
      };
      const t0 = now();
      let res: Response;
      try {
        res = await opts.fetch(wire.url, { method: 'POST', headers: wire.headers, body: JSON.stringify(wire.body) });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new ProviderError(
          `Network error calling ${info.label}: ${msg}. In a browser this usually means CORS, an offline network, or a blocked host.`,
          'network',
          { http, latencyMs: now() - t0 },
        );
      }
      const textBody = await res.text();
      const latencyMs = now() - t0;
      let body: unknown = textBody;
      try {
        body = JSON.parse(textBody);
      } catch {
        /* keep text */
      }
      const safeBody = redactDeep(body, secrets);
      http.response = { status: res.status, body: safeBody };
      if (!res.ok) {
        const { message, code } = extractProviderError(safeBody, res.status);
        throw new ProviderError(message, 'provider', { status: res.status, code, raw: safeBody, http, latencyMs });
      }
      let parsed: Parsed;
      try {
        parsed = parse(body);
      } catch (e) {
        if (e instanceof ProviderError) throw new ProviderError(e.message, 'provider', { ...e.details, status: res.status, http, latencyMs });
        throw e;
      }
      return { ...parsed, latencyMs, http };
    },
  };
}
