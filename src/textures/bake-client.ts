// Main-thread entry for baked textures. Both modules load on first use, so the start JS does not grow.
import type { BakeArgs, BakeResult } from './bake.ts';

export async function requestBake(args: BakeArgs, slot = 'texture'): Promise<BakeResult> {
  const [{ heavy }, { bakeKey }] = await Promise.all([import('@/heavy/client.ts'), import('./bake.ts')]);
  // An AbortError (a newer bake in the same slot) propagates; callers ignore it.
  return heavy.run('bakeTexture', args, { key: bakeKey(args), slot });
}
