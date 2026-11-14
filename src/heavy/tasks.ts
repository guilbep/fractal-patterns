// Heavy tasks run by the shared worker (or on the main thread when it cannot start).
// Later entries `await import()` their pure module, so only the tasks used get loaded.
export const TASKS = {
  echo: async (args: { text: string; delayMs?: number }) => {
    if (args.delayMs) await new Promise((r) => setTimeout(r, args.delayMs));
    return { text: args.text };
  },
};

export type TaskName = keyof typeof TASKS;
export type TaskArgs<N extends TaskName> = Parameters<(typeof TASKS)[N]>[0];
export type TaskResult<N extends TaskName> = Awaited<ReturnType<(typeof TASKS)[N]>>;
