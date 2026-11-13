import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  FAMILIES,
  FAMILY_LABELS,
  KINDS,
  KIND_FAMILY,
  KIND_LABELS,
  MAX_DEPTH,
  generate,
  geometry,
  hasCompat,
  tileAspect,
  type Kind,
  type PatternParams,
} from './fractal.ts';
import { PENROSE_ASPECT } from './penrose.ts';

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
      // The Penrose kinds are allowed more: the owner accepts a heavy tile there (the page shows its bytes), so
      // their cap is 125000, measured worst 118102 for 'penroseboth' depth 4 at size 120.
      // The same holds for the 8-fold quasicrystal kinds at depth 3, size 120, seeds 1 to 20:
      // measured worst 93016 for 'octa' (seed 18) and 100040 for 'octastars' (seed 14).
      const cap = tileAspect(kind) !== 1 ? 125000 : kind === 'octa' ? 95000 : kind === 'octastars' ? 105000 : 60000;
      assert.ok(len <= cap, `${kind} seed ${seed}: ${len}`);
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
    const h = Math.round((120 / tileAspect(kind)) * 1000) / 1000;
    assert.ok(svg.includes(`viewBox="0 0 120 ${h}"`), kind);
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
    assert.ok(
      g.some((poly) => poly.length >= 2),
      kind,
    );
  }
});

test('source hygiene', () => {
  const dir = join(import.meta.dirname, 'patterns');
  const files = [
    join(import.meta.dirname, 'fractal.ts'),
    ...readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => join(dir, f)),
  ];
  assert.ok(files.length >= 4, files.join());
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    assert.ok(!src.includes('Math.random'), file);
    assert.ok(!src.includes('Date.now'), file);
  }
});

test('families', () => {
  assert.deepEqual([...FAMILIES], ['fractal', 'line', 'surface', 'symmetry', 'theme', 'quasi']);
  assert.equal(FAMILY_LABELS.quasi, 'Quasicrystals');
  for (const kind of ['penrose', 'penrosearcs', 'penroseboth', 'octa', 'octastars', 'dodeca', 'dodecastars'] as const)
    assert.equal(KIND_FAMILY[kind], 'quasi', kind);
  for (const kind of [
    'topo',
    'maze',
    'circuit',
    'seigaiha',
    'rain',
    'ridges',
    'stars',
    'roots',
    'cracks',
    'knot',
    'roof',
    'feathers',
    'chain',
    'pipes',
    'chladni',
  ] as const)
    assert.equal(KIND_FAMILY[kind], 'theme', kind);
  for (const family of FAMILIES) assert.ok(typeof FAMILY_LABELS[family] === 'string' && FAMILY_LABELS[family].length > 0, family);
  assert.deepEqual(Object.keys(KIND_FAMILY).sort(), [...KINDS].sort());
  for (const kind of KINDS) assert.ok((FAMILIES as readonly string[]).includes(KIND_FAMILY[kind]), kind);
  for (const kind of ['carpet', 'quadtree', 'tree', 'fold', 'hilbert', 'koch', 'sierpinski', 'htree'] as const)
    assert.equal(KIND_FAMILY[kind], 'fractal', kind);
  for (const kind of ['stitch', 'whirl', 'rosette', 'spiral'] as const) assert.equal(KIND_FAMILY[kind], 'line', kind);
  for (const kind of [
    'brick',
    'stack',
    'herringbone',
    'basket',
    'hex',
    'trinet',
    'nested',
    'dots',
    'hatch',
    'crosshatch',
    'zigzag',
    'scales',
    'waves',
  ] as const)
    assert.equal(KIND_FAMILY[kind], 'surface', kind);
});

