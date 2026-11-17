import { RuntimeLabDB, setDb } from '~/db';
import { initialDraft, useSessionStore } from '~/stores/session-store';
import { useTraceStore } from '~/stores/trace-store';

export const FAKE_KEY = 'sk-test-WEB-FAKE-KEY-abcdef123456';

let n = 0;
export async function freshDb() {
  const db = new RuntimeLabDB(`test-${Date.now()}-${n++}`);
  setDb(db);
  await db.open();
  useSessionStore.setState({ keys: {}, remembered: {}, draft: initialDraft(), running: false });
  useTraceStore.setState({ current: undefined, liveSteps: [], compare: [], lastError: undefined });
  return db;
}

export async function dumpDb(db: RuntimeLabDB, except: string[] = []) {
  const out: Record<string, unknown[]> = {};
  for (const t of db.tables) if (!except.includes(t.name)) out[t.name] = await t.toArray();
  return out;
}

/** Spy fetch that answers like OpenAI: first a tool call, then a final answer. */
export function spyFetch() {
  const urls: string[] = [];
  let i = 0;
  const fetch = async (url: string, _init?: RequestInit) => {
    urls.push(url);
    const body =
      i++ === 0
        ? { choices: [{ message: { content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'get_weather', arguments: '{"city":"Melbourne"}' } }] } }], usage: { prompt_tokens: 9, completion_tokens: 4 } }
        : { choices: [{ message: { content: `It is 21C. (echo: ${FAKE_KEY})` } }], usage: { prompt_tokens: 20, completion_tokens: 6 } };
    return new Response(JSON.stringify(body), { status: 200 });
  };
  return { fetch, urls };
}
