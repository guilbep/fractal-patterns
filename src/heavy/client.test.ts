import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeavyClient, type WorkerLike } from './client.ts';
import { TASKS } from './tasks.ts';

// A fake worker that answers echo asynchronously; text 'boom' fails the task, text 'crash' fires onerror.
function fakeWorker() {
  const w = {
    posts: 0,
    terminated: false,
    onmessage: null as WorkerLike['onmessage'],
    onerror: null as WorkerLike['onerror'],
    postMessage(m: unknown) {
      w.posts++;
      const { id, args } = m as { id: number; args: { text: string } };
      setTimeout(async () => {
        if (args.text === 'crash') return w.onerror?.(new Error('worker died'));
        if (args.text === 'boom') return w.onmessage?.({ data: { id, ok: false, error: 'boom failed' } });
        w.onmessage?.({ data: { id, ok: true, result: await TASKS.echo(args) } });
      }, 1);
    },
    terminate() {
      w.terminated = true;
    },
  };
  return w;
}

test('run resolves with the worker result', async () => {
  const w = fakeWorker();
  const c = createHeavyClient({ makeWorker: () => w });
  assert.deepEqual(await c.run('echo', { text: 'hi' }), { text: 'hi' });
  assert.equal(w.posts, 1);
});

test('a memo hit resolves without posting again', async () => {
  const w = fakeWorker();
  const c = createHeavyClient({ makeWorker: () => w });
  await c.run('echo', { text: 'a' }, { key: 'k' });
  assert.deepEqual(await c.run('echo', { text: 'other' }, { key: 'k' }), { text: 'a' });
  assert.equal(w.posts, 1);
});

test('the memo evicts the least recently used key past its limit', async () => {
  const w = fakeWorker();
  const c = createHeavyClient({ makeWorker: () => w, memo: 2 });
  await c.run('echo', { text: '1' }, { key: '1' });
  await c.run('echo', { text: '2' }, { key: '2' });
  await c.run('echo', { text: '3' }, { key: '3' });
  assert.equal(w.posts, 3);
  await c.run('echo', { text: '3' }, { key: '3' });
  await c.run('echo', { text: '2' }, { key: '2' });
  assert.equal(w.posts, 3);
  await c.run('echo', { text: '1' }, { key: '1' });
  assert.equal(w.posts, 4);
});

test('a newer run in the same slot aborts the older one, whose result is still memoised', async () => {
  const w = fakeWorker();
  const c = createHeavyClient({ makeWorker: () => w });
  const first = c.run('echo', { text: 'old' }, { slot: 's', key: 'old' });
  const second = c.run('echo', { text: 'new' }, { slot: 's' });
  await assert.rejects(first, { name: 'AbortError' });
  assert.deepEqual(await second, { text: 'new' });
  assert.deepEqual(await c.run('echo', { text: 'x' }, { key: 'old' }), { text: 'old' });
  assert.equal(w.posts, 2);
});

test('a worker error falls back to the main thread', async () => {
  const w = fakeWorker();
  const c = createHeavyClient({ makeWorker: () => w });
  assert.deepEqual(await c.run('echo', { text: 'crash' }), { text: 'crash' });
  assert.ok(w.terminated);
  assert.deepEqual(await c.run('echo', { text: 'after' }), { text: 'after' });
  assert.equal(w.posts, 1);
});

test('no worker (null or throwing) runs on the main thread', async () => {
  const none = createHeavyClient({ makeWorker: () => null });
  assert.deepEqual(await none.run('echo', { text: 'n', delayMs: 2 }), { text: 'n' });
  const throws = createHeavyClient({
    makeWorker: () => {
      throw new Error('no workers here');
    },
  });
  assert.deepEqual(await throws.run('echo', { text: 't' }), { text: 't' });
});

test('a task error rejects with its message', async () => {
  const c = createHeavyClient({ makeWorker: () => fakeWorker() });
  await assert.rejects(c.run('echo', { text: 'boom' }), { message: 'boom failed' });
});
