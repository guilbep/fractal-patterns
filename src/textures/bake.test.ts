import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type BakeArgs, type BakeKind, bakeKey, bakePixels } from './bake.ts';
import { ROUTES, TEXTURE_KINDS } from '../texture.ts';

const KINDS: BakeKind[] = ['paper', 'coldpress', 'linen', 'plaster', 'sand', 'riso', 'washi', 'kraft'];
const BASE: BakeArgs = {
  kind: 'paper',
  seed: 1,
  scale: 1,
  strength: 40,
  tone: 'dark',
  background: '#f4efe6',
  colors: ['#1d3557', '#e63946'],
  n: 32,
};

test('bakePixels dispatches every kind, n*n*4 long and deterministic', () => {
  for (const kind of KINDS) {
    const a = bakePixels({ ...BASE, kind });
    assert.equal(a.length, 32 * 32 * 4, kind);
    assert.deepEqual(a, bakePixels({ ...BASE, kind }), kind);
  }
  assert.notDeepEqual(bakePixels(BASE), bakePixels({ ...BASE, kind: 'washi' }));
});

test('bakeKey is equal for equal inputs and differs when any input differs', () => {
  assert.equal(bakeKey(BASE), bakeKey({ ...BASE, colors: [...BASE.colors] }));
  const changes: Partial<BakeArgs>[] = [
    { kind: 'linen' },
    { seed: 2 },
    { scale: 1.25 },
    { strength: 41 },
    { tone: 'light' },
    { background: '#ffffff' },
    { colors: ['#1d3557'] },
    { n: 64 },
    { quality: 0.9 },
  ];
  for (const c of changes) assert.notEqual(bakeKey({ ...BASE, ...c }), bakeKey(BASE), JSON.stringify(c));
});

test('ROUTES agrees: kinds with a baked route bake, the others are refused', () => {
  for (const kind of TEXTURE_KINDS) {
    const bake = () => bakePixels({ ...BASE, kind: kind as BakeKind });
    if (ROUTES[kind].includes('baked')) assert.equal(bake().length, 32 * 32 * 4, kind);
    else assert.throws(bake, /cannot bake/, kind);
  }
  for (const kind of ['terrazzo', 'stipple', 'grain'] as const) assert.ok(!ROUTES[kind].includes('baked'));
});
