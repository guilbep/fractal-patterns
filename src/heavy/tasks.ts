// Heavy tasks run by the shared worker (or on the main thread when it cannot start).
// Later entries `await import()` their pure module, so only the tasks used get loaded.
export const TASKS = {
  echo: async (args: { text: string; delayMs?: number }) => {
    if (args.delayMs) await new Promise((r) => setTimeout(r, args.delayMs));
    return { text: args.text };
  },
  farrisWheel: async (args: import('../patterns/farris-wheel-task.ts').WheelArgs) =>
    (await import('../patterns/farris-wheel-task.ts')).farrisWheel(args),
  // A grown kind's polylines (Turing stripes and spots, coral, frost): 50 to 170 ms on a desktop.
  growTile: async (args: { kind: import('../fractal.ts').Kind; seed: number; depth: number; size: number }) => {
    const [f, r, d] = await Promise.all([import('../fractal.ts'), import('../patterns/reaction.ts'), import('../patterns/dla.ts')]);
    f.useGrown(r, d);
    return f.geometry(args);
  },
  bakeTexture: async (args: import('../textures/bake.ts').BakeArgs) => (await import('../textures/bake.ts')).bakeTexture(args),
};

export type TaskName = keyof typeof TASKS;
export type TaskArgs<N extends TaskName> = Parameters<(typeof TASKS)[N]>[0];
export type TaskResult<N extends TaskName> = Awaited<ReturnType<(typeof TASKS)[N]>>;
