import { describe, expect, it } from 'vitest';
import { decodeShareFragment, encodeShareLink, exportRunJson } from '@runtime-lab/core';
import { loadRememberedKeys, rememberKey, saveExperiment, saveRun, updateRunNotes } from '~/db/repo';
import { runDraft } from '~/services/trace-engine';
import { currentSecrets, useSessionStore } from '~/stores/session-store';
import { FAKE_KEY, dumpDb, freshDb, spyFetch } from './helpers';

describe('API keys never reach IndexedDB or share links', () => {
  it('a run with a key in memory stores no trace of the key', async () => {
    const db = await freshDb();
    useSessionStore.getState().setKey('openai', FAKE_KEY);
    // Put the key into the prompt too, and the fake provider echoes it back.
    useSessionStore.getState().setDraft({ prompt: `debug: my key is ${FAKE_KEY}` });
    const run = await runDraft(spyFetch().fetch);
    expect(run).toBeDefined();
    const everything = JSON.stringify(await dumpDb(db));
    expect(everything).not.toContain(FAKE_KEY);
    expect(everything).not.toContain('sk-test-WEB');
    expect(await db.apiKeys.count()).toBe(0);
  });

  it('only the explicit opt-in writes a key, and only to the apiKeys table', async () => {
    const db = await freshDb();
    await rememberKey('openai', FAKE_KEY);
    useSessionStore.getState().setKey('openai', FAKE_KEY);
    await runDraft(spyFetch().fetch);
    expect((await loadRememberedKeys()).map((k) => k.provider)).toEqual(['openai']);
    expect(JSON.stringify(await dumpDb(db, ['apiKeys']))).not.toContain(FAKE_KEY);
  });

  it('saveRun scrubs in-memory keys even if a caller passes a dirty run', async () => {
    const db = await freshDb();
    useSessionStore.getState().setKey('anthropic', 'custom-key-without-known-prefix-999');
    const { SAMPLE_RUN } = await import('@runtime-lab/core');
    await saveRun({ ...SAMPLE_RUN, id: 'dirty', notes: 'custom-key-without-known-prefix-999' }, currentSecrets());
    expect(JSON.stringify(await dumpDb(db))).not.toContain('custom-key-without-known-prefix-999');
  });

  it('saved run notes scrub in-memory keys', async () => {
    const db = await freshDb();
    useSessionStore.getState().setKey('anthropic', 'custom-key-without-known-prefix-999');
    const { SAMPLE_RUN } = await import('@runtime-lab/core');
    await saveRun({ ...SAMPLE_RUN, id: 'notes' });
    await updateRunNotes('notes', 'A note with custom-key-without-known-prefix-999', currentSecrets());
    expect(JSON.stringify(await dumpDb(db))).not.toContain('custom-key-without-known-prefix-999');
  });

  it('redacts experiment fields and history before persistence', async () => {
    const db = await freshDb();
    const secret = 'custom-experiment-key-without-prefix-321';
    useSessionStore.getState().setKey('anthropic', secret);
    await saveExperiment({ title: secret, hypothesis: `hypothesis ${secret}`, notes: `notes ${secret}` }, currentSecrets());
    expect(JSON.stringify(await dumpDb(db))).not.toContain(secret);
  });

  it('redacts keys captured when a run starts even if the current key changes', async () => {
    const db = await freshDb();
    const originalKey = 'custom-inflight-key-without-prefix-876';
    useSessionStore.getState().setKey('openai', originalKey);
    useSessionStore.getState().setDraft({ toolsJson: '[]', prompt: `prompt includes ${originalKey}` });
    let respond!: (response: Response) => void;
    let notifyFetch!: () => void;
    const fetched = new Promise<void>((resolve) => {
      notifyFetch = resolve;
    });
    const fetch = async () => {
      notifyFetch();
      return new Promise<Response>((resolve) => {
        respond = resolve;
      });
    };
    const pending = runDraft(fetch);
    await fetched;
    useSessionStore.getState().setKey('openai', 'replacement-key');
    respond(new Response(JSON.stringify({ choices: [{ message: { content: 'done' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } })));
    await pending;
    expect(JSON.stringify(await dumpDb(db))).not.toContain(originalKey);
  });

  it('share links and JSON exports never contain the key', async () => {
    await freshDb();
    useSessionStore.getState().setKey('openai', FAKE_KEY);
    useSessionStore.getState().setDraft({ prompt: `debug ${FAKE_KEY}` });
    const run = (await runDraft(spyFetch().fetch))!;
    const link = encodeShareLink(run, 'https://lab.example/share', { secrets: currentSecrets(), includeSystemPrompt: true, includeRawPayloads: true });
    expect(link).not.toContain(FAKE_KEY);
    expect(JSON.stringify(decodeShareFragment(new URL(link).hash))).not.toContain(FAKE_KEY);
    expect(exportRunJson(run, { secrets: currentSecrets() })).not.toContain(FAKE_KEY);
  });
});
