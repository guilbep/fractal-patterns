// The shared heavy worker: a task name and its args in, the result (or the error message) out.
import { TASKS, type TaskName } from './tasks.ts';

self.onmessage = async (e: MessageEvent<{ id: number; task: TaskName; args: never }>) => {
  const { id, task, args } = e.data;
  try {
    const result: unknown = await TASKS[task](args);
    const transfer = (result as { transfer?: Transferable[] } | null)?.transfer;
    self.postMessage({ id, ok: true, result }, { transfer: Array.isArray(transfer) ? transfer : [] });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
