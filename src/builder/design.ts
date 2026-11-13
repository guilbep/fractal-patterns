// The builder design as a studio: the builder draws and exports through the
// studio model, so it shares the seamless wrap and the repeat code. Also the
// pure edit operations and the validation of stored (untrusted) designs.
import { safePathData } from '../motifgrid.ts';
import { INK_MAX_LENGTH, studioSvg } from '../studio/model.ts';
import type { Placement, Studio, StudioLayer, StudioMotif } from '../studio/model.ts';
import type { Design, Item, Stamp, StampPart } from './types.ts';

interface Pair {
  owner: number;
  color: string;
  opacity: number;
  paint: StampPart['paint'];
  placement: Placement;
}

function pairs(d: Design): { motifs: StudioMotif[]; pairs: Pair[] } {
  const motifs: StudioMotif[] = [];
  const first: number[] = [];
  for (const s of d.stamps) {
    first.push(motifs.length);
    for (const p of s.parts)
      motifs.push({
        d: p.d,
        box: s.box,
        paint: p.paint,
        ...(p.evenodd ? { evenodd: true } : {}),
      });
  }
  const out: Pair[] = [];
  d.items.forEach((it, owner) => {
    const s = d.stamps[it.stamp];
    if (s === undefined) return;
    s.parts.forEach((p, k) =>
      out.push({
        owner,
        color: it.colors[k] ?? p.color,
        opacity: it.opacity,
        paint: p.paint,
        placement: {
          motif: (first[it.stamp] ?? 0) + k,
          x: it.x,
          y: it.y,
          scale: it.scale,
          rotate: it.rotate,
          flip: it.flip,
        },
      }),
    );
  });
  return { motifs, pairs: out };
}

/**
 * The design as a studio. Each (item, part) pair is one placement. With `merge`,
 * consecutive pairs with the same color, opacity and paint share a layer (paint is
 * in the key because a layer draws its fills before its strokes).
 */
export function toStudio(d: Design, merge = true): Studio {
  const { motifs, pairs: ps } = pairs(d);
  const layers: {
    color: string;
    opacity: number;
    strokeWidth: number;
    placements: Placement[];
    paint: string;
  }[] = [];
  for (const p of ps) {
    const last = layers[layers.length - 1];
    if (merge && last && last.color === p.color && last.opacity === p.opacity && last.paint === p.paint) last.placements.push(p.placement);
    else
      layers.push({
        color: p.color,
        opacity: p.opacity,
        strokeWidth: d.strokeWidth,
        placements: [p.placement],
        paint: p.paint,
      });
  }
  return {
    width: d.width,
    height: d.height,
    background: d.background,
    repeat: d.repeat,
    ...(d.overlap === 'down' ? { overlap: 'down' as const } : {}),
    motifs,
    layers: layers.map((l): StudioLayer => ({
      color: l.color,
      opacity: l.opacity,
      strokeWidth: l.strokeWidth,
      placements: l.placements,
    })),
  };
}

/** For toStudio(d, false): the item index (into d.items) of each layer. */
export function owners(d: Design): number[] {
  return pairs(d).pairs.map((p) => p.owner);
}

export function designSvg(d: Design, precision = 1): string {
  return studioSvg(toStudio(d), precision);
}

const mod = (a: number, m: number): number => ((a % m) + m) % m;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function fix(d: Design, it: Item): Item {
  return {
    ...it,
    x: mod(it.x, d.width),
    y: mod(it.y, d.height),
    scale: clamp(it.scale, 0.05, 20),
    opacity: clamp(it.opacity, 0, 1),
    rotate: mod(it.rotate, 360),
  };
}

const nextId = (d: Design): number => d.items.reduce((m, it) => Math.max(m, it.id), 0) + 1;

export function addItem(d: Design, stamp: number, x: number, y: number, patch: Partial<Item> = {}): Design {
  const it: Item = {
    id: nextId(d),
    stamp,
    x,
    y,
    scale: 1,
    rotate: 0,
    flip: false,
    opacity: 1,
    colors: [],
    ...patch,
  };
  return { ...d, items: [...d.items, fix(d, it)] };
}

