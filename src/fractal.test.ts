import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { FAMILIES, FAMILY_LABELS, KINDS, KIND_FAMILY, KIND_LABELS, MAX_DEPTH, generate, geometry, type PatternParams } from './fractal.ts';

const base = { seed: 1, depth: 3, size: 120, strokeWidth: 1, precision: 1, color: '#336699', opacity: 0.5 } as const;
const params = (kind: PatternParams['kind'], over: Partial<PatternParams> = {}): PatternParams => ({ ...base, kind, ...over });
const pathD = (svg: string): string => /\sd="([^"]*)"/.exec(svg)?.[1] ?? '';

test('kinds, labels and depth caps', () => {
  assert.ok(KINDS.length >= 4);
  for (const kind of KINDS) {
    assert.equal(typeof KIND_LABELS[kind], 'string', kind);
    assert.ok(KIND_LABELS[kind].length > 0, kind);
    assert.ok(Number.isInteger(MAX_DEPTH[kind]) && MAX_DEPTH[kind] >= 1, kind);
  }
});

test('deterministic', () => {
  for (const kind of KINDS) {
    assert.equal(generate(params(kind)), generate(params(kind)), kind);
    assert.deepEqual(geometry(params(kind)), geometry(params(kind)), kind);
  }
});

test('seed matters', () => {
  for (const kind of KINDS) {
    assert.notEqual(generate(params(kind, { seed: 1 })), generate(params(kind, { seed: 2 })), kind);
  }
});

test('kinds differ', () => {
  const outs = KINDS.map((kind) => generate(params(kind)));
  for (let i = 0; i < KINDS.length; i++) {
    for (let j = i + 1; j < KINDS.length; j++) {
      assert.notEqual(outs[i], outs[j], `${KINDS[i]} vs ${KINDS[j]}`);
    }
  }
});

test('bounds', () => {
  for (const kind of KINDS) {
    for (let seed = 1; seed <= 20; seed++) {
      for (let depth = 1; depth <= MAX_DEPTH[kind]; depth++) {
        for (const poly of geometry({ kind, seed, depth, size: 120 })) {
          for (const [x, y] of poly) {
            const msg = `${kind} seed ${seed} depth ${depth}: (${x}, ${y})`;
            assert.ok(Number.isFinite(x) && Number.isFinite(y), msg);
            assert.ok(x >= -1e-9 && x <= 120 + 1e-9 && y >= -1e-9 && y <= 120 + 1e-9, msg);
          }
        }
      }
    }
  }
});

test('depth clamp', () => {
  for (const kind of KINDS) {
    assert.equal(generate(params(kind, { depth: 99 })), generate(params(kind, { depth: MAX_DEPTH[kind] })), kind);
    assert.equal(generate(params(kind, { depth: 0 })), generate(params(kind, { depth: 1 })), kind);
    assert.equal(generate(params(kind, { depth: -5 })), generate(params(kind, { depth: 1 })), kind);
    assert.equal(generate(params(kind, { depth: 2.9 })), generate(params(kind, { depth: 2 })), kind);
  }
});

test('size cap', () => {
  for (const kind of KINDS) {
    for (let seed = 1; seed <= 20; seed++) {
      const len = generate(params(kind, { seed, depth: MAX_DEPTH[kind] })).length;
      assert.ok(len <= 60000, `${kind} seed ${seed}: ${len}`);
    }
    const deep = generate(params(kind, { depth: MAX_DEPTH[kind] })).length;
    const shallow = generate(params(kind, { depth: 1 })).length;
    assert.ok(deep > shallow, `${kind}: ${deep} <= ${shallow}`);
  }
});

test('well-formed', () => {
  for (const kind of KINDS) {
    const svg = generate(params(kind));
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), kind);
    assert.ok(svg.endsWith('</svg>'), kind);
    assert.ok(svg.includes('viewBox="0 0 120 120"'), kind);
    assert.ok(svg.includes('#336699'), kind);
    assert.ok(!svg.includes('\n'), kind);
  }
});

test('precision', () => {
  for (const kind of KINDS) {
    const p0 = generate(params(kind, { precision: 0 }));
    const p2 = generate(params(kind, { precision: 2 }));
    assert.doesNotMatch(pathD(p0), /\d\.\d/, kind);
    assert.doesNotMatch(pathD(p2), /\.\d{3,}/, kind);
    assert.ok(pathD(p0).length > 0 && pathD(p2).length > 0, kind);
    assert.ok(p0.length <= p2.length, kind);
  }
});

test('non-empty at depth 1', () => {
  for (const kind of KINDS) {
    const g = geometry(params(kind, { depth: 1 }));
    assert.ok(g.some((poly) => poly.length >= 2), kind);
  }
});

test('source hygiene', () => {
  const dir = join(import.meta.dirname, 'patterns');
  const files = [join(import.meta.dirname, 'fractal.ts'), ...readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => join(dir, f))];
  assert.ok(files.length >= 4, files.join());
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    assert.ok(!src.includes('Math.random'), file);
    assert.ok(!src.includes('Date.now'), file);
  }
});

test('families', () => {
  assert.deepEqual([...FAMILIES], ['fractal', 'line', 'surface', 'symmetry']);
  for (const family of FAMILIES) assert.ok(typeof FAMILY_LABELS[family] === 'string' && FAMILY_LABELS[family].length > 0, family);
  assert.deepEqual(Object.keys(KIND_FAMILY).sort(), [...KINDS].sort());
  for (const kind of KINDS) assert.ok((FAMILIES as readonly string[]).includes(KIND_FAMILY[kind]), kind);
  for (const kind of ['carpet', 'quadtree', 'tree', 'fold', 'hilbert', 'koch', 'sierpinski', 'htree'] as const) assert.equal(KIND_FAMILY[kind], 'fractal', kind);
  for (const kind of ['stitch', 'whirl', 'rosette', 'spiral'] as const) assert.equal(KIND_FAMILY[kind], 'line', kind);
  for (const kind of ['brick', 'stack', 'herringbone', 'basket', 'hex', 'trinet', 'nested', 'dots', 'hatch', 'crosshatch', 'zigzag', 'scales', 'waves'] as const) assert.equal(KIND_FAMILY[kind], 'surface', kind);
});

test('all kinds are registered', () => {
  assert.equal(KINDS.length, 33);
  const ids = ['carpet', 'quadtree', 'tree', 'fold', 'hilbert', 'koch', 'sierpinski', 'htree', 'stitch', 'whirl', 'rosette', 'spiral', 'brick', 'stack', 'herringbone', 'basket', 'hex', 'trinet', 'nested', 'dots', 'hatch', 'crosshatch', 'zigzag', 'scales', 'waves', 'p1', 'p2', 'pm', 'pg', 'cm', 'pmm', 'pmg', 'pgg'];
  for (const id of ids) assert.ok((KINDS as readonly string[]).includes(id), id);
  for (const kind of ['p1', 'p2', 'pm', 'pg', 'cm', 'pmm', 'pmg', 'pgg'] as const) assert.equal(KIND_FAMILY[kind], 'symmetry', kind);
});

// Pins the four original kinds to their output before the pattern library split.
test('original kinds unchanged', () => {
  const sum = (s: string): number => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
    return h;
  };
  const expected = { carpet: [3545, 2456235446], quadtree: [479, 3337282164], tree: [296, 2527021275], fold: [305, 62992884] } as const;
  for (const [kind, [len, hash]] of Object.entries(expected)) {
    const svg = generate(params(kind as PatternParams['kind']));
    assert.deepEqual([svg.length, sum(svg)], [len, hash], kind);
  }
});