test('all kinds are registered', () => {
  assert.equal(KINDS.length, 59);
  const ids = [
    'carpet',
    'quadtree',
    'tree',
    'fold',
    'hilbert',
    'koch',
    'sierpinski',
    'htree',
    'stitch',
    'whirl',
    'rosette',
    'spiral',
    'brick',
    'stack',
    'herringbone',
    'basket',
    'hex',
    'trinet',
    'nested',
    'dots',
    'hatch',
    'crosshatch',
    'zigzag',
    'scales',
    'waves',
    'p1',
    'p2',
    'pm',
    'pg',
    'cm',
    'pmm',
    'pmg',
    'pgg',
    'cmm',
    'p4',
    'p4m',
    'p4g',
    'topo',
    'maze',
    'circuit',
    'seigaiha',
    'rain',
    'ridges',
    'stars',
    'roots',
    'cracks',
    'knot',
    'roof',
    'feathers',
    'chain',
    'pipes',
    'penrose',
    'penrosearcs',
    'penroseboth',
    'chladni',
    'octa',
    'octastars',
    'dodeca',
    'dodecastars',
  ];
  for (const id of ids) assert.ok((KINDS as readonly string[]).includes(id), id);
  for (const kind of ['p1', 'p2', 'pm', 'pg', 'cm', 'pmm', 'pmg', 'pgg', 'cmm', 'p4', 'p4m', 'p4g'] as const)
    assert.equal(KIND_FAMILY[kind], 'symmetry', kind);
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

// Seeds 1 and 7, each at depth 2 (clamped) and at MAX_DEPTH: [length, checksum].
const PINS: Readonly<Record<PatternParams['kind'], readonly (readonly [number, number])[]>> = {
  carpet: [
    [874, 1091373014],
    [3545, 2456235446],
    [484, 1749858001],
    [2509, 3686315158],
  ],
  quadtree: [
    [282, 821261076],
    [4998, 1927372122],
    [262, 677269668],
    [430, 2891877244],
  ],
  tree: [
    [243, 2759250437],
    [13258, 1110468707],
    [242, 2986816077],
    [13305, 3885085056],
  ],
  fold: [
    [255, 859194244],
    [13490, 1394362823],
    [237, 539457672],
    [13460, 465871762],
  ],
  hilbert: [
    [285, 1441681784],
    [5826, 3066421812],
    [358, 4002436554],
    [10319, 3253935492],
  ],
  koch: [
    [524, 3192583770],
    [1231, 2081181765],
    [518, 177311602],
    [1211, 2146396944],
  ],
  sierpinski: [
    [355, 3101839787],
    [4223, 1435662919],
    [340, 536439190],
    [4584, 735749703],
  ],
  htree: [
    [256, 2855005465],
    [4926, 2934235049],
    [264, 1156273364],
    [5066, 2152603343],
  ],
  stitch: [
    [1282, 3962283576],
    [2702, 1849762768],
    [591, 3555996101],
    [1015, 1620058513],
  ],
  whirl: [
    [753, 3292977095],
    [3395, 2426671349],
    [523, 3373288469],
    [1771, 1504161561],
  ],
  rosette: [
    [4280, 3507761752],
    [9145, 2788744015],
    [4049, 487085929],
    [8629, 1953945536],
  ],
  spiral: [
    [3622, 2042200279],
    [13448, 3394452757],
    [4857, 3367794274],
    [8424, 4179179945],
  ],
  brick: [
    [658, 1111932418],
    [6118, 3122607304],
    [704, 3774701392],
    [7010, 378196599],
  ],
  stack: [
    [568, 3999388396],
    [4791, 3639399134],
    [866, 153160848],
    [8691, 2729466668],
  ],
  herringbone: [
    [1567, 2763474623],
    [2823, 630801951],
    [1049, 3069674589],
    [1945, 2620668206],
  ],
  basket: [
    [1696, 2090924171],
    [3262, 3345833484],
    [1238, 331737724],
    [2276, 3631796526],
  ],
  hex: [
    [2111, 2457886277],
    [2811, 4136593986],
    [1887, 2868040303],
    [2486, 3855734519],
  ],
  trinet: [
    [2243, 579129321],
    [4400, 1298066207],
    [1960, 4135657664],
    [4254, 3993952],
  ],
  nested: [
    [702, 1087911635],
    [1172, 1792881661],
    [569, 650995318],
    [798, 3938390938],
  ],
  dots: [
    [2639, 368532610],
    [4727, 2694248735],
    [3804, 3946067864],
    [6628, 3034688270],
  ],
  hatch: [
    [332, 3359891743],
    [976, 2560707260],
    [597, 2419500769],
    [1779, 792063604],
  ],
  crosshatch: [
    [523, 1821356251],
    [2834, 1502489897],
    [640, 1787895535],
    [3074, 676658575],
  ],
  zigzag: [
    [701, 2896323915],
    [1475, 1129473197],
    [1122, 2541840131],
    [3324, 2203222442],
  ],
  scales: [
    [11956, 2482303660],
    [14704, 1522490746],
    [12791, 2797531321],
    [15685, 2535948349],
  ],
  waves: [
    [2385, 4115393438],
    [4771, 1445524103],
    [2032, 416921061],
    [4364, 180453329],
  ],
  p1: [
    [7397, 3420060759],
    [9463, 2294214907],
    [5401, 843269521],
    [7393, 2348458863],
  ],
  p2: [
    [8463, 95702153],
    [10625, 2973491401],
    [6381, 1183845255],
    [8297, 3916630907],
  ],
  pm: [
    [8459, 1282395639],
    [10623, 3528554657],
    [6363, 2200293795],
    [8287, 449444487],
  ],
  pg: [
    [8509, 630227315],
    [10675, 3205263135],
    [6528, 3431220392],
    [8452, 971403078],
  ],
  cm: [
    [7327, 2386546380],
    [9389, 2853552554],
    [5356, 940755251],
    [7342, 552660063],
  ],
  pmm: [
    [7317, 73583947],
    [9375, 2626953579],
    [5295, 3024464575],
    [7273, 22520375],
  ],
  pmg: [
    [7696, 3674283244],
    [9827, 1429494830],
    [5512, 1031989620],
    [7557, 730637328],
  ],
  pgg: [
    [7324, 654972624],
    [9383, 3868193251],
    [5359, 662830349],
    [7341, 1137800333],
  ],
  cmm: [
    [10249, 720509025],
    [10249, 720509025],
    [8479, 2071005017],
    [8479, 2071005017],
  ],
  p4: [
    [7317, 286067429],
    [9375, 871280595],
    [5295, 122568817],
    [7273, 3187394487],
  ],
  p4m: [
    [10247, 2005882999],
    [10247, 2005882999],
    [8479, 3127315267],
    [8479, 3127315267],
  ],
  p4g: [
    [10249, 2125458137],
    [10249, 2125458137],
    [8479, 947140447],
    [8479, 947140447],
  ],
  topo: [
    [3011, 3861823989],
    [5462, 3817255663],
    [2616, 1655201297],
    [4929, 1197861658],
  ],
  maze: [
    [659, 2619462757],
    [4310, 832085665],
    [701, 3220551635],
    [4190, 4240096149],
  ],
  circuit: [
    [1462, 3145945702],
    [3393, 275250863],
    [1596, 1451272234],
    [3173, 4257413840],
  ],
  seigaiha: [
    [4358, 1341764974],
    [5400, 3142934253],
    [3727, 3589165545],
    [4403, 222214902],
  ],
  rain: [
    [1305, 425290469],
    [2602, 2487345899],
    [1061, 3908686537],
    [2289, 467214959],
  ],
  ridges: [
    [927, 2684168796],
    [1371, 509724153],
    [856, 983763702],
    [1269, 2490662448],
  ],
  stars: [
    [1977, 1751550229],
    [3884, 3549015369],
    [1855, 204746269],
    [3778, 1349270411],
  ],
  roots: [
    [1334, 3005360599],
    [2331, 2696580939],
    [956, 100405250],
    [2282, 646059734],
  ],
  cracks: [
    [2174, 1333504645],
    [3160, 1032476330],
    [2153, 3394787634],
    [3292, 3727290274],
  ],
  knot: [
    [989, 2397143373],
    [3297, 3102048544],
    [877, 1436506350],
    [2610, 1900145100],
  ],
  roof: [
    [1193, 1761430929],
    [3486, 2021280794],
    [1463, 1561041351],
    [4382, 2062858093],
  ],
  feathers: [
    [3085, 3321380633],
    [3991, 3969648057],
    [3037, 2689398739],
    [3889, 1593919680],
  ],
  chain: [
    [2471, 4293182795],
    [4930, 363413214],
    [3218, 3413979123],
    [7137, 3186133837],
  ],
  pipes: [
    [3558, 3952300901],
    [12629, 641918205],
    [3208, 3436706001],
    [12147, 2126258508],
  ],
  penrose: [
    [3891, 2504793203],
    [23607, 943003851],
    [3852, 4200862368],
    [23246, 1796574155],
  ],
  penrosearcs: [
    [14880, 723624810],
    [94698, 1400798053],
    [14771, 286776405],
    [94829, 2890536417],
  ],
  penroseboth: [
    [18568, 2102647298],
    [118102, 3289418917],
    [18420, 3219815402],
    [117872, 966209441],
  ],
  chladni: [
    [1303, 672125876],
    [2780, 1541374676],
    [1182, 3482209262],
    [3697, 3866082923],
  ],
  octa: [
    [16032, 4137623251],
    [92618, 3584427911],
    [16238, 2630596331],
    [92824, 22219930],
  ],
  octastars: [
    [17709, 3347306865],
    [100004, 2537374824],
    [17268, 3074400373],
    [99263, 845989535],
  ],
  dodeca: [
    [13859, 2051765636],
    [25161, 1491003487],
    [14057, 2554691103],
    [25301, 1548947765],
  ],
  dodecastars: [
    [14535, 1457518766],
    [26832, 1440312088],
    [15005, 3140798711],
    [27456, 966033677],
  ],
};

// The compatible layouts (compat: true) of the kinds that have one.
const COMPAT_KINDS = ['brick', 'stack', 'herringbone', 'basket', 'hex', 'trinet', 'nested'] as const;
const COMPAT_PINS: Readonly<Record<(typeof COMPAT_KINDS)[number], readonly (readonly [number, number])[]>> = {
  brick: [
    [686, 3427296643],
    [6379, 758282201],
    [686, 3427296643],
    [6976, 3870900975],
  ],
  stack: [
    [867, 3005474261],
    [8429, 1499612667],
    [886, 3069893280],
    [9149, 884229329],
  ],
  herringbone: [
    [1414, 1710378433],
    [3420, 3217173535],
    [1368, 3107162782],
    [3290, 3034217418],
  ],
  basket: [
    [1696, 259194953],
    [3268, 1305786576],
    [1696, 3218181801],
    [3266, 2906136156],
  ],
  hex: [
    [2239, 1052858778],
    [3949, 3868869938],
    [2144, 944034512],
    [2792, 3033650510],
  ],
  trinet: [
    [2180, 3728487575],
    [4768, 3918578613],
    [2068, 455262175],
    [4384, 2535150605],
  ],
  nested: [
    [763, 2190743378],
    [1360, 584054202],
    [763, 2190743378],
    [1282, 331006696],
  ],
};

test('every kind is pinned', () => {
  const sum = (s: string): number => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
    return h;
  };
  const pins = (kind: Kind, compat: boolean) =>
    [1, 7]
      .flatMap((seed) => [2, MAX_DEPTH[kind]].map((depth) => generate(params(kind, { seed, depth, compat }))))
      .map((s) => [s.length, sum(s)]);
  for (const kind of KINDS) assert.deepEqual(pins(kind, false), PINS[kind], kind);
  for (const kind of COMPAT_KINDS) assert.deepEqual(pins(kind, true), COMPAT_PINS[kind], `${kind} compat`);
});

test('hasCompat holds for exactly the seven compatible kinds; for the others compat changes nothing', () => {
  assert.deepEqual(KINDS.filter(hasCompat), [...COMPAT_KINDS]);
  for (const kind of ['tree', 'dots'] as const)
    for (const depth of [1, 2, 3]) assert.equal(generate(params(kind, { depth, compat: true })), generate(params(kind, { depth })), kind);
});

test('the free and the compatible layouts differ at depth 3, seed 1', () => {
  for (const kind of COMPAT_KINDS)
    assert.notEqual(generate(params(kind, { seed: 1, depth: 3, compat: true })), generate(params(kind, { seed: 1, depth: 3 })), kind);
});

// Distinct outputs over seeds 1..12 at depth 2, measured. The free mode does NOT give at least as
// many for stack and basket: distinct strings count small details, not layout variety.
test('distinct outputs over seeds 1..12 at depth 2, free and compatible', () => {
  const distinct = (kind: Kind, compat: boolean) =>
    new Set(Array.from({ length: 12 }, (_, i) => generate(params(kind, { seed: i + 1, depth: 2, compat })))).size;
  const rows = COMPAT_KINDS.map((kind) => [kind, distinct(kind, false), distinct(kind, true)]);
  assert.deepEqual(rows, [
    ['brick', 11, 11],
    ['stack', 8, 12],
    ['herringbone', 12, 12],
    ['basket', 11, 12],
    ['hex', 12, 12],
    ['trinet', 12, 12],
    ['nested', 12, 5],
  ]);
});

const PENROSE_KINDS = ['penrose', 'penrosearcs', 'penroseboth'] as const;

test('tileAspect: 1 for every square kind, PENROSE_ASPECT for the three Penrose kinds', () => {
  for (const kind of KINDS) assert.equal(tileAspect(kind), (PENROSE_KINDS as readonly string[]).includes(kind) ? PENROSE_ASPECT : 1, kind);
});

test('generate for a Penrose kind: an SVG of size by size / aspect, viewBox to match', () => {
  for (const kind of PENROSE_KINDS)
    for (const size of [120, 240]) {
      const h = Math.round((size / PENROSE_ASPECT) * 1000) / 1000;
      assert.ok(
        generate(params(kind, { size })).startsWith(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${h}" viewBox="0 0 ${size} ${h}">`,
        ),
        kind,
      );
    }
});

test('Penrose rhombs at depth 2: every whole edge segment has one length (one uniform scale)', () => {
  const lens = geometry({ kind: 'penrose', seed: 1, depth: 2, size: 240 })
    .filter((p) => p.length === 2)
    .map(([p, q]) => Math.hypot(q![0] - p![0], q![1] - p![1]));
  const max = Math.max(...lens);
  // Segments cut by the tile border are shorter; the whole ones are most of them.
  const whole = lens.filter((l) => l > max - 1e-3);
  assert.ok(whole.length > lens.length / 2);
  for (const l of whole) assert.ok(Math.abs(l - max) < 1e-6, `${l} vs ${max}`);
});