export function updateItem(d: Design, id: number, patch: Partial<Omit<Item, 'id'>>): Design {
  const i = d.items.findIndex((it) => it.id === id);
  if (i < 0) return d;
  return {
    ...d,
    items: d.items.map((it, k) => (k === i ? fix(d, { ...it, ...patch }) : it)),
  };
}

export function moveBy(d: Design, id: number, dx: number, dy: number): Design {
  const it = d.items.find((t) => t.id === id);
  return it ? updateItem(d, id, { x: it.x + dx, y: it.y + dy }) : d;
}

export function removeItem(d: Design, id: number): Design {
  return d.items.some((it) => it.id === id) ? { ...d, items: d.items.filter((it) => it.id !== id) } : d;
}

/** A copy right above the original, moved by 10 percent of the tile. */
export function duplicateItem(d: Design, id: number): Design {
  const i = d.items.findIndex((it) => it.id === id);
  const it = d.items[i];
  if (it === undefined) return d;
  const copy = fix(d, {
    ...it,
    id: nextId(d),
    x: it.x + d.width / 10,
    y: it.y + d.height / 10,
  });
  return {
    ...d,
    items: [...d.items.slice(0, i + 1), copy, ...d.items.slice(i + 1)],
  };
}

export function reorder(d: Design, id: number, to: 'front' | 'back' | 'up' | 'down'): Design {
  const i = d.items.findIndex((it) => it.id === id);
  const it = d.items[i];
  if (it === undefined) return d;
  const last = d.items.length - 1;
  const j = clamp({ front: last, back: 0, up: i + 1, down: i - 1 }[to], 0, last);
  if (j === i) return d;
  const items = d.items.filter((_, k) => k !== i);
  items.splice(j, 0, it);
  return { ...d, items };
}

const pick = (d: Design, ids: readonly number[]): Set<number> => new Set(ids.filter((id) => d.items.some((it) => it.id === id)));

/** Apply `f` to each listed item (unknown ids are skipped); no known id gives the same design. */
function mapMany(d: Design, ids: readonly number[], f: (it: Item) => Partial<Omit<Item, 'id'>>): Design {
  const set = pick(d, ids);
  if (!set.size) return d;
  return { ...d, items: d.items.map((it) => (set.has(it.id) ? fix(d, { ...it, ...f(it) }) : it)) };
}

export function moveMany(d: Design, ids: readonly number[], dx: number, dy: number): Design {
  return mapMany(d, ids, (it) => ({ x: it.x + dx, y: it.y + dy }));
}

export function updateMany(
  d: Design,
  ids: readonly number[],
  patch: Partial<Omit<Item, 'id'>> | ((it: Item) => Partial<Omit<Item, 'id'>>),
): Design {
  return mapMany(d, ids, typeof patch === 'function' ? patch : () => patch);
}

export function removeMany(d: Design, ids: readonly number[]): Design {
  const set = pick(d, ids);
  return set.size ? { ...d, items: d.items.filter((it) => !set.has(it.id)) } : d;
}

/** A copy right above each original, moved by 10 percent of the tile, and the new ids in the order of `ids`. */
export function duplicateMany(d: Design, ids: readonly number[]): { design: Design; ids: number[] } {
  const set = pick(d, ids);
  if (!set.size) return { design: d, ids: [] };
  let id = nextId(d);
  const copyOf = new Map<number, number>();
  const items: Item[] = [];
  for (const it of d.items) {
    items.push(it);
    if (!set.has(it.id)) continue;
    copyOf.set(it.id, id);
    items.push(fix(d, { ...it, id: id++, x: it.x + d.width / 10, y: it.y + d.height / 10 }));
  }
  return { design: { ...d, items }, ids: ids.filter((k) => copyOf.has(k)).map((k) => copyOf.get(k)!) };
}

