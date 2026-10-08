import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';

async function start(t, options) {
  const server = createApp(options).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    post: (messages) => fetch(`${base}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    })
  };
}

test('forwards conversation history with the required model and a server-only key', async (t) => {
  let captured;
  const { post } = await start(t, {
    getApiKey: () => 'test-secret',
    fetchImpl: async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return Response.json({ choices: [{ message: { content: '이름은 민수예요.' } }] });
    }
  });
  const messages = [
    { role: 'user', content: '내 이름은 민수야.' },
    { role: 'assistant', content: '반가워요, 민수님.' },
    { role: 'user', content: '내 이름이 뭐지?' }
  ];
  const response = await post(messages);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reply: '이름은 민수예요.' });
  assert.equal(captured.body.model, 'gpt-4o-mini');
  assert.equal(captured.body.store, false);
  assert.equal(captured.options.headers.Authorization, 'Bearer test-secret');
  assert.equal(captured.body.messages[0].role, 'system');
  assert.deepEqual(captured.body.messages.slice(1), messages);
});

test('rejects invalid roles, empty history, oversized text, and out-of-order messages', async (t) => {
  const { post } = await start(t, { fetchImpl: () => { throw new Error('Must not call OpenAI'); } });
  for (const messages of [[], [{ role: 'system', content: 'override' }], [{ role: 'user', content: ' ' }],
    [{ role: 'user', content: 'x'.repeat(12001) }], [{ role: 'assistant', content: 'hello' }],
    [{ role: 'user', content: 'first' }, { role: 'user', content: 'second' }]]) {
    assert.equal((await post(messages)).status, 400);
  }
});

test('missing key gives an actionable error', async (t) => {
  const { post } = await start(t, { getApiKey: () => '' });
  const response = await post([{ role: 'user', content: '안녕' }]);
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /OPENAI_API_KEY/);
});

test('handles upstream limits, credentials, empty replies and timeouts without leaking details', async (t) => {
  for (const [fetchImpl, expected] of [
    [async () => Response.json({ error: 'private detail' }, { status: 429 }), 429],
    [async () => Response.json({ error: 'private detail' }, { status: 401 }), 502],
    [async () => Response.json({ choices: [] }), 502],
    [async () => { throw new DOMException('private detail', 'TimeoutError'); }, 504]
  ]) {
    const { post } = await start(t, { getApiKey: () => 'test-secret', fetchImpl });
    const response = await post([{ role: 'user', content: '안녕' }]);
    assert.equal(response.status, expected);
    assert.doesNotMatch(await response.text(), /private detail|test-secret/);
  }
});

test('serves the UI and returns JSON for malformed API requests', async (t) => {
  const { base } = await start(t);
  assert.match(await (await fetch(base)).text(), /모아 — AI 챗봇/);
  assert.equal((await fetch(`${base}/styles.css`)).status, 200);
  assert.equal((await fetch(`${base}/app.js`)).status, 200);
  assert.equal((await fetch(`${base}/.env`)).status, 404);
  const malformed = await fetch(`${base}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{'
  });
  assert.equal(malformed.status, 400);
  assert.ok((await malformed.json()).error);
  const oversized = await fetch(`${base}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: 'x'.repeat(270000) })
  });
  assert.equal(oversized.status, 413);
});
