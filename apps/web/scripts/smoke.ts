/**
 * Browser smoke test of the BUILT static site with its real CSP, in Chrome.
 * Checks pages render, there are no CSP violations or console errors, and
 * the only network requests are to the site itself. Needs a local Chrome:
 * set CHROME_PATH or install google-chrome.
 */
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { serve } from './serve.ts';

const root = fileURLToPath(new URL('../dist/client', import.meta.url));
const port = 4317;
const base = `http://127.0.0.1:${port}`;
const server = await serve(root, port);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
const problems: string[] = [];
const requests: string[] = [];
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('request', (r) => requests.push(r.url()));

async function check(path: string, text: RegExp) {
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.getByText(text).first().waitFor({ timeout: 10_000 });
  console.log(`ok  ${path}  (${text})`);
}

try {
  await check('/', /Your AI Worked\. But Do You Know Why\?/);
  await check('/sample', /This is an example trace/);
  await page.getByRole('button', { name: 'Play demo' }).waitFor();
  await page.getByRole('link', { name: /Try this setup in the Lab \(needs your API key\)/ }).waitFor();
  await page.getByRole('tab', { name: 'Metrics' }).click();
  await page.getByText('Latency per step (ms)').waitFor();
  await page.getByRole('tab', { name: 'Graph' }).click();
  await page.locator('.react-flow__node').first().waitFor();
  console.log('ok  /sample metrics + graph tabs');
  await page.getByRole('tab', { name: 'Timeline' }).click();
  const beforePlay = requests.length;
  await page.getByRole('button', { name: 'Play demo' }).click();
  await page.getByText('Run started').first().waitFor();
  await page.getByText(/hand-written example replay/).waitFor();
  await page.getByRole('button', { name: 'Pause' }).waitFor();
  await page.getByRole('button', { name: 'Replay' }).waitFor();
  await page.getByText('Model turn 3').waitFor({ timeout: 10_000 });
  await page.getByText(/Finished the hand-written example replay/).waitFor();
  const playForeign = requests.slice(beforePlay).filter((u) => !u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:'));
  if (playForeign.length) problems.push(...playForeign.map((u) => `play demo unexpected request: ${u}`));
  else console.log('ok  /sample Play demo replay, no off-origin requests');
  await check('/lab', /No Trace Yet/);
  // Run without a key: must fail as a traced error, with no request leaving the page.
  await page.getByRole('button', { name: /Run and trace/ }).click();
  await page.getByText(/No API key set for OpenAI/).first().waitFor({ timeout: 10_000 });
  console.log('ok  /lab run without key -> traced error');

  // Full traced run against an intercepted OpenAI endpoint (no real key, no real call).
  // The request still has to pass the page's CSP to reach the interceptor.
  const FAKE = 'sk-test-SMOKE-FAKE-KEY-0000000000';
  let call = 0;
  let sawAuth = '';
  await page.route('https://api.openai.com/**', async (route) => {
    sawAuth = route.request().headers()['authorization'] ?? '';
    const body =
      call++ === 0
        ? { choices: [{ message: { content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'get_weather', arguments: '{"city":"Melbourne"}' } }] } }], usage: { prompt_tokens: 40, completion_tokens: 12 } }
        : { choices: [{ message: { content: 'It is 21C and cloudy in Melbourne.' } }], usage: { prompt_tokens: 80, completion_tokens: 10 } };
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  });
  await page.getByLabel(/OpenAI API key/).fill(FAKE);
  await page.getByRole('button', { name: /Run and trace/ }).click();
  await page.getByText('It is 21C and cloudy in Melbourne.').first().waitFor({ timeout: 10_000 });
  if (sawAuth !== `Bearer ${FAKE}`) problems.push('provider did not receive the key from the browser');
  const stored = await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    const dump: unknown[] = [];
    for (const { name } of dbs) {
      if (!name) continue;
      const db: IDBDatabase = await new Promise((res, rej) => {
        const r = indexedDB.open(name);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      for (const store of Array.from(db.objectStoreNames)) {
        const all: unknown[] = await new Promise((res) => {
          const q = db.transaction(store).objectStore(store).getAll();
          q.onsuccess = () => res(q.result);
        });
        dump.push({ store, all });
      }
      db.close();
    }
    return JSON.stringify(dump) + JSON.stringify(localStorage) + JSON.stringify(sessionStorage);
  });
  if (stored.includes(FAKE)) problems.push('API key found in browser storage');
  if (!stored.includes('It is 21C')) problems.push('run was not saved to IndexedDB');
  console.log('ok  /lab traced run with tool call via intercepted provider; key not in IndexedDB/localStorage');
  // Inline-script CSP check: try to fetch a foreign host from the page; CSP must block it.
  const blocked = await page.evaluate(async () => {
    try {
      await fetch('https://example.com/');
      return false;
    } catch {
      return true;
    }
  });
  if (!blocked) problems.push('CSP did not block fetch to https://example.com');
  else console.log('ok  CSP blocks fetch to a non-provider host');
  await check('/about', /About the creator/);
  await check('/settings', /Price table/);
} finally {
  await browser.close();
  server.close();
}

const foreign = requests.filter((u) => !u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:') && u !== 'https://example.com/' && !u.startsWith('https://api.openai.com/'));
const relevant = problems.filter((p) => !p.includes('example.com'));
if (foreign.length) relevant.push(...foreign.map((u) => `unexpected request: ${u}`));
if (relevant.length) {
  console.error(relevant.join('\n'));
  process.exit(1);
}
console.log(`smoke: passed, ${requests.length} requests, all same-origin or to the provider API`);