/** Move the listed items together, keeping their relative order. Up and down move each by one place where it can. */
export function reorderMany(d: Design, ids: readonly number[], to: 'front' | 'back' | 'up' | 'down'): Design {
  const set = pick(d, ids);
  if (!set.size) return d;
  let items: Item[];
  if (to === 'front' || to === 'back') {
    const moved = d.items.filter((it) => set.has(it.id));
    const rest = d.items.filter((it) => !set.has(it.id));
    items = to === 'front' ? [...rest, ...moved] : [...moved, ...rest];
  } else {
    // Swap each selected item with an unselected neighbor, scanning from the side it moves toward.
    items = [...d.items];
    const up = to === 'up';
    for (let k = up ? items.length - 2 : 1; up ? k >= 0 : k < items.length; k += up ? -1 : 1) {
      const j = up ? k + 1 : k - 1;
      if (set.has(items[k]!.id) && !set.has(items[j]!.id)) [items[k], items[j]] = [items[j]!, items[k]!];
    }
  }
  return items.every((it, k) => it === d.items[k]) ? d : { ...d, items };
}

const COLOR = /^#[0-9a-fA-F]{6}$/;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function parsePart(v: unknown): StampPart | null {
  if (!isObj(v) || typeof v.d !== 'string' || (v.paint !== 'fill' && v.paint !== 'stroke')) return null;
  if (typeof v.color !== 'string' || !COLOR.test(v.color)) return null;
  const evenodd = v.evenodd === true;
  const d = safePathData(v.d, evenodd ? INK_MAX_LENGTH : undefined);
  if (d === null) return null;
  return { d, paint: v.paint, ...(evenodd ? { evenodd } : {}), color: v.color };
}

function parseStamp(v: unknown): Stamp | null {
  if (!isObj(v) || typeof v.name !== 'string' || !fin(v.box) || v.box <= 0 || !Array.isArray(v.parts)) return null;
  const parts = v.parts.map(parsePart);
  if (parts.some((p) => p === null)) return null;
  return { name: v.name.slice(0, 60), box: v.box, parts: parts as StampPart[] };
}

function parseItem(v: unknown): Item | null {
  if (!isObj(v) || !Array.isArray(v.colors) || typeof v.flip !== 'boolean') return null;
  const { id, stamp, x, y, scale, rotate, opacity } = v;
  if (![id, stamp, x, y, scale, rotate, opacity].every(fin)) return null;
  if (!v.colors.every((c) => typeof c === 'string' && COLOR.test(c))) return null;
  return {
    id,
    stamp,
    x,
    y,
    scale,
    rotate,
    flip: v.flip,
    opacity,
    colors: [...v.colors],
  } as Item;
}

/**
 * Validates an untrusted stored design. Any invalid field gives null, including a
 * stamp part with unsafe path data: the whole design is rejected, not repaired.
 * Only an item whose stamp index is out of range is dropped, and duplicate ids are
 * renumbered 1..n.
 */
export function parseDesign(value: unknown): Design | null {
  if (!isObj(value) || !Array.isArray(value.stamps) || !Array.isArray(value.items)) return null;
  const { width, height, background, repeat, strokeWidth } = value;
  if (!fin(width) || !fin(height) || width < 16 || width > 2000 || height < 16 || height > 2000) return null;
  if (background !== null && (typeof background !== 'string' || !COLOR.test(background))) return null;
  if (repeat !== 'straight' && repeat !== 'half-drop' && repeat !== 'brick') return null;
  if (!fin(strokeWidth) || strokeWidth < 0 || strokeWidth > 50) return null;
  if (value.stamps.length > 200 || value.items.length > 2000) return null;
  const stamps = value.stamps.map(parseStamp);
  if (stamps.some((s) => s === null)) return null;
  const parsed = value.items.map(parseItem);
  if (parsed.some((it) => it === null)) return null;
  const d: Design = {
    width,
    height,
    background,
    repeat,
    strokeWidth,
    stamps: stamps as Stamp[],
    items: [],
    // A missing or unknown value is plain list order: the key stays missing.
    ...(value.overlap === 'down' ? { overlap: 'down' as const } : {}),
  };
  let items = (parsed as Item[])
    .filter((it) => Number.isInteger(it.stamp) && it.stamp >= 0 && it.stamp < stamps.length)
    .map((it) => fix(d, it));
  if (new Set(items.map((it) => it.id)).size !== items.length) items = items.map((it, k) => ({ ...it, id: k + 1 }));
  return { ...d, items };
}
