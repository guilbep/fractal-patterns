// Client for the shared heavy worker: memo by key, one request in flight per slot,
// main-thread fallback when the worker cannot start or fails.
import { TASKS, type TaskArgs, type TaskName, type TaskResult } from './tasks.ts';

export type WorkerLike = {
  postMessage(m: unknown, transfer?: Transferable[]): void;
  onmessage: ((e: { data: any }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  terminate(): void;
};

type Pending = {
  task: TaskName;
  args: unknown;
  key: string | undefined;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
  dropped: boolean;
};

const abortError = () => Object.assign(new Error('superseded by a newer run in the same slot'), { name: 'AbortError' });

const defaultWorker = (): WorkerLike =>
  new Worker(new URL('./heavy.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;

export function createHeavyClient(opts: { makeWorker?: () => WorkerLike | null; memo?: number } = {}) {
  const makeWorker = opts.makeWorker ?? defaultWorker;
  const limit = opts.memo ?? 32;
  const memo = new Map<string, unknown>(); // insertion order = LRU order
  const pending = new Map<number, Pending>();
  const slots = new Map<string, number>();
  let worker: WorkerLike | null = null;
  let failed = false;
  let nextId = 1;

  const remember = (key: string, value: unknown) => {
    memo.delete(key);
    memo.set(key, value);
    if (memo.size > limit) memo.delete(memo.keys().next().value!);
  };

  const finish = (id: number, ok: boolean, value: unknown) => {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (ok && p.key !== undefined) remember(p.key, value);
    if (p.dropped) return;
    if (ok) p.resolve(value);
    else p.reject(value instanceof Error ? value : new Error(String(value)));
  };

  const onMain = (id: number) => {
    const p = pending.get(id)!;
    setTimeout(() => {
      (TASKS[p.task] as (a: unknown) => Promise<unknown>)(p.args).then(
        (r) => finish(id, true, r),
        (err) => finish(id, false, err),
      );
    }, 0);
  };

  const getWorker = () => {
    if (worker || failed) return worker;
    try {
      worker = makeWorker();
    } catch {
      worker = null;
    }
    if (!worker) {
      failed = true;
      return null;
    }
    worker.onmessage = (e) => finish(e.data.id, e.data.ok, e.data.ok ? e.data.result : new Error(e.data.error));
    worker.onerror = () => {
      // The worker is gone for good: rerun everything it held on the main thread.
      failed = true;
      worker?.terminate();
      worker = null;
      for (const id of pending.keys()) onMain(id);
    };
    return worker;
  };

  function run<N extends TaskName>(task: N, args: TaskArgs<N>, o: { key?: string; slot?: string } = {}): Promise<TaskResult<N>> {
    const id = nextId++;
    if (o.slot !== undefined) {
      const older = pending.get(slots.get(o.slot) ?? -1);
      if (older && !older.dropped) {
        older.dropped = true;
        older.reject(abortError());
      }
      slots.set(o.slot, id);
    }
    if (o.key !== undefined && memo.has(o.key)) {
      const hit = memo.get(o.key);
      remember(o.key, hit);
      return Promise.resolve(hit as TaskResult<N>);
    }
    return new Promise((resolve, reject) => {
      pending.set(id, { task, args, key: o.key, resolve: resolve as (v: unknown) => void, reject, dropped: false });
      const w = getWorker();
      if (w) w.postMessage({ id, task, args });
      else onMain(id);
    });
  }

  return { run };
}

// The shared client: the worker starts on the first run, never at page start.
export const heavy = createHeavyClient();
