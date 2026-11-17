import type { ProviderId } from './types.js';

export type BrowserSupport = 'supported' | 'local-cors-required' | 'unsupported';

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  /** API base URL (no trailing slash). */
  baseUrl: string;
  /** Wire protocol the adapter speaks. */
  protocol: 'openai-chat' | 'anthropic-messages' | 'gemini-generate';
  browser: BrowserSupport;
  browserNote: string;
  /** Environment variable the CLI reads the key from. */
  keyEnv: string;
  requiresKey: boolean;
  /** Example model id, taken from the provider's public docs (verify before use). */
  exampleModel: string;
}

/**
 * CORS status was checked with an OPTIONS preflight from a foreign Origin on
 * 2026-11-18 (AEDT). Providers can change this at any time.
 */
export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    protocol: 'openai-chat',
    browser: 'supported',
    browserNote: 'Direct browser calls allowed (CORS preflight OK).',
    keyEnv: 'OPENAI_API_KEY',
    requiresKey: true,
    exampleModel: 'gpt-5-mini',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    protocol: 'anthropic-messages',
    browser: 'supported',
    browserNote: 'Requires the anthropic-dangerous-direct-browser-access header, which Runtime Lab sends.',
    keyEnv: 'ANTHROPIC_API_KEY',
    requiresKey: true,
    exampleModel: 'claude-haiku-5-5',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    protocol: 'openai-chat',
    browser: 'supported',
    browserNote: 'Direct browser calls allowed (CORS preflight OK).',
    keyEnv: 'OPENROUTER_API_KEY',
    requiresKey: true,
    exampleModel: 'openai/gpt-5-mini',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    protocol: 'openai-chat',
    browser: 'supported',
    browserNote: 'OpenAI-compatible endpoint; CORS preflight OK.',
    keyEnv: 'GROQ_API_KEY',
    requiresKey: true,
    exampleModel: 'llama-3.1-8b-instant',
  },
  mistral: {
    id: 'mistral',
    label: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    protocol: 'openai-chat',
    browser: 'supported',
    browserNote: 'OpenAI-compatible chat completions; CORS preflight OK.',
    keyEnv: 'MISTRAL_API_KEY',
    requiresKey: true,
    exampleModel: '',
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    protocol: 'gemini-generate',
    browser: 'supported',
    browserNote: 'generateContent with the x-goog-api-key header; CORS preflight OK.',
    keyEnv: 'GEMINI_API_KEY',
    requiresKey: true,
    exampleModel: '',
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (local)',
    baseUrl: 'http://localhost:11434/v1',
    protocol: 'openai-chat',
    browser: 'local-cors-required',
    browserNote:
      'Runs on your machine. The browser can only reach it if Ollama allows this page\'s origin (set OLLAMA_ORIGINS). No key needed.',
    keyEnv: 'OLLAMA_API_KEY',
    requiresKey: false,
    exampleModel: '',
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

/** Every origin the app may ever connect to. Used for the CSP and the fetch guard. */
export const ALLOWED_ORIGINS: readonly string[] = [
  'https://api.openai.com',
  'https://api.anthropic.com',
  'https://openrouter.ai',
  'https://api.groq.com',
  'https://api.mistral.ai',
  'https://generativelanguage.googleapis.com',
  'http://localhost:11434',
  'http://127.0.0.1:11434',
];

export function isProviderId(x: unknown): x is ProviderId {
  return typeof x === 'string' && x in PROVIDERS;
}
